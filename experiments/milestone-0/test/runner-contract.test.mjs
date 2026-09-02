import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  RunnerEventReducer,
  parseRunnerJsonLine,
  validateRunnerCapabilities,
  validateRunnerRequest
} from '../src/runner-contract.mjs';

const windowsCapabilities = {
  capability_version: 'runner-capabilities-v0',
  platform: 'windows',
  architecture: 'x86_64',
  mechanism: 'windows_job_object',
  whole_tree_termination: true,
  kill_on_owner_exit: true,
  membership_observable: true,
  soft_stop_scope: 'whole_tree',
  escape_resistance: 'strong',
  separate_stdout_stderr: true,
  interactive_stdin: true,
  timeout: true,
  provider: { name: 'processkit', version: '3.3.4' }
};

function event(sequence, kind, payload = {}, runId = 'run-1') {
  return {
    protocol: 'local-runner-jsonl-v0',
    sequence,
    at: new Date(1700000000000 + sequence).toISOString(),
    run_id: runId,
    kind,
    payload
  };
}

test('capabilities accept strong Job/cgroup profiles and limited process groups', () => {
  assert.equal(validateRunnerCapabilities(windowsCapabilities).mechanism, 'windows_job_object');
  const linux = validateRunnerCapabilities({
    ...windowsCapabilities,
    platform: 'linux',
    mechanism: 'linux_cgroup_v2'
  });
  assert.equal(linux.escape_resistance, 'strong');
  const macos = validateRunnerCapabilities({
    ...windowsCapabilities,
    platform: 'macos',
    mechanism: 'posix_process_group',
    kill_on_owner_exit: false,
    soft_stop_scope: 'best_effort',
    escape_resistance: 'process_group'
  });
  assert.equal(macos.escape_resistance, 'process_group');
});

test('capabilities reject mechanism/platform mismatch and inflated process-group guarantees', () => {
  assert.throws(() => validateRunnerCapabilities({
    ...windowsCapabilities,
    platform: 'macos'
  }), /windows_job_object.*windows/i);
  assert.throws(() => validateRunnerCapabilities({
    ...windowsCapabilities,
    platform: 'macos',
    mechanism: 'posix_process_group'
  }), /process group cannot claim strong/i);
  assert.throws(() => validateRunnerCapabilities({
    ...windowsCapabilities,
    mechanism: 'unknown'
  }), /mechanism/i);
});

test('start/input/finish/cancel requests validate the frozen protocol', () => {
  const start = validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0',
    kind: 'start',
    request_id: 'req-1',
    run_id: 'run-1',
    program: path.resolve('node'),
    argv: ['--version'],
    cwd: path.resolve('.'),
    env: { inheritance_policy: 'none', inherit_names: [], overrides: {}, unset: [] },
    timeout_ms: 1000
  });
  assert.equal(start.kind, 'start');
  assert.equal(validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0', kind: 'input', request_id: 'req-2', run_id: 'run-1', bytes_base64: 'bm9uY2U='
  }).kind, 'input');
  assert.equal(validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0', kind: 'finish_input', request_id: 'req-3', run_id: 'run-1'
  }).kind, 'finish_input');
  assert.equal(validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0', kind: 'cancel', request_id: 'req-4', run_id: 'run-1'
  }).kind, 'cancel');
});

test('requests reject protocol mismatch, implicit env inheritance and malformed base64', () => {
  assert.throws(() => validateRunnerRequest({ protocol: 'other', kind: 'cancel', request_id: 'r', run_id: 'x' }), /protocol/i);
  assert.throws(() => validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0', kind: 'input', request_id: 'r', run_id: 'x', bytes_base64: 'not base64!'
  }), /base64/i);
  assert.throws(() => validateRunnerRequest({
    protocol: 'local-runner-jsonl-v0', kind: 'start', request_id: 'r', run_id: 'x',
    program: path.resolve('node'), argv: [], cwd: path.resolve('.'),
    env: { inheritance_policy: 'none', inherit_names: ['PATH'], overrides: {}, unset: [] }, timeout_ms: 1
  }), /inherit_names.*empty/i);
});

test('parseRunnerJsonLine accepts one object and rejects blank, malformed, or array JSON', () => {
  assert.deepEqual(parseRunnerJsonLine('{"kind":"cancel"}'), { kind: 'cancel' });
  assert.throws(() => parseRunnerJsonLine('  '), /blank/i);
  assert.throws(() => parseRunnerJsonLine('{'), /invalid runner JSON/i);
  assert.throws(() => parseRunnerJsonLine('[]'), /object/i);
});

test('event reducer accepts an ordered successful run with separate stream drains', () => {
  const reducer = new RunnerEventReducer();
  const frames = [
    event(1, 'runner.ready'),
    event(2, 'capabilities.reported', windowsCapabilities),
    event(3, 'boundary.created', { boundary_id: 'boundary-1', root_pid: 101 }),
    event(4, 'process.started', { pid: 101 }),
    event(5, 'stdout.frame', { stream_sequence: 1, bytes_base64: 'aGVsbG8=', byte_length: 5 }),
    event(6, 'stderr.frame', { stream_sequence: 1, bytes_base64: 'ZXJy', byte_length: 3 }),
    event(7, 'stdout.drained', { final_sequence: 1 }),
    event(8, 'stderr.drained', { final_sequence: 1 }),
    event(9, 'boundary.snapshot', { active_processes: 0 }),
    event(10, 'process.exited', { pid: 101, exit_code: 0, signal: null }),
    event(11, 'run.completed', { status: 'succeeded', exit_code: 0, termination_reason: 'natural_exit' })
  ];
  for (const frame of frames) reducer.push(frame);
  const state = reducer.snapshot();
  assert.equal(state.completed, true);
  assert.equal(state.streams.stdout.drained, true);
  assert.equal(state.streams.stderr.drained, true);
  assert.equal(state.activeProcesses, 0);
});

test('event reducer rejects global/stream regressions and run-id changes', () => {
  const reducer = new RunnerEventReducer();
  reducer.push(event(1, 'runner.ready'));
  assert.throws(() => reducer.push(event(1, 'boundary.created', { boundary_id: 'b', root_pid: 1 })), /sequence.*increase/i);
  assert.throws(() => reducer.push(event(2, 'boundary.created', { boundary_id: 'b', root_pid: 1 }, 'other')), /run_id/i);

  const streams = new RunnerEventReducer();
  streams.push(event(1, 'runner.ready'));
  streams.push(event(2, 'stdout.frame', { stream_sequence: 1, bytes_base64: 'YQ==', byte_length: 1 }));
  assert.throws(() => streams.push(event(3, 'stdout.frame', { stream_sequence: 1, bytes_base64: 'Yg==', byte_length: 1 })), /stream_sequence.*increase/i);
});

test('event reducer rejects incorrect byte length and frames after drain', () => {
  const length = new RunnerEventReducer();
  length.push(event(1, 'runner.ready'));
  assert.throws(() => length.push(event(2, 'stdout.frame', {
    stream_sequence: 1, bytes_base64: 'YQ==', byte_length: 2
  })), /byte_length/i);

  const drained = new RunnerEventReducer();
  drained.push(event(1, 'runner.ready'));
  drained.push(event(2, 'stdout.drained', { final_sequence: 0 }));
  assert.throws(() => drained.push(event(3, 'stdout.frame', {
    stream_sequence: 1, bytes_base64: 'YQ==', byte_length: 1
  })), /after stdout drain/i);
});

test('run completion is unique and cancelled_safe requires drained streams and zero processes', () => {
  const unsafe = new RunnerEventReducer();
  unsafe.push(event(1, 'runner.ready'));
  unsafe.push(event(2, 'stdout.drained', { final_sequence: 0 }));
  unsafe.push(event(3, 'stderr.drained', { final_sequence: 0 }));
  unsafe.push(event(4, 'boundary.snapshot', { active_processes: 1 }));
  assert.throws(() => unsafe.push(event(5, 'run.completed', {
    status: 'cancelled_safe', exit_code: null, termination_reason: 'cancel'
  })), /zero active processes/i);

  const complete = new RunnerEventReducer();
  complete.push(event(1, 'runner.ready'));
  complete.push(event(2, 'stdout.drained', { final_sequence: 0 }));
  complete.push(event(3, 'stderr.drained', { final_sequence: 0 }));
  complete.push(event(4, 'boundary.snapshot', { active_processes: 0 }));
  complete.push(event(5, 'run.completed', {
    status: 'cancelled_safe', exit_code: null, termination_reason: 'cancel'
  }));
  assert.throws(() => complete.push(event(6, 'run.completed', {
    status: 'cancelled_safe', exit_code: null, termination_reason: 'cancel'
  })), /after run.completed|at most once/i);
});
