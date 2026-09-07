import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rm, link } from 'node:fs/promises';
import { withImmediateTransaction } from './artifact-db.mjs';

const REQUIRED_TYPES = new Set(['agent_log', 'diff', 'verification_result', 'change_package']);
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

function assertId(value, label) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Error(`${label} must contain only letters, digits, dot, underscore or hyphen`);
}

function callFault(fault, point, context = {}) {
  if (fault === undefined) return;
  if (typeof fault !== 'function') throw new Error('fault must be a function');
  const result = fault(point, context);
  if (result && typeof result.then === 'function') throw new Error('fault hook must be synchronous');
}

function bufferOf(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (typeof bytes === 'string' || bytes instanceof Uint8Array) return Buffer.from(bytes);
  throw new Error('bytes must be a Buffer, Uint8Array, or string');
}

async function hashFile(filePath) {
  const bytes = await readFile(filePath);
  return { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

function relativePortable(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

export async function createArtifactStore(root) {
  if (typeof root !== 'string' || root.length === 0) throw new Error('store root is required');
  const resolved = path.resolve(root);
  const stagingRoot = path.join(resolved, 'staging');
  const objectsRoot = path.join(resolved, 'objects');
  await mkdir(stagingRoot, { recursive: true });
  await mkdir(objectsRoot, { recursive: true });
  return { root: resolved, stagingRoot, objectsRoot };
}

async function finalizeNoOverwrite(stagingPath, finalPath, expected) {
  await mkdir(path.dirname(finalPath), { recursive: true });
  try {
    await link(stagingPath, finalPath);
    await rm(stagingPath);
    return { reused: false };
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const actual = await hashFile(finalPath).catch(() => null);
    if (!actual || actual.size !== expected.size || actual.sha256 !== expected.sha256) {
      throw new Error(`content-addressed object mismatch at ${finalPath}`);
    }
    await rm(stagingPath, { force: true });
    return { reused: true };
  }
}

export async function sealArtifact(options) {
  if (!options || typeof options !== 'object') throw new Error('seal options are required');
  const { store, db } = options;
  if (!store?.root || !store?.stagingRoot || !store?.objectsRoot) throw new Error('artifact store is required');
  if (!db || typeof db.prepare !== 'function') throw new Error('database handle is required');
  assertId(options.runId, 'runId');
  assertId(options.artifactId, 'artifactId');
  if (!REQUIRED_TYPES.has(options.type)) throw new Error('unsupported artifact type');
  if (options.producerStopped !== true) throw new Error('producer must be stopped before sealing');
  if (options.outputDrained !== true) throw new Error('output must be drained before sealing');
  if (!db.prepare('select id from runs where id=?').get(options.runId)) throw new Error(`run does not exist: ${options.runId}`);

  const bytes = bufferOf(options.bytes);
  const runStaging = path.join(store.stagingRoot, options.runId);
  await mkdir(runStaging, { recursive: true });
  const stagingPath = path.join(runStaging, `${options.artifactId}.tmp`);

  const handle = await open(stagingPath, 'w');
  try {
    await handle.writeFile(bytes);
    callFault(options.fault, 'after_staging_write', { stagingPath });
    await handle.sync();
  } finally {
    await handle.close();
  }
  callFault(options.fault, 'after_flush_close', { stagingPath });

  const sealed = await hashFile(stagingPath);
  callFault(options.fault, 'after_hash', { stagingPath, ...sealed });

  const finalPath = path.join(store.objectsRoot, sealed.sha256.slice(0, 2), sealed.sha256);
  const finalize = await finalizeNoOverwrite(stagingPath, finalPath, sealed);
  const contentLocation = relativePortable(store.root, finalPath);
  callFault(options.fault, 'after_finalize', { finalPath, contentLocation, reused: finalize.reused, ...sealed });

  const sealedAt = new Date().toISOString();
  withImmediateTransaction(db, () => {
    db.prepare('insert into artifacts(id,run_id,type,content_location,sha256,size,sealed_at) values(?,?,?,?,?,?,?)')
      .run(options.artifactId, options.runId, options.type, contentLocation, sealed.sha256, sealed.size, sealedAt);
    callFault(options.fault, 'after_artifact_row', { artifactId: options.artifactId });

    const eventSequence = db.prepare('select coalesce(max(sequence),0)+1 next_sequence from events where run_id=?').get(options.runId).next_sequence;
    db.prepare('insert into events(run_id,sequence,type,payload_json) values(?,?,?,?)')
      .run(options.runId, eventSequence, 'artifact.created', JSON.stringify({ artifactId: options.artifactId, type: options.type, size: sealed.size, sha256: sealed.sha256 }));
    callFault(options.fault, 'after_event', { sequence: eventSequence });

    if (options.transition) {
      if (typeof options.transition.phase !== 'string' || typeof options.transition.state !== 'string') throw new Error('transition requires phase and state');
      db.prepare('update runs set phase=?, state=? where id=?').run(options.transition.phase, options.transition.state, options.runId);
    }
    callFault(options.fault, 'before_commit', { transition: options.transition ?? null });
  });

  return {
    artifactId: options.artifactId,
    runId: options.runId,
    type: options.type,
    contentLocation,
    size: sealed.size,
    sha256: sealed.sha256,
    sealedAt,
    objectReused: finalize.reused
  };
}
