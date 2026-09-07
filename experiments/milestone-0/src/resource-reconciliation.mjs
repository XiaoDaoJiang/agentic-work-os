const SAFE_LEASE_STATES = new Set(['retained', 'released']);

function factsObject(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) throw new Error('resource facts object is required');
  return facts;
}

export function evaluateResourceSafety(input) {
  const facts = factsObject(input);
  const reasonCodes = [];
  let hardFail = false;

  if (facts.lateOutputObserved === true) {
    reasonCodes.push('POST_TERMINAL_LATE_OUTPUT');
    hardFail = true;
  }
  if (facts.lateMarkerObserved === true) {
    reasonCodes.push('POST_TERMINAL_LATE_MARKER');
    hardFail = true;
  }

  if (facts.boundaryKnown !== true || !Number.isInteger(facts.activeProcesses) || facts.activeProcesses < 0) {
    reasonCodes.push('BOUNDARY_FACTS_INSUFFICIENT');
  } else if (facts.activeProcesses > 0) {
    reasonCodes.push('ACTIVE_PROCESSES_REMAIN');
  }

  if (facts.stdoutDrained !== true) reasonCodes.push('STDOUT_NOT_DRAINED');
  if (facts.stderrDrained !== true) reasonCodes.push('STDERR_NOT_DRAINED');
  if (!SAFE_LEASE_STATES.has(facts.workspaceLeaseState)) reasonCodes.push('WORKSPACE_LEASE_UNSAFE');
  if (facts.driftCheckComplete !== true) reasonCodes.push('DRIFT_CHECK_INCOMPLETE');

  const uniqueReasonCodes = [...new Set(reasonCodes)];
  const safe = uniqueReasonCodes.length === 0;
  return {
    resourceState: safe ? 'safe' : 'blocked',
    lockAction: safe ? 'release' : 'keep',
    reasonCodes: uniqueReasonCodes,
    hardFail
  };
}

export function nextReconciliationProjection(previous, facts) {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('previous projection object is required');
  const result = evaluateResourceSafety(facts);
  return {
    resourceState: result.resourceState,
    lockAction: result.lockAction,
    eventType: result.resourceState === 'safe' ? 'resource.reconciliation.succeeded' : 'resource.reconciliation.blocked',
    reasonCodes: result.reasonCodes,
    hardFail: result.hardFail
  };
}

export function shouldBlockCandidateRun(lock, candidate) {
  if (!lock || typeof lock !== 'object' || !candidate || typeof candidate !== 'object') throw new Error('lock and candidate are required');
  if (lock.resourceState === 'safe') return false;
  const sameTask = typeof lock.taskId === 'string' && lock.taskId.length > 0 && lock.taskId === candidate.taskId;
  const sameRepository = typeof lock.repositoryIdentity === 'string' && lock.repositoryIdentity.length > 0 && lock.repositoryIdentity === candidate.repositoryIdentity;
  return sameTask || sameRepository;
}
