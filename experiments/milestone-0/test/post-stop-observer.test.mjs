import test from 'node:test';
import assert from 'node:assert/strict';
import { observePostStop } from '../src/post-stop-observer.mjs';

function fakeClock() {
  let current = 0;
  return { now: () => current, sleep: async (ms) => { current += ms; } };
}

function constantProbes(overrides = {}) {
  return {
    processProbe: overrides.processProbe ?? (async () => ({ activeProcesses: 0 })),
    markerProbe: overrides.markerProbe ?? (async () => ({ exists: true, size: 10, sha256: 'a'.repeat(64) })),
    outputProbe: overrides.outputProbe ?? (async () => ({ stdoutSize: 4, stderrSize: 2, stdoutSha256: 'b'.repeat(64), stderrSha256: 'c'.repeat(64) }))
  };
}

test('samples through the entire observation window and does not return early on zero processes', async () => {
  const clock = fakeClock();
  const result = await observePostStop({ durationMs: 100, sampleIntervalMs: 30, ...constantProbes(), now: clock.now, sleep: clock.sleep });
  assert.equal(result.status, 'PASS');
  assert.equal(result.completedObservationMs, 100);
  assert.deepEqual(result.samples.map((sample) => sample.elapsedMs), [0, 30, 60, 90, 100]);
  assert.equal(result.survivorObserved, false);
  assert.equal(result.lateMarkerObserved, false);
  assert.equal(result.lateOutputObserved, false);
});

test('records a survivor but still completes the full observation window', async () => {
  const clock = fakeClock();
  let call = 0;
  const result = await observePostStop({
    durationMs: 90,
    sampleIntervalMs: 30,
    ...constantProbes({ processProbe: async () => ({ activeProcesses: call++ === 1 ? 1 : 0 }) }),
    now: clock.now,
    sleep: clock.sleep
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.completedObservationMs, 90);
  assert.equal(result.survivorObserved, true);
  assert.equal(result.samples.length, 4);
});

test('detects marker mutation after the baseline sample as a late write', async () => {
  const clock = fakeClock();
  let call = 0;
  const result = await observePostStop({
    durationMs: 20,
    sampleIntervalMs: 10,
    ...constantProbes({ markerProbe: async () => ({ exists: true, size: call++ === 0 ? 10 : 11, sha256: (call <= 1 ? 'a' : 'd').repeat(64) }) }),
    now: clock.now,
    sleep: clock.sleep
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.lateMarkerObserved, true);
});

test('detects stdout or stderr mutation after baseline as late output', async () => {
  const clock = fakeClock();
  let call = 0;
  const result = await observePostStop({
    durationMs: 20,
    sampleIntervalMs: 10,
    ...constantProbes({ outputProbe: async () => {
      call += 1;
      return { stdoutSize: call === 1 ? 4 : 5, stderrSize: 2, stdoutSha256: (call === 1 ? 'b' : 'e').repeat(64), stderrSha256: 'c'.repeat(64) };
    } }),
    now: clock.now,
    sleep: clock.sleep
  });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.lateOutputObserved, true);
});

test('probe failure returns INCONCLUSIVE and never becomes PASS', async () => {
  const clock = fakeClock();
  const result = await observePostStop({
    durationMs: 100,
    sampleIntervalMs: 25,
    ...constantProbes({ processProbe: async () => { throw new Error('probe unavailable'); } }),
    now: clock.now,
    sleep: clock.sleep
  });
  assert.equal(result.status, 'INCONCLUSIVE');
  assert.equal(result.probeError, 'probe unavailable');
  assert.equal(result.completedObservationMs, 0);
});

test('rejects invalid observation durations and malformed probe facts', async () => {
  const clock = fakeClock();
  await assert.rejects(observePostStop({ durationMs: 0, sampleIntervalMs: 10, ...constantProbes(), now: clock.now, sleep: clock.sleep }), /durationMs/);
  await assert.rejects(observePostStop({ durationMs: 10, sampleIntervalMs: 0, ...constantProbes(), now: clock.now, sleep: clock.sleep }), /sampleIntervalMs/);
  const result = await observePostStop({ durationMs: 10, sampleIntervalMs: 10, ...constantProbes({ processProbe: async () => ({ activeProcesses: -1 }) }), now: clock.now, sleep: clock.sleep });
  assert.equal(result.status, 'INCONCLUSIVE');
  assert.match(result.probeError, /activeProcesses/);
});
