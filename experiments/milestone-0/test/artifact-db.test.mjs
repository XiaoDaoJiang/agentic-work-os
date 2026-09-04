import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { openArtifactExperimentDb, withImmediateTransaction } from '../src/artifact-db.mjs';

test('initializes minimal experiment tables and constraints', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-artdb-'));
  const db = openArtifactExperimentDb(path.join(root, 'state.sqlite'));
  const names = db.prepare("select name from sqlite_master where type='table' order by name").all().map(r => r.name);
  for (const required of ['artifacts','events','review_decisions','runs']) assert.ok(names.includes(required));
  db.prepare("insert into runs(id,phase,state) values(?,?,?)").run('run-1','test','running');
  db.prepare("insert into events(run_id,sequence,type,payload_json) values(?,?,?,?)").run('run-1',1,'x','{}');
  assert.throws(() => db.prepare("insert into events(run_id,sequence,type,payload_json) values(?,?,?,?)").run('run-1',1,'y','{}'));
  db.close();
});

test('rolls back artifact row, event and run transition on mid-transaction failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-artdb-tx-'));
  const db = openArtifactExperimentDb(path.join(root, 'state.sqlite'));
  db.prepare("insert into runs(id,phase,state) values(?,?,?)").run('run-1','test','running');
  assert.throws(() => withImmediateTransaction(db, () => {
    db.prepare("insert into artifacts(id,run_id,type,content_location,sha256,size,sealed_at) values(?,?,?,?,?,?,?)")
      .run('a1','run-1','diff','objects/x','a'.repeat(64),1,new Date().toISOString());
    db.prepare("insert into events(run_id,sequence,type,payload_json) values(?,?,?,?)").run('run-1',1,'artifact.created','{}');
    db.prepare("update runs set phase=?, state=? where id=?").run('review','waiting_review','run-1');
    throw new Error('fault-after-phase');
  }), /fault-after-phase/);
  assert.equal(db.prepare("select count(*) c from artifacts").get().c, 0);
  assert.equal(db.prepare("select count(*) c from events").get().c, 0);
  const run = db.prepare("select phase,state from runs where id=?").get('run-1');
  assert.equal(run.phase, 'test');
  assert.equal(run.state, 'running');
  db.close();
});
