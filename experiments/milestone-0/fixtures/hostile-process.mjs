#!/usr/bin/env node
import path from 'node:path';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { assertPathWithinRoot } from '../src/paths.mjs';
import { createSeededDelays, validateHostileScenario } from '../src/hostile-scenario.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROLES = new Set(['parent', 'child', 'grandchild']);
const ROLE_SEED_OFFSET = { parent: 0, child: 1009, grandchild: 2017 };

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Expected --name value near ${key ?? '<end>'}`);
    options[key.slice(2)] = value;
  }
  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeFrame(stream, line, segmented) {
  if (!segmented || line.length < 2) {
    stream.write(line);
    return;
  }
  const splitAt = Math.max(1, Math.floor(line.length / 2));
  stream.write(line.slice(0, splitAt));
  stream.write(line.slice(splitAt));
}

async function waitForNonce() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    lines.close();
    return line;
  }
  throw new Error('stdin closed before nonce arrived');
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  for (const required of ['root', 'scenario', 'control-file', 'role']) {
    if (!options[required]) throw new Error(`--${required} is required`);
  }
  if (!ROLES.has(options.role)) throw new Error('--role must be parent, child, or grandchild');

  const root = path.resolve(options.root);
  const controlFile = assertPathWithinRoot(root, options['control-file']);
  const markerFile = options.marker ? assertPathWithinRoot(root, options.marker) : null;
  await mkdir(root, { recursive: true });
  await mkdir(path.dirname(controlFile), { recursive: true });
  if (markerFile) await mkdir(path.dirname(markerFile), { recursive: true });

  const scenario = validateHostileScenario(JSON.parse(await readFile(path.resolve(options.scenario), 'utf8')));
  if ((scenario.markerWrites > 0 || scenario.lateWriteDelayMs !== null) && !markerFile) {
    throw new Error('--marker is required when marker or late-write behavior is configured');
  }

  const role = options.role;
  let eventChain = Promise.resolve();
  const emit = (event, payload = {}) => {
    const record = {
      event,
      role,
      pid: process.pid,
      ppid: process.ppid,
      monotonicNs: process.hrtime.bigint().toString(),
      timestamp: new Date().toISOString(),
      payload
    };
    eventChain = eventChain.then(() => appendFile(controlFile, `${JSON.stringify(record)}\n`, 'utf8'));
    return eventChain;
  };

  let markerSequence = 0;
  const writeMarker = async (kind = 'normal') => {
    markerSequence += 1;
    const line = JSON.stringify({ kind, role, pid: process.pid, sequence: markerSequence, timestamp: new Date().toISOString() });
    await appendFile(markerFile, `${line}\n`, 'utf8');
    await emit('marker.written', { kind, sequence: markerSequence });
  };

  let continuousTimer = null;
  let continuousSequence = 0;
  const stopContinuousOutput = () => {
    if (continuousTimer) clearInterval(continuousTimer);
    continuousTimer = null;
  };

  process.on('SIGTERM', () => {
    void (async () => {
      await emit('signal.received', { signal: 'SIGTERM', ignored: scenario.ignoreSoftStop });
      if (scenario.ignoreSoftStop) {
        if (scenario.lateWriteDelayMs !== null && markerFile) {
          setTimeout(() => { void writeMarker('late-after-sigterm'); }, scenario.lateWriteDelayMs);
        }
        return;
      }
      stopContinuousOutput();
      await eventChain;
      process.exit(143);
    })();
  });

  await emit('fixture.started', {
    cwd: process.cwd(),
    argv: process.argv.slice(2),
    scenarioVersion: scenario.version,
    seed: scenario.seed
  });

  if (scenario.continuousOutputIntervalMs > 0) {
    continuousTimer = setInterval(() => {
      continuousSequence += 1;
      process.stdout.write(`${role}:tick:${continuousSequence}\n`);
      process.stderr.write(`${role}:tick:${continuousSequence}\n`);
    }, scenario.continuousOutputIntervalMs);
  }

  const frameCount = Math.max(scenario.stdoutFrames.length, scenario.stderrFrames.length);
  const jitters = createSeededDelays(
    (scenario.seed + ROLE_SEED_OFFSET[role]) >>> 0,
    frameCount,
    0,
    scenario.timingJitterMs
  );
  for (let index = 0; index < frameCount; index += 1) {
    const delay = scenario.outputIntervalMs + jitters[index];
    if (delay > 0) await sleep(delay);
    if (index < scenario.stdoutFrames.length) {
      writeFrame(process.stdout, `${role}:${scenario.stdoutFrames[index]}\n`, scenario.segmentOutput);
    }
    if (index < scenario.stderrFrames.length) {
      writeFrame(process.stderr, `${role}:${scenario.stderrFrames[index]}\n`, scenario.segmentOutput);
    }
  }

  if (scenario.stdinNonce && role === 'parent') {
    const nonce = await waitForNonce();
    process.stdout.write(`stdin:${role}:${nonce}\n`);
    await emit('stdin.acknowledged', { nonce });
  }

  const spawnDescendant = async (childRole, detached = false) => {
    if (scenario.delayedDescendantMs > 0) await sleep(scenario.delayedDescendantMs);
    const args = [
      SELF,
      '--root', root,
      '--scenario', path.resolve(options.scenario),
      '--control-file', controlFile,
      '--role', childRole
    ];
    if (markerFile) args.push('--marker', markerFile);
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      detached,
      stdio: detached ? ['ignore', 'ignore', 'ignore'] : ['ignore', 'inherit', 'inherit'],
      windowsHide: true
    });
    await emit('descendant.spawned', { childRole, childPid: child.pid, detached });
    if (detached) {
      child.unref();
      return null;
    }
    const result = await new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));
    await emit('descendant.exited', { childRole, childPid: child.pid, ...result });
    return result;
  };

  if (role === 'parent' && scenario.spawnChild) {
    const detached = scenario.rootExitBeforeDescendants;
    await spawnDescendant('child', detached);
    if (detached) {
      stopContinuousOutput();
      await emit('fixture.exiting', { exitMode: 'root-early-exit', exitCode: 0 });
      await eventChain;
      return;
    }
  } else if (role === 'child' && scenario.spawnGrandchild) {
    await spawnDescendant('grandchild', false);
  }

  for (let index = 0; index < scenario.markerWrites; index += 1) {
    if (scenario.markerIntervalMs > 0) await sleep(scenario.markerIntervalMs);
    await writeMarker('normal');
  }

  if (scenario.exitMode === 'hang') {
    await emit('fixture.hanging', {});
    if (!continuousTimer) continuousTimer = setInterval(() => {}, 1000);
    await new Promise(() => {});
    return;
  }

  stopContinuousOutput();
  const exitCode = scenario.exitMode === 'nonzero' ? scenario.nonzeroExitCode : 0;
  await emit('fixture.exiting', { exitMode: scenario.exitMode, exitCode });
  await eventChain;
  process.exitCode = exitCode;
}

main().catch((error) => {
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exitCode = 1;
});
