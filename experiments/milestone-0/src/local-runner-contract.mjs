const CAPABILITY_VERSION = 'local-runner-capabilities-v1';
const PROTOCOL_VERSION = 'local-runner-protocol-v1';
const PLATFORMS = new Set(['windows', 'linux', 'macos']);
const MECHANISMS = new Set(['job_object', 'cgroup_v2', 'process_group', 'unproven', 'none']);
const ESCAPE_RESISTANCE = new Set(['strong', 'process_group', 'best_effort']);
const METHODS = new Set(['capabilities', 'start', 'send_input', 'cancel', 'wait', 'snapshot', 'reconcile']);
const EVENT_KINDS = new Set(['started', 'stdout', 'stderr', 'input_accepted', 'cancel_requested', 'exited', 'snapshot', 'protocol_error']);

export class LocalRunnerContractError extends Error {
  constructor(message) { super(message); this.name = 'LocalRunnerContractError'; }
}
function fail(message) { throw new LocalRunnerContractError(message); }
function plain(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}
function exactKeys(value, allowed, required, label) {
  const object = plain(value, label);
  for (const key of Object.keys(object)) if (!allowed.includes(key)) fail(`${label} contains unknown field ${key}`);
  for (const key of required) if (!(key in object)) fail(`${label}.${key} is required`);
  return object;
}
function nonEmpty(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) fail(`${label} must be a non-empty NUL-free string`);
  return value;
}
function bool(value, label) { if (typeof value !== 'boolean') fail(`${label} must be boolean`); return value; }
function positive(value, label, allowZero = false) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) fail(`${label} must be an integer >= ${allowZero ? 0 : 1}`);
  return value;
}
function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.includes('\0'))) fail(`${label} must be an array of NUL-free strings`);
  return [...value];
}
function validBase64(value, label) {
  nonEmpty(value, label);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail(`${label} must be canonical base64`);
  return value;
}
function frozen(value) { return Object.freeze(value); }

export function validateRunnerCapabilities(document) {
  const keys = ['version','platform','architecture','mechanism','whole_tree_termination','owner_exit_cleanup','membership_observable','escape_resistance','stdin','separate_output_streams','timeout'];
  const value = exactKeys(document, keys, keys, 'capabilities');
  if (value.version !== CAPABILITY_VERSION) fail(`capabilities.version must be ${CAPABILITY_VERSION}`);
  if (!PLATFORMS.has(value.platform)) fail('capabilities.platform must be windows, linux, or macos');
  nonEmpty(value.architecture, 'capabilities.architecture');
  if (!MECHANISMS.has(value.mechanism)) fail('capabilities.mechanism is unsupported');
  if (!ESCAPE_RESISTANCE.has(value.escape_resistance)) fail('capabilities.escape_resistance is unsupported');
  for (const key of ['whole_tree_termination','owner_exit_cleanup','membership_observable','stdin','separate_output_streams','timeout']) bool(value[key], `capabilities.${key}`);

  if (value.mechanism === 'job_object' && value.platform !== 'windows') fail('job_object mechanism is valid only on windows');
  if (value.mechanism === 'cgroup_v2' && value.platform !== 'linux') fail('cgroup_v2 mechanism is valid only on linux');
  if (value.mechanism === 'process_group' && !['linux','macos'].includes(value.platform)) fail('process_group mechanism is valid only on linux or macos');
  if (value.mechanism === 'process_group' && value.escape_resistance === 'strong') fail('process_group cannot claim strong escape resistance');
  if (['unproven','none'].includes(value.mechanism)) {
    if (value.whole_tree_termination || value.owner_exit_cleanup || value.membership_observable) fail(`${value.mechanism} mechanism cannot claim containment capabilities`);
    if (value.escape_resistance !== 'best_effort') fail(`${value.mechanism} mechanism requires best_effort escape resistance`);
  }
  if (value.owner_exit_cleanup && !value.whole_tree_termination) fail('owner_exit_cleanup requires whole_tree_termination');
  if (value.escape_resistance === 'strong') {
    if (!['job_object','cgroup_v2'].includes(value.mechanism)) fail('strong escape resistance requires job_object or cgroup_v2');
    if (!value.whole_tree_termination || !value.membership_observable) fail('strong escape resistance requires whole-tree termination and observable membership');
  }
  return frozen({ ...value });
}

export function deriveSupportLevel(document) {
  const value = Object.isFrozen(document) ? document : validateRunnerCapabilities(document);
  const execution = value.stdin && value.separate_output_streams && value.timeout;
  if (execution && value.whole_tree_termination && value.owner_exit_cleanup && value.membership_observable && value.escape_resistance === 'strong') return 'managed';
  if (execution && value.whole_tree_termination && !['unproven','none'].includes(value.mechanism)) return 'compatible';
  return 'unsupported';
}

function validateParams(method, params) {
  const value = plain(params, 'request.params');
  if (method === 'capabilities') {
    exactKeys(value, [], [], 'request.params');
    return {};
  }
  if (method === 'start') {
    exactKeys(value, ['program','argv','cwd','env','timeout_ms'], ['program','argv','cwd','env','timeout_ms'], 'request.params');
    const env = plain(value.env, 'request.params.env');
    for (const [key, item] of Object.entries(env)) {
      nonEmpty(key, 'request.params.env key');
      if (typeof item !== 'string') fail('request.params.env values must be strings');
    }
    return { program: nonEmpty(value.program,'request.params.program'), argv: stringArray(value.argv,'request.params.argv'), cwd: nonEmpty(value.cwd,'request.params.cwd'), env: { ...env }, timeout_ms: positive(value.timeout_ms,'request.params.timeout_ms') };
  }
  if (method === 'send_input') {
    exactKeys(value, ['session_id','bytes_base64'], ['session_id','bytes_base64'], 'request.params');
    return { session_id: nonEmpty(value.session_id,'request.params.session_id'), bytes_base64: validBase64(value.bytes_base64,'request.params.bytes_base64') };
  }
  if (method === 'cancel') {
    exactKeys(value, ['session_id','request_id'], ['session_id','request_id'], 'request.params');
    return { session_id: nonEmpty(value.session_id,'request.params.session_id'), request_id: nonEmpty(value.request_id,'request.params.request_id') };
  }
  exactKeys(value, ['session_id'], ['session_id'], 'request.params');
  return { session_id: nonEmpty(value.session_id, 'request.params.session_id') };
}

export function validateRunnerRequest(document) {
  const value = exactKeys(document, ['version','id','method','params'], ['version','id','method','params'], 'request');
  if (value.version !== PROTOCOL_VERSION) fail(`request.version must be ${PROTOCOL_VERSION}`);
  nonEmpty(value.id, 'request.id');
  if (!METHODS.has(value.method)) fail('request.method is unsupported');
  return frozen({ version: PROTOCOL_VERSION, id: value.id, method: value.method, params: frozen(validateParams(value.method, value.params)) });
}

export function validateRunnerResponse(document) {
  const value = exactKeys(document, ['version','id','ok','result','error'], ['version','id','ok'], 'response');
  if (value.version !== PROTOCOL_VERSION) fail(`response.version must be ${PROTOCOL_VERSION}`);
  nonEmpty(value.id, 'response.id'); bool(value.ok, 'response.ok');
  if (value.ok) {
    if (!('result' in value)) fail('successful response.result is required');
    if ('error' in value) fail('successful response cannot include error');
    return frozen({ version: PROTOCOL_VERSION, id: value.id, ok: true, result: value.result });
  }
  if ('result' in value) fail('error response cannot include result');
  const error = exactKeys(value.error, ['code','message'], ['code','message'], 'response.error');
  return frozen({ version: PROTOCOL_VERSION, id: value.id, ok: false, error: frozen({ code: nonEmpty(error.code,'response.error.code'), message: nonEmpty(error.message,'response.error.message') }) });
}

function validateEventPayload(kind, payload) {
  const value = plain(payload, 'event.payload');
  if (kind === 'stdout' || kind === 'stderr') {
    exactKeys(value, ['stream_sequence','bytes_base64'], ['stream_sequence','bytes_base64'], 'event.payload');
    return { stream_sequence: positive(value.stream_sequence,'event.payload.stream_sequence'), bytes_base64: validBase64(value.bytes_base64,'event.payload.bytes_base64') };
  }
  if (kind === 'started') {
    exactKeys(value, ['pid','mechanism'], ['pid','mechanism'], 'event.payload');
    return { pid: positive(value.pid,'event.payload.pid'), mechanism: nonEmpty(value.mechanism,'event.payload.mechanism') };
  }
  if (kind === 'input_accepted') {
    exactKeys(value, ['byte_length'], ['byte_length'], 'event.payload');
    return { byte_length: positive(value.byte_length,'event.payload.byte_length',true) };
  }
  if (kind === 'cancel_requested') {
    exactKeys(value, ['request_id'], ['request_id'], 'event.payload');
    return { request_id: nonEmpty(value.request_id,'event.payload.request_id') };
  }
  if (kind === 'exited') {
    exactKeys(value, ['exit_code','termination_reason'], ['exit_code','termination_reason'], 'event.payload');
    if (value.exit_code !== null && !Number.isInteger(value.exit_code)) fail('event.payload.exit_code must be integer or null');
    return { exit_code: value.exit_code, termination_reason: nonEmpty(value.termination_reason,'event.payload.termination_reason') };
  }
  if (kind === 'snapshot') {
    exactKeys(value, ['active_processes'], ['active_processes'], 'event.payload');
    return { active_processes: positive(value.active_processes,'event.payload.active_processes',true) };
  }
  exactKeys(value, ['code','message'], ['code','message'], 'event.payload');
  return { code: nonEmpty(value.code,'event.payload.code'), message: nonEmpty(value.message,'event.payload.message') };
}

export function validateRunnerEvent(document) {
  const value = exactKeys(document, ['version','session_id','sequence','kind','at','payload'], ['version','session_id','sequence','kind','at','payload'], 'event');
  if (value.version !== PROTOCOL_VERSION) fail(`event.version must be ${PROTOCOL_VERSION}`);
  nonEmpty(value.session_id,'event.session_id'); positive(value.sequence,'event.sequence');
  if (!EVENT_KINDS.has(value.kind)) fail('event.kind is unsupported');
  nonEmpty(value.at,'event.at'); if (Number.isNaN(Date.parse(value.at))) fail('event.at must be an ISO timestamp');
  return frozen({ version: PROTOCOL_VERSION, session_id: value.session_id, sequence: value.sequence, kind: value.kind, at: value.at, payload: frozen(validateEventPayload(value.kind,value.payload)) });
}
