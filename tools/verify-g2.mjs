import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,realpathSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir,release} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync,fork} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {setupVerificationFixture,waitForFixture as wait,boundedFixture as bounded,fixtureLimits,fixtureSetupBudget,fixturePipelineBudget,fixtureCheckBudget,fixtureSuiteBudget} from './verify-verification.mjs';
import {Store} from '../apps/server/dist/store.js';
import {RealExecutor} from '../apps/server/dist/real-executor.js';
import {createApplication} from '../apps/server/dist/app.js';
import {executionIdentity,readExecutionProfile,sha256File,g2Cases} from '../apps/server/dist/execution-profile.js';
import {verificationShell} from '../apps/server/dist/verification.js';

const identity=()=>createHash('sha256').update(JSON.stringify(executionIdentity())).digest('hex');
const profile=helper=>({executable:process.execPath,helper,helper_revision:sha256File(helper),model:'fixture',codex_version:'native-fixture',evidence_path:'',source_identity:identity()});
const counts=(store,id)=>Object.fromEntries(['artifacts','run_logs','stage_output','stage_observations','captured_versions','verification_results','execution_facts'].map(table=>[table,store.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE run_id=?`).get(id).n]));
const request=(context,decision='accept')=>({request_id:randomUUID(),decision,package_id:context.package.id,package_sha256:context.package.sha256,note:'fixture decision'});

export async function verifyG2({helper,evidence,g1EvidencePath}) {
 assert.equal(process.platform,'win32');const initialIdentity=identity();
 const root=mkdtempSync(join(tmpdir(),'workos-g1-review-'));mkdirSync(evidence,{recursive:true});writeFileSync(join(root,'.g1-disposable-fixture'),'diagnostic-only\n');
 const cases={};const pass=name=>{cases[name]='passed';writeFileSync(join(evidence,'progress.json'),JSON.stringify({root,cases},null,2));console.log(`PASS G2 ${name}`);};
 const setup=async(name,command="[Console]::WriteLine('verified')",options={})=>setupVerificationFixture(join(root,name),helper,command,{review:true,...options});
 const f=await setup('normal',"[Console]::WriteLine('sealed stdout'); [Console]::Error.WriteLine('sealed stderr')");
 try {
  f.executor.launch(f.run);await wait(()=>f.store.getRun(f.run.id).state!=='running',f.pipelineBudget,'G2 normal pipeline');assert.equal(f.store.getRun(f.run.id).state,'waiting_review');
  const context=await f.executor.reviewContext(f.run.id);assert.deepEqual(context.blockers,[]);assert.equal(context.artifacts.length,4);
  const pkgPath=join(root,'normal','runs','artifacts',context.package.content_location),bytes=readFileSync(pkgPath),manifest=JSON.parse(bytes);
  assert.equal(manifest.result_tree_hash,f.store.getRunEvidence(f.run.id).captures.find(x=>x.point==='after').version.resultTreeHash);assert.equal(manifest.entries.find(x=>x.path==='agent-result.txt').content_base64,Buffer.from('agent').toString('base64'));const verificationArtifact=context.artifacts.find(item=>item.artifact.type==='verification_result').artifact;const sealedVerification=JSON.parse(readFileSync(join(root,'normal','runs','artifacts',verificationArtifact.content_location),'utf8'));for(const stream of ['stdout','stderr'])assert.ok(sealedVerification.output.some(item=>item.stream===stream&&item.text.includes(`sealed ${stream}`)));pass('same-capture-package');
  const before=counts(f.store,f.run.id);const workspace=resolve(f.workspace),within=relative(root,workspace);assert.ok(within&&!within.startsWith('..')&&!isAbsolute(within));rmSync(workspace,{recursive:true});
  const input=request(context);await f.executor.review(f.run.id,input);assert.equal(f.store.getRun(f.run.id).state,'completed');assert.equal(f.store.getTask(f.run.task_id).state,'done');
  const downloaded=await f.executor.delivery(f.run.id);assert.deepEqual(downloaded.bytes,bytes);assert.equal(f.store.lastResourceCheck(f.run.id).replay.result_tree_hash,manifest.result_tree_hash);pass('workspace-deleted-replay');
  assert.equal((await f.executor.review(f.run.id,input)).replay,true);await assert.rejects(async()=>f.executor.review(f.run.id,{...input,decision:'reject'}),/决定|幂等/);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM events WHERE type='run.terminal'").get().n,1);pass('decision-idempotency');
  assert.deepEqual(counts(f.store,f.run.id),before);assert.deepEqual(readFileSync(pkgPath),bytes);pass('sealed-evidence-immutable');
  writeFileSync(pkgPath,'damaged');assert.equal((await f.executor.reviewContext(f.run.id)).delivery_integrity.value,'corrupt');await assert.rejects(f.executor.delivery(f.run.id),/损坏|缺失/);assert.equal(f.store.getTask(f.run.task_id).state,'done');
  rmSync(pkgPath);assert.equal((await f.executor.reviewContext(f.run.id)).delivery_integrity.value,'missing');writeFileSync(pkgPath,bytes);assert.equal((await f.executor.reviewContext(f.run.id)).delivery_integrity.value,'healthy');pass('sealed-corruption');
  writeFileSync(join(evidence,'accepted.json'),JSON.stringify({run:f.store.getRun(f.run.id),review:await f.executor.reviewContext(f.run.id),business_counts:before},null,2));
 }finally{await f.executor.close();f.store.close();}
 for(const scenario of ['nonzero','timeout','drift','restart','gate-off','cancel']) {
  const command=scenario==='nonzero'?"node -e \"process.exit(7)\"":scenario==='timeout'?"node -e \"setInterval(()=>{},1000)\"":scenario==='drift'?"[System.IO.File]::WriteAllText('changed-by-test.txt','changed')":"[Console]::WriteLine('verified')";
  const next=await setup(scenario,command,{review:scenario!=='gate-off',timeout:scenario==='timeout'?1:10});
  try {
   if(scenario==='cancel'){const seal=next.executor.sealReview.bind(next.executor);next.executor.sealReview=(...args)=>{next.executor.cancel(next.run.id);return seal(...args);};}
   next.executor.launch(next.run);await wait(()=>next.store.getRun(next.run.id).state!=='running',next.pipelineBudget,`G2 ${scenario} pipeline`);
   if(scenario==='gate-off'){assert.equal(next.store.getRun(next.run.id).state,'succeeded');assert.equal(next.store.artifacts(next.run.id).length,0);assert.equal(next.store.lastResourceCheck(next.run.id),null);await assert.rejects(async()=>next.executor.review(next.run.id,{request_id:randomUUID(),decision:'accept',package_id:'none',package_sha256:'a'.repeat(64),note:''}),/G2/);pass('gate-off');continue;}
   if(scenario==='cancel'){assert.equal(next.store.getRun(next.run.id).state,'cancelled');assert.equal(next.store.getReviewDecision(next.run.id),null);assert.equal(next.store.resourceLock(),null);pass('cancel-seal');continue;}
   assert.equal(next.store.getRun(next.run.id).state,'waiting_review');const context=await next.executor.reviewContext(next.run.id);
   if(scenario==='nonzero'||scenario==='timeout'){assert.equal(next.store.getRunEvidence(next.run.id).verification.outcome,scenario==='nonzero'?'failed':'timeout');await next.executor.review(next.run.id,request(context));assert.equal(next.store.getReviewDecision(next.run.id).decision,'accept');pass(scenario==='nonzero'?'verification-nonzero':'verification-timeout');}
   if(scenario==='drift'){await assert.rejects(next.executor.review(next.run.id,request(context)),/版本不一致/);await next.executor.review(next.run.id,request(context,'reject'));assert.equal(next.store.getTask(next.run.task_id).state,'ready');pass('version-drift');}
   writeFileSync(join(evidence,`${scenario}.json`),JSON.stringify({run:next.store.getRun(next.run.id),review:context},null,2));
   if(scenario==='restart') {
    const saved=counts(next.store,next.run.id);await next.executor.close();next.store.close();
    const app=await createApplication({databasePath:join(root,scenario,'state.sqlite'),port:0,diagnostic:{fixtureRoot:root,profile:profile(helper),review:true}});
    try {
     assert.equal(app.store.getRun(next.run.id).state,'waiting_review');assert.deepEqual(counts(app.store,next.run.id),saved);pass('waiting-restart');
     const session=await (await fetch(app.origin+'/api/session')).json();const route=app.origin+`/api/runs/${next.run.id}/review`,input=request(context,'reject');
     assert.equal((await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).status,403);
     assert.equal((await fetch(route,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.invalid','X-WorkOS-Session':session.session_token},body:JSON.stringify(input)})).status,403);
     const checked=await (await fetch(route)).json();assert.equal(checked.package.sha256,context.package.sha256);
     const response=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json',Origin:app.origin,'X-WorkOS-Session':session.session_token},body:JSON.stringify(input)});assert.equal(response.status,201);assert.equal((await response.json()).decision.decision,'reject');pass('request-protection');
    }finally{await app.close();}
   }
  }finally{await next.executor.close();next.store.close();}
 }
 const child=fork(fileURLToPath(import.meta.url),['--review-owner',join(root,'owner'),helper],{stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});let errors='';child.stderr.on('data',data=>errors+=data);
 try {
  const details=await bounded(new Promise((resolveResult,reject)=>{child.once('message',resolveResult);child.once('error',reject);child.once('exit',()=>reject(new Error(errors)));}),fixtureSetupBudget+fixturePipelineBudget({review:true}), 'review owner IPC');assert.equal(typeof details.marker,'string');
  await wait(()=>existsSync(details.marker),fixtureCheckBudget,'review check start');const worker=JSON.parse(readFileSync(details.marker,'utf8'));assert.ok(Number.isInteger(worker.pid)&&worker.pid>0);
  assert.equal(child.kill('SIGKILL'),true);await bounded(new Promise(resolveClose=>child.once('close',resolveClose)),fixtureLimits.processClose,'review owner close');
  await wait(()=>{try{process.kill(worker.pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}},fixtureLimits.processClose,'review worker stop');
  const store=new Store(join(root,'owner','state.sqlite'));try{assert.equal(store.recoverInterrupted(),0);assert.equal(store.getRun(details.id).state,'waiting_review');assert.ok(store.resourceLock());assert.throws(()=>store.reservePreparation(details.task,'blocked-owner'),/资源/);const executor=new RealExecutor(store,join(root,'owner','runs'),profile(helper),undefined,identity);const context=await executor.reviewContext(details.id);await executor.review(details.id,request(context,'reject'));assert.equal(store.getTask(details.task).state,'blocked');assert.ok(store.resourceLock());await executor.close();writeFileSync(join(evidence,'owner-loss.json'),JSON.stringify({run:store.getRun(details.id),lock:store.resourceLock(),worker_stopped:true},null,2));}finally{store.close();}pass('check-owner-loss');
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await bounded(new Promise(resolveClose=>child.once('close',resolveClose)),fixtureLimits.processClose,'owned fixture cleanup');}}
 for(const [name,files] of [['decision-atomicity',['apps/server/test/review-store.test.mjs']],['artifact-crash-recovery',['experiments/milestone-0/test/artifact-crash-worker.test.mjs']],['ignored-tracked-package',['experiments/milestone-0/test/ignored-tracked-package.test.mjs']],['delivery-recovery',['tools/test-review-recovery.mjs']],['review-boundary-failures',['tools/test-review-boundaries.mjs']]]) {
  const timeout=name==='delivery-recovery'?fixtureSuiteBudget({pipelines:1,checks:4}):name==='review-boundary-failures'?fixtureSuiteBudget({pipelines:2,checks:4}):120000;
  const result=spawnSync(process.execPath,['--test',...files],{encoding:'utf8',windowsHide:true,timeout});writeFileSync(join(evidence,`${name}.txt`),`Parent budget: ${timeout}ms\n`+result.stdout+'\n'+result.stderr+(result.error?'\n'+result.error.stack:''));assert.equal(result.status,0,result.error?.message??result.stderr);pass(name);
 }
 assert.equal(identity(),initialIdentity,'source changed during G2');assert.deepEqual(g2Cases.filter(name=>cases[name]!=='passed'),[]);
 const g1=g1EvidencePath?readExecutionProfile(g1EvidencePath):null;if(g1EvidencePath)assert.ok(g1,'G2 activation requires current G1');
 const metadata=g1?JSON.parse(readFileSync(g1.evidence_path,'utf8')):{};
 const gitVersion=spawnSync('git',['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(gitVersion.status,0);
 const code=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true,timeout:5000});assert.equal(code.status,0);
 const manifest={code_sha:code.stdout.trim(),git_version:gitVersion.stdout.trim(),codex_version:g1?.codex_version??'fixture',g1_evidence_path:g1?.evidence_path??null,g1_code_sha:metadata.code_sha??null,schema:'fmvp-g2-v1',activation:g1?'passed':'diagnostic_only',source_identity:initialIdentity,platform:'win32/x64',node:process.version,node_executable:realpathSync(process.execPath),node_executable_sha256:sha256File(process.execPath),os_release:release(),model:g1?.model??'fixture',executable_sha256:g1?sha256File(g1.executable):null,helper_sha256:sha256File(helper),verification_shell_sha256:sha256File(verificationShell()),cases,root};
 writeFileSync(join(evidence,'g2.json'),JSON.stringify(manifest,null,2));return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
if(process.argv[2]==='--review-owner') {
 const root=process.argv[3],helper=process.argv[4],f=await setupVerificationFixture(root,helper,"[Console]::WriteLine('verified')",{review:true});f.executor.launch(f.run);await wait(()=>f.store.getRun(f.run.id).state==='waiting_review',f.pipelineBudget,'review owner pipeline');
 const native=f.executor.executeBoundary.bind(f.executor);f.executor.executeBoundary=(run,command)=>{if(command.check){const marker=join(command.check.directory,'started.json');process.send({id:run.id,task:run.task_id,marker});return native(run,{...command,argv:['-e',`require('node:fs').writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid}));setInterval(()=>{},1000)`]});}return native(run,command);};
 const context=await f.executor.reviewContext(f.run.id);await f.executor.review(f.run.id,request(context));
}else{await verifyG2({helper:resolve('experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe'),evidence:resolve(process.argv[2]??'verification-output/fmvp-04/g2-development'),g1EvidencePath:process.argv[3]});}

}
