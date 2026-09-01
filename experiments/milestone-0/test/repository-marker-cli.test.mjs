import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const cli = new URL('../src/cli.mjs', import.meta.url);

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli.pathname, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('repository-marker CLI creates once and then reuses the Git common-dir identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-cli-'));
  const repo = path.join(root, 'repo');
  await mkdir(repo);
  await execFileAsync('git', ['init'], { cwd: repo });

  const first = await runCli(['repository-marker', '--path', repo], root);
  assert.equal(first.code, 0, first.stderr);
  const firstDocument = JSON.parse(first.stdout);
  assert.equal(firstDocument.scheme, 'repo-marker-v1');
  assert.equal(firstDocument.created, true);

  const second = await runCli(['repository-marker', '--path', repo], root);
  assert.equal(second.code, 0, second.stderr);
  const secondDocument = JSON.parse(second.stdout);
  assert.equal(secondDocument.created, false);
  assert.equal(secondDocument.repositoryIdentity, firstDocument.repositoryIdentity);
});
