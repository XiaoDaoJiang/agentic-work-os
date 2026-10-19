import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, rm, writeFile, lstat, realpath, readdir, rmdir } from 'node:fs/promises';
import { validateChangePackageBytes, changePackageSha256 } from './change-package.mjs';
import { computeResultTreeHash } from './git-result-tree.mjs';

const execFileAsync = promisify(execFile);

async function git(checkout, args, gitExecutable = 'git') {
  const nullPath=process.platform==='win32'?'NUL':'/dev/null';
  const env={...Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_'))),GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullPath,GIT_TERMINAL_PROMPT:'0'};
  const { stdout = '' } = await execFileAsync(gitExecutable, ['-c','core.hooksPath='+nullPath,'-c','core.fsmonitor=false','-c','core.autocrlf=false',...args], {
    cwd: path.resolve(checkout),
    encoding: 'utf8',
    windowsHide: true, env, timeout:30000,
    maxBuffer: 8 * 1024 * 1024
  });
  return stdout.trim();
}

function resolveSafeTarget(checkout, gitPath) {
  const root = path.resolve(checkout);
  const target = path.resolve(root, ...gitPath.split('/'));
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`package path escapes checkout: ${gitPath}`);
  }
  return target;
}

function preflightOperations(manifest, checkout) {
  return manifest.entries.map((entry) => {
    const target = resolveSafeTarget(checkout, entry.path);
    if (entry.op === 'delete') return { op: 'delete', path: entry.path, target };
    return {
      op: 'upsert',
      path: entry.path,
      target,
      mode: entry.mode,
      bytes: Buffer.from(entry.content_base64, 'base64')
    };
  });
}

export async function replayChangePackage({ bytes, checkout, gitExecutable = 'git' }) {
  if (!checkout) throw new Error('checkout is required');
  const manifest = validateChangePackageBytes(bytes);
  const operations = preflightOperations(manifest, checkout);
  const resolvedCheckout = path.resolve(checkout);

  const head = await git(resolvedCheckout, ['rev-parse', 'HEAD'], gitExecutable);
  if (head !== manifest.base_revision) {
    throw new Error(`base revision mismatch: expected ${manifest.base_revision}, got ${head}`);
  }
  const objectFormat = await git(resolvedCheckout, ['rev-parse', '--show-object-format'], gitExecutable);
  if (objectFormat !== manifest.git_object_format) {
    throw new Error(`Git object format mismatch: expected ${manifest.git_object_format}, got ${objectFormat}`);
  }
  const dirty = await git(resolvedCheckout, ['status', '--porcelain=v1', '--untracked-files=all'], gitExecutable);
  if (dirty.length > 0) throw new Error('replay checkout must be clean before applying package');

  if(await realpath(resolvedCheckout)!==resolvedCheckout)throw new Error('checkout must not be a symlink');
  const visit=async(directory,root=false)=>{
    for(const item of await readdir(directory,{withFileTypes:true})){
      if(root&&item.name==='.git')continue;
      const target=path.join(directory,item.name),stat=await lstat(target);
      if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw new Error('replay requires ordinary files without symlinks');
      if(stat.isDirectory())await visit(target);
    }
  };
  await visit(resolvedCheckout,true);
  const removals=new Set(operations.filter(x=>x.op==='delete').map(x=>x.path));
  const modes=new Map((await git(resolvedCheckout,['ls-files','--stage'],gitExecutable)).split('\n').filter(Boolean).map(line=>[line.slice(line.indexOf('\t')+1),line.slice(0,6)]));
  for(const operation of operations.filter(x=>x.op==='delete')) {
    const current=await lstat(operation.target).catch(e=>{if(['ENOENT','ENOTDIR'].includes(e.code))return null;throw e;});
    if(current&&!current.isFile())throw new Error('delete target must be an ordinary file');
  }
  for(const operation of operations.filter(x=>x.op==='upsert')) {
    const parts=operation.path.split('/');
    for(let i=1;i<parts.length;i++){
      const parent=parts.slice(0,i).join('/');const info=await lstat(resolveSafeTarget(checkout,parent)).catch(e=>{if(['ENOENT','ENOTDIR'].includes(e.code))return null;throw e;});
      if(info?.isFile()&&!removals.has(parent))throw new Error('upsert ancestor is an undeleted file');
    }
    const current=await lstat(operation.target).catch(e=>{if(['ENOENT','ENOTDIR'].includes(e.code))return null;throw e;});
    if(current?.isDirectory())for(const file of modes.keys())if(file.startsWith(operation.path+'/')&&!removals.has(file))throw new Error('directory replacement requires all children deleted');
    if(process.platform==='win32'&&operation.mode==='100755'&&modes.get(operation.path)!=='100755')throw new Error('Windows profile cannot introduce executable mode');
  }
  for(const operation of operations.filter(x=>x.op==='delete').sort((a,b)=>b.path.length-a.path.length)) {
    const current=await lstat(operation.target).catch(e=>{if(['ENOENT','ENOTDIR'].includes(e.code))return null;throw e;});
    if(current&&!current.isFile())throw new Error('delete target must be an ordinary file');
    if(current)await rm(operation.target);
    let parent=path.dirname(operation.target);
    while(parent!==resolvedCheckout){
      try{await rmdir(parent);}catch(error){if(['ENOENT','ENOTEMPTY','EEXIST','ENOTDIR'].includes(error.code))break;throw error;}
      parent=path.dirname(parent);
    }
  }
  for(const operation of operations.filter(x=>x.op==='upsert')) {
    const current=await lstat(operation.target).catch(e=>{if(['ENOENT','ENOTDIR'].includes(e.code))return null;throw e;});
    if(current?.isDirectory())await rmdir(operation.target);
    await mkdir(path.dirname(operation.target),{recursive:true});
    await writeFile(operation.target,operation.bytes);
    await chmod(operation.target,operation.mode==='100755'?0o755:0o644);
  }

  const replayTree = await computeResultTreeHash({
    workspace: resolvedCheckout,
    baseRevision: manifest.base_revision,
    gitExecutable
  });
  if (replayTree.objectFormat !== manifest.git_object_format) throw new Error('replay object format changed unexpectedly');
  if (replayTree.resultTreeHash !== manifest.result_tree_hash) {
    throw new Error(`replay tree mismatch: expected ${manifest.result_tree_hash}, got ${replayTree.resultTreeHash}`);
  }
  return {
    checkout: resolvedCheckout,
    packageSha256: changePackageSha256(bytes),
    baseRevision: manifest.base_revision,
    expectedResultTreeHash: manifest.result_tree_hash,
    resultTreeHash: replayTree.resultTreeHash,
    appliedEntries: operations.length
  };
}
