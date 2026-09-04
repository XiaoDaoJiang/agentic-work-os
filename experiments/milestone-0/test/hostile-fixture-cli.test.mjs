import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const cli = new URL('../src/cli.mjs', import.meta.url);

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli.pathname, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('hostile-fixture-plan validates the scenario and freezes an overridden seed without spawning a process', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-hostile-plan-'));
  const scenario = path.join(root, 'scenario.json');
  await writeFile(scenario, JSON.stringify({ hostile_process_v0: {
    seed: 10,
    stdoutFrames: ['a', 'b'],
    stderrFrames: ['e'],
    timingJitterMs: 5,
    exitMode: 'zero'
  } }), 'utf8');
  const before = await readdir(root);
  const result = await runCli(['hostile-fixture-plan', '--scenario', scenario, '--seed', '77'], root);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.scenario.seed, 77);
  assert.equal(output.outputJitterMs.length, 2);
  assert.equal(output.outputJitterMs.every((value) => value >= 0 && value <= 5), true);
  assert.deepEqual(await readdir(root), before);
});
