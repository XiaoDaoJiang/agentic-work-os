import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { runStageB, STAGE_B_PROTOCOL } from '../src/stage-b-client.mjs';

const runner = process.env.STAGE_B_RUNNER;
if (!runner) throw new Error('STAGE_B_RUNNER must point to the compiled Stage B binary');
const fixture = fileURLToPath(new URL('../fixtures/stage-b-child.mjs', import.meta.url));
const summary = { platform: process.platform, architecture: process.arch, node: process.version, cases: [] };

function start({ runId, cwd, mode, nonce, timeoutMs = 3000, exitCode }) {
  const argv = [fixture, '--mode', mode, '--nonce', nonce];
  if (exitCode !== undefined) argv.push('--exit-code', String(exitCode));
  return {
    protocol: STAGE_B_PROTOCOL,
    kind: 'start',
    request_id: `start-${runId}`,
    run_id: runId,
    program: process.execPath,
    argv,
    cwd,
    env: {
      inheritance_policy: 'allowlist',
      inherit_names: ['STAGE_B_INHERITED', 'SystemRoot', 'WINDIR', 'PATH', 'TEMP', 'TMP'],
      overrides: { STAGE_B_NONCE: '覆盖值' },
      unset: ['STAGE_B_SHOULD_NOT_EXIST']
    },
    timeout_ms: timeoutMs
  };
}

function input(runId, requestId, text) {
  return {
    protocol: STAGE_B_PROTOCOL,
    kind: 'input',
    request_id: requestId,
    run_id: runId,
    bytes_base64: Buffer.from(text).toString('base64')
  };
}

function finish(runId) {
  return {
    protocol: STAGE_B_PROTOCOL,
    kind: 'finish_input',
    request_id: `finish-${runId}`,
    run_id: runId
  };
}

async function workspace(name) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-stage-b-'));
  const cwd = path.join(root, name);
  await mkdir(cwd, { recursive: true });
  return cwd;
}

function observation(stdoutText) {
  const line = stdoutText.split(/\r?\n/).find((item) => item.startsWith('observation:'));
  assert.ok(line, `observation line missing from ${JSON.stringify(stdoutText)}`);
  return JSON.parse(line.slice('observation:'.length));
}

function event(result, kind) {
  const found = result.events.find((item) => item.event === kind);
  assert.ok(found, `missing event ${kind}`);
  return found;
}

test.after(async () => {
  if (process.env.STAGE_B_SUMMARY) {
    await writeFile(process.env.STAGE_B_SUMMARY, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  }
});

test('runs exact argv/cwd/env/stdin/stdout/stderr in a spaces and Chinese path', { timeout: 15000 }, async () => {
  process.env.STAGE_B_INHERITED = 'inherit-me';
  const cwd = await workspace('workspace with spaces 中文');
  const runId = 'stage-b-success';
  const nonce = 'nonce-成功';
  const result = await runStageB({
    executable: runner,
    requests: [
      start({ runId, cwd, mode: 'success', nonce }),
      input(runId, 'input-1', 'hello '),
      input(runId, 'input-2', '世界\n'),
      finish(runId)
    ]
  });

  assert.equal(result.helperExitCode, 0, result.helperStderr);
  assert.equal(result.completed.status, 'succeeded');
  assert.equal(result.completed.termination_reason, 'exit_zero');
  assert.equal(result.completed.exit_code, 0);
  assert.equal(result.completed.containment_applied, false);
  assert.equal(result.completed.observation_scope, 'root_only');

  const seen = observation(result.stdoutBytes.toString('utf8'));
  assert.equal(await realpath(seen.cwd), await realpath(cwd));
  assert.equal(seen.nonce, nonce);
  assert.equal(Buffer.from(seen.stdin_base64, 'base64').toString('utf8'), 'hello 世界\n');
  assert.equal(seen.env_value, '覆盖值');
  assert.equal(seen.inherited_probe, 'inherit-me');
  assert.ok(result.stderrBytes.toString('utf8').includes(`stderr:start:${nonce}`));
  assert.equal(result.events.filter((item) => item.event === 'input.accepted').length, 2);
  assert.equal(event(result, 'capabilities.reported').payload.containment_applied, false);
  summary.cases.push({ id: 'success', status: result.completed.status, event_count: result.events.length });
});

test('reports a nonzero child exit without failing the helper protocol', { timeout: 15000 }, async () => {
  const cwd = await workspace('failure 中文');
  const runId = 'stage-b-failure';
  const result = await runStageB({
    executable: runner,
    requests: [start({ runId, cwd, mode: 'failure', nonce: 'nonce-failure', exitCode: 7 }), finish(runId)]
  });
  assert.equal(result.helperExitCode, 0, result.helperStderr);
  assert.equal(result.completed.status, 'failed');
  assert.equal(result.completed.termination_reason, 'exit_nonzero');
  assert.equal(result.completed.exit_code, 7);
  assert.equal(event(result, 'process.exited').payload.exit_code, 7);
  summary.cases.push({ id: 'nonzero', status: result.completed.status, exit_code: result.completed.exit_code });
});

test('enforces timeout while explicitly disclosing root-only termination', { timeout: 15000 }, async () => {
  const cwd = await workspace('timeout 中文');
  const runId = 'stage-b-timeout';
  const startedAt = Date.now();
  const result = await runStageB({
    executable: runner,
    requests: [start({ runId, cwd, mode: 'hang', nonce: 'nonce-timeout', timeoutMs: 250 }), finish(runId)]
  });
  const elapsedMs = Date.now() - startedAt;
  assert.equal(result.helperExitCode, 0, result.helperStderr);
  assert.equal(result.completed.status, 'timed_out');
  assert.equal(result.completed.termination_reason, 'timeout_root_kill');
  assert.equal(result.completed.exit_code, null);
  assert.equal(result.completed.containment_applied, false);
  assert.ok(elapsedMs < 5000, `timeout took ${elapsedMs}ms`);
  assert.equal(event(result, 'boundary.snapshot').payload.active_processes, 0);
  assert.equal(event(result, 'boundary.snapshot').payload.observation_scope, 'root_only');
  summary.cases.push({ id: 'timeout', status: result.completed.status, elapsed_ms: elapsedMs });
});
