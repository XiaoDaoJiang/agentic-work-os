import { sha256File } from '../apps/server/dist/execution-profile.js';
import { createApplication } from '../apps/server/dist/app.js';
import { join } from 'node:path';
const [directory, executable, helper, fixtureRoot] = process.argv.slice(2);
const app = await createApplication({ databasePath: join(directory, 'state.sqlite'), port: 0, diagnostic: { fixtureRoot, profile: { executable, helper, helper_revision: sha256File(helper), model: 'gpt-6.1-sol', codex_version: 'diagnostic', evidence_path: '' } } });
process.send?.({ origin: app.origin });
process.on('message', async (message) => { if (message === 'close') {
    await app.close();
    process.exit(0);
} });
