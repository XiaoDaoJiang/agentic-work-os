import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const cli = new URL('../src/cli.mjs', import.meta.url);
const execFileAsync = promisify(execFile);
function runCli(args, cwd) { return new Promise((resolve) => { const child = spawn(process.execPath, [cli.pathname, ...args], { cwd }); let stdout = ''; let stderr = ''; child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; }); child.on('close', (code) => resolve({ code, stdout, stderr })); }); }

test('repository-identity command fails closed at the native identity boundary on a non-Windows host', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-cli-ri-single-'));
  await execFileAsync('git', ['init'], { cwd: root });
  const result = await runCli(['repository-identity', '--path', root], root);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /requires Windows/);
});

test('repository-identity-matrix emits and writes an auditable non-Windows INCONCLUSIVE result', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-cli-ri-matrix-'));
  const output = path.join(root, 'ri-matrix.json');
  const result = await runCli(['repository-identity-matrix', '--parent', root, '--run-id', 'exp_cli', '--output', output], root);
  assert.equal(result.code, 2, result.stderr);
  const stdoutDoc = JSON.parse(result.stdout);
  const fileDoc = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(stdoutDoc.overallVerdict, 'INCONCLUSIVE');
  assert.equal(fileDoc.overallVerdict, 'INCONCLUSIVE');
  assert.equal(fileDoc.cases.length, 11);
  assert.equal(fileDoc.cases.at(-1).id, 'RI-11');
  assert.equal(fileDoc.cases.at(-1).verdict, 'PASS');
});
