import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const cli = new URL('../src/cli.mjs', import.meta.url);

function runCli(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli.pathname, ...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('repository-vector command prints canonical PASS result', async () => {
  const result = await runCli(['repository-vector'], process.cwd());
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.matchesCanonicalVector, true);
  assert.equal(output.payloadByteLength, 83);
});

test('validate-verification exits zero for valid JSON contract', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-cli-contract-'));
  const file = path.join(root, 'contract.json');
  await writeFile(file, JSON.stringify({ verification_invocation_v0: { execution: { mode: 'argv', program: 'node', argv: ['--version'] }, cwd_binding: 'assigned_workspace', env: { inheritance_policy: 'none', inherit_names: [], overrides: {}, unset: [] }, timeout_ms: 1000, output: { stdout: 'separate ordered frames', stderr: 'separate ordered frames' }, cancel: 'runner_owned_process_containment' } }));
  const result = await runCli(['validate-verification', file], root);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /VALID/);
});

test('init creates an evidence run manifest without starting a runtime', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-cli-init-'));
  const plan = path.join(root, 'plan.md');
  await writeFile(plan, '# plan');
  const evidenceRoot = path.join(root, 'evidence');
  const result = await runCli(['init', '--evidence-root', evidenceRoot, '--plan', plan, '--harness-revision', 'test-rev'], root);
  assert.equal(result.code, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const manifest = JSON.parse(await readFile(output.manifestPath, 'utf8'));
  assert.equal(manifest.harness_revision, 'test-rev');
  assert.equal(manifest.evidence_files.length, 0);
  assert.match(manifest.experiment_run_id, /^m0-/);
});
