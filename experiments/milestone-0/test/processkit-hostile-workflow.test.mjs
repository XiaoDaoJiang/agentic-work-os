import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const WORKFLOW_PATH = fileURLToPath(
  new URL('../../../.github/workflows/m0-processkit-hostile-containment.yml', import.meta.url)
);

async function workflowSource() {
  return readFile(WORKFLOW_PATH, 'utf8');
}

test('ProcessKit hostile evidence workflow freezes platforms and toolchains', async () => {
  const workflow = await workflowSource();

  assert.match(workflow, /^name:\s*M0 ProcessKit hostile containment$/m);
  for (const os of ['windows-2025', 'ubuntu-24.04', 'macos-15']) {
    assert.match(workflow, new RegExp(`-\\s+${os.replace('.', '\\.')}`));
  }
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version:\s*22\.16\.0/);
  assert.match(workflow, /dtolnay\/rust-toolchain@1\.88\.0/);
  assert.match(workflow, /PROCESSKIT_VERSION:\s*["']?3\.3\.4["']?/);
});

test('ProcessKit hostile evidence workflow treats dependency and quality gates as harness gates', async () => {
  const workflow = await workflowSource();

  assert.match(workflow, /cargo metadata --locked/);
  assert.match(workflow, /cargo test --locked/);
  assert.match(workflow, /cargo fmt[^\n]*-- --check/);
  assert.match(workflow, /cargo clippy --locked[^\n]*-D warnings/);
  assert.match(workflow, /cargo build --locked[^\n]*--release[^\n]*--bin hostile-probe/);
  assert.doesNotMatch(workflow, /continue-on-error\s*:/);
});

test('ProcessKit hostile evidence workflow runs the frozen race matrix and always uploads raw evidence', async () => {
  const workflow = await workflowSource();

  assert.match(workflow, /run-processkit-hostile-matrix\.mjs/);
  assert.match(workflow, /--mode\s+race/);
  assert.match(workflow, /actions\/upload-artifact@v7/);
  assert.match(workflow, /if:\s*always\(\)/);
  assert.match(workflow, /matrix-summary\.json/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s*read/);
});
