#!/usr/bin/env node
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createExperimentRunId } from './ids.mjs';
import { sha256File } from './hash.mjs';
import { createManifest, indexEvidenceFile, writeManifest } from './manifest.mjs';
import { createDisposableFixture } from './fixture.mjs';
import {
  computeLocalRepositoryIdentity,
  computeRepositoryIdentityVector,
  verifyCanonicalRepositoryIdentityVector
} from './repository-identity.mjs';
import { getWindowsFileIdentity } from './windows-file-identity.mjs';
import { runRepositoryIdentityMatrix } from './repository-identity-matrix.mjs';
import { renderTrustedLocalPrompt } from './trusted-local.mjs';
import { createSeededDelays, validateHostileScenario } from './hostile-scenario.mjs';
import { validateVerificationInvocation } from './verification-invocation.mjs';

function parseOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i]?.startsWith('--') || args[i + 1] === undefined) {
      throw new Error(`Expected --name value near ${args[i] ?? '<end>'}`);
    }
    const key = args[i].slice(2);
    if (key in options) throw new Error(`Duplicate option: --${key}`);
    options[key] = args[i + 1];
  }
  return options;
}

async function init(args) {
  const options = parseOptions(args);
  for (const required of ['evidence-root', 'plan', 'amendment', 'harness-revision']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  const planPath = path.resolve(options.plan);
  const amendmentPath = path.resolve(options.amendment);
  const evidenceRoot = path.resolve(options['evidence-root']);
  const experimentRunId = createExperimentRunId();
  const runRoot = path.join(evidenceRoot, experimentRunId);
  const directories = [
    'spike-1-runner/contract',
    'spike-1-runner/platforms/windows',
    'spike-1-runner/platforms/linux',
    'spike-1-runner/platforms/macos',
    'spike-2-codex-adapter',
    'spike-3-change-package',
    'spike-4-artifact-durability',
    'cross-contracts/repository-identity/marker',
    'cross-contracts/repository-identity/reference-windows-file-id',
    'cross-contracts/trusted-local',
    'cross-contracts/verification-invocation',
    'cross-contracts/resource-reconciliation',
    'cross-contracts/runtime-capabilities'
  ];
  await Promise.all(directories.map((dir) => mkdir(path.join(runRoot, dir), { recursive: true })));
  const manifestPath = path.join(runRoot, 'manifest.json');
  const manifest = createManifest({
    experimentRunId,
    planSha256: await sha256File(planPath),
    amendments: [{ path: amendmentPath, sha256: await sha256File(amendmentPath) }],
    harnessRevision: options['harness-revision'],
    planPath
  });
  await writeManifest(manifestPath, manifest);
  process.stdout.write(`${JSON.stringify({ experimentRunId, runRoot, manifestPath }, null, 2)}\n`);
}

async function repositoryIdentity(args) {
  const options = parseOptions(args);
  if (!options.path) throw new Error('--path is required');
  const result = await computeLocalRepositoryIdentity(options.path, {
    gitExecutable: options.git ?? 'git',
    fileIdentityResolver: (commonDir) => getWindowsFileIdentity(commonDir, {
      powershellExecutable: options.powershell ?? 'powershell.exe'
    })
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function repositoryIdentityMatrix(args) {
  const options = parseOptions(args);
  for (const required of ['parent', 'run-id']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  const result = await runRepositoryIdentityMatrix({
    parent: options.parent,
    experimentRunId: options['run-id'],
    powershellExecutable: options.powershell ?? 'powershell.exe',
    gitExecutable: options.git ?? 'git'
  });
  if (options.output) {
    const outputPath = path.resolve(options.output);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.overallVerdict === 'PASS' ? 0 : result.overallVerdict === 'FAIL' ? 1 : 2;
}

async function hostileFixturePlan(args) {
  const options = parseOptions(args);
  for (const required of ['scenario', 'seed']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  const seed = Number(options.seed);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('--seed must be an integer between 0 and 4294967295');
  }
  const document = JSON.parse(await readFile(path.resolve(options.scenario), 'utf8'));
  document.hostile_process_v0 = { ...(document.hostile_process_v0 ?? {}), seed };
  const scenario = validateHostileScenario(document);
  const frameCount = Math.max(scenario.stdoutFrames.length, scenario.stderrFrames.length);
  const outputJitterMs = createSeededDelays(scenario.seed, frameCount, 0, scenario.timingJitterMs);
  process.stdout.write(`${JSON.stringify({ scenario, outputJitterMs }, null, 2)}\n`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'hostile-fixture-plan') {
    await hostileFixturePlan(args);
    return;
  }
  if (command === 'repository-identity') {
    await repositoryIdentity(args);
    return;
  }
  if (command === 'repository-identity-matrix') {
    await repositoryIdentityMatrix(args);
    return;
  }
  if (command === 'repository-vector') {
    const result = computeRepositoryIdentityVector('0123456789abcdef', '000102030405060708090a0b0c0d0e0f');
    process.stdout.write(`${JSON.stringify({ ...result, matchesCanonicalVector: verifyCanonicalRepositoryIdentityVector() }, null, 2)}\n`);
    return;
  }
  if (command === 'validate-verification') {
    if (args.length !== 1) throw new Error('validate-verification requires a JSON file path');
    validateVerificationInvocation(JSON.parse(await readFile(path.resolve(args[0]), 'utf8')));
    process.stdout.write('VALID verification_invocation_v0\n');
    return;
  }
  if (command === 'trusted-local-prompt') {
    const options = parseOptions(args);
    for (const required of ['source', 'workspace', 'run-id']) {
      if (!options[required]) throw new Error(`--${required} is required`);
    }
    process.stdout.write(`${renderTrustedLocalPrompt({
      sourceRepository: path.resolve(options.source),
      assignedWorkspace: path.resolve(options.workspace),
      experimentRunId: options['run-id']
    })}\n`);
    return;
  }
  if (command === 'create-fixture') {
    const options = parseOptions(args);
    for (const required of ['parent', 'run-id']) {
      if (!options[required]) throw new Error(`--${required} is required`);
    }
    process.stdout.write(`${JSON.stringify(await createDisposableFixture({
      parent: options.parent,
      experimentRunId: options['run-id']
    }), null, 2)}\n`);
    return;
  }
  if (command === 'index-evidence') {
    const options = parseOptions(args);
    for (const required of ['manifest', 'file']) {
      if (!options[required]) throw new Error(`--${required} is required`);
    }
    process.stdout.write(`${JSON.stringify(await indexEvidenceFile(options.manifest, options.file), null, 2)}\n`);
    return;
  }
  if (command === 'init') {
    await init(args);
    return;
  }
  throw new Error(`Unknown command: ${command ?? '<none>'}`);
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
