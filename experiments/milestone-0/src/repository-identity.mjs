import { createHash } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getWindowsFileIdentity } from './windows-file-identity.mjs';

const execFileAsync = promisify(execFile);
const VERSION = 'repo-local-git-v0';
const CANONICAL_SHA = '6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4';

function assertHex(value, length, label) {
  if (typeof value !== 'string' || value.length !== length || !/^[0-9a-f]+$/.test(value)) {
    throw new Error(`${label} must be exactly ${length} lowercase hex characters`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

export function computeRepositoryIdentityVector(volumeSerialHex, fileIdHex) {
  assertHex(volumeSerialHex, 16, 'volumeSerialHex');
  assertHex(fileIdHex, 32, 'fileIdHex');
  const payload = Buffer.from(`${VERSION}\0windows-file-id\0${volumeSerialHex}\0${fileIdHex}`, 'utf8');
  const sha256 = createHash('sha256').update(payload).digest('hex');
  return {
    version: VERSION,
    payloadByteLength: payload.length,
    sha256,
    repositoryIdentity: `${VERSION}:${sha256}`
  };
}

export function verifyCanonicalRepositoryIdentityVector() {
  const result = computeRepositoryIdentityVector('0123456789abcdef', '000102030405060708090a0b0c0d0e0f');
  return result.payloadByteLength === 83 && result.sha256 === CANONICAL_SHA && result.repositoryIdentity === `${VERSION}:${CANONICAL_SHA}`;
}

export async function resolveGitRepositoryFacts(inputPath, options = {}) {
  assertNonEmptyString(inputPath, 'inputPath');
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const resolvedInputPath = path.resolve(cwd, inputPath);
  const execute = options.execFile ?? execFileAsync;
  let stdout;
  try {
    ({ stdout } = await execute(options.gitExecutable ?? 'git', [
      '-C',
      resolvedInputPath,
      'rev-parse',
      '--path-format=absolute',
      '--show-toplevel',
      '--git-common-dir'
    ], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }));
  } catch (error) {
    throw new Error(`Git repository facts could not be resolved for ${resolvedInputPath}: ${error.message}`, { cause: error });
  }

  const lines = stdout.replace(/\r\n/g, '\n').split('\n').filter((line) => line.length > 0);
  if (lines.length !== 2) throw new Error(`Git repository facts returned ${lines.length} lines; expected exactly 2`);

  return {
    inputPath,
    resolvedInputPath,
    gitTopLevel: path.resolve(lines[0]),
    gitCommonDir: path.resolve(lines[1])
  };
}

export async function computeLocalRepositoryIdentity(inputPath, options = {}) {
  const gitFacts = await resolveGitRepositoryFacts(inputPath, options);
  const fileIdentityResolver = options.fileIdentityResolver ?? ((commonDir) => getWindowsFileIdentity(commonDir, {
    platform: options.platform ?? process.platform,
    powershellExecutable: options.powershellExecutable,
    scriptPath: options.scriptPath,
    execute: options.nativeExecute
  }));
  let fileIdentity;
  try {
    fileIdentity = await fileIdentityResolver(gitFacts.gitCommonDir);
  } catch (error) {
    throw new Error(`Windows file identity could not be resolved for ${gitFacts.gitCommonDir}: ${error.message}`, { cause: error });
  }
  if (!fileIdentity || typeof fileIdentity !== 'object') throw new Error('file identity resolver returned no object');
  assertNonEmptyString(fileIdentity.finalPath, 'finalPath');
  const vector = computeRepositoryIdentityVector(fileIdentity.volumeSerialHex, fileIdentity.fileIdHex);
  return {
    algorithmVersion: VERSION,
    ...gitFacts,
    finalCommonDirPath: fileIdentity.finalPath,
    fileIdentity: {
      volumeSerialHex: fileIdentity.volumeSerialHex,
      fileIdHex: fileIdentity.fileIdHex
    },
    repositoryIdentity: vector.repositoryIdentity
  };
}
