import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const SUPPORTED_MODES = new Set(['100644', '100755']);

async function git(workspace, args, { gitExecutable = 'git', env = process.env, encoding = 'utf8' } = {}) {
  const { stdout } = await execFileAsync(gitExecutable, args, {
    cwd: path.resolve(workspace),
    env,
    encoding,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
  return stdout;
}

function parseNameStatusZ(buffer) {
  const tokens = Buffer.from(buffer).toString('utf8').split('\0').filter((token) => token.length > 0);
  if (tokens.length % 2 !== 0) throw new Error('unexpected git name-status -z output');
  const result = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const status = tokens[i];
    const filePath = tokens[i + 1];
    if (!['A', 'M', 'D', 'T'].includes(status)) throw new Error(`unsupported Git change status ${status}`);
    result.push({ status, path: filePath });
  }
  return result;
}

function assertRelativeGitPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) throw new Error('invalid Git path');
  if (path.posix.isAbsolute(filePath) || filePath === '..' || filePath.startsWith('../')) throw new Error(`unsafe Git path ${filePath}`);
  return filePath;
}

async function withTempIndex(workspace, baseRevision, gitExecutable, operation) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'm0-git-index-'));
  const indexPath = path.join(tempRoot, 'index');
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  try {
    await git(workspace, ['read-tree', baseRevision], { gitExecutable, env });
    await git(workspace, ['add', '-A', '--', '.'], { gitExecutable, env });
    return await operation(env);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function indexMode(workspace, filePath, gitExecutable, env) {
  const output = await git(workspace, ['ls-files', '-s', '-z', '--', filePath], { gitExecutable, env, encoding: null });
  const record = Buffer.from(output).toString('utf8').split('\0').filter(Boolean);
  if (record.length !== 1) throw new Error(`expected one index entry for ${filePath}`);
  const tab = record[0].indexOf('\t');
  if (tab < 0) throw new Error(`malformed index entry for ${filePath}`);
  const metadata = record[0].slice(0, tab).split(' ');
  const mode = metadata[0];
  if (!SUPPORTED_MODES.has(mode)) throw new Error(`unsupported Git mode ${mode} for ${filePath}`);
  return mode;
}

export async function computeResultTreeHash({ workspace, baseRevision, gitExecutable = 'git' }) {
  if (!workspace || !baseRevision) throw new Error('workspace and baseRevision are required');
  return withTempIndex(workspace, baseRevision, gitExecutable, async (env) => {
    const objectFormat = String(await git(workspace, ['rev-parse', '--show-object-format'], { gitExecutable })).trim();
    if (!['sha1', 'sha256'].includes(objectFormat)) throw new Error(`unsupported Git object format ${objectFormat}`);
    const resultTreeHash = String(await git(workspace, ['write-tree'], { gitExecutable, env })).trim();
    if (!/^[0-9a-f]{40}$/.test(resultTreeHash) && !/^[0-9a-f]{64}$/.test(resultTreeHash)) {
      throw new Error('invalid result tree hash');
    }
    return { objectFormat, resultTreeHash };
  });
}

export async function collectWorkspaceChanges({ workspace, baseRevision, gitExecutable = 'git' }) {
  if (!workspace || !baseRevision) throw new Error('workspace and baseRevision are required');
  const resolvedWorkspace = path.resolve(workspace);
  return withTempIndex(resolvedWorkspace, baseRevision, gitExecutable, async (env) => {
    const raw = await git(resolvedWorkspace, ['diff', '--cached', '--name-status', '-z', '--no-renames', baseRevision, '--'], {
      gitExecutable,
      env,
      encoding: null
    });
    const changed = parseNameStatusZ(raw);
    const entries = [];
    for (const item of changed) {
      const gitPath = assertRelativeGitPath(item.path);
      if (item.status === 'D') {
        entries.push({ op: 'delete', path: gitPath });
        continue;
      }
      const mode = await indexMode(resolvedWorkspace, gitPath, gitExecutable, env);
      const bytes = await readFile(path.join(resolvedWorkspace, ...gitPath.split('/')));
      entries.push({
        op: 'upsert',
        path: gitPath,
        mode,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes
      });
    }
    entries.sort((a, b) => Buffer.from(a.path).compare(Buffer.from(b.path)));
    return entries;
  });
}
