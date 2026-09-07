import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import { openArtifactExperimentDb } from '../src/artifact-db.mjs';
import { createArtifactStore, sealArtifact } from '../src/artifact-store.mjs';
import { reconcileArtifacts, evaluateReviewReadiness, validateReviewDecisionReference } from '../src/artifact-reconciliation.mjs';

async function setup(state = 'running') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-reconcile-'));
  const store = await createArtifactStore(path.join(root, 'store'));
  const db = openArtifactExperimentDb(path.join(root, 'state.sqlite'));
  db.prepare('insert into runs(id,phase,state) values(?,?,?)').run('run-1','test',state);
  return { root, store, db };
}
async function seal(store, db, id, type, bytes = `${type}-${id}`) { return sealArtifact({ store, db, runId:'run-1', artifactId:id, type, bytes, producerStopped:true, outputDrained:true }); }
async function sealRequired(store, db) {
  return {
    log: await seal(store,db,'log-1','agent_log'),
    diff: await seal(store,db,'diff-1','diff'),
    verification: await seal(store,db,'verify-1','verification_result'),
    package: await seal(store,db,'pkg-1','change_package')
  };
}

test('F-07 row with missing object is classified missing and blocks Review', async () => {
  const { store, db } = await setup(); const required = await sealRequired(store, db);
  await rm(path.join(store.root, required.diff.contentLocation));
  const rec = await reconcileArtifacts({ store, db, runId:'run-1' });
  const diff = rec.artifacts.find(a => a.id === 'diff-1');
  assert.equal(diff.status, 'missing'); assert.ok(diff.reasonCodes.includes('OBJECT_MISSING_OR_UNREADABLE'));
  assert.equal(evaluateReviewReadiness(rec).ready, false); db.close();
});

test('F-07 size/hash mismatch is classified corrupt and blocks Review', async () => {
  const { store, db } = await setup(); const required = await sealRequired(store, db);
  await writeFile(path.join(store.root, required.verification.contentLocation), 'tampered', 'utf8');
  const rec = await reconcileArtifacts({ store, db, runId:'run-1' });
  const item = rec.artifacts.find(a => a.id === 'verify-1');
  assert.equal(item.status, 'corrupt'); assert.equal(item.reasonCodes.some(code => ['SIZE_MISMATCH','HASH_MISMATCH'].includes(code)), true);
  assert.equal(evaluateReviewReadiness(rec).ready, false); db.close();
});

test('F-08 missing required type is not Review-ready', async () => {
  const { store, db } = await setup(); await seal(store,db,'diff-1','diff');
  const ready = evaluateReviewReadiness(await reconcileArtifacts({ store, db, runId:'run-1' }));
  assert.equal(ready.ready, false); assert.ok(ready.reasonCodes.includes('AGENT_LOG_MISSING')); assert.ok(ready.reasonCodes.includes('VERIFICATION_RESULT_MISSING')); assert.ok(ready.reasonCodes.includes('CHANGE_PACKAGE_MISSING')); db.close();
});

test('F-08 duplicate healthy change packages are not Review-ready', async () => {
  const { store, db } = await setup(); await sealRequired(store, db); await seal(store,db,'pkg-2','change_package');
  const ready = evaluateReviewReadiness(await reconcileArtifacts({ store, db, runId:'run-1' }));
  assert.equal(ready.ready, false); assert.ok(ready.reasonCodes.includes('CHANGE_PACKAGE_NOT_UNIQUE')); db.close();
});

test('all four healthy required types with one package are Review-ready', async () => {
  const { store, db } = await setup(); await sealRequired(store, db);
  assert.deepEqual(evaluateReviewReadiness(await reconcileArtifacts({ store, db, runId:'run-1' })), { ready:true, reasonCodes:[] }); db.close();
});

test('F-09 ReviewDecision package hash mismatch is invalid and does not rewrite the decision', async () => {
  const { store, db } = await setup('completed'); const required = await sealRequired(store, db);
  db.prepare('insert into review_decisions(run_id,decision,change_package_artifact_id,change_package_sha256) values(?,?,?,?)').run('run-1','accept',required.package.artifactId,'f'.repeat(64));
  const rec = await reconcileArtifacts({ store, db, runId:'run-1' }); const validation = validateReviewDecisionReference({ db, reconciliation:rec, runId:'run-1' });
  assert.equal(validation.valid, false); assert.ok(validation.reasonCodes.includes('DECISION_PACKAGE_HASH_MISMATCH'));
  assert.equal(db.prepare('select change_package_sha256 from review_decisions where run_id=?').get('run-1').change_package_sha256, 'f'.repeat(64)); db.close();
});

test('reconciliation classifies staging temp and finalized orphan without auto-promoting either', async () => {
  const { store, db } = await setup(); const stageDir = path.join(store.stagingRoot, 'run-1'); await mkdir(stageDir, { recursive:true }); await writeFile(path.join(stageDir, 'leftover.tmp'), 'temp', 'utf8');
  const orphanDir = path.join(store.objectsRoot, 'aa'); await mkdir(orphanDir, { recursive:true }); await writeFile(path.join(orphanDir, 'orphan'), 'orphan', 'utf8');
  const rec = await reconcileArtifacts({ store, db, runId:'run-1' }); assert.equal(rec.temps.length, 1); assert.equal(rec.orphans.length, 1); assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0); assert.equal(evaluateReviewReadiness(rec).ready, false); db.close();
});

test('F-17 partial sealed evidence on failed run is preserved but never presented as Review-ready', async () => {
  const { store, db } = await setup('failed'); const diff = await seal(store,db,'diff-1','diff');
  assert.equal(await readFile(path.join(store.root,diff.contentLocation),'utf8'), 'diff-diff-1');
  const rec = await reconcileArtifacts({ store, db, runId:'run-1' }); assert.equal(rec.run.state, 'failed'); assert.equal(rec.artifacts.find(a=>a.id==='diff-1').status, 'healthy'); assert.equal(evaluateReviewReadiness(rec).ready, false); assert.equal(db.prepare('select state from runs where id=?').get('run-1').state, 'failed'); db.close();
});
