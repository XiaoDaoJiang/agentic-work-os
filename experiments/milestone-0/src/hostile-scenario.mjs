const VERSION = 'hostile-process-v0';
const EXIT_MODES = new Set(['zero', 'nonzero', 'hang']);

function integer(value, fallback, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return result;
}

function boolean(value, fallback, label) {
  const result = value ?? fallback;
  if (typeof result !== 'boolean') throw new Error(`${label} must be boolean`);
  return result;
}

function stringArray(value, label) {
  const result = value ?? [];
  if (!Array.isArray(result) || !result.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
  return [...result];
}

export function createSeededDelays(seed, count, minMs, maxMs) {
  const normalizedSeed = integer(seed, 1, 'seed', { min: 0, max: 0xffffffff });
  const normalizedCount = integer(count, 0, 'count');
  const normalizedMin = integer(minMs, 0, 'minMs');
  const normalizedMax = integer(maxMs, normalizedMin, 'maxMs');
  if (normalizedMax < normalizedMin) throw new Error('maxMs must be greater than or equal to minMs');

  let state = normalizedSeed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const span = normalizedMax - normalizedMin + 1;
  return Array.from({ length: normalizedCount }, () => normalizedMin + Math.floor(next() * span));
}

export function validateHostileScenario(document) {
  const raw = document?.hostile_process_v0;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('hostile_process_v0 object is required');
  }
  const exitMode = raw.exitMode ?? 'zero';
  if (!EXIT_MODES.has(exitMode)) throw new Error('exitMode must be zero, nonzero, or hang');
  const lateWriteDelayMs = raw.lateWriteDelayMs ?? null;
  if (lateWriteDelayMs !== null) integer(lateWriteDelayMs, 0, 'lateWriteDelayMs');

  return Object.freeze({
    version: VERSION,
    seed: integer(raw.seed, 1, 'seed', { min: 0, max: 0xffffffff }),
    stdoutFrames: Object.freeze(stringArray(raw.stdoutFrames, 'stdoutFrames')),
    stderrFrames: Object.freeze(stringArray(raw.stderrFrames, 'stderrFrames')),
    outputIntervalMs: integer(raw.outputIntervalMs, 0, 'outputIntervalMs'),
    timingJitterMs: integer(raw.timingJitterMs, 0, 'timingJitterMs'),
    stdinNonce: boolean(raw.stdinNonce, false, 'stdinNonce'),
    segmentOutput: boolean(raw.segmentOutput, false, 'segmentOutput'),
    continuousOutputIntervalMs: integer(raw.continuousOutputIntervalMs, 0, 'continuousOutputIntervalMs'),
    spawnChild: boolean(raw.spawnChild, false, 'spawnChild'),
    spawnGrandchild: boolean(raw.spawnGrandchild, false, 'spawnGrandchild'),
    delayedDescendantMs: integer(raw.delayedDescendantMs, 0, 'delayedDescendantMs'),
    rootExitBeforeDescendants: boolean(raw.rootExitBeforeDescendants, false, 'rootExitBeforeDescendants'),
    exitMode,
    nonzeroExitCode: integer(raw.nonzeroExitCode, 7, 'nonzeroExitCode', { min: 1, max: 255 }),
    markerWrites: integer(raw.markerWrites, 0, 'markerWrites'),
    markerIntervalMs: integer(raw.markerIntervalMs, 10, 'markerIntervalMs'),
    lateWriteDelayMs,
    ignoreSoftStop: boolean(raw.ignoreSoftStop, false, 'ignoreSoftStop')
  });
}
