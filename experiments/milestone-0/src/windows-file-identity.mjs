import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const DEFAULT_SCRIPT_PATH = fileURLToPath(new URL('../scripts/windows-file-identity.ps1', import.meta.url));

function assertHex(value, length, label) {
  if (typeof value !== 'string' || value.length !== length || !/^[0-9a-f]+$/.test(value)) {
    throw new Error(`${label} must be exactly ${length} lowercase hex characters`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`);
}

async function invokeHelper(operation, targetPath, options = {}) {
  if ((options.platform ?? process.platform) !== 'win32') throw new Error(`${operation} requires Windows`);
  assertNonEmptyString(targetPath, 'targetPath');
  const execute = options.execute ?? execFileAsync;
  const powershellExecutable = options.powershellExecutable ?? 'powershell.exe';
  const scriptPath = options.scriptPath ?? DEFAULT_SCRIPT_PATH;
  let stdout;
  try {
    ({ stdout } = await execute(powershellExecutable, [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-Operation',
      operation,
      '-Path',
      targetPath
    ], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }));
  } catch (error) {
    throw new Error(`Windows file identity helper failed: ${error.message}`, { cause: error });
  }

  const raw = String(stdout ?? '').trim();
  if (raw.length === 0) throw new Error('Windows file identity helper returned empty output');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Windows file identity helper returned invalid JSON: ${error.message}`, { cause: error });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Windows file identity helper returned a non-object JSON value');
  }
  return parsed;
}

export async function getWindowsFileIdentity(targetPath, options = {}) {
  const parsed = await invokeHelper('file-id', targetPath, options);
  assertNonEmptyString(parsed.finalPath, 'finalPath');
  assertHex(parsed.volumeSerialHex, 16, 'volumeSerialHex');
  assertHex(parsed.fileIdHex, 32, 'fileIdHex');
  if (parsed.fileIdHex === '0'.repeat(32)) throw new Error('all-zero FILE_ID_128 is unsupported');
  return {
    finalPath: parsed.finalPath,
    volumeSerialHex: parsed.volumeSerialHex,
    fileIdHex: parsed.fileIdHex
  };
}

export async function getWindowsShortPath(targetPath, options = {}) {
  const parsed = await invokeHelper('short-path', targetPath, options);
  if (parsed.available === false) return null;
  if (parsed.available !== true) throw new Error('short-path helper must return available=true|false');
  assertNonEmptyString(parsed.shortPath, 'shortPath');
  return parsed.shortPath;
}
