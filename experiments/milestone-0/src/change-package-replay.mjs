import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { validateChangePackageBytes, changePackageSha256 } from './change-package.mjs';
import { computeResultTreeHash } from './git-result-tree.mjs';

const execFileAsync = promisify(execFile);

async function git(checkout, args, gitExecutable = 'git') {
  const { stdout = '' } = await execFileAsync(gitExecutable, args, {
    cwd: path.resolve(checkout),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024
  });
  return stdout.trim();
}

function resolveSafeTarget(checkout, gitPath) {
  const root = path.resolve(checkout);
  const target = path.resolve(root, ...gitPath.split('/'));
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`package path escapes checkout: ${gitPath}`);
  }
  return target;
}

function preflightOperations(manifest, checkout) {
  return manifest.entries.map((entry) => {
    const target = resolveSafeTarget(checkout, entry.path);
    if (entry.op === 'delete') return { op: 'delete', path: entry.path, target };
    return {
      op: 'upsert',
      path: entry.path,
      target,
      mode: entry.mode,
      bytes: Buffer.from(entry.content_base64, 'base64')
    };
  });
}

export async function replayChangePackage({ bytes, checkout, gitExecutable = 'git' }) {
  if (!checkout) throw new Error('checkout is required');
  const manifest = validateChangePackageBytes(bytes);
  const operations = preflightOperations(manifest, checkout);
  const resolvedCheckout = path.resolve(checkout);

  const head = await git(resolvedCheckout, ['rev-parse', 'HEAD'], gitExecutable);
  if (head !== manifest.base_revision) {
    throw new Error(`base revision mismatch: expected ${manifest.base_revision}, got ${head}`);
  }
  const objectFormat = await git(resolvedCheckout, ['rev-parse', '--show-object-format'], gitExecutable);
  if (objectFormat !== manifest.git_object_format) {
    throw new Error(`Git object format mismatch: expected ${manifest.git_object_format}, got ${objectFormat}`);
  }
  const dirty = await git(resolvedCheckout, ['status', '--porcelain=v1', '--untracked-files=all'], gitExecutable);
  if (dirty.length > 0) throw new Error('replay checkout must be clean before applying package');

  for (const operation of operations) {
    if (operation.op === 'delete') {
      await rm(operation.target, { force: true });
      continue;
    }
    await mkdir(path.dirname(operation.target), { recursive: true });
    await writeFile(operation.target, operation.bytes);
    await chmod(operation.target, operation.mode === '100755' ? 0o755 : 0o644);
  }

  const replayTree = await computeResultTreeHash({
    workspace: resolvedCheckout,
    baseRevision: manifest.base_revision,
    gitExecutable
  });
  if (replayTree.objectFormat !== manifest.git_object_format) throw new Error('replay object format changed unexpectedly');
  if (replayTree.resultTreeHash !== manifest.result_tree_hash) {
    throw new Error(`replay tree mismatch: expected ${manifest.result_tree_hash}, got ${replayTree.resultTreeHash}`);
  }
  return {
    checkout: resolvedCheckout,
    packageSha256: changePackageSha256(bytes),
    baseRevision: manifest.base_revision,
    expectedResultTreeHash: manifest.result_tree_hash,
    resultTreeHash: replayTree.resultTreeHash,
    appliedEntries: operations.length
  };
}
