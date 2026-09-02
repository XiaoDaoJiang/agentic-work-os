import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { openArtifactExperimentDb } from '../src/artifact-db.mjs';
import { createArtifactStore, sealArtifact } from '../src/artifact-store.mjs';
import { computeDeliveryIntegrity, assertDeliveryIntegrityValue } from '../src/delivery-integrity.mjs';

async function setup(decision='accept') {
  const root = await mkdtemp(path.join(os.tmpdir(),'m0-delivery-'));
  const store = await createArtifactStore(path.join(root,'store'));
  const db = openArtifactExperimentDb(path.join(root,'state.sqlite'));
  db.prepare('insert into runs(id,phase,state) values(?,?,?)').run('run-1','complete','completed');
  const pkg = await sealArtifact({ store,db,runId:'run-1',artifactId:'pkg-1',type:'change_package',bytes:'package-bytes',producerStopped:true,outputDrained:true });
  if (decision) db.prepare('insert into review_decisions(run_id,decision,change_package_artifact_id,change_package_sha256) values(?,?,?,?)').run('run-1',decision,pkg.artifactId,pkg.sha256);
  return { root, store, db, pkg };
}
const validManifest = async () => true; const validReplay = async () => true;

test('F-10 legal accept with matching row/object/manifest/replay is healthy', async () => {
  const { store,db } = await setup('accept'); const beforeRun = db.prepare('select phase,state from runs where id=?').get('run-1'); const beforeEvents = db.prepare('select count(*) c from events where run_id=?').get('run-1').c;
  const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay });
  assert.equal(result.value,'healthy'); assert.deepEqual(result.reasonCodes,[]); assert.equal(db.prepare('select count(*) c from events where run_id=?').get('run-1').c,beforeEvents);
  const afterRun = db.prepare('select phase,state from runs where id=?').get('run-1'); assert.equal(afterRun.phase,beforeRun.phase); assert.equal(afterRun.state,beforeRun.state); db.close();
});

test('F-11 no accept decision yields no projection and invalid fourth values are rejected', async () => {
  for (const decision of [null,'reject']) { const { store,db } = await setup(decision); assert.equal(await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }),null); db.close(); }
  for (const value of ['unknown','degraded','']) assert.throws(()=>assertDeliveryIntegrityValue(value),/delivery_integrity/);
  for (const value of ['healthy','missing','corrupt']) assert.equal(assertDeliveryIntegrityValue(value),value);
});

test('F-12 missing precedence distinguishes missing Artifact row and missing object', async () => {
  { const { store,db,pkg } = await setup('accept'); db.prepare('delete from artifacts where id=?').run(pkg.artifactId); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(result.value,'missing'); assert.deepEqual(result.reasonCodes,['ARTIFACT_ROW_MISSING']); db.close(); }
  { const { store,db,pkg } = await setup('accept'); await rm(path.join(store.root,pkg.contentLocation)); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(result.value,'missing'); assert.deepEqual(result.reasonCodes,['OBJECT_MISSING_OR_UNREADABLE']); db.close(); }
});

test('F-13 type/run, size/hash, manifest and replay failures are corrupt', async () => {
  { const { store,db,pkg } = await setup('accept'); db.prepare('update artifacts set type=? where id=?').run('diff',pkg.artifactId); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(result.value,'corrupt'); assert.ok(result.reasonCodes.includes('TYPE_OR_RUN_MISMATCH')); db.close(); }
  { const { store,db,pkg } = await setup('accept'); await writeFile(path.join(store.root,pkg.contentLocation),'tampered','utf8'); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(result.value,'corrupt'); assert.equal(result.reasonCodes.some(c=>['SIZE_MISMATCH','HASH_MISMATCH'].includes(c)),true); db.close(); }
  { const { store,db } = await setup('accept'); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:async()=>false,replayValidator:validReplay }); assert.equal(result.value,'corrupt'); assert.ok(result.reasonCodes.includes('MANIFEST_INVALID')); db.close(); }
  { const { store,db } = await setup('accept'); const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:async()=>false }); assert.equal(result.value,'corrupt'); assert.ok(result.reasonCodes.includes('REPLAY_TREE_MISMATCH')); db.close(); }
});

test('decision hash mismatch is corrupt even when object bytes match the Artifact row', async () => {
  const { store,db } = await setup('accept'); db.prepare('update review_decisions set change_package_sha256=? where run_id=?').run('f'.repeat(64),'run-1');
  const result = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(result.value,'corrupt'); assert.ok(result.reasonCodes.includes('HASH_MISMATCH')); db.close();
});

test('F-14 restoring exact bytes recomputes healthy without rewriting historical decision or terminal', async () => {
  const { store,db,pkg } = await setup('accept'); const objectPath = path.join(store.root,pkg.contentLocation); const decisionBefore = db.prepare('select * from review_decisions where run_id=?').get('run-1'); const runBefore = db.prepare('select phase,state from runs where id=?').get('run-1');
  await rm(objectPath); assert.equal((await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay })).value,'missing');
  await mkdir(path.dirname(objectPath),{recursive:true}); await writeFile(objectPath,'package-bytes','utf8'); const restored = await computeDeliveryIntegrity({ store,db,runId:'run-1',manifestValidator:validManifest,replayValidator:validReplay }); assert.equal(restored.value,'healthy');
  const decisionAfter = db.prepare('select * from review_decisions where run_id=?').get('run-1'); const runAfter = db.prepare('select phase,state from runs where id=?').get('run-1'); assert.equal(decisionAfter.change_package_artifact_id,decisionBefore.change_package_artifact_id); assert.equal(decisionAfter.change_package_sha256,decisionBefore.change_package_sha256); assert.equal(runAfter.phase,runBefore.phase); assert.equal(runAfter.state,runBefore.state); db.close();
});
