import path from 'node:path';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

const REQUIRED = ['agent_log','diff','verification_result','change_package'];
const LABEL = {
  agent_log: 'AGENT_LOG',
  diff: 'DIFF',
  verification_result: 'VERIFICATION_RESULT',
  change_package: 'CHANGE_PACKAGE'
};

async function listFiles(root) {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes:true }); } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(root);
  return out;
}

function inside(root, target) {
  const rel = path.relative(root, target);
  return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

async function verifyArtifactRow(store, row) {
  const target = path.resolve(store.root, row.content_location);
  const base = { id:row.id, runId:row.run_id, type:row.type, contentLocation:row.content_location, sha256:row.sha256, size:row.size };
  if (!inside(store.root, target)) return { ...base, status:'corrupt', reasonCodes:['CONTENT_LOCATION_INVALID'] };
  let bytes;
  try { bytes = await readFile(target); } catch {
    return { ...base, status:'missing', reasonCodes:['OBJECT_MISSING_OR_UNREADABLE'] };
  }
  const reasons = [];
  if (bytes.length !== row.size) reasons.push('SIZE_MISMATCH');
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== row.sha256) reasons.push('HASH_MISMATCH');
  return { ...base, status:reasons.length ? 'corrupt':'healthy', reasonCodes:reasons, actualSize:bytes.length, actualSha256:actualHash };
}

export async function reconcileArtifacts({ store, db, runId }) {
  if (!store?.root || !store?.stagingRoot || !store?.objectsRoot) throw new Error('artifact store is required');
  if (!db || typeof db.prepare !== 'function') throw new Error('database handle is required');
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('runId is required');
  const runRow = db.prepare('select id,phase,state from runs where id=?').get(runId);
  if (!runRow) throw new Error(`run does not exist: ${runId}`);
  const rows = db.prepare('select id,run_id,type,content_location,sha256,size,sealed_at from artifacts where run_id=? order by id').all(runId);
  const artifacts = [];
  for (const row of rows) artifacts.push(await verifyArtifactRow(store, row));

  const tempFiles = await listFiles(path.join(store.stagingRoot, runId));
  const temps = tempFiles.map(file => path.relative(store.root, file).split(path.sep).join('/')).sort();

  const allRows = db.prepare('select content_location from artifacts').all();
  const referenced = new Set(allRows.map(row => row.content_location));
  const objectFiles = await listFiles(store.objectsRoot);
  const orphans = objectFiles
    .map(file => path.relative(store.root, file).split(path.sep).join('/'))
    .filter(location => !referenced.has(location))
    .sort();

  return {
    run: { id:runRow.id, phase:runRow.phase, state:runRow.state },
    artifacts,
    temps,
    orphans
  };
}

export function evaluateReviewReadiness(reconciliation) {
  if (!reconciliation || !Array.isArray(reconciliation.artifacts)) throw new Error('reconciliation result is required');
  const reasonCodes = [];
  for (const type of REQUIRED) {
    const all = reconciliation.artifacts.filter(item => item.type === type);
    const healthy = all.filter(item => item.status === 'healthy');
    if (type === 'change_package') {
      if (healthy.length === 0) reasonCodes.push(all.length === 0 ? 'CHANGE_PACKAGE_MISSING' : 'CHANGE_PACKAGE_INVALID');
      else if (healthy.length !== 1) reasonCodes.push('CHANGE_PACKAGE_NOT_UNIQUE');
    } else if (healthy.length === 0) {
      reasonCodes.push(all.length === 0 ? `${LABEL[type]}_MISSING` : `${LABEL[type]}_INVALID`);
    }
  }
  return { ready: reasonCodes.length === 0, reasonCodes };
}

export function validateReviewDecisionReference({ db, reconciliation, runId }) {
  if (!db || typeof db.prepare !== 'function') throw new Error('database handle is required');
  if (!reconciliation || !Array.isArray(reconciliation.artifacts)) throw new Error('reconciliation result is required');
  const decision = db.prepare('select run_id,decision,change_package_artifact_id,change_package_sha256 from review_decisions where run_id=?').get(runId);
  if (!decision) return { valid:true, status:'not_reviewed', reasonCodes:[] };
  const reasons = [];
  const artifact = reconciliation.artifacts.find(item => item.id === decision.change_package_artifact_id);
  if (!artifact) reasons.push('DECISION_PACKAGE_REF_MISSING');
  else {
    if (artifact.runId !== runId || artifact.type !== 'change_package') reasons.push('DECISION_PACKAGE_TYPE_OR_RUN_MISMATCH');
    if (artifact.status !== 'healthy') reasons.push('DECISION_PACKAGE_INVALID');
    if (decision.change_package_sha256 !== artifact.sha256) reasons.push('DECISION_PACKAGE_HASH_MISMATCH');
  }
  return { valid:reasons.length === 0, status:'reviewed', decision:decision.decision, reasonCodes:reasons };
}
