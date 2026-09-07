import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateResourceSafety, nextReconciliationProjection, shouldBlockCandidateRun } from '../src/resource-reconciliation.mjs';

const safeFacts = {
  boundaryKnown: true,
  activeProcesses: 0,
  stdoutDrained: true,
  stderrDrained: true,
  workspaceLeaseState: 'retained',
  driftCheckComplete: true,
  driftDetected: false,
  lateOutputObserved: false,
  lateMarkerObserved: false,
  userConfirmedStopped: false,
  deliveryIntegrity: 'healthy'
};

test('RR-01 live boundary process blocks resource safety and keeps scheduling lock', () => {
  const result = evaluateResourceSafety({ ...safeFacts, activeProcesses: 1 });
  assert.equal(result.resourceState, 'blocked');
  assert.equal(result.lockAction, 'keep');
  assert.deepEqual(result.reasonCodes, ['ACTIVE_PROCESSES_REMAIN']);
  assert.equal(result.hardFail, false);
});

test('RR-02 undrained stdout or stderr cannot be safe', () => {
  assert.equal(evaluateResourceSafety({ ...safeFacts, stdoutDrained: false }).resourceState, 'blocked');
  assert.equal(evaluateResourceSafety({ ...safeFacts, stderrDrained: false }).resourceState, 'blocked');
});

test('RR-03 zero active processes plus drain, known lease and drift check is safe', () => {
  const retained = evaluateResourceSafety(safeFacts);
  assert.equal(retained.resourceState, 'safe');
  assert.equal(retained.lockAction, 'release');
  assert.deepEqual(retained.reasonCodes, []);
  assert.equal(evaluateResourceSafety({ ...safeFacts, workspaceLeaseState: 'released' }).resourceState, 'safe');
});

test('RR-04 drift can be abnormal while resource state remains safe', () => {
  const result = evaluateResourceSafety({ ...safeFacts, driftDetected: true });
  assert.equal(result.resourceState, 'safe');
  assert.equal(result.lockAction, 'release');
});

test('RR-05 missing boundary, process, lease, drain or drift facts blocks safely', () => {
  const cases = [
    { boundaryKnown: false },
    { activeProcesses: null },
    { stdoutDrained: null },
    { stderrDrained: null },
    { workspaceLeaseState: 'unknown' },
    { workspaceLeaseState: 'active' },
    { driftCheckComplete: false }
  ];
  for (const patch of cases) {
    const result = evaluateResourceSafety({ ...safeFacts, ...patch });
    assert.equal(result.resourceState, 'blocked');
    assert.equal(result.lockAction, 'keep');
    assert.ok(result.reasonCodes.length > 0);
  }
});

test('RR-06 user confirmation cannot substitute for missing machine facts', () => {
  const result = evaluateResourceSafety({ ...safeFacts, boundaryKnown: false, activeProcesses: null, userConfirmedStopped: true });
  assert.equal(result.resourceState, 'blocked');
  assert.ok(result.reasonCodes.includes('BOUNDARY_FACTS_INSUFFICIENT'));
});

test('RR-07 terminal late output or marker is a hard failure and remains blocked', () => {
  const lateOutput = evaluateResourceSafety({ ...safeFacts, lateOutputObserved: true });
  assert.equal(lateOutput.resourceState, 'blocked');
  assert.equal(lateOutput.lockAction, 'keep');
  assert.equal(lateOutput.hardFail, true);
  assert.ok(lateOutput.reasonCodes.includes('POST_TERMINAL_LATE_OUTPUT'));
  const lateMarker = evaluateResourceSafety({ ...safeFacts, lateMarkerObserved: true });
  assert.equal(lateMarker.hardFail, true);
  assert.ok(lateMarker.reasonCodes.includes('POST_TERMINAL_LATE_MARKER'));
});

test('RR-08 accepted package delivery integrity is orthogonal to resource safety', () => {
  for (const deliveryIntegrity of ['healthy', 'missing', 'corrupt']) {
    const result = evaluateResourceSafety({ ...safeFacts, deliveryIntegrity });
    assert.equal(result.resourceState, 'safe');
    assert.equal(result.lockAction, 'release');
  }
});

test('next reconciliation projection only returns resource and lock facts', () => {
  const projection = nextReconciliationProjection({ resourceState: 'reconciling', phase: 'agent', state: 'interrupted', terminalEventId: 'term-1' }, safeFacts);
  assert.deepEqual(projection, {
    resourceState: 'safe',
    lockAction: 'release',
    eventType: 'resource.reconciliation.succeeded',
    reasonCodes: [],
    hardFail: false
  });
  assert.equal('phase' in projection, false);
  assert.equal('state' in projection, false);
  assert.equal('terminalEventId' in projection, false);
});

test('RR-09 unrelated repository identity is not blocked by an existing repository lock', () => {
  const lock = { taskId: 'task-a', repositoryIdentity: 'repo:a', resourceState: 'blocked' };
  assert.equal(shouldBlockCandidateRun(lock, { taskId: 'task-a', repositoryIdentity: 'repo:b' }), true);
  assert.equal(shouldBlockCandidateRun(lock, { taskId: 'task-b', repositoryIdentity: 'repo:a' }), true);
  assert.equal(shouldBlockCandidateRun(lock, { taskId: 'task-b', repositoryIdentity: 'repo:b' }), false);
  assert.equal(shouldBlockCandidateRun({ ...lock, resourceState: 'safe' }, { taskId: 'task-a', repositoryIdentity: 'repo:a' }), false);
});
