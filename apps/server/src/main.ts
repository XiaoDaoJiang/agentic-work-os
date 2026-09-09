import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApplication } from './app.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const dataDir = resolve(process.env.WORKOS_DATA_DIR ?? resolve(root, '.workos'));
const port = Number(process.env.WORKOS_PORT ?? '4317');
const staticDir = resolve(root, 'apps/web/dist');
try {
  if (!existsSync(resolve(staticDir, 'index.html'))) throw new Error('Web build missing. Run npm run build first.');
  const app = await createApplication({ databasePath: resolve(dataDir, 'workos.sqlite'), port, staticDir });
  console.log(JSON.stringify({ event: 'listening', origin: app.origin, execution_mode: 'mock' }));
  const stop = () => { void app.close().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 1; }); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Application startup failed'); process.exitCode = 1;
}
