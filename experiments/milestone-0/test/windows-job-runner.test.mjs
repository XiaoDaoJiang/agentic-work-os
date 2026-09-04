import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  encodeWindowsJobLaunchSpec, decodeWindowsJobLaunchSpec,
  buildWindowsJobRunnerArgs, readAndReduceBoundaryControlLog,
  startWindowsJobRun
} from '../src/windows-job-runner.mjs';

test('launch spec round-trips argv literally without shell interpretation', () => {
  const spec={program:'C:\\Program Files\\Node\\node.exe',argv:['a b','$()','>','中文'],cwd:'C:\\work dir\\项目'};
  const encoded=encodeWindowsJobLaunchSpec(spec);
  assert.match(encoded,/^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeWindowsJobLaunchSpec(encoded),spec);
});

test('launch spec rejects relative Windows paths, NUL and non-string argv', () => {
  assert.throws(()=>encodeWindowsJobLaunchSpec({program:'node.exe',argv:[],cwd:'C:\\work'}),/absolute Windows path/);
  assert.throws(()=>encodeWindowsJobLaunchSpec({program:'C:\\node.exe',argv:['bad\0'],cwd:'C:\\work'}),/argv/);
  assert.throws(()=>encodeWindowsJobLaunchSpec({program:'C:\\node.exe',argv:[1],cwd:'C:\\work'}),/argv/);
});

test('runner args use -File and opaque launch spec instead of a shell command string', () => {
  const spec=encodeWindowsJobLaunchSpec({program:'C:\\node.exe',argv:['a b'],cwd:'C:\\work'});
  const args=buildWindowsJobRunnerArgs({
    helperScript:'C:\\repo\\windows-job-runner.ps1',launchSpec:spec,
    controlFile:'C:\\evidence\\control.jsonl',cancelFile:'C:\\evidence\\cancel.json',pollIntervalMs:25
  });
  assert.deepEqual(args.slice(0,7),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','C:\\repo\\windows-job-runner.ps1']);
  assert.ok(args.includes(spec));
  assert.equal(args.some((x)=>x==='-Command'),false);
});

test('control log must be valid ordered boundary frames', async () => {
  const lines=[
    {sequence:1,at:'2026-08-31T00:00:00.000Z',kind:'boundary.created',payload:{boundaryId:'job-1',rootPid:12,rootCreatedAt:'2026-08-31T00:00:00.000Z'}},
    {sequence:2,at:'2026-08-31T00:00:00.001Z',kind:'process.assigned',payload:{pid:12,createdAt:'2026-08-31T00:00:00.000Z',role:'root'}},
    {sequence:3,at:'2026-08-31T00:00:00.002Z',kind:'boundary.snapshot',payload:{activeProcesses:0}},
    {sequence:4,at:'2026-08-31T00:00:00.003Z',kind:'helper.exited',payload:{exitCode:0}}
  ].map(JSON.stringify).join('\n')+'\n';
  const reduced=await readAndReduceBoundaryControlLog('control.jsonl',{readFileFn:async()=>lines});
  assert.equal(reduced.boundaryId,'job-1'); assert.equal(reduced.activeProcesses,0); assert.equal(reduced.helperExited.exitCode,0);
  await assert.rejects(()=>readAndReduceBoundaryControlLog('control.jsonl',{readFileFn:async()=>lines.replace('"sequence":4','"sequence":2')}),/strictly increase/);
});

test('startWindowsJobRun rejects non-Windows instead of pretending containment', async () => {
  await assert.rejects(()=>startWindowsJobRun({
    platform:'linux',program:'C:\\node.exe',argv:[],cwd:'C:\\work',
    helperScript:'C:\\runner.ps1',controlFile:'C:\\e\\control.jsonl',cancelFile:'C:\\e\\cancel.json'
  }),/requires Windows/);
});

test('input, cancel and raw stream/drain facts remain separate and deterministic', async () => {
  const writes=[]; const stdinBytes=[]; const child=new EventEmitter(); child.stdin=new PassThrough(); child.stdout=new PassThrough(); child.stderr=new PassThrough();
  child.stdin.on('data',(d)=>stdinBytes.push(Buffer.from(d)));
  let spawnOptions=null;
  const spawnFn=(_exe,_args,opts)=>{spawnOptions=opts;return child;};
  const run=await startWindowsJobRun({
    platform:'win32',program:'C:\\node.exe',argv:['x'],cwd:'C:\\work',
    helperScript:'C:\\runner.ps1',controlFile:'C:\\e\\control.jsonl',cancelFile:'C:\\e\\cancel.json',
    spawnFn, mkdirFn:async()=>{}, rmFn:async()=>{}, writeFileFn:async(p,b)=>writes.push([p,String(b)]),
    readControlLogFn:async()=>({boundaryId:'job-1',activeProcesses:0,helperExited:{exitCode:0}})
  });
  assert.deepEqual(spawnOptions.stdio,['pipe','pipe','pipe']);
  await run.sendInput(Buffer.from('nonce\n'));
  assert.equal(Buffer.concat(stdinBytes).toString(),'nonce\n');
  child.stdout.write(Buffer.from('out')); child.stderr.write(Buffer.from('err'));
  await run.cancel('req-1'); await run.cancel('req-2');
  assert.equal(writes.length,1); assert.match(writes[0][1],/"requestId":"req-1"/);
  child.stdout.end(); child.stderr.end(); child.emit('close',0,null);
  const completion=await run.completion;
  assert.equal(completion.exitCode,0); assert.equal(run.stdoutFrames.length,1); assert.equal(run.stderrFrames.length,1);
  assert.equal(run.stdoutFrames[0].bytes.toString(),'out'); assert.equal(run.stderrFrames[0].bytes.toString(),'err');
  assert.equal(completion.stdoutDrained,true); assert.equal(completion.stderrDrained,true);
});
