// API-only test process: disposable database, no dependency on the web build.
import { createApplication } from '../../dist/app.js';
import { join } from 'node:path';
const app = await createApplication({ databasePath: join(process.env.WORKOS_DATA_DIR, 'workos.sqlite'),
  port: Number(process.env.WORKOS_PORT), intervalMs: 80 });
console.log(JSON.stringify({ event: 'listening', origin: app.origin, execution_mode: 'mock' }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void app.close(); });
