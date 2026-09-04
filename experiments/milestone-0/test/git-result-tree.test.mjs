import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, rename, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { computeResultTreeHash, collectWorkspaceChanges } from '../src/git-result-tree.mjs';

const execFileAsync = promisify(execFile);
async function git(cwd, args, options = {}) {
  const { stdout = '' } = await execFileAsync('git', args, { cwd, encoding: 'utf8', ...options });
  return stdout.trim();
}

async function createFixture() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'm0-cp-git-'));
  await git(workspace, ['init']);
  await git(workspace, ['config', 'user.email', 'm0@example.invalid']);
  await git(workspace, ['config', 'user.name', 'M0']);
  await writeFile(path.join(workspace, 'keep.txt'), 'before\n');
  await writeFile(path.join(workspace, 'delete.txt'), 'delete me\n');
  await writeFile(path.join(workspace, 'old-name.txt'), 'rename me\n');
  await writeFile(path.join(workspace, 'space file.txt'), 'space before\n');
  await writeFile(path.join(workspace, '中文.txt'), '中文-before\n');
  await writeFile(path.join(workspace, 'exec.sh'), '#!/bin/sh\necho before\n');
  await chmod(path.join(workspace, 'exec.sh'), 0o755);
  await git(workspace, ['add', '-A']);
  await git(workspace, ['commit', '-m', 'base']);
  const baseRevision = await git(workspace, ['rev-parse', 'HEAD']);
  return { workspace, baseRevision };
}

async function makeChanges(workspace) {
  await writeFile(path.join(workspace, 'keep.txt'), 'after\n');
  await rm(path.join(workspace, 'delete.txt'));
  await rename(path.join(workspace, 'old-name.txt'), path.join(workspace, 'new-name.txt'));
  await writeFile(path.join(workspace, 'space file.txt'), 'space after\n');
  await writeFile(path.join(workspace, '中文.txt'), '中文-after\n');
  await writeFile(path.join(workspace, 'binary.bin'), Buffer.from([0, 1, 2, 255]));
  await writeFile(path.join(workspace, 'exec.sh'), '#!/bin/sh\necho after\n');
  await chmod(path.join(workspace, 'exec.sh'), 0o755);
}

test('collectWorkspaceChanges returns deterministic delete/upsert entries without mutating the real index', async () => {
  const { workspace, baseRevision } = await createFixture();
  await makeChanges(workspace);
  const statusBefore = await git(workspace, ['status', '--porcelain=v1', '-z']);
  const changes = await collectWorkspaceChanges({ workspace, baseRevision });
  const statusAfter = await git(workspace, ['status', '--porcelain=v1', '-z']);
  assert.equal(statusAfter, statusBefore);
  assert.deepEqual(changes.map(({ op, path }) => [op, path]), [['upsert','binary.bin'],['delete','delete.txt'],['upsert','exec.sh'],['upsert','keep.txt'],['upsert','new-name.txt'],['delete','old-name.txt'],['upsert','space file.txt'],['upsert','中文.txt']]);
  const binary = changes.find((entry) => entry.path === 'binary.bin');
  assert.equal(binary.size, 4); assert.equal(binary.mode, '100644'); assert.deepEqual(binary.bytes, Buffer.from([0,1,2,255])); assert.match(binary.sha256,/^[0-9a-f]{64}$/);
  assert.equal(changes.find((entry)=>entry.path==='exec.sh').mode,'100755');
});

test('computeResultTreeHash hashes the working tree result through a temporary index only', async () => {
  const { workspace, baseRevision } = await createFixture(); await makeChanges(workspace); const statusBefore = await git(workspace,['status','--porcelain=v1','-z']);
  const first = await computeResultTreeHash({ workspace, baseRevision }); const second = await computeResultTreeHash({ workspace, baseRevision });
  assert.equal(first.objectFormat,'sha1'); assert.match(first.resultTreeHash,/^[0-9a-f]{40}$/); assert.deepEqual(second,first); assert.equal(await git(workspace,['status','--porcelain=v1','-z']),statusBefore);
});

test('collectWorkspaceChanges fails closed on symlink entries', async () => {
  const { workspace, baseRevision } = await createFixture(); const target=path.join(workspace,'target.txt'); await writeFile(target,'target\n');
  try { await (await import('node:fs/promises')).symlink('target.txt',path.join(workspace,'link.txt')); } catch(error){ if(error?.code==='EPERM') return; throw error; }
  await assert.rejects(()=>collectWorkspaceChanges({workspace,baseRevision}),/unsupported Git mode 120000/);
});
