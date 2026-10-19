import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,renameSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setupVerificationFixture} from './verify-verification.mjs';

const helper=resolve('experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');
const request=context=>({request_id:randomUUID(),decision:'accept',package_id:context.package.id,package_sha256:context.package.sha256,note:'recovery regression'});
const wait=async(fn)=>{const until=Date.now()+60000;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw new Error('review fixture timed out');};
test('accepted Package remains recheckable after safe source failure; download still checks current source and bytes',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workos-review-recovery-')),f=await setupVerificationFixture(root,helper,"[Console]::WriteLine('verified')",{review:true});
 try{
  f.executor.launch(f.run);await wait(()=>f.store.getRun(f.run.id).state!=='running');assert.equal(f.store.getRun(f.run.id).state,'waiting_review');
  const before=await f.executor.reviewContext(f.run.id);await f.executor.review(f.run.id,request(before));
  const source=join(root,'source'),offline=join(root,'source-offline');renameSync(source,offline);
  await assert.rejects(f.executor.delivery(f.run.id),/本次交付检查未通过/);assert.equal(f.store.resourceLock(),null);assert.equal(f.store.lastResourceCheck(f.run.id).replay,null);
  const failed=await f.executor.reviewContext(f.run.id);assert.equal(failed.delivery_integrity.value,'healthy');assert.equal(failed.last_check.drift,'unavailable');assert.ok(failed.blockers.some(text=>text.includes('上次检查')));
  await assert.rejects(f.executor.delivery(f.run.id),/本次交付检查未通过/);
  renameSync(offline,source);const previous=f.store.lastResourceCheck(f.run.id).operation_id;
  const delivered=await f.executor.delivery(f.run.id);assert.notEqual(f.store.lastResourceCheck(f.run.id).operation_id,previous);assert.equal(f.store.lastResourceCheck(f.run.id).drift,'clear');
  const object=join(root,'runs','artifacts',before.package.content_location),original=readFileSync(object);assert.deepEqual(delivered.bytes,original);writeFileSync(object,'broken');
  assert.equal((await f.executor.reviewContext(f.run.id)).delivery_integrity.value,'corrupt');await assert.rejects(f.executor.delivery(f.run.id),/损坏|缺失/);writeFileSync(object,original);
  f.store.reserveResourceCheck(f.run.id,'unknown-operation',before.package.sha256);f.store.recordResourceCheck(f.run.id,{operation_id:'unknown-operation',package_sha256:before.package.sha256,checked_at:new Date().toISOString(),resource_state:'unknown',drift:'unavailable',replay:null,reason:'fixture_unknown'});
  await assert.rejects(f.executor.delivery(f.run.id),/资源/);assert.equal(f.store.resourceLock().run_id,f.run.id);assert.equal(f.store.getTask(f.run.task_id).state,'done');assert.equal(f.store.getReviewDecision(f.run.id).decision,'accept');
 }finally{await f.executor.close();f.store.close();}
});
