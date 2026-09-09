import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(new URL('../apps/web/dist/', import.meta.url), { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['apps/web/src/main.tsx'], bundle: true,
  outfile: 'apps/web/dist/app.js', platform: 'browser', format: 'esm', target: 'es2022',
  minify: true, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'info' });
await copyFile(new URL('../apps/web/index.html', import.meta.url), new URL('../apps/web/dist/index.html', import.meta.url));
