import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBoundaryFrame, reduceBoundaryFrames, BoundaryProtocolError } from '../src/process-boundary-protocol.mjs';

const created = {
  kind: 'boundary.created',
  sequence: 1,
  at: '2026-08-31T08:00:00.000Z',
  payload: { boundaryId: 'job-1', rootPid: 100, rootCreatedAt: '2026-08-31T08:00:00.000Z' }
};

function frame(kind, sequence, payload = {}) {
  return { kind, sequence, at: `2026-08-31T08:00:${String(sequence).padStart(2, '0')}.000Z`, payload };
}

test('validates a boundary.created frame with stable root facts', () => {
  assert.deepEqual(validateBoundaryFrame(created), created);
});

test('requires boundary creation before any process assignment', () => {
  assert.throws(() => reduceBoundaryFrames([frame('process.assigned', 1, { pid: 101, createdAt: '2026-08-31T08:00:00.100Z' })]), BoundaryProtocolError);
});

test('tracks assigned process facts and active process snapshots', () => {
  const result = reduceBoundaryFrames([
    created,
    frame('process.assigned', 2, { pid: 100, createdAt: '2026-08-31T08:00:00.000Z', role: 'root' }),
    frame('process.assigned', 3, { pid: 101, createdAt: '2026-08-31T08:00:00.100Z', role: 'child' }),
    frame('boundary.snapshot', 4, { activeProcesses: 2 })
  ]);
  assert.equal(result.boundaryId, 'job-1');
  assert.equal(result.rootPid, 100);
  assert.deepEqual([...result.assignedPids], [100, 101]);
  assert.equal(result.activeProcesses, 2);
});

test('requires globally increasing helper frame sequence', () => {
  assert.throws(() => reduceBoundaryFrames([created, frame('boundary.snapshot', 1, { activeProcesses: 1 })]), /frame sequence must strictly increase/);
});

test('enforces monotonic per-stream sequence and rejects frames after drain', () => {
  const base = [
    created,
    frame('stream.frame', 2, { stream: 'stdout', streamSequence: 1, byteLength: 4 }),
    frame('stream.frame', 3, { stream: 'stderr', streamSequence: 1, byteLength: 3 }),
    frame('stream.frame', 4, { stream: 'stdout', streamSequence: 2, byteLength: 2 }),
    frame('stream.drained', 5, { stream: 'stdout', finalSequence: 2 })
  ];
  const result = reduceBoundaryFrames(base);
  assert.equal(result.streams.stdout.lastSequence, 2);
  assert.equal(result.streams.stdout.drained, true);
  assert.equal(result.streams.stderr.lastSequence, 1);
  assert.equal(result.streams.stderr.drained, false);
  assert.throws(() => reduceBoundaryFrames([...base, frame('stream.frame', 6, { stream: 'stdout', streamSequence: 3, byteLength: 1 })]), /stream frame arrived after stdout drain/);
  assert.throws(() => reduceBoundaryFrames([created, frame('stream.frame', 2, { stream: 'stdout', streamSequence: 2, byteLength: 1 }), frame('stream.frame', 3, { stream: 'stdout', streamSequence: 2, byteLength: 1 })]), /stdout streamSequence must strictly increase/);
});

test('enforces terminate ordering and records cancel facts without claiming safety', () => {
  assert.throws(() => reduceBoundaryFrames([created, frame('boundary.terminate.completed', 2, { reason: 'cancel' })]), /terminate.completed requires terminate.started/);
  const result = reduceBoundaryFrames([
    created,
    frame('cancel.requested', 2, { requestId: 'cancel-1' }),
    frame('boundary.terminate.started', 3, { reason: 'cancel' }),
    frame('boundary.terminate.completed', 4, { reason: 'cancel' }),
    frame('boundary.snapshot', 5, { activeProcesses: 0 })
  ]);
  assert.equal(result.cancelRequested, true);
  assert.equal(result.terminationStarted, true);
  assert.equal(result.terminationCompleted, true);
  assert.equal(result.activeProcesses, 0);
});

test('rejects duplicate helper terminal facts', () => {
  assert.throws(() => reduceBoundaryFrames([created, frame('helper.exited', 2, { exitCode: 0 }), frame('helper.exited', 3, { exitCode: 0 })]), /helper.exited may occur at most once/);
});

test('rejects unknown frame kinds and malformed payloads', () => {
  assert.throws(() => validateBoundaryFrame(frame('mystery.event', 1, {})), /unknown boundary frame kind/);
  assert.throws(() => validateBoundaryFrame(frame('boundary.snapshot', 1, { activeProcesses: -1 })), /activeProcesses/);
  assert.throws(() => validateBoundaryFrame(frame('stream.frame', 1, { stream: 'combined', streamSequence: 1, byteLength: 1 })), /stream must be stdout or stderr/);
});
