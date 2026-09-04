import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, rm } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const SCHEME = 'repo-marker-v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function assertUuid(uuid) {
  if (typeof uuid !== 'string' || !UUID_V4.test(uuid)) {
    throw new Error('repository marker UUID must be a canonical lowercase UUID v4');
  }
  return uuid;
}

function markerPaths(commonDir) {
  const gitCommonDir = path.resolve(commonDir);
  const markerDir = path.join(gitCommonDir, 'agentic-work-os');
  return { gitCommonDir, markerDir, markerPath: path.join(markerDir, 'repository-id') };
}

function markerResult(commonDir, uuid, created) {
  const paths = markerPaths(commonDir);
  return {
    scheme: SCHEME,
    uuid,
    repositoryIdentity: `${SCHEME}:${uuid}`,
    gitCommonDir: paths.gitCommonDir,
    markerPath: paths.markerPath,
    created
  };
}

export async function resolveGitCommonDir(inputPath, options = {}) {
  if (typeof inputPath !== 'string' || inputPath.length === 0 || inputPath.includes('\0')) {
    throw new Error('inputPath must be a non-empty NUL-free string');
  }
  const cwd = path.resolve(inputPath);
  const execute = options.execute ?? execFileAsync;
  let result;
  try {
    result = await execute(options.gitExecutable ?? 'git', [
      'rev-parse', '--path-format=absolute', '--git-common-dir'
    ], {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });
  } catch (error) {
    throw new Error(`cannot resolve Git common-dir: ${error.message}`, { cause: error });
  }
  const lines = String(result.stdout ?? '').split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length !== 1 || !path.isAbsolute(lines[0])) {
    throw new Error('git rev-parse returned an invalid absolute common-dir');
  }
  return path.resolve(lines[0]);
}

function parseMarkerText(text, markerPath) {
  const match = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\n$/.exec(text);
  if (!match) throw new Error(`invalid repository marker at ${markerPath}`);
  return match[1];
}

export async function readRepositoryMarker(commonDir, options = {}) {
  const { gitCommonDir, markerPath } = markerPaths(commonDir);
  const readFileFn = options.readFileFn ?? readFile;
  let text;
  try {
    text = await readFileFn(markerPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new Error(`cannot read repository marker (${error?.code ?? 'UNKNOWN'}): ${error.message}`, { cause: error });
  }
  return markerResult(gitCommonDir, parseMarkerText(String(text), markerPath), false);
}

async function readConcurrentWinner(commonDir, options) {
  const attempts = options.winnerReadAttempts ?? 20;
  const delayMs = options.winnerReadDelayMs ?? 5;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const winner = await readRepositoryMarker(commonDir, options);
      if (winner) return winner;
    } catch (error) {
      lastError = error;
    }
    if (attempt + 1 < attempts) await sleep(delayMs);
  }
  if (lastError) throw lastError;
  throw new Error('repository marker winner was not readable after concurrent creation');
}

export async function ensureRepositoryMarker(inputPath, options = {}) {
  const gitCommonDir = await resolveGitCommonDir(inputPath, options);
  const existing = await readRepositoryMarker(gitCommonDir, options);
  if (existing) return existing;

  const { markerDir, markerPath } = markerPaths(gitCommonDir);
  const mkdirFn = options.mkdirFn ?? mkdir;
  const openFn = options.openFn ?? open;
  const rmFn = options.rmFn ?? rm;
  await mkdirFn(markerDir, { recursive: true });

  const uuid = assertUuid((options.randomUUIDFn ?? randomUUID)());
  let handle = null;
  let createdFile = false;
  try {
    handle = await openFn(markerPath, 'wx', 0o600);
    createdFile = true;
    await handle.writeFile(`${uuid}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
  } catch (error) {
    if (handle) {
      try { await handle.close(); } catch {}
    }
    if (error?.code === 'EEXIST') return readConcurrentWinner(gitCommonDir, options);
    if (createdFile) {
      try { await rmFn(markerPath, { force: true }); } catch {}
    }
    throw new Error(`cannot create repository marker (${error?.code ?? 'UNKNOWN'}): ${error.message}`, { cause: error });
  }

  const saved = await readRepositoryMarker(gitCommonDir, options);
  if (!saved || saved.uuid !== uuid) throw new Error('repository marker verification failed after creation');
  return { ...saved, created: true };
}
