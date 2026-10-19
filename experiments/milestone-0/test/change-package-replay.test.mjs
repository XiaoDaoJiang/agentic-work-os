import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile, rename, mkdir, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { captureWorkspaceVersion, collectWorkspaceChanges, computeResultTreeHash } from '../src/git-result-tree.mjs';
import { buildChangePackage } from '../src/change-package.mjs';
import { replayChangePackage } from '../src/change-package-replay.mjs';
const execFileAsync=promisify(execFile);async function git(cwd,args){const {stdout=''}=await execFileAsync('git',['-c','core.autocrlf=false',...args],{cwd,encoding:'utf8'});return stdout.trim();}
const verificationInvocation={verification_invocation_v0:{execution:{mode:'argv',program:'node',argv:['--version']},cwd_binding:'assigned_workspace',env:{inheritance_policy:'none',inherit_names:[],overrides:{},unset:[]},timeout_ms:1000,output:{stdout:'separate ordered frames',stderr:'separate ordered frames'},cancel:'runner_owned_process_containment'}};
const evidence={agent_log:{artifact_id:'agent-log-1',sha256:'a'.repeat(64)},diff:{artifact_id:'diff-1',sha256:'b'.repeat(64)},verification_result:{artifact_id:'verification-1',sha256:'c'.repeat(64)}};
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'m0-cp-replay-'));const seed=path.join(root,'seed');await execFileAsync('git',['init',seed]);await git(seed,['config','user.email','m0@example.invalid']);await git(seed,['config','user.name','M0']);await writeFile(path.join(seed,'keep.txt'),'before\n');await writeFile(path.join(seed,'remove.txt'),'remove\n');await writeFile(path.join(seed,'old.txt'),'rename\n');await git(seed,['add','-A']);await git(seed,['commit','-m','base']);const baseRevision=await git(seed,['rev-parse','HEAD']);const workspace=path.join(root,'workspace');await execFileAsync('git',['-c','core.autocrlf=false','clone',seed,workspace]);await writeFile(path.join(workspace,'keep.txt'),'after\n');await rm(path.join(workspace,'remove.txt'));await rename(path.join(workspace,'old.txt'),path.join(workspace,'new.txt'));await writeFile(path.join(workspace,'binary.bin'),Buffer.from([0,255,7]));const changes=await collectWorkspaceChanges({workspace,baseRevision});const {objectFormat,resultTreeHash}=await computeResultTreeHash({workspace,baseRevision});const pkg=buildChangePackage({baseRevision,objectFormat,resultTreeHash,changes,evidence,verificationInvocation});return{root,seed,workspace,resultTreeHash,pkg};}
test('replayChangePackage reconstructs the same result tree after the original Workspace is deleted',async()=>{const f=await setup();await rm(f.workspace,{recursive:true,force:true});const checkout=path.join(f.root,'replay');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);const replay=await replayChangePackage({bytes:f.pkg.bytes,checkout});assert.equal(replay.resultTreeHash,f.resultTreeHash);assert.equal(replay.packageSha256,f.pkg.sha256);assert.equal(await readFile(path.join(checkout,'keep.txt'),'utf8'),'after\n');await assert.rejects(()=>readFile(path.join(checkout,'remove.txt')),/ENOENT/);assert.equal(await readFile(path.join(checkout,'new.txt'),'utf8'),'rename\n');assert.deepEqual(await readFile(path.join(checkout,'binary.bin')),Buffer.from([0,255,7]));});
test('replayChangePackage rejects a wrong base before mutating checkout bytes',async()=>{const f=await setup();const checkout=path.join(f.root,'wrong-base');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);await git(checkout,['config','user.email','m0@example.invalid']);await git(checkout,['config','user.name','M0']);await writeFile(path.join(checkout,'keep.txt'),'different committed base\n');await git(checkout,['add','keep.txt']);await git(checkout,['commit','-m','different']);const before=await readFile(path.join(checkout,'keep.txt'),'utf8');await assert.rejects(()=>replayChangePackage({bytes:f.pkg.bytes,checkout}),/base revision mismatch/);assert.equal(await readFile(path.join(checkout,'keep.txt'),'utf8'),before);assert.equal(await git(checkout,['status','--porcelain']),'');});
test('replayChangePackage rejects tampered payload before mutating checkout bytes',async()=>{const f=await setup();const checkout=path.join(f.root,'tampered');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);const before=await readFile(path.join(checkout,'keep.txt'),'utf8');const manifest=JSON.parse(f.pkg.bytes.toString('utf8'));manifest.entries.find((e)=>e.op==='upsert').content_base64=Buffer.from('tampered').toString('base64');await assert.rejects(()=>replayChangePackage({bytes:Buffer.from(JSON.stringify(manifest)+'\n'),checkout}),/payload size or sha256 mismatch/);assert.equal(await readFile(path.join(checkout,'keep.txt'),'utf8'),before);assert.equal(await git(checkout,['status','--porcelain']),'');});


test('all delete targets are checked before any mutation',async()=>{
 const f=await setup(),checkout=path.join(f.root,'bad-delete');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);
 await mkdir(path.join(checkout,'dir'));await writeFile(path.join(checkout,'dir','child'),'child');await git(checkout,['add','.']);await git(checkout,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','directory']);
 const baseRevision=await git(checkout,['rev-parse','HEAD']);const pkg=buildChangePackage({baseRevision,objectFormat:'sha1',resultTreeHash:f.resultTreeHash,changes:[{op:'delete',path:'keep.txt'},{op:'delete',path:'dir'}],evidence,verificationInvocation});
 await assert.rejects(replayChangePackage({bytes:pkg.bytes,checkout}),/ordinary file/);
 assert.equal(await readFile(path.join(checkout,'keep.txt'),'utf8'),'before\n');assert.equal(await readFile(path.join(checkout,'dir','child'),'utf8'),'child');assert.equal(await git(checkout,['status','--porcelain']),'');
});

test('capture and replay support file-directory replacements without recursive deletion',async()=>{
 const f=await setup();const workspace=path.join(f.root,'transitions');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,workspace]);
 await rm(path.join(workspace,'keep.txt'));await mkdir(path.join(workspace,'keep.txt'));await writeFile(path.join(workspace,'keep.txt','child'),'new child');
 const baseRevision=await git(workspace,['rev-parse','HEAD']);const changes=await collectWorkspaceChanges({workspace,baseRevision}),tree=await computeResultTreeHash({workspace,baseRevision});
 const pkg=buildChangePackage({baseRevision,...tree,changes,evidence,verificationInvocation});const checkout=path.join(f.root,'file-to-dir');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);
 assert.equal((await replayChangePackage({bytes:pkg.bytes,checkout})).resultTreeHash,tree.resultTreeHash);assert.equal(await readFile(path.join(checkout,'keep.txt','child'),'utf8'),'new child');
 await git(workspace,['add','.']);await git(workspace,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','directory']);const newBase=await git(workspace,['rev-parse','HEAD']);await rm(path.join(workspace,'keep.txt','child'));await rmdir(path.join(workspace,'keep.txt'));await writeFile(path.join(workspace,'keep.txt'),'regular again');
 const reverseChanges=await collectWorkspaceChanges({workspace,baseRevision:newBase}),reverseTree=await computeResultTreeHash({workspace,baseRevision:newBase});const reverse=buildChangePackage({baseRevision:newBase,...reverseTree,changes:reverseChanges,evidence,verificationInvocation});const reverseCheckout=path.join(f.root,'dir-to-file');await execFileAsync('git',['-c','core.autocrlf=false','clone',workspace,reverseCheckout]);assert.equal((await replayChangePackage({bytes:reverse.bytes,checkout:reverseCheckout})).resultTreeHash,reverseTree.resultTreeHash);assert.equal(await readFile(path.join(reverseCheckout,'keep.txt'),'utf8'),'regular again');
});


test('Agent commits are captured against frozen base and replay after Workspace deletion',async()=>{
 const f=await setup(),baseRevision=await git(f.workspace,['rev-parse','HEAD']);
 await git(f.workspace,['add','.']);await git(f.workspace,['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','agent implementation']);
 assert.notEqual(await git(f.workspace,['rev-parse','HEAD']),baseRevision);
 const changes=await collectWorkspaceChanges({workspace:f.workspace,baseRevision}),tree=await computeResultTreeHash({workspace:f.workspace,baseRevision});
 assert.ok(changes.some(entry=>entry.path==='new.txt'));const pkg=buildChangePackage({baseRevision,...tree,changes,evidence,verificationInvocation});
 const relative=path.relative(f.root,f.workspace);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));await rm(f.workspace,{recursive:true});
 const checkout=path.join(f.root,'committed-replay');await execFileAsync('git',['-c','core.autocrlf=false','clone',f.seed,checkout]);
 assert.equal((await replayChangePackage({bytes:pkg.bytes,checkout})).resultTreeHash,tree.resultTreeHash);assert.equal(await readFile(path.join(checkout,'new.txt'),'utf8'),'rename\n');
});

for (const ignored of [false, true]) {
 test(`sealed replay retains nested attributes and literal payload bytes, ignored=${ignored}`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-attributes-replay-'));
  const seed = path.join(root, 'seed');
  await execFileAsync('git', ['init', seed]);
  await git(seed, ['config', 'user.email', 'm0@example.invalid']); await git(seed, ['config', 'user.name', 'M0']);
  await mkdir(path.join(seed, 'kibana'));
  const attributes = '*.js text eol=lf\n*.md text eol=lf\n*.png binary\nREADME.md export-ignore\n';
  await writeFile(path.join(seed, 'kibana/app.js'), 'before\n');
  await writeFile(path.join(seed, 'kibana/README.md'), 'before\n');
  await writeFile(path.join(seed, 'kibana/image.png'), Buffer.from([0, 255, 13, 10]));
  if (ignored) await writeFile(path.join(seed, '.gitignore'), '.gitattributes\n');
  else await writeFile(path.join(seed, 'kibana/.gitattributes'), attributes);
  await git(seed, ['add', '.']); await git(seed, ['commit', '-m', 'base']);
  const baseRevision = await git(seed, ['rev-parse', 'HEAD']);
  const workspace = path.join(root, 'workspace');
  await execFileAsync('git', ['-c', 'core.autocrlf=false', 'clone', seed, workspace]);
  await writeFile(path.join(workspace, 'kibana/.gitattributes'), attributes + '# payload\n');
  await writeFile(path.join(workspace, 'kibana/app.js'), 'after\n');
  await writeFile(path.join(workspace, 'kibana/README.md'), 'kept\n');
  await writeFile(path.join(workspace, 'kibana/image.png'), Buffer.from([0, 255, 13, 10, 7]));
  if (ignored) await git(workspace, ['add', '-f', 'kibana/.gitattributes']);
  const capture = await captureWorkspaceVersion({ workspace, baseRevision });
  const pkg = buildChangePackage({ baseRevision, objectFormat: capture.objectFormat, resultTreeHash: capture.resultTreeHash, changes: capture.entries, evidence, verificationInvocation });
  assert.ok(capture.entries.some(entry => entry.path === 'kibana/.gitattributes'));
  assert.equal(path.dirname(workspace), root); await rm(workspace, { recursive: true });
  const checkout = path.join(root, 'replay');
  await execFileAsync('git', ['-c', 'core.autocrlf=false', 'clone', seed, checkout]);
  const index = await readFile(path.join(checkout, '.git/index'));
  assert.equal((await replayChangePackage({ bytes: pkg.bytes, checkout })).resultTreeHash, capture.resultTreeHash);
  assert.equal(await readFile(path.join(checkout, 'kibana/.gitattributes'), 'utf8'), attributes + '# payload\n');
  assert.equal(await readFile(path.join(checkout, 'kibana/app.js'), 'utf8'), 'after\n');
  assert.equal(await readFile(path.join(checkout, 'kibana/README.md'), 'utf8'), 'kept\n');
  assert.deepEqual(await readFile(path.join(checkout, 'kibana/image.png')), Buffer.from([0, 255, 13, 10, 7]));
  assert.deepEqual(await readFile(path.join(checkout, '.git/index')), index);
 });
}
