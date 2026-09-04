import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, open, readFile, link, rm } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const VERSION = 'repo-marker-v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function canonicalMarker(id) { return `${JSON.stringify({ version: VERSION, id })}\n`; }
function validateUuid(id) {
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error('repository marker id must be a canonical lowercase UUID');
  return id;
}
function exactMarker(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('repository marker must be an object');
  const keys = Object.keys(value);
  if (keys.length !== 2 || keys[0] !== 'version' || keys[1] !== 'id') throw new Error('repository marker fields/order are invalid');
  if (value.version !== VERSION) throw new Error(`repository marker version must be ${VERSION}`);
  validateUuid(value.id);
  return value;
}
async function callFault(fault, point, context) { if (fault) await fault(point, context); }

export function markerPathForCommonDir(commonDir) {
  if (typeof commonDir !== 'string' || commonDir.length === 0) throw new Error('git common-dir is required');
  return path.join(path.resolve(commonDir), 'agentic-work-os', 'repository-id.json');
}

export async function resolveGitCommonDir(inputPath, options = {}) {
  if (typeof inputPath !== 'string' || inputPath.length === 0 || inputPath.includes('\0')) throw new Error('inputPath is required');
  const resolvedInputPath = path.resolve(inputPath);
  const execute = options.execute ?? execFileAsync;
  let result;
  try {
    result = await execute(options.gitExecutable ?? 'git', ['-C', resolvedInputPath, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'], {
      encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024
    });
  } catch (error) {
    throw new Error(`Git repository discovery failed for ${resolvedInputPath}: ${error.message}`);
  }
  const lines = String(result.stdout ?? '').split(/\r?\n/);
  while (lines.at(-1) === '') lines.pop();
  if (lines.length !== 2 || lines.some((line) => line.length === 0)) throw new Error('Git repository discovery returned malformed output');
  const gitTopLevel = path.resolve(lines[0]);
  const gitCommonDir = path.resolve(lines[1]);
  if (!path.isAbsolute(gitTopLevel) || !path.isAbsolute(gitCommonDir)) throw new Error('Git repository discovery must return absolute paths');
  return { inputPath, resolvedInputPath, gitTopLevel, gitCommonDir };
}

export async function readRepositoryMarker(markerPath, options = {}) {
  const readFileFn = options.readFileFn ?? readFile;
  const text = await readFileFn(markerPath, 'utf8');
  let parsed;
  try { parsed = JSON.parse(text); } catch (error) { throw new Error(`repository marker JSON is invalid: ${error.message}`); }
  const value = exactMarker(parsed);
  if (text !== canonicalMarker(value.id)) throw new Error('repository marker bytes are not canonical');
  return Object.freeze({ version: VERSION, id: value.id });
}

export async function ensureRepositoryMarker(inputPath, options = {}) {
  const facts = await resolveGitCommonDir(inputPath, options);
  const markerPath = markerPathForCommonDir(facts.gitCommonDir);
  try {
    const existing = await readRepositoryMarker(markerPath, options);
    return Object.freeze({ scheme: VERSION, repositoryIdentity: `${VERSION}:${existing.id}`, repositoryId: existing.id, ...facts, markerPath, created: false });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const mkdirFn = options.mkdirFn ?? mkdir;
  const openFn = options.openFn ?? open;
  const linkFn = options.linkFn ?? link;
  const rmFn = options.rmFn ?? rm;
  const randomUUIDFn = options.randomUUIDFn ?? randomUUID;
  await mkdirFn(path.dirname(markerPath), { recursive: true });
  const candidateId = validateUuid(randomUUIDFn().toLowerCase());
  const tempId = validateUuid(randomUUIDFn().toLowerCase());
  const tempPath = `${markerPath}.tmp.${process.pid}.${tempId}`;
  let handle;
  let published = false;
  try {
    handle = await openFn(tempPath, 'wx');
    await handle.writeFile(canonicalMarker(candidateId), 'utf8');
    await handle.sync();
    await handle.close(); handle = null;
    await callFault(options.fault, 'after_temp_sync', { markerPath, tempPath, candidateId });
    try {
      await linkFn(tempPath, markerPath);
      published = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw new Error(`repository marker atomic publish failed: ${error.message}`);
    }
    if (published) await callFault(options.fault, 'after_publish', { markerPath, tempPath, candidateId });
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rmFn(tempPath, { force: true }).catch(() => {});
  }

  const winner = await readRepositoryMarker(markerPath, options);
  if (published && winner.id !== candidateId) throw new Error('published repository marker does not match candidate');
  return Object.freeze({ scheme: VERSION, repositoryIdentity: `${VERSION}:${winner.id}`, repositoryId: winner.id, ...facts, markerPath, created: published });
}
