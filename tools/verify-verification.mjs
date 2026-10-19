import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { execFileSync,fork } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { Store } from '../apps/server/dist/store.js';
import { RealExecutor } from '../apps/server/dist/real-executor.js';
import { freezeVerification } from '../apps/server/dist/verification.js';
import { sha256File, executionIdentity } from '../apps/server/dist/execution-profile.js';
import { ensureRepositoryMarker } from '../experiments/milestone-0/src/repository-marker.mjs';
// Mirror the existing RealExecutor stage limits; these are harness budgets, not product settings.
// Each boundary already has a 20s watchdog allowance. Reserve 10s for DB/file work and polling.
export const fixtureLimits=Object.freeze({agent:10000,capture:60000,check:120000,boundaryExit:20000,persistence:10000,git:30000,processClose:10000});
export const fixtureSetupBudget=7*fixtureLimits.git+fixtureLimits.persistence; // init/add/commit/HEAD/marker/clone/checkout
export const fixtureCheckBudget=fixtureLimits.check+fixtureLimits.boundaryExit+fixtureLimits.persistence;
export const fixtureVerificationStartBudget=fixtureLimits.agent+fixtureLimits.capture+2*fixtureLimits.boundaryExit+fixtureLimits.persistence;
export function fixturePipelineBudget({review=false,timeout=10}={}) {
 assert.ok(Number.isFinite(timeout)&&timeout>0,'fixture verification timeout must be positive');
 return fixtureLimits.agent+2*fixtureLimits.capture+timeout*1000+4*fixtureLimits.boundaryExit+(review?fixtureLimits.check+fixtureLimits.boundaryExit:0)+fixtureLimits.persistence;
}
export function fixtureSuiteBudget({pipelines=1,checks=0}={}) {return pipelines*(fixtureSetupBudget+fixturePipelineBudget({review:true}))+checks*fixtureCheckBudget+fixtureLimits.processClose;}
export const boundedFixture=(promise,ms,label)=>new Promise((resolveResult,reject)=>{const timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms}ms`)),ms);promise.then(value=>{clearTimeout(timer);resolveResult(value);},error=>{clearTimeout(timer);reject(error);});});
export const waitForFixture=async(predicate,ms,label='fixture')=>{assert.ok(Number.isFinite(ms)&&ms>0,'a finite fixture wait budget is required');const until=Date.now()+ms;while(Date.now()<until){const result=await predicate();if(result)return result;await new Promise(r=>setTimeout(r,30));}throw new Error(`${label} timed out after ${ms}ms`);};
const git=(cwd,args)=>execFileSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,timeout:fixtureLimits.git}).trim();
export async function setupVerificationFixture(root,helper,command,{review=false,timeout=10,agent="require('node:fs').writeFileSync('agent-result.txt','agent')"}={}) {
 mkdirSync(root,{recursive:true});const source=join(root,'source');mkdirSync(source);git(source,['init']);writeFileSync(join(source,'README.md'),'native verification fixture\n');
 writeFileSync(join(source,'long.cjs'),`const fs=require('node:fs');const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync('verification-started.json',JSON.stringify({pid:process.pid,child:child.pid}));setInterval(()=>{},1000);`);
 git(source,['add','.']);git(source,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);
 const base=git(source,['rev-parse','HEAD']);const marker=await ensureRepositoryMarker(source,{execute:async(program,args,options)=>({stdout:execFileSync(program,args,{...options,timeout:fixtureLimits.git})})});const workspace=join(root,'workspace');git(source,['clone','--no-local',source,workspace]);git(workspace,['checkout','--detach',base]);
 const store=new Store(join(root,'state.sqlite'));const task=store.createTask({goal:'native fixture',definition_of_done:['fixture'],repository_path:source,verification_draft:{command,timeout_seconds:timeout}});
 const execution={profile_id:'native-fixture',model:'fixture',base_revision:base,repository_identity:marker.repositoryIdentity,source_path:source,workspace_path:workspace,receipt_path:join(root,'agent.receipt.json'),runtime_id:randomUUID(),spawn_nonce:randomUUID(),timeout_ms:10000,helper_revision:sha256File(helper)};
 const identity=()=>createHash('sha256').update(JSON.stringify(executionIdentity())).digest('hex');
 if(review)execution.review_identity=identity();
 const run=store.startRealRun(task.id,randomUUID(),execution,task.revision,{verify:true,expected_task_revision:task.revision},freezeVerification(task)).run;
 const executor=new RealExecutor(store,join(root,'runs'),{executable:process.execPath,helper,helper_revision:sha256File(helper),model:'fixture',codex_version:'native-fixture',evidence_path:'',source_identity:''},undefined,review?identity:()=>null);
 const native=executor.executeBoundary.bind(executor);
 // This fixture substitutes only the Agent command; all verification/capture/ownership code is production code.
 executor.executeBoundary=(run,command)=>native(run,command.stage==='agent'?{...command,program:process.execPath,argv:['-e',agent]}:command);
 return {store,executor,run,workspace,pipelineBudget:fixturePipelineBudget({review,timeout})};
}
export async function verifyVerification({helper,evidence}) {
 assert.equal(process.platform,'win32');const directory=mkdtempSync(join(tmpdir(),'workos-g1-verification-'));mkdirSync(evidence,{recursive:true});const outcomes={};
 for(const scenario of ['normal','nonzero','timeout','cancel','drift','capture-error','stage-cancel']) {
  const command=scenario==='nonzero'?"node -e \"process.exit(7)\"; Write-Output 'after nonzero'":scenario==='timeout'||scenario==='cancel'?'node long.cjs':scenario==='drift'?"[System.IO.File]::WriteAllText('changed-by-test.txt','changed')":"[Console]::WriteLine('验证 stdout'); [Console]::Error.WriteLine('验证 stderr')";
  const fixture=await setupVerificationFixture(join(directory,scenario),helper,command,{timeout:scenario==='timeout'?2:10,...(scenario==='capture-error'?{agent:"const fs=require('node:fs');fs.writeFileSync('.gitattributes','*.txt text eol=lf\\n');fs.writeFileSync('convert.txt','changed\\r\\n')"}:{})});
  const {store,executor,run,workspace}=fixture;
  try {
   if(scenario==='stage-cancel') {const record=store.recordStage.bind(store);store.recordStage=(id,stage,facts)=>{record(id,stage,facts);if(stage==='agent')executor.cancel(id);};}
   executor.launch(run);
   assert.throws(()=>store.startRun(run.task_id,{execution_mode:'mock',scenario:'success',request_id:'blocked-fixture'}),/资源/);
   if(scenario==='cancel') {await waitForFixture(()=>existsSync(join(workspace,'verification-started.json')),fixtureVerificationStartBudget,'verification start');executor.cancel(run.id);executor.cancel(run.id);}
   await waitForFixture(()=>store.getRun(run.id).state!=='running',fixture.pipelineBudget,'verification pipeline');
   const final=store.getRun(run.id);const result=store.getRunEvidence(run.id);writeFileSync(join(evidence,`${scenario}.json`),JSON.stringify({run:final,evidence:result,lock:store.resourceLock()},null,2));
   assert.equal(store.resourceLock(),null);assert.equal(store.getTask(run.task_id).state,'ready');
   assert.equal(new Set(result.stages.map(x=>x.facts.spawn_nonce)).size,result.stages.length);
   assert.ok(result.stages.every(x=>x.facts.receipt_matches&&x.facts.stdout_drained&&x.facts.stderr_drained));
   if(scenario==='normal') {assert.equal(final.state,'succeeded');assert.equal(result.verification.outcome,'passed');assert.equal(result.verification.version_match,'match');assert.equal(result.captures.length,2);for(const stream of ['stdout','stderr'])assert.ok(result.output.some(x=>x.stage==='verification'&&x.stream===stream&&x.text.includes(`验证 ${stream}`)));}
   if(scenario==='nonzero'){assert.equal(result.verification.outcome,'failed');assert.equal(result.verification.exit_code,7);}
   if(scenario==='timeout'){assert.equal(result.verification.outcome,'timeout');assert.equal(final.state,'failed');}
   if(scenario==='cancel'||scenario==='stage-cancel'){assert.equal(final.state,'cancelled');assert.equal(result.verification.outcome,'cancelled');assert.ok(!result.stages.some(x=>x.stage==='capture-after'));if(scenario==='stage-cancel')assert.equal(result.stages.length,1);}
   if(scenario==='cancel'||scenario==='timeout'){const pids=JSON.parse(readFileSync(join(workspace,'verification-started.json')));for(const pid of Object.values(pids))assert.throws(()=>process.kill(pid,0));}
   if(scenario==='drift'){assert.equal(result.verification.outcome,'passed');assert.equal(result.verification.version_match,'changed');assert.equal(final.state,'failed');}
   if(scenario==='capture-error'){assert.equal(result.verification.outcome,'error');assert.ok(!result.stages.some(x=>x.stage==='verification'));}
   const saved=JSON.stringify(result);writeFileSync(join(workspace,'outside-change.txt'),'after capture');assert.equal(JSON.stringify(store.getRunEvidence(run.id)),saved);
   assert.throws(()=>store.db.prepare('DELETE FROM stage_observations WHERE run_id=?').run(run.id),/immutable/);
   outcomes[scenario]='passed';console.log(`PASS verification ${scenario}`);
  } finally {await executor.close();store.close();}
 }
 const ownerRoot=join(directory,'owner-loss');const child=fork(fileURLToPath(import.meta.url),['--owner',ownerRoot,helper],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});let details;let errors='';child.stderr.on('data',chunk=>errors+=chunk);
 try {details=await boundedFixture(new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',()=>reject(new Error(errors)));}),fixtureSetupBudget,'verification owner IPC');await waitForFixture(()=>existsSync(join(details.workspace,'verification-started.json')),fixtureVerificationStartBudget,'verification owner start');child.kill('SIGKILL');await boundedFixture(new Promise(resolve=>child.once('close',resolve)),fixtureLimits.processClose,'verification owner close');const reopened=new Store(join(ownerRoot,'state.sqlite'));try{reopened.recoverInterrupted();assert.equal(reopened.getRun(details.id).state,'interrupted');assert.ok(reopened.resourceLock());assert.throws(()=>reopened.reservePreparation(details.task,'owner-blocked'),/资源/);writeFileSync(join(evidence,'owner-loss.json'),JSON.stringify({run:reopened.getRun(details.id),evidence:reopened.getRunEvidence(details.id),lock:reopened.resourceLock()},null,2));}finally{reopened.close();}outcomes['owner-loss']='passed';console.log('PASS verification owner-loss');}finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await boundedFixture(new Promise(resolve=>child.once('close',resolve)),fixtureLimits.processClose,'verification owner cleanup');}}
 writeFileSync(join(evidence,'native-summary.json'),JSON.stringify({directory,outcomes},null,2));return outcomes;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
if(process.argv[2]==='--owner') {const {store,executor,run,workspace}=await setupVerificationFixture(process.argv[3],process.argv[4],'node long.cjs',{timeout:30});process.send({id:run.id,task:run.task_id,workspace});executor.launch(run);setInterval(()=>{},1000);}
else {const helper=resolve('experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');await verifyVerification({helper,evidence:resolve(process.argv[2]??'verification-output/fmvp-03/native')});}

}
