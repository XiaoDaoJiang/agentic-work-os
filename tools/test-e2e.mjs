import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// shortcut: plain .mjs tests avoid Playwright 1.52's loader hang on Node 24; revisit before adding TS tests/config.
const cli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const result = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, PW_DISABLE_TS_ESM: '1' },
});
if (result.error) console.error(result.error);
process.exitCode = result.status ?? 1;
