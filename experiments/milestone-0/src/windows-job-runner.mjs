import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { reduceBoundaryFrames } from './process-boundary-protocol.mjs';

function windowsAbsolute(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    throw new Error(`${label} must be an absolute Windows path`);
  }
  if (!/^(?:[A-Za-z]:[\\/]|\\\\)/.test(value)) throw new Error(`${label} must be an absolute Windows path`);
  return value;
}
function assertArgv(argv) {
  if (!Array.isArray(argv) || argv.some((v)=>typeof v!=='string'||v.includes('\0'))) throw new Error('argv must be an array of NUL-free strings');
}
export function encodeWindowsJobLaunchSpec({ program, argv, cwd }) {
  windowsAbsolute(program,'program'); windowsAbsolute(cwd,'cwd'); assertArgv(argv);
  return Buffer.from(JSON.stringify({program,argv,cwd}),'utf8').toString('base64url');
}
export function decodeWindowsJobLaunchSpec(encoded) {
  if (typeof encoded!=='string'||!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('launchSpec must be base64url');
  let value;
  try { value=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')); } catch(error){ throw new Error(`launchSpec is invalid: ${error.message}`); }
  encodeWindowsJobLaunchSpec(value);
  return value;
}
export function buildWindowsJobRunnerArgs({ helperScript, launchSpec, controlFile, cancelFile, pollIntervalMs=25 }) {
  windowsAbsolute(helperScript,'helperScript'); windowsAbsolute(controlFile,'controlFile'); windowsAbsolute(cancelFile,'cancelFile');
  decodeWindowsJobLaunchSpec(launchSpec);
  if (!Number.isSafeInteger(pollIntervalMs)||pollIntervalMs<=0) throw new Error('pollIntervalMs must be a positive integer');
  return ['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helperScript,
    '-LaunchSpec',launchSpec,'-ControlFile',controlFile,'-CancelFile',cancelFile,'-PollIntervalMs',String(pollIntervalMs)];
}
export async function readAndReduceBoundaryControlLog(controlFile,{readFileFn=readFile}={}) {
  const text=await readFileFn(controlFile,'utf8');
  const frames=String(text).split(/\r?\n/).filter(Boolean).map((line,index)=>{
    try{return JSON.parse(line);}catch(error){throw new Error(`invalid control JSONL line ${index+1}: ${error.message}`);}
  });
  if (frames.length===0) throw new Error('boundary control log is empty');
  return reduceBoundaryFrames(frames);
}
export async function startWindowsJobRun(options) {
  if (!options||typeof options!=='object') throw new Error('options are required');
  const platform=options.platform ?? process.platform;
  if (platform!=='win32') throw new Error('Windows Job Object runner requires Windows');
  const launchSpec=encodeWindowsJobLaunchSpec({program:options.program,argv:options.argv??[],cwd:options.cwd});
  const powershellExecutable=options.powershellExecutable ?? 'powershell.exe';
  const args=buildWindowsJobRunnerArgs({
    helperScript:options.helperScript,launchSpec,controlFile:options.controlFile,cancelFile:options.cancelFile,pollIntervalMs:options.pollIntervalMs??25
  });
  const mkdirFn=options.mkdirFn ?? mkdir, rmFn=options.rmFn ?? rm, writeFileFn=options.writeFileFn ?? writeFile;
  await mkdirFn(path.win32.dirname(options.controlFile),{recursive:true});
  await mkdirFn(path.win32.dirname(options.cancelFile),{recursive:true});
  await rmFn(options.controlFile,{force:true});
  await rmFn(options.cancelFile,{force:true});
  const spawnFn=options.spawnFn ?? nodeSpawn;
  const child=spawnFn(powershellExecutable,args,{stdio:['pipe','pipe','pipe'],windowsHide:true});
  if (!child||!child.stdin||!child.stdout||!child.stderr||typeof child.on!=='function') throw new Error('spawnFn must return a child process with stdin/stdout/stderr');
  const stdoutFrames=[], stderrFrames=[];
  let stdoutSequence=0, stderrSequence=0, stdoutDrained=false, stderrDrained=false;
  child.stdout.on('data',(bytes)=>stdoutFrames.push({sequence:++stdoutSequence,bytes:Buffer.from(bytes)}));
  child.stderr.on('data',(bytes)=>stderrFrames.push({sequence:++stderrSequence,bytes:Buffer.from(bytes)}));
  const stdoutDrain=new Promise((resolve)=>{let done=false;const finish=()=>{if(done)return;done=true;stdoutDrained=true;resolve();};child.stdout.once('end',finish);child.stdout.once('close',finish);});
  const stderrDrain=new Promise((resolve)=>{let done=false;const finish=()=>{if(done)return;done=true;stderrDrained=true;resolve();};child.stderr.once('end',finish);child.stderr.once('close',finish);});
  const sendInput=async(bytes)=>{
    const payload=Buffer.isBuffer(bytes)?bytes:bytes instanceof Uint8Array||typeof bytes==='string'?Buffer.from(bytes):null;
    if (!payload) throw new Error('input bytes must be Buffer, Uint8Array, or string');
    if (child.stdin.destroyed||child.stdin.writableEnded) throw new Error('runner stdin is closed');
    if (!child.stdin.write(payload)) await new Promise((resolve)=>child.stdin.once('drain',resolve));
    return {byteLength:payload.length};
  };
  let cancelRequested=false;
  const cancel=async(requestId='cancel')=>{
    if (cancelRequested) return {requested:false,requestId};
    if (typeof requestId!=='string'||requestId.length===0) throw new Error('cancel requestId is required');
    cancelRequested=true;
    await writeFileFn(options.cancelFile,`${JSON.stringify({requestId,requestedAt:new Date().toISOString()})}\n`,'utf8');
    return {requested:true,requestId};
  };
  const readControlLogFn=options.readControlLogFn ?? ((file)=>readAndReduceBoundaryControlLog(file));
  const completion=new Promise((resolve,reject)=>{
    child.once?.('error',reject) ?? child.on('error',reject);
    child.on('close',async(exitCode,signal)=>{
      try {
        await Promise.all([stdoutDrain,stderrDrain]);
        const boundary=await readControlLogFn(options.controlFile);
        resolve({exitCode,signal,boundary,cancelRequested,stdoutDrained,stderrDrained});
      } catch(error){ reject(error); }
    });
  });
  return {process:child,sendInput,cancel,completion,stdoutFrames,stderrFrames,launchSpec,args};
}
