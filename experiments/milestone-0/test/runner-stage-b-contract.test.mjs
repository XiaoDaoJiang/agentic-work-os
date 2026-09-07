import test from 'node:test';
import assert from 'node:assert/strict';
import { RUNNER_PROTOCOL } from '../src/runner-contract.mjs';
import { validateStageBRequestBatch } from '../src/runner-stage-b-contract.mjs';

function start(runId = 'run-1') {
  return {
    protocol: RUNNER_PROTOCOL,
    kind: 'start',
    request_id: 'start-1',
    run_id: runId,
    program: process.execPath,
    argv: ['fixture.mjs'],
    cwd: process.cwd(),
    env: { inheritance_policy: 'none', inherit_names: [], overrides: {}, unset: [] },
    timeout_ms: 1000
  };
}

function input(id, text, runId = 'run-1') {
  return {
    protocol: RUNNER_PROTOCOL,
    kind: 'input',
    request_id: id,
    run_id: runId,
    bytes_base64: Buffer.from(text).toString('base64')
  };
}

function finish(runId = 'run-1') {
  return {
    protocol: RUNNER_PROTOCOL,
    kind: 'finish_input',
    request_id: 'finish-1',
    run_id: runId
  };
}

function cancel(runId = 'run-1') {
  return {
    protocol: RUNNER_PROTOCOL,
    kind: 'cancel',
    request_id: 'cancel-1',
    run_id: runId
  };
}

test('accepts an empty Stage B stdin batch', () => {
  const result = validateStageBRequestBatch([start(), finish()]);
  assert.equal(result.start.kind, 'start');
  assert.equal(result.stdinBytes.length, 0);
  assert.deepEqual(result.inputRequests, []);
});

test('concatenates queued input bytes in request order', () => {
  const result = validateStageBRequestBatch([
    start(),
    input('in-1', 'hello '),
    input('in-2', '世界\n'),
    finish()
  ]);
  assert.equal(result.stdinBytes.toString('utf8'), 'hello 世界\n');
  assert.deepEqual(result.inputRequests.map((item) => item.request_id), ['in-1', 'in-2']);
});

test('rejects missing or duplicate start', () => {
  assert.throws(() => validateStageBRequestBatch([finish()]), /first request must be start/i);
  assert.throws(
    () => validateStageBRequestBatch([start(), { ...start(), request_id: 'start-2' }, finish()]),
    /start may occur exactly once/i
  );
});

test('rejects missing, duplicate, or non-final finish_input', () => {
  assert.throws(() => validateStageBRequestBatch([start()]), /finish_input is required/i);
  assert.throws(
    () => validateStageBRequestBatch([start(), finish(), { ...finish(), request_id: 'finish-2' }]),
    /finish_input may occur exactly once/i
  );
  assert.throws(
    () => validateStageBRequestBatch([start(), finish(), input('late', 'x')]),
    /request arrived after finish_input/i
  );
});

test('rejects mismatched run IDs, cancel, and duplicate request IDs', () => {
  assert.throws(
    () => validateStageBRequestBatch([start(), input('in-1', 'x', 'run-2'), finish()]),
    /run_id must match/i
  );
  assert.throws(
    () => validateStageBRequestBatch([start(), cancel(), finish()]),
    /cancel is not supported in Stage B/i
  );
  assert.throws(
    () => validateStageBRequestBatch([start(), input('start-1', 'x'), finish()]),
    /request_id must be unique/i
  );
});

test('rejects invalid Base64 and more than 1 MiB of queued stdin', () => {
  assert.throws(
    () => validateStageBRequestBatch([start(), { ...input('bad', 'x'), bytes_base64: '***' }, finish()]),
    /canonical base64/i
  );
  const tooLarge = Buffer.alloc(1024 * 1024 + 1).toString('base64');
  assert.throws(
    () => validateStageBRequestBatch([start(), { ...input('large', ''), bytes_base64: tooLarge }, finish()]),
    /exceeds 1048576 bytes/i
  );
});
