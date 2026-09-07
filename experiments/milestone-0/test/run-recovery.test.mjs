import test from 'node:test';
import assert from 'node:assert/strict';
import { convergeRunOnStartup, handleTerminalLateOutput } from '../src/run-recovery.mjs';

test('F-15 nonterminal startup with unknown resources converges to interrupted/reconciliation_required and keeps lock', () => {
  const run = { id:'run-1', phase:'agent', state:'running', terminal:false, taskId:'task-1', repositoryIdentity:'repo:1' };
  const result = convergeRunOnStartup({ run, resourceFacts: null, stagingFactsKnown: false });
  assert.deepEqual(result.businessTransition, { phase:'agent', state:'interrupted' });
  assert.equal(result.resourceState, 'reconciliation_required');
  assert.equal(result.lockAction, 'keep');
  assert.equal(result.allowReview, false);
  assert.equal(result.allowNewRunSameResource, false);
  assert.ok(result.reasonCodes.includes('STARTUP_RESOURCE_FACTS_UNKNOWN'));
  assert.ok(result.reasonCodes.includes('STARTUP_STAGING_FACTS_UNKNOWN'));
});

test('F-15 terminal startup does not rewrite the business terminal', () => {
  const run = { id:'run-1', phase:'complete', state:'completed', terminal:true };
  const result = convergeRunOnStartup({ run, resourceFacts:null, stagingFactsKnown:false });
  assert.equal(result.businessTransition, null);
  assert.equal(result.resourceState, 'reconciliation_required');
  assert.equal(result.lockAction, 'keep');
});

test('F-16 terminal late output is discarded, never sealed, preserves terminal, and reports a resource hard failure', () => {
  const run = { id:'run-1', phase:'complete', state:'completed', terminal:true, terminalEventId:'term-1' };
  const result = handleTerminalLateOutput({
    run,
    stream:'stdout',
    bytes:Buffer.from('late'),
    resourceFacts:{
      boundaryKnown:true, activeProcesses:0,
      stdoutDrained:true, stderrDrained:true,
      workspaceLeaseState:'retained', driftCheckComplete:true,
      lateMarkerObserved:false
    }
  });
  assert.equal(result.action, 'discard');
  assert.equal(result.sealArtifact, false);
  assert.equal(result.appendAgentOutput, false);
  assert.equal(result.businessTransition, null);
  assert.deepEqual(result.allowedEvents, ['resource.reconciliation.started','resource.reconciliation.blocked']);
  assert.equal(result.resourceProjection.hardFail, true);
  assert.equal(result.resourceProjection.resourceState, 'blocked');
  assert.ok(result.resourceProjection.reasonCodes.includes('POST_TERMINAL_LATE_OUTPUT'));
  assert.equal(result.originalTerminalEventId, 'term-1');
});

test('late output before terminal is not handled by the terminal discard contract', () => {
  assert.throws(() => handleTerminalLateOutput({
    run:{id:'run-1',phase:'agent',state:'running',terminal:false},
    stream:'stdout', bytes:Buffer.from('data'), resourceFacts:{}
  }), /terminal Run/);
});

test('F-16 only accepts stdout/stderr and byte-like payloads', () => {
  const run={id:'run-1',phase:'complete',state:'completed',terminal:true};
  assert.throws(()=>handleTerminalLateOutput({run,stream:'other',bytes:Buffer.from('x'),resourceFacts:{}}),/stdout or stderr/);
  assert.throws(()=>handleTerminalLateOutput({run,stream:'stdout',bytes:{},resourceFacts:{}}),/bytes/);
});
