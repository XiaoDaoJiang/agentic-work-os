import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm, rename, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { captureWorkspaceVersion, computeResultTreeHash, collectWorkspaceChanges } from '../src/git-result-tree.mjs';

const execFileAsync = promisify(execFile);
async function git(cwd, args, options = {}) {
  const { stdout = '' } = await execFileAsync('git', args, { cwd, encoding: 'utf8', ...options });
  return stdout.trim();
}

async function createFixture() {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'm0-cp-git-'));
  await git(workspace, ['init']);
  await git(workspace, ['config', 'user.email', 'm0@example.invalid']);
  await git(workspace, ['config', 'user.name', 'M0']);
  await writeFile(path.join(workspace, 'keep.txt'), 'before\n');
  await writeFile(path.join(workspace, 'delete.txt'), 'delete me\n');
  await writeFile(path.join(workspace, 'old-name.txt'), 'rename me\n');
  await writeFile(path.join(workspace, 'space file.txt'), 'space before\n');
  await writeFile(path.join(workspace, '中文.txt'), '中文-before\n');
  await writeFile(path.join(workspace, 'exec.sh'), '#!/bin/sh\necho before\n');
  await chmod(path.join(workspace, 'exec.sh'), 0o755);
  await git(workspace, ['add', '-A']);
  await git(workspace, ['update-index', '--chmod=+x', 'exec.sh']);
  await git(workspace, ['commit', '-m', 'base']);
  const baseRevision = await git(workspace, ['rev-parse', 'HEAD']);
  return { workspace, baseRevision };
}

async function makeChanges(workspace) {
  await writeFile(path.join(workspace, 'keep.txt'), 'after\n');
  await rm(path.join(workspace, 'delete.txt'));
  await rename(path.join(workspace, 'old-name.txt'), path.join(workspace, 'new-name.txt'));
  await writeFile(path.join(workspace, 'space file.txt'), 'space after\n');
  await writeFile(path.join(workspace, '中文.txt'), '中文-after\n');
  await writeFile(path.join(workspace, 'binary.bin'), Buffer.from([0, 1, 2, 255]));
  await writeFile(path.join(workspace, 'exec.sh'), '#!/bin/sh\necho after\n');
  await chmod(path.join(workspace, 'exec.sh'), 0o755);
}

test('collectWorkspaceChanges returns deterministic delete/upsert entries without mutating the real index', async () => {
  const { workspace, baseRevision } = await createFixture();
  await makeChanges(workspace);
  const statusBefore = await git(workspace, ['status', '--porcelain=v1', '-z']);
  const changes = await collectWorkspaceChanges({ workspace, baseRevision });
  const statusAfter = await git(workspace, ['status', '--porcelain=v1', '-z']);
  assert.equal(statusAfter, statusBefore);
  assert.deepEqual(changes.map(({ op, path }) => [op, path]), [['upsert','binary.bin'],['delete','delete.txt'],['upsert','exec.sh'],['upsert','keep.txt'],['upsert','new-name.txt'],['delete','old-name.txt'],['upsert','space file.txt'],['upsert','中文.txt']]);
  const binary = changes.find((entry) => entry.path === 'binary.bin');
  assert.equal(binary.size, 4); assert.equal(binary.mode, '100644'); assert.deepEqual(binary.bytes, Buffer.from([0,1,2,255])); assert.match(binary.sha256,/^[0-9a-f]{64}$/);
  assert.equal(changes.find((entry)=>entry.path==='exec.sh').mode,'100755');
});

test('computeResultTreeHash hashes the working tree result through a temporary index only', async () => {
  const { workspace, baseRevision } = await createFixture(); await makeChanges(workspace); const statusBefore = await git(workspace,['status','--porcelain=v1','-z']);
  const first = await computeResultTreeHash({ workspace, baseRevision }); const second = await computeResultTreeHash({ workspace, baseRevision });
  assert.equal(first.objectFormat,'sha1'); assert.match(first.resultTreeHash,/^[0-9a-f]{40}$/); assert.deepEqual(second,first); assert.equal(await git(workspace,['status','--porcelain=v1','-z']),statusBefore);
});

test('collectWorkspaceChanges fails closed on symlink entries', async () => {
  const { workspace, baseRevision } = await createFixture(); const target=path.join(workspace,'target.txt'); await writeFile(target,'target\n');
  try { await (await import('node:fs/promises')).symlink('target.txt',path.join(workspace,'link.txt')); } catch(error){ if(error?.code==='EPERM') return; throw error; }
  await assert.rejects(()=>collectWorkspaceChanges({workspace,baseRevision}),/unsupported Git mode 120000|only ordinary files supported/);
});

test('nested LF, binary and export-ignore attributes preserve captured bytes and the real index', async () => {
  const { workspace } = await createFixture();
  await mkdir(path.join(workspace, 'kibana'));
  const attributes = '*.js text eol=lf\n*.md text eol=lf\n*.png binary\nREADME.md export-ignore\n';
  await writeFile(path.join(workspace, 'kibana/.gitattributes'), attributes);
  await writeFile(path.join(workspace, 'kibana/app.js'), 'before\n');
  await writeFile(path.join(workspace, 'kibana/README.md'), 'before\n');
  await writeFile(path.join(workspace, 'kibana/image.png'), Buffer.from([0, 255, 13, 10]));
  await git(workspace, ['add', '.']); await git(workspace, ['commit', '-m', 'attributes']);
  const baseRevision = await git(workspace, ['rev-parse', 'HEAD']);
  await writeFile(path.join(workspace, 'kibana/.gitattributes'), attributes + '# captured\n');
  await writeFile(path.join(workspace, 'kibana/app.js'), 'after\n');
  await writeFile(path.join(workspace, 'kibana/README.md'), 'kept despite export-ignore\n');
  await writeFile(path.join(workspace, 'kibana/image.png'), Buffer.from([0, 255, 13, 10, 7]));
  const index = await readFile(path.join(workspace, '.git/index'));
  const first = await captureWorkspaceVersion({ workspace, baseRevision });
  const second = await captureWorkspaceVersion({ workspace, baseRevision });
  assert.equal(second.resultTreeHash, first.resultTreeHash);
  for (const [file, bytes] of [['.gitattributes', Buffer.from(attributes + '# captured\n')], ['app.js', Buffer.from('after\n')], ['README.md', Buffer.from('kept despite export-ignore\n')], ['image.png', Buffer.from([0, 255, 13, 10, 7])]]) {
    assert.deepEqual(first.entries.find(entry => entry.path === 'kibana/' + file).bytes, bytes);
  }
  assert.deepEqual(await readFile(path.join(workspace, '.git/index')), index);
});

test('real CRLF conversion is rejected without changing the real index', async () => {
  const { workspace } = await createFixture();
  await writeFile(path.join(workspace, '.gitattributes'), '*.txt text eol=lf\n');
  await git(workspace, ['add', '.']); await git(workspace, ['commit', '-m', 'attributes']);
  const baseRevision = await git(workspace, ['rev-parse', 'HEAD']);
  await writeFile(path.join(workspace, 'keep.txt'), Buffer.from('changed\r\n'));
  const index = await readFile(path.join(workspace, '.git/index'));
  await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /captured bytes changed or content conversion detected/);
  assert.deepEqual(await readFile(path.join(workspace, '.git/index')), index);
});

for (const prefix of ['', 'kibana/']) {
  test(`${prefix}.gitattributes must be an ordinary file`, async () => {
    const { workspace, baseRevision } = await createFixture();
    await mkdir(path.join(workspace, prefix + '.gitattributes'), { recursive: true });
    await writeFile(path.join(workspace, prefix + '.gitattributes/child.txt'), 'not attributes\n');
    await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /attributes file must be captured as an ordinary file/);
  });

  test(`ignored ${prefix}.gitattributes must be captured before its rules can affect the tree`, async () => {
    const { workspace, baseRevision } = await createFixture();
    if (prefix) await mkdir(path.join(workspace, 'kibana'));
    await writeFile(path.join(workspace, '.gitignore'), '.gitattributes\n');
    await writeFile(path.join(workspace, prefix + '.gitattributes'), '*.txt text eol=lf\n');
    await writeFile(path.join(workspace, prefix + 'new.txt'), 'LF text\n');
    const index = await readFile(path.join(workspace, '.git/index'));
    await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /attributes file must be captured/);
    assert.deepEqual(await readFile(path.join(workspace, '.git/index')), index);
    await git(workspace, ['add', '-f', prefix + '.gitattributes']);
    const captured = await captureWorkspaceVersion({ workspace, baseRevision });
    assert.deepEqual(captured.entries.find(entry => entry.path === prefix + '.gitattributes').bytes, Buffer.from('*.txt text eol=lf\n'));
    assert.deepEqual(captured.entries.find(entry => entry.path === prefix + 'new.txt').bytes, Buffer.from('LF text\n'));
  });
}

test('local filter programs, info attributes and includes remain blocked before execution', async () => {
  const { workspace, baseRevision } = await createFixture();
  const marker = path.join(workspace, 'filter-executed.txt');
  await writeFile(path.join(workspace, '.gitattributes'), '*.txt filter=danger\n');
  await git(workspace, ['config', 'filter.danger.clean', 'echo ran > filter-executed.txt']);
  await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /local content conversion\/filter\/include unsupported/);
  await assert.rejects(readFile(marker), /ENOENT/);
  await git(workspace, ['config', '--remove-section', 'filter.danger']);
  await writeFile(path.join(workspace, '.git/info/attributes'), '*.txt text\n');
  await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /info attributes unsupported/);
  await rm(path.join(workspace, '.git/info/attributes'));
  await git(workspace, ['config', 'include.path', 'absent-config']);
  await assert.rejects(captureWorkspaceVersion({ workspace, baseRevision }), /local content conversion\/filter\/include unsupported/);
});
