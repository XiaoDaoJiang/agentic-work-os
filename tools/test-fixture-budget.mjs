import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setupVerificationFixture,fixturePipelineBudget,fixtureSuiteBudget,fixtureCheckBudget,waitForFixture} from './verify-verification.mjs';

test('pipeline deadline covers configured stages and waits remain bounded without retrying errors',async()=>{
 assert.ok(fixturePipelineBudget({review:true})>10000+60000+10000+60000+120000);
 assert.equal(fixturePipelineBudget({review:true,timeout:30})-fixturePipelineBudget({review:true,timeout:10}),20000);
 assert.ok(fixtureSuiteBudget({pipelines:2,checks:4})>2*fixturePipelineBudget({review:true})+4*fixtureCheckBudget);
 await assert.rejects(waitForFixture(()=>false,20,'bounded predicate'),/bounded predicate timed out after 20ms/);
 let calls=0;await assert.rejects(waitForFixture(()=>{calls++;throw new Error('fixture failure');},1000),/fixture failure/);assert.equal(calls,1);
});

test('fresh nonzero native fixture reaches review and accepts within the derived pipeline budget',{timeout:fixtureSuiteBudget({pipelines:1,checks:1})},async()=>{
 const root=mkdtempSync(join(tmpdir(),'workos-nonzero-budget-')),helper=resolve('experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');
 const evidenceRoot=resolve('verification-output/fmvp-04');mkdirSync(evidenceRoot,{recursive:true});const evidence=join(mkdtempSync(join(evidenceRoot,'nonzero-budget-')),'result.json');
 const f=await setupVerificationFixture(root,helper,'node -e "process.exit(7)"',{review:true}),stages=[];
 const native=f.executor.executeBoundary.bind(f.executor);f.executor.executeBoundary=async(run,command)=>{const started=Date.now(),result=await native(run,command);stages.push({stage:command.check?'resource-check':command.stage,timeout_ms:command.timeout,elapsed_ms:Date.now()-started,safe:result.safe,terminal:result.terminal});return result;};
 const started=Date.now();let pipelineElapsed;
 try{
  f.executor.launch(f.run);await waitForFixture(()=>f.store.getRun(f.run.id).state!=='running',f.pipelineBudget,'single nonzero pipeline');pipelineElapsed=Date.now()-started;
  assert.equal(f.store.getRun(f.run.id).state,'waiting_review');const context=await f.executor.reviewContext(f.run.id);assert.deepEqual(context.blockers,[]);
  assert.equal(f.store.getRunEvidence(f.run.id).verification.outcome,'failed');assert.equal(f.store.getRunEvidence(f.run.id).verification.exit_code,7);
  await f.executor.review(f.run.id,{request_id:randomUUID(),decision:'accept',package_id:context.package.id,package_sha256:context.package.sha256,note:'nonzero budget regression'});
  assert.equal(f.store.getRun(f.run.id).state,'completed');assert.equal(f.store.getReviewDecision(f.run.id).decision,'accept');assert.equal(f.store.resourceLock(),null);
  assert.ok(stages.every(stage=>stage.safe&&stage.terminal.stdout_drained&&stage.terminal.stderr_drained));
  console.log(JSON.stringify({root,evidence,pipeline_budget_ms:f.pipelineBudget,pipeline_elapsed_ms:pipelineElapsed,total_elapsed_ms:Date.now()-started}));
 }finally{
  await f.executor.close();writeFileSync(evidence,JSON.stringify({root,pipeline_budget_ms:f.pipelineBudget,pipeline_elapsed_ms:pipelineElapsed,total_elapsed_ms:Date.now()-started,stages,run:f.store.getRun(f.run.id),evidence:f.store.getRunEvidence(f.run.id),review:f.store.getReviewDecision(f.run.id),lock:f.store.resourceLock()},null,2));f.store.close();
 }
});
