#!/usr/bin/env node
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { queryRustRunnerCapabilities } from '../src/rust-runner-client.mjs';

const outputPath = path.resolve(process.argv[2] ?? `evidence/ci/capabilities-${process.platform}-${process.arch}.json`);
const executable = path.resolve(
  'runner-rs',
  'target',
  'release',
  process.platform === 'win32' ? 'agentic-runner-spike.exe' : 'agentic-runner-spike'
);
const result = await queryRustRunnerCapabilities({ executable, requestId: 'ci-capabilities-v1' });
const document = {
  evidence_version: 'm0-runner-capability-evidence-v1',
  observed_at: new Date().toISOString(),
  node: process.version,
  host_platform: process.platform,
  host_architecture: process.arch,
  executable,
  support_level: result.supportLevel,
  capabilities: result.capabilities
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
