import { RealExecutor } from '../dist/real-executor.js';
import { freezeVerification, parseVerificationSelection } from '../dist/verification.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Store } from '../dist/store.js';
import * as trees from '../../../experiments/milestone-0/src/git-result-tree.mjs';

const input = {goal:'fixture',definition_of_done:['observable'],repository_path:process.cwd(),verification_draft:{command:'DO_NOT_RUN',timeout_seconds:5}};
test('verification opt-in binds revision and idempotency; default retains draft only', t => {
  const root = mkdtempSync(join(tmpdir(),'workos-verification-store-')); const store = new Store(join(root,'state.sqlite')); t.after(()=>store.close());
  const task=store.createTask(input); const execution={profile_id:'fixture',workspace_path:root};
  const run=store.startRealRun(task.id,'default-request',execution).run;
  assert.equal(run.input_snapshot.verification,undefined);
  assert.throws(()=>store.replayRealRun(task.id,'default-request',{verify:true,expected_task_revision:1}), /请求|幂等/);
  store.finishRealRun(run.id,'succeeded','fixture',{},true);
  store.updateTask(task.id,{...input,verification_draft:{command:'CHANGED',timeout_seconds:5}});
  assert.throws(()=>store.startRealRun(task.id,'changed-request',execution,1,{verify:true,expected_task_revision:1}), /Task/);
});

test('capture is one immutable tree/blob/diff view and includes untracked, deletion and binary', async () => {
  const root=mkdtempSync(join(tmpdir(),'workos-capture-')); const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
  git(['init']); writeFileSync(join(root,'old.txt'),'old\n'); writeFileSync(join(root,'remove.txt'),'remove\n');
  git(['add','.']); git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']); const baseRevision=git(['rev-parse','HEAD']);
  writeFileSync(join(root,'old.txt'),'new\n'); git(['rm','remove.txt']); writeFileSync(join(root,'新.bin'),Buffer.from([0,1,255]));
  assert.equal(typeof trees.captureWorkspaceVersion,'function');
  const result=await trees.captureWorkspaceVersion({workspace:root,baseRevision});
  assert.equal(result.baseRevision,baseRevision); assert.equal(result.entries.length,3);
  assert.equal(result.entries.find(x=>x.path==='remove.txt').op,'delete');
  assert.deepEqual(result.entries.find(x=>x.path==='新.bin').bytes,Buffer.from([0,1,255]));
  assert.equal(git(['show',`${result.resultTreeHash}:old.txt`]),'new'); assert.match(result.diff,/new/);
  writeFileSync(join(root,'old.txt'),'later'); assert.equal(result.entries.find(x=>x.path==='old.txt').bytes.toString(),'new\n');
  writeFileSync(join(root,'.gitattributes'),'* text=auto\n'); await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/attributes|conversion/);
});


test('capture handles deleted tracked directory and literal __proto__ path', async () => {
 const root=mkdtempSync(join(tmpdir(),'workos-capture-delete-'));const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();git(['init']);mkdirSync(join(root,'dir'));writeFileSync(join(root,'dir','a.txt'),'a');writeFileSync(join(root,'__proto__'),'plain');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);const baseRevision=git(['rev-parse','HEAD']);rmSync(join(root,'dir'),{recursive:true});writeFileSync(join(root,'__proto__'),'changed');const capture=await trees.captureWorkspaceVersion({workspace:root,baseRevision});assert.deepEqual(capture.entries.map(x=>[x.path,x.op]),[['__proto__','upsert'],['dir/a.txt','delete']]);
 git(['config','core.autocrlf','true']);await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/conversion/);
});


test('verification requires explicit current revision and immutable evidence survives finalization', t=>{
 const root=mkdtempSync(join(tmpdir(),'workos-proof-'));const store=new Store(join(root,'state.sqlite'));t.after(()=>store.close());const task=store.createTask(input);
 assert.deepEqual(parseVerificationSelection({}),{verify:false});assert.throws(()=>parseVerificationSelection({verify:true}),/revision/);assert.throws(()=>parseVerificationSelection({verify:'yes'}),/布尔/);
 const frozen=freezeVerification(task);assert.deepEqual(frozen.verification_invocation_v0.env.overrides,{});assert.equal(frozen.requested_command,'DO_NOT_RUN');
 const run=store.startRealRun(task.id,'proof-request',{workspace_path:root},1,{verify:true,expected_task_revision:1},frozen).run;
 store.appendProgress(run.id,'agent','actual stage');store.recordStage(run.id,'agent',{resource_state:'safe'});store.appendOutput(run.id,'agent','stdout','真实输出');
 store.finishRealRun(run.id,'failed','agent_nonzero',{resource_state:'safe'},true,{outcome:'error',exit_code:null,version_match:'unknown',reason:'agent_not_successful'});
 assert.equal(store.getRun(run.id).phase,'agent');const proof=store.getRunEvidence(run.id);assert.equal(proof.verification.reason,'agent_not_successful');assert.equal(proof.output[0].text,'真实输出');
 for(const table of ['stage_observations','verification_results','stage_output','execution_facts'])assert.throws(()=>store.db.prepare(`DELETE FROM ${table} WHERE run_id=?`).run(run.id),/immutable/);
 store.finishRealRun(run.id,'succeeded','must_not_replace',{},true);assert.deepEqual(store.getRunEvidence(run.id),proof);
});

test('failed terminal persistence cannot escape as unhandled rejection or release durable lock',async t=>{
 const root=mkdtempSync(join(tmpdir(),'workos-proof-failure-'));const store=new Store(join(root,'state.sqlite'));t.after(()=>store.close());const task=store.createTask(input);const run=store.startRealRun(task.id,'failure-request',{workspace_path:root}).run;
 const executor=new RealExecutor(store,root,{});executor.execute=async()=>{throw new Error('fixture execution error');};store.finishRealRun=()=>{throw new Error('fixture disk write failure');};
 const rejected=[];const observe=error=>rejected.push(error);process.on('unhandledRejection',observe);t.after(()=>process.off('unhandledRejection',observe));executor.launch(run);await new Promise(resolve=>setTimeout(resolve,30));await executor.close();assert.deepEqual(rejected,[]);assert.equal(store.getRun(run.id).state,'running');assert.equal(store.resourceLock().run_id,run.id);assert.throws(()=>store.reservePreparation(task.id,'another-request'),/资源/);
});


test('capture rejects staged-only mode changes and ignored attributes instead of silently omitting them',async()=>{
 const root=mkdtempSync(join(tmpdir(),'workos-capture-mode-'));const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();git(['init']);git(['config','core.filemode','false']);writeFileSync(join(root,'file.txt'),'plain');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);const baseRevision=git(['rev-parse','HEAD']);
 git(['update-index','--chmod=+x','file.txt']);await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/staged Git mode/);
 git(['update-index','--chmod=-x','file.txt']);writeFileSync(join(root,'added.txt'),'added');git(['add','added.txt']);git(['update-index','--chmod=+x','added.txt']);await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/staged Git mode/);
 git(['update-index','--chmod=-x','added.txt']);const good=await trees.captureWorkspaceVersion({workspace:root,baseRevision});assert.equal(good.entries.find(x=>x.path==='added.txt').mode,'100644');
 writeFileSync(join(root,'.gitignore'),'.gitattributes\n');writeFileSync(join(root,'.gitattributes'),'* text=auto\n');await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/attributes/);
 rmSync(join(root,'.gitattributes'));git(['config','include.path','config-extra']);await assert.rejects(trees.captureWorkspaceVersion({workspace:root,baseRevision}),/include/);
});
