import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rename, writeFile, readFile, readdir } from 'node:fs/promises';
import {
  markerPathForCommonDir,
  readRepositoryMarker,
  ensureRepositoryMarker
} from '../src/repository-marker-identity.mjs';

const execFileAsync = promisify(execFile);
async function git(cwd, ...args) { return execFileAsync('git', args, { cwd, encoding: 'utf8' }); }
async function committedRepo(parent, name = 'repo') {
  const root = path.join(parent, name);
  await mkdir(root, { recursive: true });
  await git(root, 'init');
  await git(root, 'config', 'user.email', 'm0@example.invalid');
  await git(root, 'config', 'user.name', 'M0');
  await writeFile(path.join(root, 'README.md'), '# fixture\n');
  await git(root, 'add', 'README.md');
  await git(root, 'commit', '-m', 'fixture');
  return root;
}

test('root, subdirectory and relative path resolve to one persisted identity', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-root-'));
  const repo = await committedRepo(parent);
  const sub = path.join(repo, 'src'); await mkdir(sub);
  const first = await ensureRepositoryMarker(repo);
  const second = await ensureRepositoryMarker(sub);
  const relative = await ensureRepositoryMarker(path.relative(process.cwd(), repo));
  assert.equal(first.repositoryIdentity, second.repositoryIdentity);
  assert.equal(first.repositoryIdentity, relative.repositoryIdentity);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.markerPath, markerPathForCommonDir(first.gitCommonDir));
});

test('linked worktree shares identity while independent clone gets a new identity', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-worktree-'));
  const repo = await committedRepo(parent, 'source');
  const worktree = path.join(parent, 'linked');
  await git(repo, 'worktree', 'add', '-b', 'linked-test', worktree);
  const clone = path.join(parent, 'clone');
  await execFileAsync('git', ['clone', repo, clone], { encoding: 'utf8' });
  const sourceId = await ensureRepositoryMarker(repo);
  const linkedId = await ensureRepositoryMarker(worktree);
  const cloneId = await ensureRepositoryMarker(clone);
  assert.equal(sourceId.repositoryIdentity, linkedId.repositoryIdentity);
  assert.notEqual(sourceId.repositoryIdentity, cloneId.repositoryIdentity);
});

test('repository directory rename preserves identity and nested repository is distinct', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-rename-'));
  const repo = await committedRepo(parent, 'before');
  const before = await ensureRepositoryMarker(repo);
  const renamed = path.join(parent, 'after'); await rename(repo, renamed);
  const after = await ensureRepositoryMarker(renamed);
  const nested = await committedRepo(renamed, 'nested');
  const nestedId = await ensureRepositoryMarker(nested);
  assert.equal(before.repositoryIdentity, after.repositoryIdentity);
  assert.notEqual(before.repositoryIdentity, nestedId.repositoryIdentity);
});

test('concurrent first initialization converges on one marker without overwrite', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-race-'));
  const repo = await committedRepo(parent);
  const results = await Promise.all(Array.from({ length: 12 }, () => ensureRepositoryMarker(repo)));
  assert.equal(new Set(results.map((value) => value.repositoryIdentity)).size, 1);
  assert.equal(results.filter((value) => value.created).length, 1);
});

test('malformed marker and non-Git input fail closed', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-bad-'));
  const repo = await committedRepo(parent);
  const probe = await ensureRepositoryMarker(repo);
  await writeFile(probe.markerPath, '{"version":"wrong","id":"no"}\n');
  await assert.rejects(() => ensureRepositoryMarker(repo), /marker/i);
  const plain = path.join(parent, 'plain'); await mkdir(plain);
  await assert.rejects(() => ensureRepositoryMarker(plain), /git/i);
});

test('fault before publish leaves no final identity; fault after publish preserves a valid winner', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'repo-marker-fault-'));
  const repoA = await committedRepo(parent, 'a');
  let markerA;
  await assert.rejects(() => ensureRepositoryMarker(repoA, { fault(point, context) {
    if (point === 'after_temp_sync') { markerA = context.markerPath; throw new Error('stop-before-publish'); }
  }}), /stop-before-publish/);
  await assert.rejects(() => readFile(markerA, 'utf8'), { code: 'ENOENT' });
  assert.equal((await readdir(path.dirname(markerA))).filter((name) => name.includes('.tmp.')).length, 0);

  const repoB = await committedRepo(parent, 'b');
  let published;
  await assert.rejects(() => ensureRepositoryMarker(repoB, { fault(point, context) {
    if (point === 'after_publish') { published = context.markerPath; throw new Error('stop-after-publish'); }
  }}), /stop-after-publish/);
  const marker = await readRepositoryMarker(published);
  const recovered = await ensureRepositoryMarker(repoB);
  assert.equal(recovered.repositoryId, marker.id);
  assert.equal(recovered.created, false);
});
