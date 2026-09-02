import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const fixture = new URL('../fixtures/hostile-process.mjs', import.meta.url);

async function createFixtureRun(document, { cwdName = 'workspace with spaces-中文', role = 'parent' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-hostile-'));
  const cwd = path.join(root, cwdName);
  await mkdir(cwd, { recursive: true });
  const scenario = path.join(root, 'scenario.json');
  const control = path.join(root, 'control.jsonl');
  const marker = path.join(root, 'marker.log');
  await writeFile(scenario, JSON.stringify(document), 'utf8');
  return { root, cwd, scenario, control, marker, role };
}

function spawnFixture(run) {
  const child = spawn(process.execPath, [
    fixture.pathname,
    '--root', run.root,
    '--scenario', run.scenario,
    '--control-file', run.control,
    '--marker', run.marker,
    '--role', run.role
  ], { cwd: run.cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
  return { child, closed, output: () => ({ stdout, stderr }) };
}

async function readControl(file) {
  const text = await readFile(file, 'utf8');
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function waitFor(predicate, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`condition not met within ${timeoutMs}ms`);
}

test('echoes cwd/argv and preserves per-stream frame order including segmented writes', async () => {
  const run = await createFixtureRun({ hostile_process_v0: {
    stdoutFrames: ['out-a', 'out-b'], stderrFrames: ['err-a', 'err-b'], segmentOutput: true,
    outputIntervalMs: 1, timingJitterMs: 2, exitMode: 'zero'
  } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  const { stdout, stderr } = proc.output();
  assert.ok(stdout.indexOf('parent:out-a') < stdout.indexOf('parent:out-b'));
  assert.ok(stderr.indexOf('parent:err-a') < stderr.indexOf('parent:err-b'));
  const events = await readControl(run.control);
  const started = events.find((event) => event.event === 'fixture.started');
  assert.equal(started.role, 'parent');
  assert.equal(started.payload.cwd, run.cwd);
  assert.deepEqual(started.payload.argv.includes('--scenario'), true);
  assert.equal(Number.isInteger(started.pid), true);
  assert.equal(Number.isInteger(started.ppid), true);
});

test('acknowledges one stdin nonce structurally before exiting', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { stdinNonce: true, exitMode: 'zero' } });
  const proc = spawnFixture(run);
  proc.child.stdin.write('nonce-123\n');
  proc.child.stdin.end();
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  assert.match(proc.output().stdout, /stdin:parent:nonce-123/);
  const events = await readControl(run.control);
  const ack = events.find((event) => event.event === 'stdin.acknowledged');
  assert.equal(ack.payload.nonce, 'nonce-123');
});

test('spawns an observable child and grandchild that share the control log', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { spawnChild: true, spawnGrandchild: true, delayedDescendantMs: 5, exitMode: 'zero' } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  const events = await readControl(run.control);
  const roles = new Set(events.filter((event) => event.event === 'fixture.started').map((event) => event.role));
  assert.deepEqual([...roles].sort(), ['child', 'grandchild', 'parent']);
  const spawned = events.filter((event) => event.event === 'descendant.spawned');
  assert.equal(spawned.some((event) => event.role === 'parent' && event.payload.childRole === 'child'), true);
  assert.equal(spawned.some((event) => event.role === 'child' && event.payload.childRole === 'grandchild'), true);
});

test('uses an explicit nonzero exit code without parsing human output', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { exitMode: 'nonzero', nonzeroExitCode: 19 } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 19);
  const events = await readControl(run.control);
  assert.equal(events.find((event) => event.event === 'fixture.exiting').payload.exitCode, 19);
});

test('hang mode stays alive with continuous output until the external test harness terminates it', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { exitMode: 'hang', continuousOutputIntervalMs: 10 } });
  const proc = spawnFixture(run);
  await waitFor(async () => (await readControl(run.control)).some((event) => event.event === 'fixture.started'));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.match(proc.output().stdout, /parent:tick:/);
  proc.child.kill('SIGKILL');
  const exit = await proc.closed;
  assert.equal(exit.signal === 'SIGKILL' || exit.code !== 0, true);
});

test('writes only the configured finite marker sequence inside the disposable root', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { markerWrites: 3, markerIntervalMs: 2, exitMode: 'zero' } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  const lines = (await readFile(run.marker, 'utf8')).trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.deepEqual(lines.map((line) => line.sequence), [1, 2, 3]);
  assert.deepEqual(new Set(lines.map((line) => line.role)), new Set(['parent']));
});

test('rejects a marker path that escapes the supplied disposable root', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { markerWrites: 1, exitMode: 'zero' } });
  run.marker = path.join(run.root, '..', 'escaped-marker.log');
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 1);
  assert.match(proc.output().stderr, /outside designated root/);
});

test('delays descendant creation by the declared amount', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { spawnChild: true, delayedDescendantMs: 40, exitMode: 'zero' } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  const events = await readControl(run.control);
  const started = events.find((event) => event.event === 'fixture.started' && event.role === 'parent');
  const spawned = events.find((event) => event.event === 'descendant.spawned' && event.role === 'parent');
  const elapsedNs = BigInt(spawned.monotonicNs) - BigInt(started.monotonicNs);
  assert.equal(elapsedNs >= 25_000_000n, true);
});

test('root-early-exit leaves an observable descendant action after the parent has closed', async () => {
  const run = await createFixtureRun({ hostile_process_v0: {
    spawnChild: true, rootExitBeforeDescendants: true, markerWrites: 1, markerIntervalMs: 50, exitMode: 'zero'
  } });
  const proc = spawnFixture(run);
  const exit = await proc.closed;
  assert.equal(exit.code, 0);
  const marker = await waitFor(async () => {
    const text = await readFile(run.marker, 'utf8');
    return text.includes('"role":"child"') ? text : null;
  }, 2000);
  assert.match(marker, /"role":"child"/);
  const events = await readControl(run.control);
  assert.equal(events.some((event) => event.event === 'descendant.spawned' && event.payload.detached === true), true);
});

test('an ignored soft-stop can intentionally create a controlled late marker write', async () => {
  const run = await createFixtureRun({ hostile_process_v0: { exitMode: 'hang', ignoreSoftStop: true, lateWriteDelayMs: 30 } });
  const proc = spawnFixture(run);
  try {
    await waitFor(async () => (await readControl(run.control)).some((event) => event.event === 'fixture.hanging'));
    proc.child.kill('SIGTERM');
    const marker = await waitFor(async () => {
      const text = await readFile(run.marker, 'utf8');
      return text.includes('late-after-sigterm') ? text : null;
    }, 2000);
    assert.match(marker, /late-after-sigterm/);
    const events = await readControl(run.control);
    const signal = events.find((event) => event.event === 'signal.received');
    assert.equal(signal.payload.ignored, true);
  } finally {
    if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill('SIGKILL');
    await proc.closed;
  }
});
