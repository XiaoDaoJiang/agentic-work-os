#!/usr/bin/env node
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(new URL('..', import.meta.url).pathname);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(absolute));
    else if (entry.isFile() && entry.name.endsWith('.mjs')) files.push(absolute);
  }
  return files;
}

const directories = ['src', 'fixtures', 'scripts'].map((name) => path.join(root, name));
const files = (await Promise.all(directories.map(collect))).flat().sort();
for (const file of files) {
  await execFileAsync(process.execPath, ['--check', file], { windowsHide: true });
}
process.stdout.write(`Syntax OK: ${files.length} JavaScript modules\n`);
