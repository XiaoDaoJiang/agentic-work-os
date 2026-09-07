import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sha256Bytes } from '../src/hash.mjs';
import { createManifest, writeManifest, indexEvidenceFile } from '../src/manifest.mjs';

test('sha256Bytes matches known digest', () => {
  assert.equal(sha256Bytes(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('manifest persists scope amendments in deterministic path order', () => {
  const manifest = createManifest({
    experimentRunId: 'm0-test',
    planSha256: 'a'.repeat(64),
    harnessRevision: 'rev-amended',
    amendments: [
      { path: 'docs/pm/z-amendment.md', sha256: 'c'.repeat(64) },
      { path: 'docs/pm/a-amendment.md', sha256: 'b'.repeat(64) }
    ]
  });
  assert.deepEqual(manifest.scope_amendments, [
    { path: 'docs/pm/a-amendment.md', sha256: 'b'.repeat(64) },
    { path: 'docs/pm/z-amendment.md', sha256: 'c'.repeat(64) }
  ]);
});

test('manifest rejects duplicate amendment paths and malformed hashes', () => {
  const base = {
    experimentRunId: 'm0-test',
    planSha256: 'a'.repeat(64),
    harnessRevision: 'rev-amended'
  };
  assert.throws(() => createManifest({
    ...base,
    amendments: [
      { path: 'docs/pm/55.md', sha256: 'b'.repeat(64) },
      { path: 'docs/pm/55.md', sha256: 'c'.repeat(64) }
    ]
  }), /duplicate amendment path/i);
  assert.throws(() => createManifest({
    ...base,
    amendments: [{ path: 'docs/pm/55.md', sha256: 'NOT-A-DIGEST' }]
  }), /amendment sha256/i);
});

test('indexEvidenceFile stores relative path, size and sha256', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-manifest-'));
  const runRoot = path.join(root, 'run');
  await mkdir(path.join(runRoot, 'raw'), { recursive: true });
  const file = path.join(runRoot, 'raw', 'stdout.bin');
  await writeFile(file, Buffer.from('hello'));
  const manifestPath = path.join(runRoot, 'manifest.json');
  const manifest = createManifest({ experimentRunId: 'm0-test', planSha256: 'a'.repeat(64), harnessRevision: 'rev-1' });
  await writeManifest(manifestPath, manifest);
  await indexEvidenceFile(manifestPath, file);
  const saved = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(saved.evidence_files, [{ path: 'raw/stdout.bin', size: 5, sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' }]);
});

test('indexEvidenceFile rejects files outside the run root', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'm0-manifest-'));
  const runRoot = path.join(root, 'run');
  await mkdir(runRoot, { recursive: true });
  const outside = path.join(root, 'outside.txt');
  await writeFile(outside, 'nope');
  const manifestPath = path.join(runRoot, 'manifest.json');
  await writeManifest(manifestPath, createManifest({ experimentRunId: 'm0-test', planSha256: 'b'.repeat(64), harnessRevision: 'rev-2' }));
  await assert.rejects(() => indexEvidenceFile(manifestPath, outside), /outside designated root/i);
});
