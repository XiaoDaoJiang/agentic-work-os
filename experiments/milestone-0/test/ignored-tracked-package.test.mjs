import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {captureWorkspaceVersion} from '../src/git-result-tree.mjs';
import {buildChangePackage} from '../src/change-package.mjs';
import {replayChangePackage} from '../src/change-package-replay.mjs';

const execute=promisify(execFile);
const git=async(cwd,...args)=>(await execute('git',['-c','core.autocrlf=false','-c','user.name=Fixture','-c','user.email=fixture@example.invalid',...args],{cwd,encoding:'utf8',windowsHide:true,timeout:30000})).stdout.trim();
const evidence=Object.fromEntries(['agent_log','diff','verification_result'].map((type,i)=>[type,{artifact_id:type,sha256:String(i+1).repeat(64)}]));
const verificationInvocation={verification_invocation_v0:{execution:{mode:'argv',program:'node',argv:['--version']},cwd_binding:'assigned_workspace',env:{inheritance_policy:'none',inherit_names:[],overrides:{},unset:[]},timeout_ms:1000,output:{stdout:'separate ordered frames',stderr:'separate ordered frames'},cancel:'runner_owned_process_containment'}};

for(const committed of [true,false])test(`ignored file force-added by Agent is captured and replayable (${committed?'committed':'staged'})`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'workos-ignored-package-')),source=join(root,'source'),workspace=join(root,'workspace');
 await git(root,'init',source);await writeFile(join(source,'.gitignore'),'generated.txt\nignored-untracked.txt\n');await git(source,'add','.');await git(source,'commit','-m','base');
 const baseRevision=await git(source,'rev-parse','HEAD');await git(root,'clone',source,workspace);
 const bytes=Buffer.from([0,255,1,13,10,37]);await writeFile(join(workspace,'generated.txt'),bytes);await writeFile(join(workspace,'ignored-untracked.txt'),'excluded');await git(workspace,'add','-f','--','generated.txt');
 if(committed)await git(workspace,'commit','-m','Agent generated result');
 const expectedTree=await git(workspace,'write-tree'),indexBefore=await git(workspace,'ls-files','--stage');
 const captured=await captureWorkspaceVersion({workspace,baseRevision});
 assert.deepEqual(captured.entries.find(entry=>entry.path==='generated.txt')?.bytes,bytes);
 assert.equal(captured.resultTreeHash,expectedTree);assert.equal(captured.entries.some(entry=>entry.path==='ignored-untracked.txt'),false);assert.equal(await git(workspace,'ls-files','--stage'),indexBefore);
 const pkg=buildChangePackage({...captured,changes:captured.entries,evidence,verificationInvocation});
 const target=resolve(workspace),within=relative(root,target);assert.ok(within&&!within.startsWith('..')&&!isAbsolute(within));await rm(target,{recursive:true});
 const checkout=join(root,'replay');await git(root,'clone',source,checkout);const replay=await replayChangePackage({bytes:pkg.bytes,checkout});
 assert.equal(replay.resultTreeHash,expectedTree);assert.deepEqual(await readFile(join(checkout,'generated.txt')),bytes);
});
