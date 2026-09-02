import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openArtifactExperimentDb } from '../src/artifact-db.mjs';
import { createArtifactStore, sealArtifact } from '../src/artifact-store.mjs';

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-artstore-'));
  const store = await createArtifactStore(path.join(root, 'store'));
  const db = openArtifactExperimentDb(path.join(root, 'state.sqlite'));
  db.prepare("insert into runs(id,phase,state) values(?,?,?)").run('run-1','test','running');
  return { root, store, db };
}

async function filesRecursively(root) {
  const out = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(p); else out.push(path.relative(root, p));
    }
  }
  await walk(root);
  return out.sort();
}

test('F-01 refuses to seal before producer stop and drain with no DB advance', async () => {
  const { store, db } = await setup();
  await assert.rejects(sealArtifact({ store, db, runId:'run-1', artifactId:'a1', type:'diff', bytes:'abc', producerStopped:false, outputDrained:true }), /producer must be stopped/);
  await assert.rejects(sealArtifact({ store, db, runId:'run-1', artifactId:'a2', type:'diff', bytes:'abc', producerStopped:true, outputDrained:false }), /output must be drained/);
  assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0);
  assert.equal(db.prepare('select count(*) c from events').get().c, 0);
  assert.deepEqual(await filesRecursively(store.stagingRoot), []);
  db.close();
});

test('F-02 faults before finalize leave only staging temp and no DB facts', async () => {
  for (const point of ['after_staging_write','after_flush_close','after_hash']) {
    const { store, db } = await setup();
    await assert.rejects(sealArtifact({
      store, db, runId:'run-1', artifactId:`a-${point}`, type:'diff', bytes:'abc', producerStopped:true, outputDrained:true,
      fault: (name) => { if (name === point) throw new Error(point); }
    }), new RegExp(point));
    assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0);
    assert.equal(db.prepare('select count(*) c from events').get().c, 0);
    assert.ok((await filesRecursively(store.stagingRoot)).length >= 1);
    assert.deepEqual(await filesRecursively(store.objectsRoot), []);
    db.close();
  }
});

test('F-03 fault after atomic finalize leaves an orphan object and no DB facts', async () => {
  const { store, db } = await setup();
  await assert.rejects(sealArtifact({
    store, db, runId:'run-1', artifactId:'a3', type:'diff', bytes:'orphan-me', producerStopped:true, outputDrained:true,
    fault: (name) => { if (name === 'after_finalize') throw new Error('after_finalize'); }
  }), /after_finalize/);
  assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0);
  assert.equal(db.prepare('select count(*) c from events').get().c, 0);
  assert.equal((await filesRecursively(store.objectsRoot)).length, 1);
  db.close();
});

test('F-04 DB transaction fault rolls back artifact/event/phase while finalized object remains orphan', async () => {
  for (const point of ['after_artifact_row','after_event','before_commit']) {
    const { store, db } = await setup();
    await assert.rejects(sealArtifact({
      store, db, runId:'run-1', artifactId:`a-${point}`, type:'diff', bytes:`bytes-${point}`, producerStopped:true, outputDrained:true,
      transition: { phase:'review', state:'waiting_review' },
      fault: (name) => { if (name === point) throw new Error(point); }
    }), new RegExp(point));
    assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0);
    assert.equal(db.prepare('select count(*) c from events').get().c, 0);
    const run = db.prepare('select phase,state from runs where id=?').get('run-1');
    assert.equal(run.phase, 'test');
    assert.equal(run.state, 'running');
    assert.equal((await filesRecursively(store.objectsRoot)).length, 1);
    db.close();
  }
});

test('successful seal writes immutable object, artifact row, event and dependent transition', async () => {
  const { store, db } = await setup();
  const result = await sealArtifact({
    store, db, runId:'run-1', artifactId:'a-ok', type:'diff', bytes:'hello', producerStopped:true, outputDrained:true,
    transition: { phase:'review', state:'waiting_review' }
  });
  assert.equal(result.sha256, createHash('sha256').update('hello').digest('hex'));
  assert.equal((await readFile(path.join(store.root, result.contentLocation), 'utf8')), 'hello');
  assert.equal(db.prepare('select count(*) c from artifacts').get().c, 1);
  assert.equal(db.prepare('select type from events where run_id=?').get('run-1').type, 'artifact.created');
  const run = db.prepare('select phase,state from runs where id=?').get('run-1');
  assert.equal(run.phase, 'review');
  assert.equal(run.state, 'waiting_review');
  db.close();
});

test('F-05 identical finalized bytes are reused idempotently without duplicate object bytes', async () => {
  const { store, db } = await setup();
  const first = await sealArtifact({ store, db, runId:'run-1', artifactId:'a1', type:'diff', bytes:'same', producerStopped:true, outputDrained:true });
  const second = await sealArtifact({ store, db, runId:'run-1', artifactId:'a2', type:'agent_log', bytes:'same', producerStopped:true, outputDrained:true });
  assert.equal(first.contentLocation, second.contentLocation);
  assert.equal((await filesRecursively(store.objectsRoot)).length, 1);
  assert.equal(db.prepare('select count(*) c from artifacts').get().c, 2);
  db.close();
});

test('F-06 mismatching bytes at the content-addressed path are rejected and never overwritten', async () => {
  const { store, db } = await setup();
  const expected = Buffer.from('expected');
  const sha = createHash('sha256').update(expected).digest('hex');
  const objectDir = path.join(store.objectsRoot, sha.slice(0,2));
  await mkdir(objectDir, { recursive: true });
  const objectPath = path.join(objectDir, sha);
  await writeFile(objectPath, 'CORRUPT', 'utf8');
  await assert.rejects(sealArtifact({ store, db, runId:'run-1', artifactId:'a1', type:'diff', bytes:expected, producerStopped:true, outputDrained:true }), /content-addressed object mismatch/);
  assert.equal(await readFile(objectPath, 'utf8'), 'CORRUPT');
  assert.equal(db.prepare('select count(*) c from artifacts').get().c, 0);
  db.close();
});
