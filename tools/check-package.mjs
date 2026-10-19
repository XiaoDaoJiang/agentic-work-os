import {readFileSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateChangePackageBytes} from '../experiments/milestone-0/src/change-package.mjs';
import {replayChangePackage} from '../experiments/milestone-0/src/change-package-replay.mjs';
import {captureWorkspaceVersion} from '../experiments/milestone-0/src/git-result-tree.mjs';

const request=JSON.parse(readFileSync(process.argv[2],'utf8'));
const directory=realpathSync(process.cwd());
const env={...Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.toUpperCase().startsWith('GIT_'))),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:process.platform==='win32'?'NUL':'/dev/null',GIT_TERMINAL_PROMPT:'0'};
const git=(cwd,args)=>execFileSync('git',['-c','core.hooksPath='+env.GIT_CONFIG_GLOBAL,'-c','core.fsmonitor=false','-c','core.autocrlf=false','-C',cwd,...args],{encoding:'utf8',env,windowsHide:true,timeout:30000,maxBuffer:8*1024*1024}).trim();
try {
 const bytes=readFileSync(request.package_path);
 if(createHash('sha256').update(bytes).digest('hex')!==request.package_sha256)throw new Error('package hash mismatch');
 const manifest=validateChangePackageBytes(bytes);
 if(manifest.base_revision!==request.base_revision)throw new Error('package base mismatch');
 const source=realpathSync(request.source_path);
 const within=relative(source,directory);
 if(!within.startsWith('..')&&!isAbsolute(within))throw new Error('check directory cannot be inside source');
 const checkSource=()=>git(source,['rev-parse','HEAD'])===manifest.base_revision&&!git(source,['status','--porcelain','--untracked-files=all']);
 let drift=checkSource()?'clear':'detected';
 const checkout=join(directory,'checkout');
 if(existsSync(checkout))throw new Error('check checkout already exists');
 git(directory,['clone','--no-local','--no-hardlinks','--no-checkout','--',source,checkout]);
 git(checkout,['checkout','--detach',manifest.base_revision]);
 git(checkout,['remote','remove','origin']);
 const replay=await replayChangePackage({bytes,checkout});
 if(existsSync(request.workspace_path)) {
   const capture=await captureWorkspaceVersion({workspace:request.workspace_path,baseRevision:manifest.base_revision});
   if(capture.headRevision!==request.workspace_head||capture.resultTreeHash!==manifest.result_tree_hash||capture.manifestSha256!==request.manifest_sha256)drift='detected';
 }
 if(!checkSource())drift='detected';
 const output=resolve(directory,'result.json');
 writeFileSync(output,JSON.stringify({package_sha256:request.package_sha256,drift,replay:{base_revision:replay.baseRevision,result_tree_hash:replay.resultTreeHash}}),{flag:'wx'});
 console.log('package replay checked');
} catch(error) {console.error(error.message);process.exitCode=1;}
