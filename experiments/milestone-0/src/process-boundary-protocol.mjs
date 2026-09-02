const FRAME_KINDS = new Set([
  'boundary.created',
  'process.assigned',
  'process.exited',
  'boundary.snapshot',
  'cancel.requested',
  'boundary.terminate.started',
  'boundary.terminate.completed',
  'stream.frame',
  'stream.drained',
  'helper.exited'
]);

export class BoundaryProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BoundaryProtocolError';
  }
}

function fail(message) {
  throw new BoundaryProtocolError(message);
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
}

function positiveInteger(value, label, { allowZero = false } = {}) {
  const min = allowZero ? 0 : 1;
  if (!Number.isSafeInteger(value) || value < min) fail(`${label} must be an integer >= ${min}`);
}

function timestamp(value, label) {
  nonEmptyString(value, label);
  if (Number.isNaN(Date.parse(value))) fail(`${label} must be an ISO timestamp`);
}

function streamName(value) {
  if (!['stdout', 'stderr'].includes(value)) fail('stream must be stdout or stderr');
}

function validatePayload(kind, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(`${kind} payload must be an object`);
  switch (kind) {
    case 'boundary.created':
      nonEmptyString(payload.boundaryId, 'boundaryId');
      positiveInteger(payload.rootPid, 'rootPid');
      timestamp(payload.rootCreatedAt, 'rootCreatedAt');
      break;
    case 'process.assigned':
      positiveInteger(payload.pid, 'pid');
      timestamp(payload.createdAt, 'createdAt');
      if (payload.role !== undefined) nonEmptyString(payload.role, 'role');
      break;
    case 'process.exited':
      positiveInteger(payload.pid, 'pid');
      if (payload.exitCode !== null && payload.exitCode !== undefined && !Number.isInteger(payload.exitCode)) fail('exitCode must be an integer or null');
      if (payload.signal !== null && payload.signal !== undefined && typeof payload.signal !== 'string') fail('signal must be string or null');
      break;
    case 'boundary.snapshot':
      positiveInteger(payload.activeProcesses, 'activeProcesses', { allowZero: true });
      break;
    case 'cancel.requested':
      nonEmptyString(payload.requestId, 'requestId');
      break;
    case 'boundary.terminate.started':
    case 'boundary.terminate.completed':
      nonEmptyString(payload.reason, 'reason');
      break;
    case 'stream.frame':
      streamName(payload.stream);
      positiveInteger(payload.streamSequence, 'streamSequence');
      positiveInteger(payload.byteLength, 'byteLength', { allowZero: true });
      break;
    case 'stream.drained':
      streamName(payload.stream);
      positiveInteger(payload.finalSequence, 'finalSequence', { allowZero: true });
      break;
    case 'helper.exited':
      if (!Number.isInteger(payload.exitCode)) fail('helper exitCode must be an integer');
      break;
    default:
      fail(`unknown boundary frame kind: ${kind}`);
  }
}

export function validateBoundaryFrame(frame) {
  if (!frame || typeof frame !== 'object' || Array.isArray(frame)) fail('boundary frame must be an object');
  if (!FRAME_KINDS.has(frame.kind)) fail(`unknown boundary frame kind: ${frame.kind ?? '<missing>'}`);
  positiveInteger(frame.sequence, 'frame sequence');
  timestamp(frame.at, 'at');
  validatePayload(frame.kind, frame.payload);
  return frame;
}

export function reduceBoundaryFrames(frames) {
  if (!Array.isArray(frames)) fail('frames must be an array');
  const state = {
    boundaryId: null,
    rootPid: null,
    rootCreatedAt: null,
    assignedPids: new Set(),
    exitedPids: new Set(),
    activeProcesses: null,
    streams: {
      stdout: { lastSequence: 0, drained: false },
      stderr: { lastSequence: 0, drained: false }
    },
    cancelRequested: false,
    terminationStarted: false,
    terminationCompleted: false,
    helperExited: null,
    lastFrameSequence: 0
  };

  for (const raw of frames) {
    const frame = validateBoundaryFrame(raw);
    if (frame.sequence <= state.lastFrameSequence) fail('frame sequence must strictly increase');
    state.lastFrameSequence = frame.sequence;

    if (frame.kind !== 'boundary.created' && state.boundaryId === null) {
      fail(`${frame.kind} requires boundary.created first`);
    }

    switch (frame.kind) {
      case 'boundary.created':
        if (state.boundaryId !== null) fail('boundary.created may occur at most once');
        state.boundaryId = frame.payload.boundaryId;
        state.rootPid = frame.payload.rootPid;
        state.rootCreatedAt = frame.payload.rootCreatedAt;
        break;
      case 'process.assigned':
        if (state.assignedPids.has(frame.payload.pid)) fail(`process ${frame.payload.pid} assigned more than once`);
        state.assignedPids.add(frame.payload.pid);
        break;
      case 'process.exited':
        if (!state.assignedPids.has(frame.payload.pid)) fail(`process.exited for unassigned pid ${frame.payload.pid}`);
        if (state.exitedPids.has(frame.payload.pid)) fail(`process ${frame.payload.pid} exited more than once`);
        state.exitedPids.add(frame.payload.pid);
        break;
      case 'boundary.snapshot':
        state.activeProcesses = frame.payload.activeProcesses;
        break;
      case 'cancel.requested':
        state.cancelRequested = true;
        break;
      case 'boundary.terminate.started':
        if (state.terminationStarted) fail('boundary.terminate.started may occur at most once');
        if (frame.payload.reason === 'cancel' && !state.cancelRequested) fail('cancel termination requires cancel.requested first');
        state.terminationStarted = true;
        break;
      case 'boundary.terminate.completed':
        if (!state.terminationStarted) fail('terminate.completed requires terminate.started');
        if (state.terminationCompleted) fail('boundary.terminate.completed may occur at most once');
        state.terminationCompleted = true;
        break;
      case 'stream.frame': {
        const stream = state.streams[frame.payload.stream];
        if (stream.drained) fail(`stream frame arrived after ${frame.payload.stream} drain`);
        if (frame.payload.streamSequence <= stream.lastSequence) fail(`${frame.payload.stream} streamSequence must strictly increase`);
        stream.lastSequence = frame.payload.streamSequence;
        break;
      }
      case 'stream.drained': {
        const stream = state.streams[frame.payload.stream];
        if (stream.drained) fail(`${frame.payload.stream} may be drained at most once`);
        if (frame.payload.finalSequence !== stream.lastSequence) fail(`${frame.payload.stream} finalSequence must equal the last observed streamSequence`);
        stream.drained = true;
        break;
      }
      case 'helper.exited':
        if (state.helperExited !== null) fail('helper.exited may occur at most once');
        state.helperExited = { ...frame.payload, at: frame.at, sequence: frame.sequence };
        break;
    }
  }

  return state;
}
