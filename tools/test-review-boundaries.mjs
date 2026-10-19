import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,renameSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setupVerificationFixture} from './verify-verification.mjs';

const helper=resolve('experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');
const request=(context,decision='accept')=>({request_id:randomUUID(),decision,package_id:context.package.id,package_sha256:context.package.sha256,note:'boundary regression'});
const wait=async(fn)=>{const until=Date.now()+60000;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('review fixture timed out');};
const counts=(store,id)=>Object.fromEntries(['artifacts','run_logs','stage_output','stage_observations','captured_versions','verification_results','execution_facts'].map(table=>[table,store.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE run_id=?`).get(id).n]));

test('waiting review checks every prerequisite, current drift, concurrent decision and mid-check qualification',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workos-review-boundaries-')),f=await setupVerificationFixture(root,helper,"[Console]::WriteLine('verified')",{review:true});
 try{
  f.executor.launch(f.run);await wait(()=>f.store.getRun(f.run.id).state!=='running');assert.equal(f.store.getRun(f.run.id).state,'waiting_review');
  const context=await f.executor.reviewContext(f.run.id),saved=counts(f.store,f.run.id);let checks=0;
  const check=f.executor.checkPackage.bind(f.executor);f.executor.checkPackage=(...args)=>{checks++;return check(...args);};
  for(const {artifact} of context.artifacts){
   const file=join(root,'runs','artifacts',artifact.content_location),bytes=readFileSync(file),backup=file+'.fixture-backup';
   renameSync(file,backup);await assert.rejects(f.executor.review(f.run.id,request(context)),/缺失|损坏/);renameSync(backup,file);
   writeFileSync(file,'corrupt prerequisite');await assert.rejects(f.executor.review(f.run.id,request(context)),/缺失|损坏/);writeFileSync(file,bytes);
   assert.equal(f.store.getReviewDecision(f.run.id),null);
  }
  assert.equal(checks,0,'missing or corrupt bytes must reject before spawning checks');
  for(const directory of [f.workspace,join(root,'source')]){
   const file=join(directory,'README.md'),bytes=readFileSync(file);writeFileSync(file,'outside edit');
   await assert.rejects(f.executor.review(f.run.id,request(context)),/检查未通过/);assert.equal(f.store.lastResourceCheck(f.run.id).drift,'detected');assert.equal(f.store.resourceLock(),null);assert.equal(f.store.getReviewDecision(f.run.id),null);writeFileSync(file,bytes);
  }
  const gate=f.executor.reviewGate;f.executor.checkPackage=async(...args)=>{const result=await check(...args);f.executor.reviewGate=()=>null;return result;};
  await assert.rejects(f.executor.review(f.run.id,request(context)),/G2/);assert.equal(f.store.lastResourceCheck(f.run.id).drift,'clear');assert.equal(f.store.getReviewDecision(f.run.id),null);assert.equal(f.store.getTask(f.run.task_id).state,'review');f.executor.reviewGate=gate;
  let started,release;const entered=new Promise(resolveStarted=>started=resolveStarted),barrier=new Promise(resolveRelease=>release=resolveRelease);
  f.executor.checkPackage=async(...args)=>{started();await barrier;return check(...args);};
  const accepting=f.executor.review(f.run.id,request(context));await entered;
  try{await assert.rejects(async()=>f.executor.review(f.run.id,request(context,'reject')),/当前检查或执行/);}finally{release();}
  await accepting;assert.equal(f.store.getReviewDecision(f.run.id).decision,'accept');assert.equal(f.store.getTask(f.run.task_id).state,'done');assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM events WHERE run_id=? AND type='run.terminal'").get(f.run.id).n,1);assert.deepEqual(counts(f.store,f.run.id),saved);
 }finally{await f.executor.close();f.store.close();}
});

test('Cancel after the first Artifact insert stops sealing before a Package or review can be published',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workos-seal-cancel-')),f=await setupVerificationFixture(root,helper,"[Console]::WriteLine('verified')",{review:true});
 try{
  const prepare=f.store.db.prepare.bind(f.store.db);let cancelled=false;
  f.store.db.prepare=sql=>{const statement=prepare(sql);if(/^insert into artifacts\(/i.test(sql)){const insert=statement.run.bind(statement);statement.run=(...args)=>{const result=insert(...args);if(!cancelled){cancelled=true;f.executor.cancel(f.run.id);}return result;};}return statement;};
  f.executor.launch(f.run);await wait(()=>f.store.getRun(f.run.id).state!=='running');
  assert.equal(cancelled,true);assert.equal(f.store.getRun(f.run.id).state,'cancelled');assert.deepEqual(f.store.artifacts(f.run.id).map(row=>row.type),['agent_log']);assert.equal(f.store.getReviewDecision(f.run.id),null);assert.equal(f.store.lastResourceCheck(f.run.id),null);assert.equal(f.store.resourceLock(),null);assert.equal(f.store.getTask(f.run.task_id).state,'ready');
 }finally{await f.executor.close();f.store.close();}
});
