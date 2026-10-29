import assert from 'node:assert/strict';
import test from 'node:test';
import { codexInvocation, codexProfile, resolveCodexExecutable } from '../dist/codex-adapter.js';

test('Codex invocation keeps native sandbox and approval restrictions with literal argv', () => {
  const invocation = codexInvocation(process.cwd(), 'write marker; $(do not execute)', 'gpt-6.1-sol', process.execPath);
  assert.equal(invocation.program, process.execPath);
  assert.deepEqual(JSON.parse(invocation.argv[1]), { cwd: process.cwd(), prompt: 'write marker; $(do not execute)', model: 'gpt-6.1-sol', executable: process.execPath });
  assert.equal(invocation.environmentPolicy, 'allowlist');
  assert.equal(codexProfile.available, false);
  assert.match(codexProfile.reason, /G1/);
  assert.throws(() => codexInvocation('relative', 'task', 'gpt-6.1-sol', process.execPath), /absolute/);
  assert.throws(() => codexInvocation(process.cwd(), '', 'gpt-6.1-sol', process.execPath), /required/);
  for (const model of [undefined, '', ' ', 'model\0invalid']) {
    assert.throws(() => codexInvocation(process.cwd(), 'task', model, process.execPath), /model is required/);
  }
  assert.throws(() => resolveCodexExecutable(''), /未找到|requires Windows/);
});
