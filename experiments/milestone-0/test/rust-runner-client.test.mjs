import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { queryRustRunnerCapabilities } from '../src/rust-runner-client.mjs';

function fakeChild(responseLines, { code = 0, stderr = '' } = {}) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  queueMicrotask(() => {
    if (stderr) child.stderr.end(stderr); else child.stderr.end();
    child.stdout.end(responseLines.join('\n') + (responseLines.length ? '\n' : ''));
    child.emit('close', code, null);
  });
  return child;
}

const capabilities = {
  version: 'local-runner-capabilities-v1',
  platform: 'linux',
  architecture: 'x64',
  mechanism: 'unproven',
  whole_tree_termination: false,
  owner_exit_cleanup: false,
  membership_observable: false,
  escape_resistance: 'best_effort',
  stdin: false,
  separate_output_streams: false,
  timeout: false
};

function ok(id = 'req-1', result = capabilities) {
  return JSON.stringify({ version: 'local-runner-protocol-v1', id, ok: true, result });
}

test('client validates one correlated capability response and derives unsupported', async () => {
  const result = await queryRustRunnerCapabilities({
    executable: '/fake/runner', requestId: 'req-1', spawnFn: () => fakeChild([ok()])
  });
  assert.equal(result.supportLevel, 'unsupported');
  assert.equal(result.capabilities.mechanism, 'unproven');
});

test('client rejects mismatched correlation, malformed capabilities and trailing frames', async () => {
  await assert.rejects(() => queryRustRunnerCapabilities({
    executable: 'x', requestId: 'req-1', spawnFn: () => fakeChild([ok('other')])
  }), /correlation/i);
  await assert.rejects(() => queryRustRunnerCapabilities({
    executable: 'x', requestId: 'req-1',
    spawnFn: () => fakeChild([ok('req-1', { ...capabilities, mechanism: 'job_object' })])
  }), /job_object/i);
  await assert.rejects(() => queryRustRunnerCapabilities({
    executable: 'x', requestId: 'req-1', spawnFn: () => fakeChild([ok(), ok()])
  }), /exactly one/i);
});

test('client rejects helper errors and nonzero exits', async () => {
  const error = JSON.stringify({
    version: 'local-runner-protocol-v1', id: 'req-1', ok: false,
    error: { code: 'BAD_REQUEST', message: 'bad' }
  });
  await assert.rejects(() => queryRustRunnerCapabilities({
    executable: 'x', requestId: 'req-1', spawnFn: () => fakeChild([error])
  }), /BAD_REQUEST/);
  await assert.rejects(() => queryRustRunnerCapabilities({
    executable: 'x', requestId: 'req-1', spawnFn: () => fakeChild([], { code: 7, stderr: 'boom' })
  }), /exit.*7.*boom/i);
});
