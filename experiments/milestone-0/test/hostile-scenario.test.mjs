import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHostileScenario, createSeededDelays } from '../src/hostile-scenario.mjs';

test('normalizes a minimal hostile_process_v0 scenario with role-neutral defaults', () => {
  const result = validateHostileScenario({ hostile_process_v0: {} });
  assert.equal(result.version, 'hostile-process-v0');
  assert.equal(result.seed, 1);
  assert.deepEqual(result.stdoutFrames, []);
  assert.deepEqual(result.stderrFrames, []);
  assert.equal(result.stdinNonce, false);
  assert.equal(result.segmentOutput, false);
  assert.equal(result.continuousOutputIntervalMs, 0);
  assert.equal(result.spawnChild, false);
  assert.equal(result.spawnGrandchild, false);
  assert.equal(result.exitMode, 'zero');
  assert.equal(result.nonzeroExitCode, 7);
  assert.equal(result.markerWrites, 0);
  assert.equal(result.ignoreSoftStop, false);
});

test('rejects invalid counts, delays, frame types, and exit modes', () => {
  const invalid = [
    { markerWrites: -1 },
    { markerIntervalMs: -1 },
    { delayedDescendantMs: -1 },
    { lateWriteDelayMs: -1 },
    { timingJitterMs: -1 },
    { continuousOutputIntervalMs: -1 },
    { segmentOutput: 'yes' },
    { stdoutFrames: [1] },
    { exitMode: 'explode' },
    { nonzeroExitCode: 0 },
    { seed: -1 }
  ];
  for (const patch of invalid) {
    assert.throws(() => validateHostileScenario({ hostile_process_v0: patch }));
  }
});

test('seeded delay generation is deterministic and bounded', () => {
  const a = createSeededDelays(42, 8, 3, 11);
  const b = createSeededDelays(42, 8, 3, 11);
  const c = createSeededDelays(43, 8, 3, 11);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 8);
  assert.equal(a.every((value) => Number.isInteger(value) && value >= 3 && value <= 11), true);
});

test('seeded delay generation rejects invalid ranges and counts', () => {
  assert.throws(() => createSeededDelays(1, -1, 0, 1));
  assert.throws(() => createSeededDelays(1, 1, 2, 1));
  assert.throws(() => createSeededDelays(1, 1, -1, 1));
});
