import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { resolveGitRepositoryFacts, computeLocalRepositoryIdentity } from '../src/repository-identity.mjs';

const execFileAsync = promisify(execFile);

async function git(args, cwd) {
  return execFileAsync('git', args, { cwd, encoding: 'utf8' });
}

async function initRepo(root, name) {
  const repo = path.join(root, name);
  await mkdir(repo, { recursive: true });
  await git(['init'], repo);
  await git(['config', 'user.email', 'm0@example.invalid'], repo);
  await git(['config', 'user.name', 'M0 Test'], repo);
  await mkdir(path.join(repo, 'src'), { recursive: true });
  return repo;
}

async function fakeFileIdentityResolver(commonDir) {
  const canonical = await realpath(commonDir);
  const hex = createHash('sha256').update(canonical).digest('hex');
  return {
    finalPath: canonical,
    volumeSerialHex: '0000000000000001',
    fileIdHex: hex.slice(0, 32)
  };
}

test('resolves the same git common-dir from root, subdirectory, relative input, and dot-dot input', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-core-'));
  const repo = await initRepo(root, 'repo');
  const subdir = path.join(repo, 'src');
  const inputs = [
    { input: repo },
    { input: subdir },
    { input: path.relative(root, repo), cwd: root },
    { input: `${subdir}${path.sep}..` }
  ];
  const facts = [];
  for (const item of inputs) facts.push(await resolveGitRepositoryFacts(item.input, { cwd: item.cwd }));
  assert.equal(new Set(facts.map((item) => item.gitCommonDir)).size, 1);
  assert.equal(new Set(facts.map((item) => item.gitTopLevel)).size, 1);
});

test('linked worktree resolves to the source repository common-dir and therefore the same identity', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-worktree-'));
  const repo = await initRepo(root, 'repo');
  await git(['commit', '--allow-empty', '-m', 'initial'], repo);
  const linked = path.join(root, 'linked');
  await git(['worktree', 'add', '-b', 'linked-test', linked], repo);
  const sourceIdentity = await computeLocalRepositoryIdentity(repo, { fileIdentityResolver: fakeFileIdentityResolver });
  const linkedIdentity = await computeLocalRepositoryIdentity(linked, { fileIdentityResolver: fakeFileIdentityResolver });
  assert.equal(linkedIdentity.repositoryIdentity, sourceIdentity.repositoryIdentity);
  assert.equal(linkedIdentity.gitCommonDir, sourceIdentity.gitCommonDir);
});

test('independent clones resolve distinct common-dirs and identities', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-clones-'));
  const source = await initRepo(root, 'source');
  await git(['commit', '--allow-empty', '-m', 'initial'], source);
  const origin = path.join(root, 'origin.git');
  await git(['clone', '--bare', source, origin], root);
  const cloneA = path.join(root, 'clone-a');
  const cloneB = path.join(root, 'clone-b');
  await git(['clone', origin, cloneA], root);
  await git(['clone', origin, cloneB], root);
  const a = await computeLocalRepositoryIdentity(cloneA, { fileIdentityResolver: fakeFileIdentityResolver });
  const b = await computeLocalRepositoryIdentity(cloneB, { fileIdentityResolver: fakeFileIdentityResolver });
  assert.notEqual(a.gitCommonDir, b.gitCommonDir);
  assert.notEqual(a.repositoryIdentity, b.repositoryIdentity);
});

test('non-git input fails closed and never calls the file identity resolver', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-nongit-'));
  let called = false;
  await assert.rejects(
    computeLocalRepositoryIdentity(root, {
      fileIdentityResolver: async () => {
        called = true;
        return { finalPath: root, volumeSerialHex: '0000000000000001', fileIdHex: '0'.repeat(32) };
      }
    }),
    /Git repository facts could not be resolved/
  );
  assert.equal(called, false);
});

test('malformed file identity fails closed without path fallback', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-malformed-'));
  const repo = await initRepo(root, 'repo');
  await assert.rejects(
    computeLocalRepositoryIdentity(repo, {
      fileIdentityResolver: async (commonDir) => ({ finalPath: commonDir, volumeSerialHex: '1', fileIdHex: 'not-hex' })
    }),
    /volumeSerialHex must be exactly 16 lowercase hex characters/
  );
});

test('default file identity binding fails closed on non-Windows instead of requiring caller wiring', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-default-native-'));
  const repo = await initRepo(root, 'repo');
  await assert.rejects(
    computeLocalRepositoryIdentity(repo, { platform: 'linux' }),
    /requires Windows/
  );
});
