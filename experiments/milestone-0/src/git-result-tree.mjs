import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, lstat } from 'node:fs/promises';

const exec = promisify(execFile);
const limit = 8 * 1024 * 1024;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const nullPath = process.platform === 'win32' ? 'NUL' : '/dev/null';
const safeEnv = () => ({...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_'))),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullPath,GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1'});
function decode(bytes) { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
function checkedPath(value) {
  if (!value || value.includes('\\') || /[\x00-\x1f]/.test(value) || path.posix.isAbsolute(value) || value.split('/').some(x=>x==='..'||x==='.git'||!x)) throw new Error('unsupported Git path');
  return value;
}
export async function captureWorkspaceVersion({workspace,baseRevision,gitExecutable='git'}) {
  if (!workspace || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(baseRevision)) throw new Error('workspace and full baseRevision required');
  const directory=await mkdtemp(path.join(os.tmpdir(),'m0-git-index-'));
  const env={...safeEnv(),GIT_INDEX_FILE:path.join(directory,'index')};
  const git=async (args,actualIndex=false) => (await exec(gitExecutable,['-c','core.hooksPath='+nullPath,'-c','core.fsmonitor=false','-c','core.autocrlf=false','-c','core.attributesFile='+nullPath,...args],{cwd:path.resolve(workspace),env:actualIndex?safeEnv():env,encoding:'buffer',windowsHide:true,timeout:30000,maxBuffer:limit})).stdout;
  const text=async args=>decode(await git(args)).trim();
  const head=async()=>{if(await text(['rev-parse','HEAD'])!==baseRevision) throw new Error('workspace HEAD drift');};
  const indexModes=async()=>{
    const modes=Object.create(null);
    for(const record of decode(await git(['ls-files','--stage','-z'],true)).split('\0').filter(Boolean)) {
      const tab=record.indexOf('\t');const [mode,,stage]=record.slice(0,tab).split(' ');const file=checkedPath(record.slice(tab+1));
      if(stage!=='0') throw new Error('unmerged index unsupported');
      modes[file]=mode;
    }
    return modes;
  };
  const inspect=async()=>{
    await head();
    if(await lstat(path.join(workspace,'.gitattributes')).catch(()=>null)) throw new Error('attributes content conversion unsupported');
    const records=decode(await git(['ls-files','--cached','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
    const result=Object.create(null); let size=0;
    for (const file of [...new Set(records)].sort()) {
      checkedPath(file);
      if (file.split('/').includes('.gitattributes')) throw new Error('attributes content conversion unsupported');
      const parts=file.split('/');
      for(let i=1;i<parts.length;i++) {
        const parent=path.join(workspace,...parts.slice(0,i));
        const stat=await lstat(parent).catch(error=>{if(error.code==='ENOENT') return null; throw error;});
        if(!stat) break;
        if(stat.isSymbolicLink()||!stat.isDirectory()) throw new Error('reparse or non-directory unsupported');
        if(await lstat(path.join(parent,'.gitattributes')).catch(()=>null)) throw new Error('attributes content conversion unsupported');
        if(await lstat(path.join(parent,'.git')).catch(()=>null)) throw new Error('nested repository unsupported');
      }
      const stat=await lstat(path.join(workspace,...parts)).catch(error=>{if(error.code==='ENOENT') return null; throw error;});
      if(!stat) continue;
      if(!stat.isFile()||stat.isSymbolicLink()) throw new Error('only ordinary files supported');
      if(stat.size>limit || records.length>10000) throw new Error('capture size limit exceeded');
      const bytes=await readFile(path.join(workspace,...parts)); size+=bytes.length; if(size>limit) throw new Error('capture size limit exceeded'); result[file]={sha256:sha(bytes),size:bytes.length};
    }
    return result;
  };
  try {
    await head();
    const gitDir=await text(['rev-parse','--absolute-git-dir']);
    if(await lstat(path.join(gitDir,'info','attributes')).catch(()=>null)) throw new Error('info attributes unsupported');
    const config=await text(['config','--local','--list']);
    if(/^(?:filter\.|include\.|includeif\.|extensions\.worktreeconfig=|core\.(?:autocrlf=(?!false)|eol=|attributesfile=))/mi.test(config)) throw new Error('local content conversion/filter/include unsupported');
    const actualModes=await indexModes();
    await git(['read-tree',baseRevision]);
    const before=await inspect();
    await git(['add','-A','--','.']);
    const resultTreeHash=await text(['write-tree']);
    const objectFormat=await text(['rev-parse','--show-object-format']);
    if(!['sha1','sha256'].includes(objectFormat)) throw new Error('unsupported object format');
    const tree=decode(await git(['ls-tree','-r','-z',resultTreeHash])).split('\0').filter(Boolean);
    const blobs=new Map();
    for(const record of tree) {
      const tab=record.indexOf('\t'); const [mode,type,oid]=record.slice(0,tab).split(' '); const file=checkedPath(record.slice(tab+1));
      if(!['100644','100755'].includes(mode)||type!=='blob') throw new Error('unsupported Git file mode');
      if(actualModes[file]&&actualModes[file]!==mode) throw new Error('staged Git mode differs from captured workspace mode');
      const bytes=await git(['cat-file','blob',oid]);
      if(!before[file]||sha(bytes)!==before[file].sha256) throw new Error('captured bytes changed or content conversion detected');
      blobs.set(file,{mode,bytes});
    }
    const names=decode(await git(['diff','--name-status','-z','--no-renames',baseRevision,resultTreeHash,'--'])).split('\0').filter(Boolean);
    const entries=[];
    for(let i=0;i<names.length;i+=2) {
      const status=names[i],file=checkedPath(names[i+1]);
      if(status==='D') entries.push({op:'delete',path:file});
      else if(['A','M','T'].includes(status)) {const {mode,bytes}=blobs.get(file);entries.push({op:'upsert',path:file,mode,size:bytes.length,sha256:sha(bytes),bytes});}
      else throw new Error('unsupported Git change status');
    }
    const diff=decode(await git(['diff','--binary','--no-ext-diff','--no-textconv','--no-renames',baseRevision,resultTreeHash,'--']));
    if(JSON.stringify(actualModes)!==JSON.stringify(await indexModes())||JSON.stringify(before)!==JSON.stringify(await inspect())) throw new Error('workspace changed during capture');
    const manifest=entries.map(({bytes,...entry})=>entry);
    return {baseRevision,objectFormat,resultTreeHash,manifestSha256:sha(JSON.stringify(manifest)),entries,diff,ignoredPolicy:'Git ignored untracked files excluded; tracked files always included'};
  } finally { await rm(directory,{recursive:true,force:true}); }
}
export async function computeResultTreeHash(options) {const {objectFormat,resultTreeHash}=await captureWorkspaceVersion(options);return {objectFormat,resultTreeHash};}
export async function collectWorkspaceChanges(options) {return (await captureWorkspaceVersion(options)).entries;}
