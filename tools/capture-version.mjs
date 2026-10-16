import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { captureWorkspaceVersion } from '../experiments/milestone-0/src/git-result-tree.mjs';
const [workspace,baseRevision,source,output]=process.argv.slice(2);
const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'NUL',GIT_TERMINAL_PROMPT:'0'};
const git=args=>execFileSync('git',['-c','core.fsmonitor=false','-c','core.hooksPath=NUL','-C',source,...args],{env,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:8*1024*1024}).trim();
try {
 if(git(['rev-parse','HEAD'])!==baseRevision||git(['status','--porcelain','--untracked-files=all'])) throw new Error('source baseline drift');
 const capture=await captureWorkspaceVersion({workspace,baseRevision});
 const result={...capture,entries:capture.entries.map(({bytes,...entry})=>entry)};
 const serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)>8*1024*1024) throw new Error('capture output size limit exceeded');
 if(git(['rev-parse','HEAD'])!==baseRevision||git(['status','--porcelain','--untracked-files=all'])) throw new Error('source baseline drift');
 writeFileSync(output,serialized,{flag:'wx'});
 console.log('capture complete');
} catch(error) { console.error(error.message);process.exitCode=1; }
