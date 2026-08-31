function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function sha256(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
}

function validateProcessFact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('processProbe must return an object');
  nonNegativeInteger(value.activeProcesses, 'activeProcesses');
  return { activeProcesses: value.activeProcesses };
}

function validateMarkerFact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('markerProbe must return an object');
  if (typeof value.exists !== 'boolean') throw new Error('marker exists must be boolean');
  if (value.exists) {
    nonNegativeInteger(value.size, 'marker size');
    sha256(value.sha256, 'marker sha256');
    return { exists: true, size: value.size, sha256: value.sha256 };
  }
  return { exists: false, size: 0, sha256: null };
}

function validateOutputFact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('outputProbe must return an object');
  nonNegativeInteger(value.stdoutSize, 'stdoutSize');
  nonNegativeInteger(value.stderrSize, 'stderrSize');
  sha256(value.stdoutSha256, 'stdoutSha256');
  sha256(value.stderrSha256, 'stderrSha256');
  return {
    stdoutSize: value.stdoutSize,
    stderrSize: value.stderrSize,
    stdoutSha256: value.stdoutSha256,
    stderrSha256: value.stderrSha256
  };
}

function sameMarker(a, b) {
  return a.exists === b.exists && a.size === b.size && a.sha256 === b.sha256;
}

function sameOutput(a, b) {
  return a.stdoutSize === b.stdoutSize && a.stderrSize === b.stderrSize &&
    a.stdoutSha256 === b.stdoutSha256 && a.stderrSha256 === b.stderrSha256;
}

export async function observePostStop(options) {
  if (!options || typeof options !== 'object') throw new Error('observer options are required');
  positiveInteger(options.durationMs, 'durationMs');
  positiveInteger(options.sampleIntervalMs, 'sampleIntervalMs');
  for (const name of ['processProbe', 'markerProbe', 'outputProbe', 'sleep', 'now']) {
    if (typeof options[name] !== 'function') throw new Error(`${name} must be a function`);
  }

  const startedAt = options.now();
  if (!Number.isFinite(startedAt)) throw new Error('now() must return a finite number');
  const samples = [];
  let baselineMarker = null;
  let baselineOutput = null;
  let survivorObserved = false;
  let lateMarkerObserved = false;
  let lateOutputObserved = false;

  while (true) {
    const current = options.now();
    if (!Number.isFinite(current) || current < startedAt) throw new Error('now() must be monotonic and finite');
    const elapsedMs = current - startedAt;
    let processFact;
    let markerFact;
    let outputFact;
    try {
      processFact = validateProcessFact(await options.processProbe());
      markerFact = validateMarkerFact(await options.markerProbe());
      outputFact = validateOutputFact(await options.outputProbe());
    } catch (error) {
      return {
        status: 'INCONCLUSIVE',
        durationMs: options.durationMs,
        sampleIntervalMs: options.sampleIntervalMs,
        completedObservationMs: elapsedMs,
        samples,
        survivorObserved,
        lateMarkerObserved,
        lateOutputObserved,
        probeError: error.message
      };
    }

    if (processFact.activeProcesses > 0) survivorObserved = true;
    if (baselineMarker === null) baselineMarker = markerFact;
    else if (!sameMarker(baselineMarker, markerFact)) lateMarkerObserved = true;
    if (baselineOutput === null) baselineOutput = outputFact;
    else if (!sameOutput(baselineOutput, outputFact)) lateOutputObserved = true;

    samples.push({ elapsedMs, process: processFact, marker: markerFact, output: outputFact });

    if (elapsedMs >= options.durationMs) break;
    const waitMs = Math.min(options.sampleIntervalMs, options.durationMs - elapsedMs);
    await options.sleep(waitMs);
  }

  return {
    status: survivorObserved || lateMarkerObserved || lateOutputObserved ? 'FAIL' : 'PASS',
    durationMs: options.durationMs,
    sampleIntervalMs: options.sampleIntervalMs,
    completedObservationMs: samples.at(-1).elapsedMs,
    samples,
    survivorObserved,
    lateMarkerObserved,
    lateOutputObserved,
    probeError: null
  };
}
