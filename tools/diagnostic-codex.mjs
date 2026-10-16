import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexInvocation, resolveCodexExecutable } from '../apps/server/dist/codex-adapter.js';
import { ensureRepositoryMarker } from '../experiments/milestone-0/src/repository-marker.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const helper = path.join(root, 'experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');
assert.equal(process.platform, 'win32', 'diagnostic profile requires Windows');
assert.ok(existsSync(helper), 'build diagnostic-runner first');
const scenario = process.argv[2] ?? 'self-test';
assert.ok(['self-test', 'codex'].includes(scenario), 'use self-test or codex');
const model = process.argv[3];
if (scenario === 'codex') assert.ok(model?.trim() && !model.includes('\0'), 'codex mode requires an explicit model argument');
const directory = mkdtempSync(path.join(os.tmpdir(), 'agentic-codex-diagnostic-'));
const fixture = path.join(directory, 'repository');
mkdirSync(fixture);
function git(args) {
  const result = spawnSync('git', ['-C', fixture, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
git(['init']);
writeFileSync(path.join(fixture, 'README.md'), 'Disposable Codex diagnostic fixture.\n');
git(['add', 'README.md']);
git(['-c', 'user.name=Diagnostic', '-c', 'user.email=diagnostic@example.invalid', 'commit', '-m', 'fixture baseline']);
const revision = git(['rev-parse', 'HEAD']);
const repository = await ensureRepositoryMarker(fixture);
const codeHead = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

async function run(name, program, argv, timeout, cancel, ownerLoss = false, expectedSafe = true) {
  const id = randomUUID();
  const request = path.join(directory, `${name}.request.json`);
  writeFileSync(request, JSON.stringify({
    start: { kind: 'start', protocol: 'local-runner-jsonl-v0', request_id: `start-${id}`, run_id: id, program, argv, cwd: fixture, env: { inheritance_policy: 'allowlist', inherit_names: codexInvocation(fixture, 'fixture', 'self-test-no-model-execution').inheritNames, overrides: {}, unset: [] }, timeout_ms: timeout },
    runtime_id: randomUUID(), spawn_nonce: randomUUID(), repository_identity: repository.repositoryIdentity,
    base_revision: revision, helper_revision: `${codeHead}+working-tree`, receipt_path: path.join(directory, `${name}.receipt.json`),
  }));
  const child = spawn(helper, [request], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let exceededExitBudget = false;
  const watchdog = setTimeout(() => { exceededExitBudget = true; child.kill(); }, name === 'backpressure' ? 8000 : timeout + 15000);
  child.once('exit', () => { clearTimeout(watchdog); child.stdout.resume(); });
  const events = [];
  let pending = '';
  let diagnosticError = '';
  child.stderr.on('data', chunk => { diagnosticError += chunk; });
  child.stdout.on('data', chunk => {
    pending += chunk;
    for (;;) {
      const newline = pending.indexOf('\n');
      if (newline < 0) break;
      const event = JSON.parse(pending.slice(0, newline));
      pending = pending.slice(newline + 1);
      events.push(event);
      if (event.kind === 'started') {
        if (name === 'backpressure') {
          child.stdout.pause();
          setTimeout(() => child.stdin.end(), 250);
        } else if (ownerLoss) child.stdin.end();
        else if (cancel) child.stdin.write('cancel\ncancel\n');
      }
    }
  });
  child.stdin.on('error', () => {});
  const exit = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  child.stdin.destroy();
  assert.equal(exceededExitBudget, false, 'helper cleanup must not block on owner output pipe');
  writeFileSync(path.join(directory, `${name}.events.json`), JSON.stringify(events, null, 2));
  const terminal = events.find(event => event.kind === 'terminal');
  if (name !== 'backpressure') assert.equal(events.filter(event => event.kind === 'terminal').length, 1, 'exactly one terminal event');
  if (name === 'backpressure') {
    assert.equal(exit, 1, 'output transport failure must fail closed');
  } else if (expectedSafe !== null) {
    assert.equal(exit, expectedSafe ? 0 : 1, JSON.stringify({ events: events.filter(e => e.kind !== 'output'), diagnosticError }));
    assert.equal(terminal?.resource_state, expectedSafe ? 'safe' : 'unknown', 'must establish boundary empty and streams drained');
    assert.equal(terminal?.resource_lock, expectedSafe ? 'releasable' : 'held');
  }
  assert.ok(existsSync(path.join(directory, `${name}.receipt.json`)));
  return { events, terminal, helperExitCode: exit };
}

console.log(JSON.stringify({ evidenceDirectory: directory, codeHead, node: process.version, platform: `${process.platform}/${process.arch}`, mode: scenario }));
if (scenario === 'self-test') {
  const normal = await run('normal', process.execPath, ['-e', 'console.log("fixture-output")'], 10000);
  assert.equal(normal.terminal.exit_code, 0);
  assert.match(normal.events.filter(e => e.kind === 'output').map(e => Buffer.from(e.bytes).toString()).join(''), /fixture-output/);
  assert.equal((await run('nonzero', process.execPath, ['-e', 'process.exit(7)'], 10000)).terminal.exit_code, 7);
  assert.equal((await run('cancel', process.execPath, ['-e', 'setInterval(()=>{},1000)'], 10000, true)).terminal.trigger, 'cancel');
  assert.equal((await run('timeout', process.execPath, ['-e', 'setInterval(()=>{},1000)'], 100)).terminal.trigger, 'timeout');
  assert.equal((await run('owner-loss', process.execPath, ['-e', 'setInterval(()=>{},1000)'], 10000, false, true)).terminal.trigger, 'owner_loss');
  const descendant = await run('root-exits-first', process.execPath, ['-e', 'const child=require("node:child_process").spawn(process.execPath,["-e","console.log(123);setInterval(()=>{},1000)"],{detached:true,stdio:["ignore",process.stdout,process.stderr]});child.unref();setTimeout(()=>process.exit(0),1000)'], 10000, false, false, false);
  assert.equal(descendant.terminal.stdout_drained, false);
  assert.ok(descendant.terminal.failure_ledger.failures.includes('INCOMPLETE_DRAIN'));
  await run('backpressure', process.execPath, ['-e', 'setInterval(()=>{process.stdout.write("x".repeat(65536));process.stderr.write("y".repeat(65536))},1)'], 10000, false, true, null);
  console.log('PASS normal/nonzero/duplicate cancel/timeout/control stdin EOF/root exits while descendant holds streams/output backpressure. G1 remains closed.');
} else {
  const executable = resolveCodexExecutable();
  const version = spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true });
  assert.equal(version.status, 0);
  const invocation = codexInvocation(fixture, 'Create marker.txt in this disposable repository containing exactly codex-fixture-ok followed by a newline. Do not access other directories, invoke external services or commit.', model);
  const result = await run('codex', executable, invocation.argv, 180000, false, false, null);
  const output = result.events.filter(e => e.kind === 'output' && e.stream === 'stdout').map(e => Buffer.from(e.bytes).toString()).join('');
  const types = output.split('\n').filter(Boolean).map(line => JSON.parse(line).type);
  const marker = path.join(fixture, 'marker.txt');
  const summary = { codexExecutable: executable, codexVersion: version.stdout.trim(), model, userConfigIgnored: true, windowsSandbox: 'elevated', unifiedExec: false, exitCode: result.terminal?.exit_code, helperExitCode: result.helperExitCode, resourceState: result.terminal?.resource_state, resourceLock: result.terminal?.resource_lock, failureLedger: result.terminal?.failure_ledger, eventTypes: types, markerMatches: existsSync(marker) && readFileSync(marker, 'utf8') === 'codex-fixture-ok\n', g1: 'closed' };
  writeFileSync(path.join(directory, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  assert.equal(summary.exitCode, 0, 'real Codex exit must succeed');
  assert.equal(summary.resourceState, 'safe');
  assert.equal(summary.markerMatches, true, 'actual fixture modification required');
  assert.ok(types.includes('turn.completed'), 'require structured turn completion');
}
