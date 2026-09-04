import path from 'node:path';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const VALUES = new Set(['healthy','missing','corrupt']);

export function assertDeliveryIntegrityValue(value) {
  if (!VALUES.has(value)) throw new Error('delivery_integrity must be healthy, missing, or corrupt');
  return value;
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

export async function computeDeliveryIntegrity({ store, db, runId, manifestValidator, replayValidator }) {
  if (!store?.root) throw new Error('artifact store is required');
  if (!db || typeof db.prepare !== 'function') throw new Error('database handle is required');
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('runId is required');
  if (typeof manifestValidator !== 'function') throw new Error('manifestValidator is required');
  if (typeof replayValidator !== 'function') throw new Error('replayValidator is required');

  const decision = db.prepare('select run_id,decision,change_package_artifact_id,change_package_sha256 from review_decisions where run_id=?').get(runId);
  if (!decision || decision.decision !== 'accept') return null;
  const checkedAt = new Date().toISOString();

  if (typeof decision.change_package_artifact_id !== 'string' || decision.change_package_artifact_id.length === 0) {
    return { value:'missing', reasonCodes:['DECISION_PACKAGE_REF_MISSING'], checkedAt };
  }

  const row = db.prepare('select id,run_id,type,content_location,sha256,size,sealed_at from artifacts where id=?').get(decision.change_package_artifact_id);
  if (!row) return { value:'missing', reasonCodes:['ARTIFACT_ROW_MISSING'], checkedAt };

  const objectPath = path.resolve(store.root, row.content_location);
  if (!inside(store.root, objectPath)) return { value:'corrupt', reasonCodes:['TYPE_OR_RUN_MISMATCH'], checkedAt };
  let bytes;
  try { bytes = await readFile(objectPath); }
  catch { return { value:'missing', reasonCodes:['OBJECT_MISSING_OR_UNREADABLE'], checkedAt }; }

  const reasons = [];
  if (row.run_id !== runId || row.type !== 'change_package') reasons.push('TYPE_OR_RUN_MISMATCH');
  if (typeof row.sealed_at !== 'string' || row.sealed_at.length === 0) reasons.push('UNSEALED');
  if (bytes.length !== row.size) reasons.push('SIZE_MISMATCH');
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== row.sha256 || decision.change_package_sha256 !== row.sha256) reasons.push('HASH_MISMATCH');

  let manifestOk = false;
  try { manifestOk = await manifestValidator(bytes, { ...row }); } catch {}
  if (manifestOk !== true) reasons.push('MANIFEST_INVALID');

  if (manifestOk === true) {
    let replayOk = false;
    try { replayOk = await replayValidator(bytes, { ...row }); } catch {}
    if (replayOk !== true) reasons.push('REPLAY_TREE_MISMATCH');
  }

  if (reasons.length > 0) return { value:'corrupt', reasonCodes:[...new Set(reasons)], checkedAt };
  return { value:'healthy', reasonCodes:[], checkedAt };
}
