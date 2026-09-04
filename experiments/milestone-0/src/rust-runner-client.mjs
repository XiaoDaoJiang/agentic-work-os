import { randomUUID } from 'node:crypto';
import { spawn as nodeSpawn } from 'node:child_process';
import {
  validateRunnerCapabilities,
  deriveSupportLevel,
  validateRunnerRequest,
  validateRunnerResponse
} from './local-runner-contract.mjs';

export async function queryRustRunnerCapabilities(options) {
  if (!options || typeof options !== 'object') throw new Error('options are required');
  if (typeof options.executable !== 'string' || options.executable.length === 0) throw new Error('executable is required');
  const requestId = options.requestId ?? randomUUID();
  const request = validateRunnerRequest({
    version: 'local-runner-protocol-v1', id: requestId, method: 'capabilities', params: {}
  });
  const spawnFn = options.spawnFn ?? nodeSpawn;
  const child = spawnFn(options.executable, options.args ?? [], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true
  });
  if (!child?.stdin || !child?.stdout || !child?.stderr || typeof child.on !== 'function') {
    throw new Error('runner process must expose stdin/stdout/stderr');
  }

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(`${JSON.stringify(request)}\n`);

  const timeoutMs = options.timeoutMs ?? 5000;
  const exit = await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill?.();
        reject(new Error(`runner capability query timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    child.once('error', (error) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(error); }
    });
    child.once('close', (code, signal) => {
      if (!settled) { settled = true; clearTimeout(timer); resolve({ code, signal }); }
    });
  });

  if (exit.code !== 0) {
    throw new Error(`runner exited with code ${exit.code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`);
  }
  const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length !== 1) throw new Error(`runner must emit exactly one capability response; observed ${lines.length}`);
  let raw;
  try { raw = JSON.parse(lines[0]); }
  catch (error) { throw new Error(`runner response is not JSON: ${error.message}`); }
  const response = validateRunnerResponse(raw);
  if (response.id !== requestId) {
    throw new Error(`runner response correlation mismatch: expected ${requestId}, received ${response.id}`);
  }
  if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
  const capabilities = validateRunnerCapabilities(response.result);
  return Object.freeze({ capabilities, supportLevel: deriveSupportLevel(capabilities), stderr });
}
