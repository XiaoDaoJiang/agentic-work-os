import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const workflowPath = fileURLToPath(new URL(
  '../../../.github/workflows/m0-cross-platform-runtime.yml',
  import.meta.url
));

test('cross-platform runtime workflow freezes its platform and toolchain matrix', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  for (const value of [
    'ubuntu-24.04',
    'windows-2025',
    'macos-15',
    'node-version: 22.16.0',
    'dtolnay/rust-toolchain@1.88.0',
    'processkit'
  ]) {
    assert.match(workflow, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workflow, /fail-fast:\s*false/);
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

test('workflow uses committed Cargo.lock and the Node runner-doctor boundary', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /cargo metadata --locked/);
  assert.match(workflow, /cargo test --locked/);
  assert.match(workflow, /cargo clippy --locked/);
  assert.match(workflow, /cargo build --locked/);
  assert.doesNotMatch(workflow, /cargo generate-lockfile/);
  assert.match(workflow, /node src\/cli\.mjs runner-doctor --executable/);
  assert.match(workflow, /test\/runner-client\.test\.mjs/);
  assert.match(workflow, /test\/workflow-structure\.test\.mjs/);
});

test('workflow uploads auditable lock and doctor artifacts without broad permissions', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /native-runner-lock-\$\{\{ matrix\.os \}\}/);
  assert.match(workflow, /native-runner-doctor-\$\{\{ matrix\.os \}\}/);
  assert.doesNotMatch(workflow, /permissions:\s*write-all/);
});
