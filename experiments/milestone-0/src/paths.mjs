import path from 'node:path';

export function assertPathWithinRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative === '') return resolvedCandidate;
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path is outside designated root: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

export function toManifestRelativePath(root, candidate) {
  const safe = assertPathWithinRoot(root, candidate);
  return path.relative(path.resolve(root), safe).split(path.sep).join('/');
}
