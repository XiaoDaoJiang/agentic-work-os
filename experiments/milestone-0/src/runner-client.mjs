import path from 'node:path';
import { spawn as nodeSpawn } from 'node:child_process';
import { parseRunnerJsonLine, validateRunnerCapabilities } from './runner-contract.mjs';

export class NativeRunnerDoctorError extends Error {
  constructor(code, message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = 'NativeRunnerDoctorError';
    this.code = code;
    this.exitCode = details.exitCode ?? null;
    this.signal = details.signal ?? null;
    this.stdout = details.stdout ?? '';
    this.stderr = details.stderr ?? '';
  }
}

function decodeUtf8(chunks, label) {
  const bytes = Buffer.concat(chunks);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_INVALID_UTF8',
      `${label} is not valid UTF-8`,
      { cause: error }
    );
  }
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(new NativeRunnerDoctorError(
        'NATIVE_RUNNER_SPAWN',
        `native runner doctor could not start: ${error.message}`,
        { cause: error }
      ));
    });
    child.once('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, signal });
    });
  });
}

export async function runNativeRunnerDoctor({ executable, spawnFn = nodeSpawn } = {}) {
  if (typeof executable !== 'string' || executable.length === 0 || executable.includes('\0') || !path.isAbsolute(executable)) {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_EXECUTABLE',
      'native runner doctor requires an absolute executable path'
    );
  }
  if (typeof spawnFn !== 'function') {
    throw new NativeRunnerDoctorError('NATIVE_RUNNER_SPAWN', 'spawnFn must be a function');
  }

  const child = spawnFn(executable, ['doctor'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false
  });
  if (!child || !child.stdout || !child.stderr || typeof child.once !== 'function') {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_SPAWN',
      'spawnFn must return a child process with stdout and stderr streams'
    );
  }

  const stdoutChunks = [];
  const stderrChunks = [];
  child.stdout.on('data', (chunk) => stdoutChunks.push(Buffer.from(chunk)));
  child.stderr.on('data', (chunk) => stderrChunks.push(Buffer.from(chunk)));

  const { exitCode, signal } = await waitForChild(child);
  const stdout = decodeUtf8(stdoutChunks, 'native runner doctor stdout');
  const stderr = decodeUtf8(stderrChunks, 'native runner doctor stderr');

  if (exitCode !== 0) {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_EXIT',
      `native runner doctor exited with code ${exitCode ?? 'null'}${signal ? ` and signal ${signal}` : ''}`,
      { exitCode, signal, stdout, stderr }
    );
  }

  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length !== 1) {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_PROTOCOL',
      `native runner doctor must emit exactly one non-empty JSON line; got ${lines.length}`,
      { exitCode, signal, stdout, stderr }
    );
  }

  let capabilities;
  try {
    capabilities = validateRunnerCapabilities(parseRunnerJsonLine(lines[0]));
  } catch (error) {
    throw new NativeRunnerDoctorError(
      'NATIVE_RUNNER_PROTOCOL',
      error.message,
      { exitCode, signal, stdout, stderr, cause: error }
    );
  }

  return { capabilities, stdout, stderr, exitCode, signal };
}
