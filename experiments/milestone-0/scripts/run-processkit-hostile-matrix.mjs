import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const POST_STOP_MS = 750;
const SAMPLE_MS = 50;
const RACE_REPETITIONS = 50;
const PHYSICAL_VERDICTS = new Set(['PASS', 'FAIL', 'INCONCLUSIVE']);

export const HOSTILE_MATRIX_CASES = Object.freeze([
  Object.freeze({
    id: 'tree-hang-cancel',
    scenario: 'tree-hang.json',
    trigger: 'cancel',
    triggerMs: 250,
    smokeSeed: 7,
    coverage: Object.freeze(['R-02', 'R-03', 'R-06'])
  }),
  Object.freeze({
    id: 'tree-hang-timeout',
    scenario: 'tree-hang.json',
    trigger: 'timeout',
    triggerMs: 250,
    smokeSeed: 7,
    coverage: Object.freeze(['R-03'])
  }),
  Object.freeze({
    id: 'root-exit-detached-cancel',
    scenario: 'root-exit-detached.json',
    trigger: 'cancel',
    triggerMs: 250,
    smokeSeed: 17,
    coverage: Object.freeze(['R-02', 'R-06'])
  }),
  Object.freeze({
    id: 'late-output-hang-cancel',
    scenario: 'late-output-hang.json',
    trigger: 'cancel',
    triggerMs: 150,
    smokeSeed: 29,
    coverage: Object.freeze(['R-08', 'RR-02', 'RR-07'])
  })
]);

function assertMode(mode) {
  if (mode !== 'smoke' && mode !== 'race') {
    throw new Error(`mode must be smoke or race; got ${mode}`);
  }
}

function assertAbsolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`);
  }
}

function assertCaseSpec(caseSpec) {
  if (!HOSTILE_MATRIX_CASES.includes(caseSpec)) {
    throw new Error('caseSpec must be one of HOSTILE_MATRIX_CASES');
  }
}

function frozenEntry(caseSpec, seed, repetition) {
  return Object.freeze({
    caseId: caseSpec.id,
    scenario: caseSpec.scenario,
    trigger: caseSpec.trigger,
    triggerMs: caseSpec.triggerMs,
    coverage: caseSpec.coverage,
    seed,
    repetition
  });
}

export function expandHostileMatrix({ mode }) {
  assertMode(mode);
  const entries = [];
  for (const caseSpec of HOSTILE_MATRIX_CASES) {
    if (mode === 'smoke') {
      entries.push(frozenEntry(caseSpec, caseSpec.smokeSeed, 0));
      entries.push(frozenEntry(caseSpec, caseSpec.smokeSeed, 1));
      continue;
    }
    for (let repetition = 0; repetition < RACE_REPETITIONS; repetition += 1) {
      entries.push(frozenEntry(caseSpec, repetition, repetition));
    }
  }
  return Object.freeze(entries);
}

export function buildHostileProbeInvocation({
  probeExecutable,
  nodeExecutable,
  fixturePath,
  scenarioPath,
  rootPath,
  caseSpec,
  seed,
  repetition
}) {
  assertAbsolute(probeExecutable, 'probeExecutable');
  assertAbsolute(nodeExecutable, 'nodeExecutable');
  assertAbsolute(fixturePath, 'fixturePath');
  assertAbsolute(scenarioPath, 'scenarioPath');
  assertAbsolute(rootPath, 'rootPath');
  assertCaseSpec(caseSpec);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('seed must be a 32-bit unsigned integer');
  }
  if (!Number.isInteger(repetition) || repetition < 0) {
    throw new Error('repetition must be a non-negative integer');
  }

  return Object.freeze({
    executable: probeExecutable,
    argv: Object.freeze([
      '--node', nodeExecutable,
      '--fixture', fixturePath,
      '--scenario', scenarioPath,
      '--root', rootPath,
      '--trigger', caseSpec.trigger,
      '--trigger-ms', String(caseSpec.triggerMs),
      '--post-stop-ms', String(POST_STOP_MS),
      '--sample-ms', String(SAMPLE_MS),
      '--seed', String(seed),
      '--repetition', String(repetition)
    ])
  });
}

function parseSingleProbeSummary(stdout) {
  if (typeof stdout !== 'string') throw new Error('probe stdout must be a string');
  const lines = stdout.lines ? stdout.lines() : stdout.split(/\r?\n/);
  const nonEmpty = Array.from(lines).filter((line) => line.trim() !== '');
  if (nonEmpty.length !== 1) {
    throw new Error(`probe must emit exactly one non-empty JSON line; got ${nonEmpty.length}`);
  }
  const summary = JSON.parse(nonEmpty[0]);
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    throw new Error('probe summary must be a JSON object');
  }
  if (summary.schema !== 'processkit-hostile-probe-v0') {
    throw new Error('probe summary schema must be processkit-hostile-probe-v0');
  }
  if (!PHYSICAL_VERDICTS.has(summary.physical_verdict)) {
    throw new Error('probe summary physical_verdict must be PASS, FAIL, or INCONCLUSIVE');
  }
  return summary;
}

export function classifyProbeExecution({ status, signal = null, stdout = '', stderr = '' }) {
  if (status !== 0 || signal !== null) {
    return Object.freeze({
      harness_status: 'FAIL',
      scenario_verdict: null,
      summary: null,
      exit_code: status,
      signal,
      stderr,
      harness_error: `probe process did not exit cleanly: status=${status} signal=${signal ?? 'none'}`
    });
  }

  try {
    const summary = parseSingleProbeSummary(stdout);
    return Object.freeze({
      harness_status: 'PASS',
      scenario_verdict: summary.physical_verdict,
      summary,
      exit_code: status,
      signal,
      stderr,
      harness_error: null
    });
  } catch (error) {
    return Object.freeze({
      harness_status: 'FAIL',
      scenario_verdict: null,
      summary: null,
      exit_code: status,
      signal,
      stderr,
      harness_error: error instanceof Error ? error.message : String(error)
    });
  }
}

export function runProbeInvocation(invocation) {
  return new Promise((resolve) => {
    const child = spawn(invocation.executable, invocation.argv, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      resolve(Object.freeze({
        harness_status: 'FAIL',
        scenario_verdict: null,
        summary: null,
        exit_code: null,
        signal: null,
        stderr,
        harness_error: `failed to start probe: ${error.message}`
      }));
    });

    child.once('close', (status, signal) => {
      if (settled) return;
      settled = true;
      resolve(classifyProbeExecution({ status, signal, stdout, stderr }));
    });
  });
}

function caseById(caseId) {
  const caseSpec = HOSTILE_MATRIX_CASES.find((candidate) => candidate.id === caseId);
  if (!caseSpec) throw new Error(`unknown hostile matrix case: ${caseId}`);
  return caseSpec;
}

function runKey(entry) {
  const repetition = String(entry.repetition).padStart(3, '0');
  const seed = String(entry.seed).padStart(10, '0');
  return `${entry.caseId}--r${repetition}--s${seed}`;
}

function serializableResult(entry, execution) {
  return {
    schema: 'processkit-hostile-matrix-result-v0',
    case_id: entry.caseId,
    scenario: entry.scenario,
    trigger: entry.trigger,
    trigger_ms: entry.triggerMs,
    seed: entry.seed,
    repetition: entry.repetition,
    coverage: [...entry.coverage],
    harness_status: execution.harness_status,
    scenario_verdict: execution.scenario_verdict,
    exit_code: execution.exit_code,
    signal: execution.signal,
    harness_error: execution.harness_error,
    stderr: execution.stderr,
    summary: execution.summary
  };
}

function summarizeMatrix(mode, records) {
  const harnessCounts = { PASS: 0, FAIL: 0 };
  const verdictCounts = { PASS: 0, FAIL: 0, INCONCLUSIVE: 0 };
  const mechanisms = new Set();

  for (const record of records) {
    harnessCounts[record.result.harness_status] += 1;
    if (record.result.scenario_verdict !== null) {
      verdictCounts[record.result.scenario_verdict] += 1;
    }
    const mechanism = record.result.summary?.actual_mechanism;
    if (typeof mechanism === 'string' && mechanism !== '') mechanisms.add(mechanism);
  }

  return {
    schema: 'processkit-hostile-matrix-summary-v0',
    mode,
    run_count: records.length,
    harness_status: harnessCounts.FAIL === 0 ? 'PASS' : 'FAIL',
    harness_counts: harnessCounts,
    scenario_verdict_counts: verdictCounts,
    actual_mechanisms: [...mechanisms].sort(),
    results: records.map((record) => ({
      case_id: record.result.case_id,
      repetition: record.result.repetition,
      seed: record.result.seed,
      harness_status: record.result.harness_status,
      scenario_verdict: record.result.scenario_verdict,
      result_path: record.resultPath
    }))
  };
}

export async function runHostileMatrix({
  mode,
  probeExecutable,
  nodeExecutable,
  fixturePath,
  scenarioDir,
  outputDir
}) {
  assertMode(mode);
  for (const [label, value] of [
    ['probeExecutable', probeExecutable],
    ['nodeExecutable', nodeExecutable],
    ['fixturePath', fixturePath],
    ['scenarioDir', scenarioDir],
    ['outputDir', outputDir]
  ]) {
    assertAbsolute(value, label);
  }

  await mkdir(outputDir, { recursive: true });
  const entries = expandHostileMatrix({ mode });
  const records = [];

  for (const entry of entries) {
    const caseSpec = caseById(entry.caseId);
    const rootPath = path.join(outputDir, 'runs', runKey(entry));
    await rm(rootPath, { recursive: true, force: true });
    await mkdir(rootPath, { recursive: true });
    const scenarioPath = path.join(scenarioDir, caseSpec.scenario);
    const invocation = buildHostileProbeInvocation({
      probeExecutable,
      nodeExecutable,
      fixturePath,
      scenarioPath,
      rootPath,
      caseSpec,
      seed: entry.seed,
      repetition: entry.repetition
    });
    const execution = await runProbeInvocation(invocation);
    const result = serializableResult(entry, execution);
    const resultPath = path.join(rootPath, 'matrix-result.json');
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8' });
    records.push({
      result,
      resultPath: path.relative(outputDir, resultPath).split(path.sep).join('/')
    });
  }

  const summary = summarizeMatrix(mode, records);
  const summaryPath = path.join(outputDir, 'matrix-summary.json');
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, { encoding: 'utf8' });
  return Object.freeze({ summary, summaryPath, records: Object.freeze(records) });
}

function parseCli(argv) {
  if (argv.length % 2 !== 0) throw new Error('CLI arguments must be --name value pairs');
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key.startsWith('--')) throw new Error(`expected --name, got ${key}`);
    if (values.has(key)) throw new Error(`duplicate argument ${key}`);
    values.set(key, argv[index + 1]);
  }
  const required = (key) => {
    const value = values.get(key);
    if (!value) throw new Error(`${key} is required`);
    values.delete(key);
    return value;
  };
  const config = {
    mode: required('--mode'),
    probeExecutable: path.resolve(required('--probe')),
    nodeExecutable: path.resolve(required('--node')),
    fixturePath: path.resolve(required('--fixture')),
    scenarioDir: path.resolve(required('--scenario-dir')),
    outputDir: path.resolve(required('--output-dir'))
  };
  if (values.size > 0) throw new Error(`unknown arguments: ${[...values.keys()].join(', ')}`);
  assertMode(config.mode);
  return config;
}

async function main() {
  try {
    const config = parseCli(process.argv.slice(2));
    const { summary } = await runHostileMatrix(config);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    process.exitCode = summary.harness_status === 'PASS' ? 0 : 1;
  } catch (error) {
    process.stderr.write(`MatrixHarnessError: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? fileURLToPath(pathToFileURL(path.resolve(process.argv[1]))) : null;
if (invokedFile === currentFile) {
  await main();
}
