import { spawn } from 'node:child_process';

export const STAGE_B_PROTOCOL = 'local-runner-jsonl-v0';
const SAFE_ID = /^[A-Za-z0-9._-]+$/;
const EVENTS = new Set([
  'runner.ready',
  'capabilities.reported',
  'boundary.created',
  'process.started',
  'input.accepted',
  'stdout.frame',
  'stderr.frame',
  'process.exited',
  'stdout.drained',
  'stderr.drained',
  'boundary.snapshot',
  'run.completed'
]);

function canonicalBase64(value, label) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error(`${label} must be canonical standard Base64`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`${label} must be canonical standard Base64`);
  return bytes;
}

function requestLine(request) {
  return `${JSON.stringify(request)}\n`;
}

export function validateStageBRequests(requests) {
  if (!Array.isArray(requests) || requests.length < 2) throw new Error('Stage B requires start and finish_input requests');
  const [start] = requests;
  if (start?.protocol !== STAGE_B_PROTOCOL || start?.kind !== 'start') throw new Error('first request must be a Stage B start request');
  if (!SAFE_ID.test(start.request_id ?? '') || !SAFE_ID.test(start.run_id ?? '')) throw new Error('start IDs must be path-safe');
  if (typeof start.program !== 'string' || start.program.length === 0 || start.program.includes('\0')) throw new Error('start.program must be a NUL-free string');
  if (!Array.isArray(start.argv) || start.argv.some((item) => typeof item !== 'string' || item.includes('\0'))) throw new Error('start.argv must be NUL-free strings');
  if (typeof start.cwd !== 'string' || start.cwd.length === 0 || start.cwd.includes('\0')) throw new Error('start.cwd must be a NUL-free string');
  if (!Number.isSafeInteger(start.timeout_ms) || start.timeout_ms <= 0) throw new Error('start.timeout_ms must be positive');
  if (!start.env || !['none', 'allowlist'].includes(start.env.inheritance_policy)) throw new Error('start.env inheritance policy is invalid');

  const ids = new Set();
  let finished = false;
  let inputBytes = 0;
  for (const request of requests) {
    if (request.protocol !== STAGE_B_PROTOCOL) throw new Error('request protocol mismatch');
    if (request.run_id !== start.run_id) throw new Error('request run_id mismatch');
    if (!SAFE_ID.test(request.request_id ?? '') || ids.has(request.request_id)) throw new Error('request_id must be unique and path-safe');
    ids.add(request.request_id);
    if (finished) throw new Error('request after finish_input');
    if (request.kind === 'cancel') throw new Error('cancel is not supported in Stage B');
    if (request.kind === 'input') inputBytes += canonicalBase64(request.bytes_base64, 'input.bytes_base64').length;
    if (request.kind === 'finish_input') finished = true;
  }
  if (!finished || requests.at(-1).kind !== 'finish_input') throw new Error('finish_input must be the final request');
  if (inputBytes > 1024 * 1024) throw new Error('Stage B stdin exceeds 1048576 bytes');
  return start;
}

function parseEvents(stdout, expectedRunId) {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error('native runner emitted no JSONL events');
  const events = lines.map((line, index) => {
    let event;
    try {
      event = JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSONL event ${index + 1}: ${error.message}`);
    }
    if (event.protocol !== STAGE_B_PROTOCOL) throw new Error(`event ${index + 1} protocol mismatch`);
    if (event.sequence !== index + 1) throw new Error(`event ${index + 1} sequence must be ${index + 1}`);
    if (event.run_id !== expectedRunId) throw new Error(`event ${index + 1} run_id mismatch`);
    if (!EVENTS.has(event.event)) throw new Error(`event ${index + 1} has unknown kind ${event.event}`);
    if (typeof event.at !== 'string' || Number.isNaN(Date.parse(event.at))) throw new Error(`event ${index + 1} timestamp is invalid`);
    if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new Error(`event ${index + 1} payload must be an object`);
    return event;
  });

  const requiredOrder = [
    'runner.ready',
    'capabilities.reported',
    'boundary.created',
    'process.started',
    'process.exited',
    'stdout.drained',
    'stderr.drained',
    'boundary.snapshot',
    'run.completed'
  ];
  let cursor = -1;
  for (const kind of requiredOrder) {
    const next = events.findIndex((event, index) => index > cursor && event.event === kind);
    if (next < 0) throw new Error(`required event missing or out of order: ${kind}`);
    cursor = next;
  }
  if (events.at(-1).event !== 'run.completed') throw new Error('run.completed must be the last event');

  const stdoutFrames = [];
  const stderrFrames = [];
  const lastSequence = { stdout: 0, stderr: 0 };
  for (const event of events) {
    if (!['stdout.frame', 'stderr.frame'].includes(event.event)) continue;
    const stream = event.event.startsWith('stdout') ? 'stdout' : 'stderr';
    if (event.payload.stream_sequence !== lastSequence[stream] + 1) throw new Error(`${stream} sequence is not contiguous`);
    lastSequence[stream] = event.payload.stream_sequence;
    const bytes = canonicalBase64(event.payload.bytes_base64, `${stream}.bytes_base64`);
    if (event.payload.byte_length !== bytes.length) throw new Error(`${stream} byte_length mismatch`);
    (stream === 'stdout' ? stdoutFrames : stderrFrames).push(bytes);
  }

  const completed = events.at(-1).payload;
  if (completed.containment_applied !== false || completed.observation_scope !== 'root_only') {
    throw new Error('Stage B completion must disclose root-only execution without containment');
  }

  return {
    events,
    stdoutBytes: Buffer.concat(stdoutFrames),
    stderrBytes: Buffer.concat(stderrFrames),
    completed
  };
}

export async function runStageB({ executable, requests, spawnFn = spawn }) {
  if (typeof executable !== 'string' || executable.length === 0) throw new Error('executable is required');
  const start = validateStageBRequests(requests);
  return new Promise((resolve, reject) => {
    const child = spawnFn(executable, [], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (exitCode, signal) => {
      try {
        const parsed = parseEvents(stdout, start.run_id);
        resolve({ ...parsed, helperExitCode: exitCode, helperSignal: signal, helperStderr: stderr });
      } catch (error) {
        reject(new Error(`${error.message}; helper exit=${exitCode}; stderr=${stderr}`));
      }
    });
    for (const request of requests) child.stdin.write(requestLine(request));
    child.stdin.end();
  });
}
