// Development/E2E helper only. The product has no process-launch API.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function startTestService(directory, port = 0, entry = 'apps/server/dist/main.js') {
  const child = spawn(process.execPath, [entry], {
    cwd: root, env: { ...process.env, WORKOS_DATA_DIR: directory, WORKOS_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = ''; let errors = '';
  child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-8000); });
  const exit = once(child, 'exit');
  try {
    const origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Test service did not start: ${errors}`)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Service exited before ready (${code}/${signal}): ${errors}`)); });
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        for (const line of output.split('\n')) {
          try { const event = JSON.parse(line); if (event.event === 'listening') { clearTimeout(timer); resolve(event.origin); return; } } catch { /* incomplete JSON line */ }
        }
      });
    });
    return {
      child, origin,
      async stop(signal = 'SIGTERM') {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill(signal);
        const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
        try { await exit; } finally { clearTimeout(timeout); }
      },
    };
  } catch (error) { child.kill('SIGKILL'); await exit.catch(() => {}); throw error; }
}
