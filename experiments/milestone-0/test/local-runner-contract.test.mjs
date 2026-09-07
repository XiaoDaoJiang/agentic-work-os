import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRunnerCapabilities,
  deriveSupportLevel,
  validateRunnerRequest,
  validateRunnerResponse,
  validateRunnerEvent
} from '../src/local-runner-contract.mjs';

const managedWindows = {
  version: 'local-runner-capabilities-v1',
  platform: 'windows',
  architecture: 'x64',
  mechanism: 'job_object',
  whole_tree_termination: true,
  owner_exit_cleanup: true,
  membership_observable: true,
  escape_resistance: 'strong',
  stdin: true,
  separate_output_streams: true,
  timeout: true
};

test('strong Windows Job Object capabilities derive managed support', () => {
  const value = validateRunnerCapabilities(managedWindows);
  assert.equal(deriveSupportLevel(value), 'managed');
  assert.equal(Object.isFrozen(value), true);
});

test('process-group profile derives compatible support without claiming strong containment', () => {
  const value = validateRunnerCapabilities({
    ...managedWindows,
    platform: 'macos',
    architecture: 'arm64',
    mechanism: 'process_group',
    owner_exit_cleanup: false,
    membership_observable: false,
    escape_resistance: 'process_group'
  });
  assert.equal(deriveSupportLevel(value), 'compatible');
});

test('unproven native helper is unsupported even when it compiles', () => {
  const value = validateRunnerCapabilities({
    ...managedWindows,
    platform: 'linux',
    mechanism: 'unproven',
    whole_tree_termination: false,
    owner_exit_cleanup: false,
    membership_observable: false,
    escape_resistance: 'best_effort',
    stdin: false,
    separate_output_streams: false,
    timeout: false
  });
  assert.equal(deriveSupportLevel(value), 'unsupported');
});

test('capability validation rejects platform/mechanism lies and unknown fields', () => {
  assert.throws(() => validateRunnerCapabilities({ ...managedWindows, platform: 'macos' }), /job_object.*windows/i);
  assert.throws(() => validateRunnerCapabilities({ ...managedWindows, mechanism: 'process_group', escape_resistance: 'strong' }), /process_group.*strong/i);
  assert.throws(() => validateRunnerCapabilities({ ...managedWindows, mechanism: 'unproven' }), /unproven.*claim/i);
  assert.throws(() => validateRunnerCapabilities({ ...managedWindows, surprise: true }), /unknown.*surprise/i);
});

test('runner requests use a strict correlated v1 envelope', () => {
  assert.deepEqual(validateRunnerRequest({
    version: 'local-runner-protocol-v1', id: 'r-1', method: 'capabilities', params: {}
  }), { version: 'local-runner-protocol-v1', id: 'r-1', method: 'capabilities', params: {} });
  assert.deepEqual(validateRunnerRequest({
    version: 'local-runner-protocol-v1', id: 'r-2', method: 'cancel',
    params: { session_id: 's-1', request_id: 'cancel-1' }
  }).params, { session_id: 's-1', request_id: 'cancel-1' });
  assert.throws(() => validateRunnerRequest({ version: 'local-runner-protocol-v1', id: 'x', method: 'unknown', params: {} }), /method/);
  assert.throws(() => validateRunnerRequest({ version: 'local-runner-protocol-v1', id: 'x', method: 'wait', params: { session_id: 's', extra: 1 } }), /unknown.*extra/i);
});

test('runner responses require exactly one result or structured error', () => {
  assert.equal(validateRunnerResponse({ version: 'local-runner-protocol-v1', id: 'r', ok: true, result: {} }).ok, true);
  assert.equal(validateRunnerResponse({ version: 'local-runner-protocol-v1', id: 'r', ok: false, error: { code: 'BAD_REQUEST', message: 'bad' } }).ok, false);
  assert.throws(() => validateRunnerResponse({ version: 'local-runner-protocol-v1', id: 'r', ok: true, result: {}, error: { code: 'X', message: 'x' } }), /error/);
});

test('runner stream events preserve session correlation and sequence', () => {
  const event = validateRunnerEvent({
    version: 'local-runner-protocol-v1', session_id: 's-1', sequence: 1,
    kind: 'stdout', at: '2026-09-01T00:00:00.000Z',
    payload: { stream_sequence: 1, bytes_base64: Buffer.from('ok').toString('base64') }
  });
  assert.equal(event.kind, 'stdout');
  assert.throws(() => validateRunnerEvent({ ...event, kind: 'mystery' }), /kind/);
  assert.throws(() => validateRunnerEvent({ ...event, sequence: 0 }), /sequence/);
});
