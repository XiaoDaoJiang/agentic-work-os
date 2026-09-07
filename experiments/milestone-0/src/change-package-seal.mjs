import { changePackageSha256, validateChangePackageBytes } from './change-package.mjs';
import { sealArtifact } from './artifact-store.mjs';

const EVIDENCE_TYPES = ['agent_log', 'diff', 'verification_result'];

function existingPackage(db, runId) {
  const rows = db.prepare("select id,run_id,type,content_location,sha256,size,sealed_at from artifacts where run_id=? and type='change_package' order by id").all(runId);
  if (rows.length > 1) throw new Error(`run ${runId} already has multiple Change Packages`);
  return rows[0] ?? null;
}

function reviewDecision(db, runId) {
  return db.prepare('select run_id,decision,change_package_artifact_id,change_package_sha256 from review_decisions where run_id=?').get(runId) ?? null;
}

function assertEvidenceBindings(db, runId, manifest) {
  for (const type of EVIDENCE_TYPES) {
    const ref = manifest.evidence[type];
    const row = db.prepare('select id,run_id,type,sha256,sealed_at from artifacts where id=?').get(ref.artifact_id);
    if (!row || row.run_id !== runId || row.type !== type || typeof row.sealed_at !== 'string' || row.sealed_at.length === 0) {
      throw new Error(`missing sealed prerequisite ${type}`);
    }
    if (row.sha256 !== ref.sha256) throw new Error(`sealed prerequisite ${type} does not match package evidence`);
  }
}

export async function sealUniqueChangePackage({ db, store, runId, artifactId, packageBytes }) {
  if (!db || typeof db.prepare !== 'function') throw new Error('database handle is required');
  if (!store?.root) throw new Error('artifact store is required');
  if (typeof runId !== 'string' || runId.length === 0) throw new Error('runId is required');
  if (typeof artifactId !== 'string' || artifactId.length === 0) throw new Error('artifactId is required');
  const bytes = Buffer.isBuffer(packageBytes) ? packageBytes : Buffer.from(packageBytes);
  const packageSha256 = changePackageSha256(bytes);

  if (reviewDecision(db, runId)) throw new Error(`ReviewDecision already exists for run ${runId}; Change Package reseal is prohibited`);

  const existing = existingPackage(db, runId);
  if (existing) {
    if (existing.sha256 !== packageSha256) throw new Error(`existing Change Package for run ${runId} has different bytes`);
    return {
      artifactId: existing.id,
      runId: existing.run_id,
      type: existing.type,
      contentLocation: existing.content_location,
      size: existing.size,
      sha256: existing.sha256,
      sealedAt: existing.sealed_at,
      idempotent: true
    };
  }

  const manifest = validateChangePackageBytes(bytes);
  assertEvidenceBindings(db, runId, manifest);
  const sealed = await sealArtifact({
    store,
    db,
    runId,
    artifactId,
    type: 'change_package',
    bytes,
    producerStopped: true,
    outputDrained: true
  });
  if (sealed.sha256 !== packageSha256) throw new Error('sealed Change Package hash does not match package bytes');
  return { ...sealed, idempotent: false };
}
