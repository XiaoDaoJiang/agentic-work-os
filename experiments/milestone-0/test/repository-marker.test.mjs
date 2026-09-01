import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { ensureRepositoryMarker, readRepositoryMarker, resolveGitCommonDir } from '../src/repository-marker.mjs';

const execFileAsync = promisify(execFile);
const FIXED_UUID = '550e8400-e29b-41d4-a716-446655440000';

async function git(cwd, args) {
  return execFileAsync('git', args, { cwd, encoding: 'utf8' });
}

async function initRepo(repo, { commit = false } = {}) {
  await mkdir(repo, { recursive: true });
  await git(repo, ['init']);
  if (commit) {
    await git(repo, ['config', 'user.email', 'm0@example.invalid']);
    await git(repo, ['config', 'user.name', 'M0 Marker']);
    await writeFile(path.join(repo, 'README.md'), '# fixture\n');
    await git(repo, ['add', 'README.md']);
    await git(repo, ['commit', '-m', 'fixture']);
  }
  return repo;
}

function fixedOptions() {
  return { randomUUIDFn: () => FIXED_UUID };
}

test('RID-01/RID-02 root, subdirectory, relative, spaces and Chinese paths share one marker identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-'));
  const repo = await initRepo(path.join(root, 'repo 空格-中文'));
  const sub = path.join(repo, 'src', '子目录');
  await mkdir(sub, { recursive: true });
  const first = await ensureRepositoryMarker(repo, fixedOptions());
  const second = await ensureRepositoryMarker(sub);
  const relative = path.relative(process.cwd(), sub);
  const third = await ensureRepositoryMarker(relative);
  assert.equal(first.repositoryIdentity, `repo-marker-v1:${FIXED_UUID}`);
  assert.equal(second.repositoryIdentity, first.repositoryIdentity);
  assert.equal(third.repositoryIdentity, first.repositoryIdentity);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(await readFile(first.markerPath, 'utf8'), `${FIXED_UUID}\n`);
});

test('RID-03 linked worktree shares the source repository identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-worktree-'));
  const repo = await initRepo(path.join(root, 'source'), { commit: true });
  const linked = path.join(root, 'linked worktree');
  await git(repo, ['worktree', 'add', '--detach', linked, 'HEAD']);
  const source = await ensureRepositoryMarker(repo, fixedOptions());
  const worktree = await ensureRepositoryMarker(linked);
  assert.equal(worktree.gitCommonDir, source.gitCommonDir);
  assert.equal(worktree.repositoryIdentity, source.repositoryIdentity);
});

test('RID-04 independent clones of the same origin receive different identities', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-clone-'));
  const source = await initRepo(path.join(root, 'source'), { commit: true });
  const cloneA = path.join(root, 'clone-a');
  const cloneB = path.join(root, 'clone-b');
  await git(root, ['clone', source, cloneA]);
  await git(root, ['clone', source, cloneB]);
  const ids = [
    await ensureRepositoryMarker(cloneA, { randomUUIDFn: () => '11111111-1111-4111-8111-111111111111' }),
    await ensureRepositoryMarker(cloneB, { randomUUIDFn: () => '22222222-2222-4222-8222-222222222222' })
  ];
  assert.notEqual(ids[0].repositoryIdentity, ids[1].repositoryIdentity);
});

test('RID-05 rename preserves identity and RID-06 re-clone at the same path changes it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-rename-'));
  const original = await initRepo(path.join(root, 'repo'));
  const before = await ensureRepositoryMarker(original, fixedOptions());
  const renamed = path.join(root, 'renamed');
  await rename(original, renamed);
  const afterRename = await ensureRepositoryMarker(renamed);
  assert.equal(afterRename.repositoryIdentity, before.repositoryIdentity);
  await rm(renamed, { recursive: true, force: true });
  await initRepo(renamed);
  const rebuilt = await ensureRepositoryMarker(renamed, { randomUUIDFn: () => '33333333-3333-4333-8333-333333333333' });
  assert.notEqual(rebuilt.repositoryIdentity, before.repositoryIdentity);
});

test('RID-07 nested repository owns a distinct marker', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-nested-'));
  const outer = await initRepo(path.join(root, 'outer'));
  const inner = await initRepo(path.join(outer, 'nested'));
  const outerId = await ensureRepositoryMarker(outer, fixedOptions());
  const innerId = await ensureRepositoryMarker(inner, { randomUUIDFn: () => '44444444-4444-4444-8444-444444444444' });
  assert.notEqual(innerId.repositoryIdentity, outerId.repositoryIdentity);
});

test('RID-08 concurrent first registration converges on exactly one valid winner', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-race-'));
  const repo = await initRepo(path.join(root, 'repo'));
  let counter = 0;
  const values = Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(8, '0')}-0000-4000-8000-000000000000`);
  const results = await Promise.all(Array.from({ length: 12 }, () => ensureRepositoryMarker(repo, {
    randomUUIDFn: () => values[counter++]
  })));
  assert.equal(new Set(results.map((item) => item.repositoryIdentity)).size, 1);
  assert.equal(results.filter((item) => item.created).length, 1);
});

test('RID-09 corrupt marker fails closed and is not overwritten', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-corrupt-'));
  const repo = await initRepo(path.join(root, 'repo'));
  const commonDir = await resolveGitCommonDir(repo);
  const markerDir = path.join(commonDir, 'agentic-work-os');
  const marker = path.join(markerDir, 'repository-id');
  await mkdir(markerDir, { recursive: true });
  await writeFile(marker, 'NOT-A-UUID\n', 'utf8');
  await assert.rejects(() => ensureRepositoryMarker(repo, fixedOptions()), /invalid repository marker/i);
  assert.equal(await readFile(marker, 'utf8'), 'NOT-A-UUID\n');
  await assert.rejects(() => readRepositoryMarker(commonDir), /invalid repository marker/i);
});

test('RID-10 creation failure is surfaced without path or remote fallback', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-marker-readonly-'));
  const repo = await initRepo(path.join(root, 'repo'));
  const failure = Object.assign(new Error('read only fixture'), { code: 'EACCES' });
  await assert.rejects(() => ensureRepositoryMarker(repo, {
    ...fixedOptions(),
    openFn: async () => { throw failure; }
  }), /cannot create repository marker.*EACCES/i);
});
