import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDisposableFixture } from '../src/fixture.mjs';

test('createDisposableFixture creates ascii, spaced and Chinese path fixtures inside parent', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'm0-fixture-'));
  const fixture = await createDisposableFixture({ parent, experimentRunId: 'm0-test' });
  assert.equal(path.dirname(fixture.root), path.resolve(parent));
  for (const dir of [fixture.asciiWorkspace, fixture.spacedWorkspace, fixture.chineseWorkspace, fixture.artifactStore, fixture.stateDir]) {
    assert.equal((await stat(dir)).isDirectory(), true);
    assert.equal(path.resolve(dir).startsWith(path.resolve(parent) + path.sep), true);
  }
});
