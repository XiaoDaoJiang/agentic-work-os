import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  HOSTILE_MATRIX_CASES,
  buildHostileProbeInvocation,
  classifyProbeExecution,
  expandHostileMatrix
} from '../scripts/run-processkit-hostile-matrix.mjs';

const EXPECTED_CASES = [
  {
    id: 'tree-hang-cancel',
    scenario: 'tree-hang.json',
    trigger: 'cancel',
    triggerMs: 250,
    smokeSeed: 7
  },
  {
    id: 'tree-hang-timeout',
    scenario: 'tree-hang.json',
    trigger: 'timeout',
    triggerMs: 250,
    smokeSeed: 7
  },
  {
    id: 'root-exit-detached-cancel',
    scenario: 'root-exit-detached.json',
    trigger: 'cancel',
    triggerMs: 250,
    smokeSeed: 17
  },
  {
    id: 'late-output-hang-cancel',
    scenario: 'late-output-hang.json',
    trigger: 'cancel',
    triggerMs: 150,
    smokeSeed: 29
  }
];

function byCase(entries, caseId) {
  return entries.filter((entry) => entry.caseId === caseId);
}

test('freezes the four physical hostile matrix cases without expected verdicts', () => {
  assert.deepEqual(
    HOSTILE_MATRIX_CASES.map(({ id, scenario, trigger, triggerMs, smokeSeed }) => ({
      id,
      scenario,
      trigger,
      triggerMs,
      smokeSeed
    })),
    EXPECTED_CASES
  );

  for (const caseSpec of HOSTILE_MATRIX_CASES) {
    assert.equal(Object.hasOwn(caseSpec, 'expectedVerdict'), false);
    assert.equal(Object.hasOwn(caseSpec, 'expectedMechanism'), false);
  }
});

test('smoke expansion runs every case twice with one frozen case seed', () => {
  const entries = expandHostileMatrix({ mode: 'smoke' });
  assert.equal(entries.length, 8);

  for (const caseSpec of EXPECTED_CASES) {
    const cases = byCase(entries, caseSpec.id);
    assert.deepEqual(cases.map((entry) => entry.repetition), [0, 1]);
    assert.deepEqual(cases.map((entry) => entry.seed), [caseSpec.smokeSeed, caseSpec.smokeSeed]);
  }
});

test('race expansion freezes 50 repetitions and seeds 0 through 49 per case', () => {
  const entries = expandHostileMatrix({ mode: 'race' });
  assert.equal(entries.length, 200);
  const expected = Array.from({ length: 50 }, (_, index) => index);

  for (const caseSpec of EXPECTED_CASES) {
    const cases = byCase(entries, caseSpec.id);
    assert.deepEqual(cases.map((entry) => entry.repetition), expected);
    assert.deepEqual(cases.map((entry) => entry.seed), expected);
  }
});

test('probe invocation is argv-only and preserves frozen observation parameters', () => {
  const probeExecutable = path.resolve('native-runner', 'target', 'debug', 'hostile-probe');
  const nodeExecutable = path.resolve('fixtures', 'fake-node');
  const fixturePath = path.resolve('fixtures', 'hostile-process.mjs');
  const scenarioPath = path.resolve('hostile-scenarios', 'tree-hang.json');
  const rootPath = path.resolve('evidence-root', 'case-0');
  const caseSpec = HOSTILE_MATRIX_CASES.find((item) => item.id === 'tree-hang-cancel');

  const invocation = buildHostileProbeInvocation({
    probeExecutable,
    nodeExecutable,
    fixturePath,
    scenarioPath,
    rootPath,
    caseSpec,
    seed: 7,
    repetition: 0
  });

  assert.equal(invocation.executable, probeExecutable);
  assert.equal(Object.hasOwn(invocation, 'shell'), false);
  assert.equal(Object.hasOwn(invocation, 'command'), false);
  assert.deepEqual(invocation.argv, [
    '--node', nodeExecutable,
    '--fixture', fixturePath,
    '--scenario', scenarioPath,
    '--root', rootPath,
    '--trigger', 'cancel',
    '--trigger-ms', '250',
    '--post-stop-ms', '750',
    '--sample-ms', '50',
    '--seed', '7',
    '--repetition', '0'
  ]);
});

test('scenario FAIL and INCONCLUSIVE remain evidence while harness execution stays healthy', () => {
  for (const scenarioVerdict of ['FAIL', 'INCONCLUSIVE']) {
    const result = classifyProbeExecution({
      status: 0,
      stdout: `${JSON.stringify({ schema: 'processkit-hostile-probe-v0', physical_verdict: scenarioVerdict })}\n`,
      stderr: ''
    });
    assert.equal(result.harness_status, 'PASS');
    assert.equal(result.scenario_verdict, scenarioVerdict);
    assert.equal(result.summary.physical_verdict, scenarioVerdict);
  }
});

test('nonzero exit or malformed summary is a harness failure, not a scenario verdict', () => {
  const nonzero = classifyProbeExecution({
    status: 2,
    stdout: '',
    stderr: 'probe failed'
  });
  assert.equal(nonzero.harness_status, 'FAIL');
  assert.equal(nonzero.scenario_verdict, null);

  const malformed = classifyProbeExecution({
    status: 0,
    stdout: '{not-json}\n',
    stderr: ''
  });
  assert.equal(malformed.harness_status, 'FAIL');
  assert.equal(malformed.scenario_verdict, null);

  const multiple = classifyProbeExecution({
    status: 0,
    stdout: '{"physical_verdict":"PASS"}\n{"physical_verdict":"PASS"}\n',
    stderr: ''
  });
  assert.equal(multiple.harness_status, 'FAIL');
  assert.equal(multiple.scenario_verdict, null);
});
