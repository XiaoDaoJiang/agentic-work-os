import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { assertPathWithinRoot } from './paths.mjs';

export async function createDisposableFixture({ parent, experimentRunId }) {
  if (!/^[A-Za-z0-9._-]+$/.test(experimentRunId)) throw new Error('experimentRunId must be path-safe');
  const parentRoot = path.resolve(parent);
  await mkdir(parentRoot, { recursive: true });
  const root = assertPathWithinRoot(parentRoot, path.join(parentRoot, experimentRunId));
  const result = {
    root,
    asciiWorkspace: path.join(root, 'workspace-ascii'),
    spacedWorkspace: path.join(root, 'workspace with spaces'),
    chineseWorkspace: path.join(root, '工作区-中文'),
    artifactStore: path.join(root, 'artifact-store'),
    stateDir: path.join(root, 'state')
  };
  await Promise.all(Object.values(result).slice(1).map((dir) => mkdir(assertPathWithinRoot(root, dir), { recursive: true })));
  return result;
}
