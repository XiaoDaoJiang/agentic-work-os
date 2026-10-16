import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { openArtifactExperimentDb } from '../src/artifact-db.mjs';
import { createArtifactStore } from '../src/artifact-store.mjs';
import { reconcileArtifacts } from '../src/artifact-reconciliation.mjs';

const worker = new URL('../fixtures/artifact-crash-worker.mjs', import.meta.url);

async function filesRecursively(root) {
  const out=[];
  async function walk(dir){
    let es=[]; try{es=await readdir(dir,{withFileTypes:true});}catch(e){if(e?.code==='ENOENT')return;throw e;}
    for(const e of es){const p=path.join(dir,e.name); if(e.isDirectory())await walk(p); else out.push(path.relative(root,p));}
  }
  await walk(root); return out.sort();
}

async function setup() {
  const root=await mkdtemp(path.join(os.tmpdir(),'m0-crash-'));
  const store=await createArtifactStore(path.join(root,'store'));
  const dbPath=path.join(root,'state.sqlite');
  const db=openArtifactExperimentDb(dbPath);
  db.prepare('insert into runs(id,phase,state) values(?,?,?)').run('run-1','test','running');
  db.close();
  return {root,store,dbPath};
}

async function runCrash({store,dbPath,point}) {
  const exit = await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[fileURLToPath(worker),'--store',store.root,'--db',dbPath,'--fault-point',point],{stdio:['ignore','pipe','pipe'],windowsHide:true});
    let stdout='',stderr='';
    let reached=false,killed=false;
    const timeout=setTimeout(()=>{
      child.kill('SIGKILL');
      reject(new Error(`Timed out waiting for crash at ${point}: ${stderr}`));
    },10000);
    child.stdout.on('data',d=>{
      stdout+=d;
      if(!reached && stdout.split('\n').includes(`fault-point:${point}`)){
        reached=true;
        killed=child.kill('SIGKILL');
      }
    });
    child.stderr.on('data',d=>stderr+=d);
    child.on('error',error=>{clearTimeout(timeout);reject(error);});
    child.on('close',(code,signal)=>{clearTimeout(timeout);resolve({code,signal,stdout,stderr,reached,killed});});
  });
  assert.equal(exit.reached,true,exit.stderr);
  assert.equal(exit.killed,true,exit.stderr);
  console.log(JSON.stringify({faultPoint:point,killSent:exit.killed,code:exit.code,signal:exit.signal}));
  return exit;
}

for (const point of ['after_flush_close','after_hash']) {
  test(`strong kill at ${point} leaves no DB advance and no finalized object`, async()=>{
    const {store,dbPath}=await setup();
    const exit=await runCrash({store,dbPath,point});
    assert.equal(exit.signal,'SIGKILL', exit.stderr);
    const db=openArtifactExperimentDb(dbPath);
    assert.equal(db.prepare('select count(*) c from artifacts').get().c,0);
    assert.equal(db.prepare('select count(*) c from events').get().c,0);
    const run=db.prepare('select phase,state from runs where id=?').get('run-1');
    assert.equal(run.phase,'test'); assert.equal(run.state,'running');
    assert.equal((await filesRecursively(store.objectsRoot)).length,0);
    db.close();
  });
}

test('strong kill after finalize leaves orphan object but no committed DB facts', async()=>{
  const {store,dbPath}=await setup();
  const exit=await runCrash({store,dbPath,point:'after_finalize'});
  assert.equal(exit.signal,'SIGKILL', exit.stderr);
  const db=openArtifactExperimentDb(dbPath);
  assert.equal(db.prepare('select count(*) c from artifacts').get().c,0);
  assert.equal(db.prepare('select count(*) c from events').get().c,0);
  assert.equal((await filesRecursively(store.objectsRoot)).length,1);
  const rec=await reconcileArtifacts({store,db,runId:'run-1'});
  assert.equal(rec.orphans.length,1);
  db.close();
});

for (const point of ['after_artifact_row','after_event','before_commit']) {
  test(`strong kill at ${point} rolls back SQLite facts and preserves orphan only`, async()=>{
    const {store,dbPath}=await setup();
    const exit=await runCrash({store,dbPath,point});
    assert.equal(exit.signal,'SIGKILL', exit.stderr);
    const db=openArtifactExperimentDb(dbPath);
    assert.equal(db.prepare('select count(*) c from artifacts').get().c,0);
    assert.equal(db.prepare('select count(*) c from events').get().c,0);
    const run=db.prepare('select phase,state from runs where id=?').get('run-1');
    assert.equal(run.phase,'test'); assert.equal(run.state,'running');
    const rec=await reconcileArtifacts({store,db,runId:'run-1'});
    assert.equal(rec.orphans.length,1);
    db.close();
  });
}
