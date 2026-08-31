import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVerificationInvocation, VerificationContractError } from '../src/verification-invocation.mjs';

const common = {
  cwd_binding: 'assigned_workspace',
  env: { inheritance_policy: 'allowlist', inherit_names: ['PATH'], overrides: { TEST: '1' }, unset: ['SECRET'] },
  timeout_ms: 1000,
  output: { stdout: 'separate ordered frames', stderr: 'separate ordered frames' },
  cancel: 'runner_owned_process_containment'
};

test('accepts argv mode', () => {
  const doc = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: ['--version'] }, ...common } };
  assert.equal(validateVerificationInvocation(doc).verification_invocation_v0.execution.mode, 'argv');
});

test('accepts explicit shell mode', () => {
  const doc = { verification_invocation_v0: { execution: { mode: 'shell', shell_path: 'pwsh.exe', shell_argv_prefix: ['-NoProfile', '-Command'], command: 'Write-Output ok', command_encoding: 'utf-8' }, ...common } };
  assert.equal(validateVerificationInvocation(doc).verification_invocation_v0.execution.mode, 'shell');
});

test('rejects ambiguous execution fields', () => {
  const doc = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: [], shell_path: 'pwsh.exe' }, ...common } };
  assert.throws(() => validateVerificationInvocation(doc), VerificationContractError);
});

test('rejects non-workspace cwd binding', () => {
  const doc = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: [] }, ...common, cwd_binding: 'caller' } };
  assert.throws(() => validateVerificationInvocation(doc), /cwd_binding/);
});

test('rejects non-positive timeout', () => {
  const doc = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: [] }, ...common, timeout_ms: 0 } };
  assert.throws(() => validateVerificationInvocation(doc), /timeout_ms/);
});

test('rejects output or cancel semantics that differ from frozen contract', () => {
  const badOutput = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: [] }, ...common, output: { stdout: 'merged', stderr: 'merged' } } };
  assert.throws(() => validateVerificationInvocation(badOutput), /output/);
  const badCancel = { verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: [] }, ...common, cancel: 'kill_pid' } };
  assert.throws(() => validateVerificationInvocation(badCancel), /cancel/);
});
