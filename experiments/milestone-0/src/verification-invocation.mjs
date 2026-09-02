export class VerificationContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationContractError';
  }
}

function fail(message) {
  throw new VerificationContractError(message);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateEnv(env) {
  if (!env || !['none', 'allowlist'].includes(env.inheritance_policy)) fail('env.inheritance_policy must be none or allowlist');
  if (!isStringArray(env.inherit_names ?? [])) fail('env.inherit_names must be an array of strings');
  if (!env.overrides || typeof env.overrides !== 'object' || Array.isArray(env.overrides)) fail('env.overrides must be an object');
  if (!Object.values(env.overrides).every((value) => typeof value === 'string')) fail('env.overrides values must be strings');
  if (!isStringArray(env.unset ?? [])) fail('env.unset must be an array of strings');
  if (env.inheritance_policy === 'none' && (env.inherit_names ?? []).length > 0) fail('env.inherit_names must be empty when inheritance_policy is none');
}

function validateExecution(execution) {
  if (!execution || !['argv', 'shell'].includes(execution.mode)) fail('execution.mode must be argv or shell');
  if (execution.mode === 'argv') {
    if (typeof execution.program !== 'string' || execution.program.length === 0) fail('argv mode requires execution.program');
    if (!isStringArray(execution.argv)) fail('argv mode requires execution.argv string array');
    for (const key of ['shell_path', 'shell_argv_prefix', 'command', 'command_encoding']) {
      if (key in execution) fail(`argv mode cannot include ${key}`);
    }
  } else {
    if (typeof execution.shell_path !== 'string' || execution.shell_path.length === 0) fail('shell mode requires execution.shell_path');
    if (!isStringArray(execution.shell_argv_prefix)) fail('shell mode requires execution.shell_argv_prefix string array');
    if (typeof execution.command !== 'string') fail('shell mode requires execution.command');
    if (execution.command_encoding !== 'utf-8') fail('shell mode requires command_encoding=utf-8');
    for (const key of ['program', 'argv']) {
      if (key in execution) fail(`shell mode cannot include ${key}`);
    }
  }
}

export function validateVerificationInvocation(document) {
  const contract = document?.verification_invocation_v0;
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) fail('verification_invocation_v0 object is required');
  validateExecution(contract.execution);
  if (contract.cwd_binding !== 'assigned_workspace') fail('cwd_binding must be assigned_workspace');
  validateEnv(contract.env);
  if (!Number.isInteger(contract.timeout_ms) || contract.timeout_ms <= 0) fail('timeout_ms must be a finite positive integer');
  if (contract.output?.stdout !== 'separate ordered frames' || contract.output?.stderr !== 'separate ordered frames') {
    fail('output must preserve separate ordered stdout and stderr frames');
  }
  if (contract.cancel !== 'runner_owned_process_containment') fail('cancel must be runner_owned_process_containment');
  return document;
}
