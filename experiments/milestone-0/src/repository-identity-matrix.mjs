import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { assertPathWithinRoot } from './paths.mjs';
import { computeLocalRepositoryIdentity, verifyCanonicalRepositoryIdentityVector } from './repository-identity.mjs';
import { getWindowsFileIdentity, getWindowsShortPath } from './windows-file-identity.mjs';

const execFileAsync = promisify(execFile);
export const RI_CASE_IDS = Array.from({ length: 11 }, (_, index) => `RI-${String(index + 1).padStart(2, '0')}`);
const MATRIX_VERSION = 'repository-identity-matrix-v0';

function sameIdentity(items) {
  return new Set(items.map((item) => item.repositoryIdentity)).size === 1;
}

function publicIdentity(result) {
  return {
    inputPath: result.inputPath,
    resolvedInputPath: result.resolvedInputPath,
    gitTopLevel: result.gitTopLevel,
    gitCommonDir: result.gitCommonDir,
    finalCommonDirPath: result.finalCommonDirPath,
    volumeSerialHex: result.fileIdentity.volumeSerialHex,
    fileIdHex: result.fileIdentity.fileIdHex,
    repositoryIdentity: result.repositoryIdentity
  };
}

export function reduceRepositoryIdentityVerdict(cases) {
  if (cases.some((item) => item.verdict === 'FAIL')) return 'FAIL';
  if (cases.some((item) => item.verdict !== 'PASS')) return 'INCONCLUSIVE';
  return 'PASS';
}

export async function runRepositoryIdentityCaseRunners(runners) {
  const results = [];
  for (const id of RI_CASE_IDS) {
    const runner = runners[id];
    if (typeof runner !== 'function') {
      results.push({ id, verdict: 'INCONCLUSIVE', reason: 'case runner is not configured' });
      continue;
    }
    try {
      const result = await runner();
      results.push({ id, verdict: result.verdict, ...(result.reason ? { reason: result.reason } : {}), details: result.details ?? {} });
    } catch (error) {
      results.push({ id, verdict: 'FAIL', reason: error.message, details: {} });
    }
  }
  return results;
}

async function run(program, args, options = {}) {
  const execute = options.execute ?? execFileAsync;
  return execute(program, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
}

async function git(cwd, args, options) {
  return run(options.gitExecutable ?? 'git', args, { cwd, execute: options.execute });
}

async function createCommittedRepo(repoPath, options) {
  await mkdir(repoPath, { recursive: true });
  await git(repoPath, ['init'], options);
  await git(repoPath, ['config', 'user.email', 'm0@example.invalid'], options);
  await git(repoPath, ['config', 'user.name', 'M0 Repository Identity'], options);
  await writeFile(path.join(repoPath, 'README.md'), `fixture ${path.basename(repoPath)}\n`, 'utf8');
  await git(repoPath, ['add', 'README.md'], options);
  await git(repoPath, ['commit', '-m', 'fixture'], options);
  return repoPath;
}

async function createSameOriginClones(caseRoot, options) {
  const seed = await createCommittedRepo(path.join(caseRoot, 'seed'), options);
  const origin = path.join(caseRoot, 'origin.git');
  await git(caseRoot, ['clone', '--bare', seed, origin], options);
  const cloneA = path.join(caseRoot, 'clone-a');
  const cloneB = path.join(caseRoot, 'clone-b');
  await git(caseRoot, ['clone', origin, cloneA], options);
  await git(caseRoot, ['clone', origin, cloneB], options);
  const remoteA = (await git(cloneA, ['remote', 'get-url', 'origin'], options)).stdout.trim();
  const remoteB = (await git(cloneB, ['remote', 'get-url', 'origin'], options)).stdout.trim();
  return { origin, cloneA, cloneB, remoteA, remoteB };
}

function createIdentityFunction(options) {
  const fileIdentityResolver = (commonDir) => getWindowsFileIdentity(commonDir, {
    platform: 'win32',
    powershellExecutable: options.powershellExecutable,
    scriptPath: options.scriptPath,
    execute: options.nativeExecute
  });
  return (inputPath, extra = {}) => computeLocalRepositoryIdentity(inputPath, {
    cwd: extra.cwd,
    gitExecutable: options.gitExecutable,
    execFile: options.execute,
    fileIdentityResolver
  });
}

function passIf(condition, reason, details) {
  return condition ? { verdict: 'PASS', details } : { verdict: 'FAIL', reason, details };
}

async function expectReject(operation) {
  try {
    await operation();
    return false;
  } catch {
    return true;
  }
}

function createWindowsCaseRunners(matrixRoot, options) {
  const identify = createIdentityFunction(options);
  const caseRoot = async (id) => {
    const root = assertPathWithinRoot(matrixRoot, path.join(matrixRoot, id.toLowerCase()));
    await mkdir(root, { recursive: true });
    return root;
  };

  return {
    'RI-01': async () => {
      const root = await caseRoot('RI-01');
      const repo = await createCommittedRepo(path.join(root, 'repo path 中文'), options);
      const subdir = path.join(repo, 'nested');
      await mkdir(subdir, { recursive: true });
      const variants = [
        await identify(repo),
        await identify(subdir),
        await identify(path.relative(root, repo), { cwd: root }),
        await identify(`${subdir}${path.sep}..`)
      ];
      return passIf(sameIdentity(variants), 'root/subdir/relative/dot-dot inputs produced different identities', { variants: variants.map(publicIdentity) });
    },

    'RI-02': async () => {
      const root = await caseRoot('RI-02');
      const repo = await createCommittedRepo(path.join(root, 'Case Alias Repo'), options);
      const baseline = await identify(repo);
      const caseVariant = await identify(repo.toUpperCase());
      const separatorVariant = await identify(repo.split('\\').join('/'));
      const shortPath = await getWindowsShortPath(repo, {
        platform: 'win32',
        powershellExecutable: options.powershellExecutable,
        scriptPath: options.scriptPath,
        execute: options.nativeExecute
      });
      const observed = [baseline, caseVariant, separatorVariant];
      if (!sameIdentity(observed)) {
        return { verdict: 'FAIL', reason: 'case or separator path variant changed identity', details: { variants: observed.map(publicIdentity), shortPath } };
      }
      if (!shortPath) {
        return { verdict: 'INCONCLUSIVE', reason: 'Windows short-path alias is unavailable for the disposable fixture', details: { variants: observed.map(publicIdentity), shortPath: null } };
      }
      const shortVariant = await identify(shortPath);
      return passIf(shortVariant.repositoryIdentity === baseline.repositoryIdentity, 'short-path alias changed identity', {
        variants: [...observed, shortVariant].map(publicIdentity),
        shortPath
      });
    },

    'RI-03': async () => {
      const root = await caseRoot('RI-03');
      const repo = await createCommittedRepo(path.join(root, 'repo'), options);
      const junction = path.join(root, 'repo-junction');
      await symlink(repo, junction, 'junction');
      const direct = await identify(repo);
      const aliased = await identify(junction);
      return passIf(direct.repositoryIdentity === aliased.repositoryIdentity, 'junction alias changed identity', {
        direct: publicIdentity(direct),
        aliased: publicIdentity(aliased)
      });
    },

    'RI-04': async () => {
      const root = await caseRoot('RI-04');
      const repo = await createCommittedRepo(path.join(root, 'repo'), options);
      const linked = path.join(root, 'linked-worktree');
      await git(repo, ['worktree', 'add', '-b', 'ri-04-linked', linked], options);
      const source = await identify(repo);
      const worktree = await identify(linked);
      return passIf(
        source.repositoryIdentity === worktree.repositoryIdentity && source.gitCommonDir === worktree.gitCommonDir,
        'linked worktree did not resolve to source common-dir identity',
        { source: publicIdentity(source), worktree: publicIdentity(worktree) }
      );
    },

    'RI-05': async () => {
      const root = await caseRoot('RI-05');
      const clones = await createSameOriginClones(root, options);
      const a = await identify(clones.cloneA);
      const b = await identify(clones.cloneB);
      return passIf(
        clones.remoteA === clones.remoteB && a.repositoryIdentity !== b.repositoryIdentity,
        'same-origin independent clones did not produce distinct local identities',
        { remoteA: clones.remoteA, remoteB: clones.remoteB, cloneA: publicIdentity(a), cloneB: publicIdentity(b) }
      );
    },

    'RI-06': async () => {
      const root = await caseRoot('RI-06');
      const repo = await createCommittedRepo(path.join(root, 'before-rename'), options);
      const before = await identify(repo);
      const renamed = path.join(root, 'after-rename');
      await rename(repo, renamed);
      const after = await identify(renamed);
      return passIf(
        before.repositoryIdentity === after.repositoryIdentity,
        'same-volume rename changed FILE_ID based identity',
        { before: publicIdentity(before), after: publicIdentity(after) }
      );
    },

    'RI-07': async () => {
      const root = await caseRoot('RI-07');
      const clones = await createSameOriginClones(root, options);
      const first = await identify(clones.cloneA);
      const recloned = await identify(clones.cloneB);
      return passIf(
        first.repositoryIdentity !== recloned.repositoryIdentity,
        're-clone reused the original local identity',
        { first: publicIdentity(first), recloned: publicIdentity(recloned) }
      );
    },

    'RI-08': async () => {
      const root = await caseRoot('RI-08');
      const repoPath = path.join(root, 'same-path');
      await createCommittedRepo(repoPath, options);
      const before = await identify(repoPath);
      await rm(repoPath, { recursive: true, force: true });
      await createCommittedRepo(repoPath, options);
      const after = await identify(repoPath);
      return passIf(
        before.repositoryIdentity !== after.repositoryIdentity,
        'delete/rebuild at the same path reused the old repository identity',
        { before: publicIdentity(before), after: publicIdentity(after) }
      );
    },

    'RI-09': async () => {
      const root = await caseRoot('RI-09');
      const parentRepo = await createCommittedRepo(path.join(root, 'parent'), options);
      const nestedRepo = await createCommittedRepo(path.join(parentRepo, 'nested-repository'), options);
      const parentIdentity = await identify(parentRepo);
      const nestedIdentity = await identify(nestedRepo);
      return passIf(
        parentIdentity.repositoryIdentity !== nestedIdentity.repositoryIdentity && parentIdentity.gitCommonDir !== nestedIdentity.gitCommonDir,
        'nested repository was confused with parent repository identity',
        { parent: publicIdentity(parentIdentity), nested: publicIdentity(nestedIdentity) }
      );
    },

    'RI-10': async () => {
      const root = await caseRoot('RI-10');
      const nonGit = path.join(root, 'not-a-repository');
      await mkdir(nonGit, { recursive: true });
      const gitFailure = await expectReject(() => identify(nonGit));
      const nativeFailure = await expectReject(() => getWindowsFileIdentity(path.join(root, 'missing-common-dir'), {
        platform: 'win32',
        powershellExecutable: options.powershellExecutable,
        scriptPath: options.scriptPath,
        execute: options.nativeExecute
      }));
      return passIf(
        gitFailure && nativeFailure,
        'Git or native file-identity failure did not fail closed',
        { gitFailureObserved: gitFailure, nativeFailureObserved: nativeFailure }
      );
    },

    'RI-11': async () => ({
      verdict: verifyCanonicalRepositoryIdentityVector() ? 'PASS' : 'FAIL',
      reason: verifyCanonicalRepositoryIdentityVector() ? undefined : 'frozen canonical vector mismatch',
      details: { canonicalVectorMatched: verifyCanonicalRepositoryIdentityVector() }
    })
  };
}

export async function runRepositoryIdentityMatrix(options) {
  if (!options || typeof options !== 'object') throw new Error('matrix options are required');
  if (typeof options.parent !== 'string' || options.parent.length === 0) throw new Error('parent is required');
  if (typeof options.experimentRunId !== 'string' || options.experimentRunId.length === 0) throw new Error('experimentRunId is required');

  const platform = options.platform ?? process.platform;
  const matrixRoot = assertPathWithinRoot(
    options.parent,
    path.join(path.resolve(options.parent), `repository-identity-${options.experimentRunId}`)
  );
  await mkdir(matrixRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  let cases;

  if (platform !== 'win32') {
    cases = RI_CASE_IDS.map((id) => id === 'RI-11'
      ? {
          id,
          verdict: verifyCanonicalRepositoryIdentityVector() ? 'PASS' : 'FAIL',
          details: { canonicalVectorMatched: verifyCanonicalRepositoryIdentityVector() }
        }
      : {
          id,
          verdict: 'INCONCLUSIVE',
          reason: `RI-01..RI-10 requires Windows; current platform is ${platform}`,
          details: {}
        });
  } else {
    const runners = options.caseRunners ?? createWindowsCaseRunners(matrixRoot, options);
    cases = await runRepositoryIdentityCaseRunners(runners);
  }

  return {
    matrixVersion: MATRIX_VERSION,
    experimentRunId: options.experimentRunId,
    platform,
    matrixRoot,
    startedAt,
    endedAt: new Date().toISOString(),
    cases,
    overallVerdict: reduceRepositoryIdentityVerdict(cases)
  };
}
