import { spawn } from 'node:child_process';

export const STAGE_B_PROTOCOL = 'local-runner-jsonl-v0';
const SAFE_ID = /^[A-Za-z0-9._-]+$/;
const EVENTS = new Set([
  'runner.ready', 'capabilities.reported', 'boundary.created', 'process.started',
  'input.accepted', 'stdout.frame', 'stderr.frame', 'process.exited',
  'stdout.drained', 'stderr.drained', 'boundary.snapshot', 'run.completed'
]);

function canonicalBase64(value, label) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`${label} must be canonical standard Base64`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`${label} must be canonical standard Base64`);
  return bytes;
}

export function validateStageBRequests(requests) {
  if (!Array.isArray(requests) || requests.length < 2) throw new Error('Stage B requires start and finish_input requests');
  const start = requests[0];
  if (start?.protocol !== STAGE_B_PROTOCOL || start?.kind !== 'start') throw new Error('first request must be start');
  if (!SAFE_ID.test(start.request_id ?? '') || !SAFE_ID.test(start.run_id ?? '')) throw new Error('start IDs must be path-safe');
  if (typeof start.program !== 'string' || start.program.length === 0 || start.program.includes('\0')) throw new Error('program must be NUL-free');
  if (!Array.isArray(start.argv) || start.argv.some((value) => typeof value !== 'string' || value.includes('\0'))) throw new Error('argv must be NUL-free strings');
  if (typeof start.cwd !== 'string' || start.cwd.length === 0 || start.cwd.includes('\0')) throw new Error('cwd must be NUL-free');
  if (!Number.isSafeInteger(start.timeout_ms) || start.timeout_ms <= 0) throw new Error('timeout_ms must be positive');
  if (!start.env || !['none', 'allowlist'].includes(start.env.inheritance_policy)) throw new Error('environment policy is invalid');

  const requestIds = new Set();
  let finished = false;
  let startCount = 0;
  let inputBytes = 0;
  for (const request of requests) {
    if (finished) throw new Error('request arrived after finish_input');
    if (request.protocol !== STAGE_B_PROTOCOL) throw new Error('request protocol mismatch');
    if (request.run_id !== start.run_id) throw new Error('request run_id mismatch');
    if (!SAFE_ID.test(request.request_id ?? '') || requestIds.has(request.request_id)) throw new Error('request_id must be unique and path-safe');
    requestIds.add(request.request_id);
    if (request.kind === 'start') {
      startCount += 1;
      if (startCount > 1) throw new Error('start may occur exactly once');
    } else if (request.kind === 'cancel') {
      throw new Error('cancel is not supported in Stage B');
    } else if (request.kind === 'input') {
      inputBytes += canonicalBase64(request.bytes_base64, 'input.bytes_base64').length;
    } else if (request.kind === 'finish_input') {
      finished = true;
    } else {
      throw new Error(`unknown request kind: ${request.kind}`);
    }
  }
  if (!finished || requests.at(-1).kind !== 'finish_input') throw new Error('finish_input must be final');
  if (inputBytes > 1024 * 1024) throw new Error('Stage B stdin exceeds 1048576 bytes');
  return start;
}

function parseEvents(stdout, runId) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error('native runner emitted no JSONL events');
  const events = lines.map((line, index) => {
    let event;
    try { event = JSON.parse(line); }
    catch (error) { throw new Error(`invalid JSONL event ${index + 1}: ${error.message}`); }
    if (event.protocol !== STAGE_B_PROTOCOL) throw new Error(`event ${index + 1} protocol mismatch`);
    if (event.sequence !== index + 1) throw new Error(`event ${index + 1} sequence mismatch`);
    if (event.run_id !== runId) throw new Error(`event ${index + 1} run_id mismatch`);
    if (!EVENTS.has(event.event)) throw new Error(`event ${index + 1} kind is unknown`);
    if (typeof event.at !== 'string' || Number.isNaN(Date.parse(event.at))) throw new Error(`event ${index + 1} timestamp is invalid`);
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new Error(`event ${index + 1} payload is invalid`);
    return event;
  });

  const required = [
    'runner.ready', 'capabilities.reported', 'boundary.created', 'process.started',
    'process.exited', 'stdout.drained', 'stderr.drained', 'boundary.snapshot', 'run.completed'
  ];
  let cursor = -1;
  for (const kind of required) {
    cursor = events.findIndex((event, index) => index > cursor && event.event === kind);
    if (cursor < 0) throw new Error(`required event missing or out of order: ${kind}`);
  }
  if (events.at(-1).event !== 'run.completed') throw new Error('run.completed must be final');

  const sequences = { stdout: 0, stderr: 0 };
  const frames = { stdout: [], stderr: [] };
  for (const event of events) {
    if (!['stdout.frame', 'stderr.frame'].includes(event.event)) continue;
    const stream = event.event.startsWith('stdout') ? 'stdout' : 'stderr';
    if (event.payload.stream_sequence !== sequences[stream] + 1) throw new Error(`${stream} sequence is not contiguous`);
    sequences[stream] = event.payload.stream_sequence;
    const bytes = canonicalBase64(event.payload.bytes_base64, `${stream}.bytes_base64`);
    if (event.payload.byte_length !== bytes.length) throw new Error(`${stream} byte_length mismatch`);
    frames[stream].push(bytes);
  }

  const completed = events.at(-1).payload;
  if (completed.containment_applied !== false || completed.observation_scope !== 'root_only') {
    throw new Error('Stage B must disclose root-only execution without containment');
  }
  return {
    events,
    completed,
    stdoutBytes: Buffer.concat(frames.stdout),
    stderrBytes: Buffer.concat(frames.stderr)
  };
}

export async function runStageB({ executable, requests, spawnFn = spawn }) {
  if (typeof executable !== 'string' || executable.length === 0) throw new Error('executable is required');
  const start = validateStageBRequests(requests);
  return new Promise((resolve, reject) => {
    const child = spawnFn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const fail = (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', fail);
    child.once('close', (helperExitCode, helperSignal) => {
      if (settled) return;
      try {
        settled = true;
        resolve({
          ...parseEvents(stdout, start.run_id),
          helperExitCode,
          helperSignal,
          helperStderr: stderr
        });
      } catch (error) {
        fail(new Error(`${error.message}; helper exit=${helperExitCode}; stderr=${stderr}`));
      }
    });
    for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`);
    child.stdin.end();
  });
}
