import assert from 'node:assert/strict';
import test from 'node:test';
import { codexInvocation, codexProfile, resolveCodexExecutable } from '../dist/codex-adapter.js';

test('Codex invocation keeps native sandbox and approval restrictions with literal argv', () => {
  const invocation = codexInvocation(process.cwd(), 'write marker; $(do not execute)', 'gpt-6.1-sol');
  assert.deepEqual(invocation.argv, ['-a', 'never', 'exec', '--json', '--ephemeral', '--ignore-user-config', '--config', 'windows.sandbox="elevated"', '--disable', 'unified_exec', '--model', 'gpt-6.1-sol', '--sandbox', 'workspace-write', '-C', process.cwd(), '--', 'write marker; $(do not execute)']);
  assert.equal(invocation.environmentPolicy, 'allowlist');
  assert.equal(codexProfile.available, false);
  assert.match(codexProfile.reason, /G1/);
  assert.throws(() => codexInvocation('relative', 'task', 'gpt-6.1-sol'), /absolute/);
  assert.throws(() => codexInvocation(process.cwd(), '', 'gpt-6.1-sol'), /required/);
  for (const model of [undefined, '', ' ', 'model\0invalid']) {
    assert.throws(() => codexInvocation(process.cwd(), 'task', model), /model is required/);
  }
  assert.throws(() => resolveCodexExecutable(''), /未找到|requires Windows/);
});
