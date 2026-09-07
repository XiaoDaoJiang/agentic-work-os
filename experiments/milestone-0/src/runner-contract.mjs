import path from 'node:path';

export const RUNNER_PROTOCOL = 'local-runner-jsonl-v0';
export const RUNNER_CAPABILITY_VERSION = 'runner-capabilities-v0';

const PLATFORMS = new Set(['windows', 'linux', 'macos', 'freebsd']);
const MECHANISMS = new Set([
  'windows_job_object',
  'linux_cgroup_v2',
  'posix_process_group',
  'process_reaper',
  'none'
]);
const SOFT_STOP_SCOPES = new Set(['whole_tree', 'direct_child', 'best_effort', 'unsupported']);
const ESCAPE_RESISTANCE = new Set(['strong', 'process_group', 'best_effort']);
const REQUEST_KINDS = new Set(['start', 'input', 'finish_input', 'cancel']);
const EVENT_KINDS = new Set([
  'runner.ready',
  'capabilities.reported',
  'boundary.created',
  'process.started',
  'input.accepted',
  'cancel.requested',
  'stdout.frame',
  'stderr.frame',
  'boundary.termination.started',
  'boundary.termination.completed',
  'stdout.drained',
  'stderr.drained',
  'process.exited',
  'boundary.snapshot',
  'run.completed',
  'runner.error'
]);
const COMPLETION_STATUSES = new Set(['succeeded', 'failed', 'timeout', 'cancelled_safe', 'start_failed', 'interrupted']);

export class RunnerContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunnerContractError';
  }
}

function fail(message) {
  throw new RunnerContractError(message);
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    fail(`${label} must be a non-empty NUL-free string`);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be boolean`);
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) fail(`${label} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a non-negative integer`);
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.includes('\0'))) {
    fail(`${label} must be an array of NUL-free strings`);
  }
  return value;
}

function strictBase64(value, label) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    fail(`${label} must be canonical base64`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) fail(`${label} must be canonical base64`);
  return bytes;
}

function validateProvider(provider) {
  object(provider, 'provider');
  nonEmptyString(provider.name, 'provider.name');
  nonEmptyString(provider.version, 'provider.version');
}

export function validateRunnerCapabilities(value) {
  const capabilities = object(value, 'runner capabilities');
  if (capabilities.capability_version !== RUNNER_CAPABILITY_VERSION) {
    fail(`capability_version must be ${RUNNER_CAPABILITY_VERSION}`);
  }
  if (!PLATFORMS.has(capabilities.platform)) fail('platform is not supported by runner-capabilities-v0');
  nonEmptyString(capabilities.architecture, 'architecture');
  if (!MECHANISMS.has(capabilities.mechanism)) fail('mechanism is not supported');
  boolean(capabilities.whole_tree_termination, 'whole_tree_termination');
  boolean(capabilities.kill_on_owner_exit, 'kill_on_owner_exit');
  boolean(capabilities.membership_observable, 'membership_observable');
  if (!SOFT_STOP_SCOPES.has(capabilities.soft_stop_scope)) fail('soft_stop_scope is not supported');
  if (!ESCAPE_RESISTANCE.has(capabilities.escape_resistance)) fail('escape_resistance is not supported');
  boolean(capabilities.separate_stdout_stderr, 'separate_stdout_stderr');
  boolean(capabilities.interactive_stdin, 'interactive_stdin');
  boolean(capabilities.timeout, 'timeout');
  validateProvider(capabilities.provider);

  if (capabilities.mechanism === 'windows_job_object' && capabilities.platform !== 'windows') {
    fail('windows_job_object mechanism requires platform=windows');
  }
  if (capabilities.mechanism === 'linux_cgroup_v2' && capabilities.platform !== 'linux') {
    fail('linux_cgroup_v2 mechanism requires platform=linux');
  }
  if (capabilities.mechanism === 'posix_process_group') {
    if (!['linux', 'macos', 'freebsd'].includes(capabilities.platform)) {
      fail('posix_process_group requires a POSIX platform');
    }
    if (capabilities.escape_resistance === 'strong') fail('process group cannot claim strong escape resistance');
  }
  if (capabilities.mechanism === 'process_reaper' && capabilities.platform !== 'freebsd') {
    fail('process_reaper mechanism requires platform=freebsd');
  }
  if (['windows_job_object', 'linux_cgroup_v2', 'process_reaper'].includes(capabilities.mechanism)) {
    if (!capabilities.whole_tree_termination || !capabilities.membership_observable) {
      fail(`${capabilities.mechanism} must report whole-tree termination and observable membership`);
    }
    if (capabilities.escape_resistance !== 'strong') {
      fail(`${capabilities.mechanism} must report strong escape resistance`);
    }
  }
  if (capabilities.mechanism === 'none') {
    if (capabilities.whole_tree_termination || capabilities.kill_on_owner_exit || capabilities.membership_observable) {
      fail('mechanism=none cannot report process-boundary guarantees');
    }
    if (capabilities.soft_stop_scope !== 'unsupported' || capabilities.escape_resistance !== 'best_effort') {
      fail('mechanism=none must report unsupported soft stop and best_effort escape resistance');
    }
  }
  return capabilities;
}

function validateEnv(env) {
  object(env, 'env');
  if (!['none', 'allowlist'].includes(env.inheritance_policy)) fail('env.inheritance_policy must be none or allowlist');
  stringArray(env.inherit_names ?? [], 'env.inherit_names');
  object(env.overrides, 'env.overrides');
  if (Object.values(env.overrides).some((value) => typeof value !== 'string')) fail('env.overrides values must be strings');
  stringArray(env.unset ?? [], 'env.unset');
  if (env.inheritance_policy === 'none' && (env.inherit_names ?? []).length > 0) {
    fail('env.inherit_names must be empty when inheritance_policy is none');
  }
}

export function validateRunnerRequest(value) {
  const request = object(value, 'runner request');
  if (request.protocol !== RUNNER_PROTOCOL) fail(`protocol must be ${RUNNER_PROTOCOL}`);
  if (!REQUEST_KINDS.has(request.kind)) fail('runner request kind is not supported');
  nonEmptyString(request.request_id, 'request_id');
  nonEmptyString(request.run_id, 'run_id');

  if (request.kind === 'start') {
    nonEmptyString(request.program, 'program');
    nonEmptyString(request.cwd, 'cwd');
    if (!path.isAbsolute(request.program)) fail('program must be an absolute path');
    if (!path.isAbsolute(request.cwd)) fail('cwd must be an absolute path');
    stringArray(request.argv, 'argv');
    validateEnv(request.env);
    positiveInteger(request.timeout_ms, 'timeout_ms');
  } else if (request.kind === 'input') {
    strictBase64(request.bytes_base64, 'bytes_base64');
  }
  return request;
}

export function parseRunnerJsonLine(line) {
  if (typeof line !== 'string' || line.trim().length === 0) fail('runner JSON line cannot be blank');
  let value;
  try {
    value = JSON.parse(line);
  } catch (error) {
    fail(`invalid runner JSON: ${error.message}`);
  }
  return object(value, 'runner JSON line');
}

function validateTimestamp(value) {
  nonEmptyString(value, 'at');
  if (Number.isNaN(Date.parse(value))) fail('at must be an ISO timestamp');
}

function validateEventEnvelope(event) {
  object(event, 'runner event');
  if (event.protocol !== RUNNER_PROTOCOL) fail(`protocol must be ${RUNNER_PROTOCOL}`);
  positiveInteger(event.sequence, 'sequence');
  validateTimestamp(event.at);
  nonEmptyString(event.run_id, 'run_id');
  if (!EVENT_KINDS.has(event.kind)) fail('runner event kind is not supported');
  object(event.payload, `${event.kind} payload`);
}

function validateFramePayload(payload, stream) {
  positiveInteger(payload.stream_sequence, `${stream}.stream_sequence`);
  const bytes = strictBase64(payload.bytes_base64, `${stream}.bytes_base64`);
  nonNegativeInteger(payload.byte_length, `${stream}.byte_length`);
  if (bytes.length !== payload.byte_length) fail(`${stream}.byte_length does not match decoded bytes`);
}

function validateEventPayload(event) {
  const payload = event.payload;
  switch (event.kind) {
    case 'capabilities.reported':
      validateRunnerCapabilities(payload);
      break;
    case 'boundary.created':
      nonEmptyString(payload.boundary_id, 'boundary_id');
      positiveInteger(payload.root_pid, 'root_pid');
      break;
    case 'process.started':
      positiveInteger(payload.pid, 'pid');
      break;
    case 'input.accepted':
      nonEmptyString(payload.request_id, 'input.accepted.request_id');
      nonNegativeInteger(payload.byte_length, 'input.accepted.byte_length');
      break;
    case 'cancel.requested':
      nonEmptyString(payload.request_id, 'cancel.requested.request_id');
      break;
    case 'stdout.frame':
      validateFramePayload(payload, 'stdout');
      break;
    case 'stderr.frame':
      validateFramePayload(payload, 'stderr');
      break;
    case 'boundary.termination.started':
    case 'boundary.termination.completed':
      nonEmptyString(payload.reason, `${event.kind}.reason`);
      break;
    case 'stdout.drained':
      nonNegativeInteger(payload.final_sequence, 'stdout.final_sequence');
      break;
    case 'stderr.drained':
      nonNegativeInteger(payload.final_sequence, 'stderr.final_sequence');
      break;
    case 'process.exited':
      positiveInteger(payload.pid, 'pid');
      if (payload.exit_code !== null && !Number.isInteger(payload.exit_code)) fail('exit_code must be an integer or null');
      if (payload.signal !== null && typeof payload.signal !== 'string') fail('signal must be a string or null');
      break;
    case 'boundary.snapshot':
      nonNegativeInteger(payload.active_processes, 'active_processes');
      break;
    case 'run.completed':
      if (!COMPLETION_STATUSES.has(payload.status)) fail('run.completed status is not supported');
      if (payload.exit_code !== null && !Number.isInteger(payload.exit_code)) fail('run.completed exit_code must be an integer or null');
      nonEmptyString(payload.termination_reason, 'termination_reason');
      break;
    case 'runner.error':
      nonEmptyString(payload.code, 'runner.error.code');
      nonEmptyString(payload.message, 'runner.error.message');
      break;
    case 'runner.ready':
      break;
    default:
      fail(`unhandled runner event kind: ${event.kind}`);
  }
}

export class RunnerEventReducer {
  constructor() {
    this.state = {
      runId: null,
      ready: false,
      capabilities: null,
      boundaryId: null,
      activeProcesses: null,
      streams: {
        stdout: { lastSequence: 0, drained: false },
        stderr: { lastSequence: 0, drained: false }
      },
      completed: false,
      completion: null,
      lastSequence: 0
    };
  }

  push(event) {
    if (this.state.completed) fail('event arrived after run.completed');
    validateEventEnvelope(event);
    validateEventPayload(event);
    if (event.sequence <= this.state.lastSequence) fail('event sequence must strictly increase');
    if (this.state.runId !== null && event.run_id !== this.state.runId) fail('run_id cannot change within one reducer');
    if (!this.state.ready && event.kind !== 'runner.ready') fail('runner.ready must be the first event');
    this.state.runId ??= event.run_id;
    this.state.lastSequence = event.sequence;

    switch (event.kind) {
      case 'runner.ready':
        if (this.state.ready) fail('runner.ready may occur at most once');
        this.state.ready = true;
        break;
      case 'capabilities.reported':
        if (this.state.capabilities !== null) fail('capabilities.reported may occur at most once');
        this.state.capabilities = event.payload;
        break;
      case 'boundary.created':
        if (this.state.boundaryId !== null) fail('boundary.created may occur at most once');
        this.state.boundaryId = event.payload.boundary_id;
        break;
      case 'stdout.frame':
      case 'stderr.frame': {
        const streamName = event.kind.startsWith('stdout') ? 'stdout' : 'stderr';
        const stream = this.state.streams[streamName];
        if (stream.drained) fail(`stream frame arrived after ${streamName} drain`);
        if (event.payload.stream_sequence <= stream.lastSequence) fail(`${streamName}.stream_sequence must strictly increase`);
        stream.lastSequence = event.payload.stream_sequence;
        break;
      }
      case 'stdout.drained':
      case 'stderr.drained': {
        const streamName = event.kind.startsWith('stdout') ? 'stdout' : 'stderr';
        const stream = this.state.streams[streamName];
        if (stream.drained) fail(`${streamName} may be drained at most once`);
        if (event.payload.final_sequence !== stream.lastSequence) fail(`${streamName}.final_sequence must equal last stream sequence`);
        stream.drained = true;
        break;
      }
      case 'boundary.snapshot':
        this.state.activeProcesses = event.payload.active_processes;
        break;
      case 'run.completed':
        if (!this.state.streams.stdout.drained || !this.state.streams.stderr.drained) {
          fail('run.completed requires both stdout and stderr drains');
        }
        if (event.payload.status === 'cancelled_safe' && this.state.activeProcesses !== 0) {
          fail('cancelled_safe requires zero active processes');
        }
        if (['succeeded', 'failed', 'timeout'].includes(event.payload.status) && this.state.activeProcesses !== 0) {
          fail(`${event.payload.status} requires zero active processes`);
        }
        this.state.completed = true;
        this.state.completion = { ...event.payload };
        break;
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      runId: this.state.runId,
      ready: this.state.ready,
      capabilities: this.state.capabilities ? { ...this.state.capabilities } : null,
      boundaryId: this.state.boundaryId,
      activeProcesses: this.state.activeProcesses,
      streams: {
        stdout: { ...this.state.streams.stdout },
        stderr: { ...this.state.streams.stderr }
      },
      completed: this.state.completed,
      completion: this.state.completion ? { ...this.state.completion } : null,
      lastSequence: this.state.lastSequence
    };
  }
}
