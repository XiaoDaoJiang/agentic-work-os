import { evaluateResourceSafety } from './resource-reconciliation.mjs';

function assertRun(run) {
  if (!run || typeof run !== 'object' || Array.isArray(run)) throw new Error('run object is required');
  if (typeof run.id !== 'string' || run.id.length === 0) throw new Error('run.id is required');
  if (typeof run.phase !== 'string' || typeof run.state !== 'string') throw new Error('run phase/state are required');
  if (typeof run.terminal !== 'boolean') throw new Error('run.terminal boolean is required');
  return run;
}

export function convergeRunOnStartup({ run, resourceFacts, stagingFactsKnown }) {
  const current = assertRun(run);
  if (typeof stagingFactsKnown !== 'boolean') throw new Error('stagingFactsKnown boolean is required');

  const resourceFactsKnown = resourceFacts !== null && resourceFacts !== undefined;
  const reasonCodes = [];
  if (!resourceFactsKnown) reasonCodes.push('STARTUP_RESOURCE_FACTS_UNKNOWN');
  if (!stagingFactsKnown) reasonCodes.push('STARTUP_STAGING_FACTS_UNKNOWN');

  if (reasonCodes.length === 0) {
    return {
      businessTransition: null,
      resourceState: current.terminal ? 'reconciliation_required' : 'active',
      lockAction: 'keep',
      allowReview: false,
      allowNewRunSameResource: false,
      reasonCodes: ['STARTUP_RECONCILIATION_REQUIRED']
    };
  }

  return {
    businessTransition: current.terminal ? null : { phase: current.phase, state: 'interrupted' },
    resourceState: 'reconciliation_required',
    lockAction: 'keep',
    allowReview: false,
    allowNewRunSameResource: false,
    reasonCodes
  };
}

function bufferOf(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array || typeof bytes === 'string') return Buffer.from(bytes);
  throw new Error('late output bytes must be Buffer, Uint8Array, or string');
}

export function handleTerminalLateOutput({ run, stream, bytes, resourceFacts }) {
  const current = assertRun(run);
  if (!current.terminal) throw new Error('late-output discard contract requires a terminal Run');
  if (!['stdout', 'stderr'].includes(stream)) throw new Error('stream must be stdout or stderr');
  const payload = bufferOf(bytes);
  const resourceProjection = evaluateResourceSafety({
    ...(resourceFacts && typeof resourceFacts === 'object' ? resourceFacts : {}),
    lateOutputObserved: true
  });
  if (resourceProjection.hardFail !== true) throw new Error('late output must produce a resource hard failure');
  return {
    action: 'discard',
    stream,
    discardedByteLength: payload.length,
    sealArtifact: false,
    appendAgentOutput: false,
    businessTransition: null,
    allowedEvents: ['resource.reconciliation.started', 'resource.reconciliation.blocked'],
    resourceProjection,
    originalTerminalEventId: current.terminalEventId ?? null
  };
}
