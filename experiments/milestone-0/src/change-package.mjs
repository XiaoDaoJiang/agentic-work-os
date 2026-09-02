import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateVerificationInvocation } from './verification-invocation.mjs';

const FORMAT = 'change-package-v0';
const SAFE_ARTIFACT_ID = /^[A-Za-z0-9._-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SUPPORTED_MODES = new Set(['100644', '100755']);

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function compareUtf8Path(a, b) {
  return Buffer.from(a).compare(Buffer.from(b));
}

function assertGitPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0') || value.includes('\\')) {
    throw new Error('package path must be a non-empty POSIX Git path');
  }
  if (path.posix.isAbsolute(value) || value === '..' || value.startsWith('../') || value.includes('/../')) {
    throw new Error(`unsafe package path: ${value}`);
  }
  return value;
}

function assertObjectId(value, objectFormat, label) {
  const length = objectFormat === 'sha1' ? 40 : objectFormat === 'sha256' ? 64 : 0;
  if (!length) throw new Error(`unsupported Git object format ${objectFormat}`);
  const pattern = new RegExp(`^[0-9a-f]{${length}}$`);
  if (!pattern.test(value)) throw new Error(`${label} must be a ${length}-character lowercase Git object id`);
}

function validateEvidenceRef(ref, label) {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) throw new Error(`evidence.${label} is required`);
  if (typeof ref.artifact_id !== 'string' || !SAFE_ARTIFACT_ID.test(ref.artifact_id)) throw new Error(`evidence.${label}.artifact_id is invalid`);
  if (typeof ref.sha256 !== 'string' || !SHA256.test(ref.sha256)) throw new Error(`evidence.${label}.sha256 is invalid`);
  return { artifact_id: ref.artifact_id, sha256: ref.sha256 };
}

function normalizeInputEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('change entry must be an object');
  const filePath = assertGitPath(entry.path);
  if (entry.op === 'delete') return { op: 'delete', path: filePath };
  if (entry.op !== 'upsert') throw new Error(`unsupported change operation ${entry.op}`);
  if (!SUPPORTED_MODES.has(entry.mode)) throw new Error(`unsupported Git mode ${entry.mode} for ${filePath}`);
  const bytes = Buffer.isBuffer(entry.bytes) ? entry.bytes : entry.bytes instanceof Uint8Array ? Buffer.from(entry.bytes) : null;
  if (!bytes) throw new Error(`upsert bytes are required for ${filePath}`);
  const actualSha = hash(bytes);
  if (entry.size !== bytes.length || entry.sha256 !== actualSha) throw new Error(`input payload size or sha256 mismatch for ${filePath}`);
  return {
    op: 'upsert',
    path: filePath,
    mode: entry.mode,
    size: bytes.length,
    sha256: actualSha,
    content_base64: bytes.toString('base64')
  };
}

function normalizeEvidence(evidence) {
  return {
    agent_log: validateEvidenceRef(evidence?.agent_log, 'agent_log'),
    diff: validateEvidenceRef(evidence?.diff, 'diff'),
    verification_result: validateEvidenceRef(evidence?.verification_result, 'verification_result')
  };
}

export function buildChangePackage({ baseRevision, objectFormat, resultTreeHash, changes, evidence, verificationInvocation }) {
  if (!Array.isArray(changes)) throw new Error('changes must be an array');
  assertObjectId(baseRevision, objectFormat, 'baseRevision');
  assertObjectId(resultTreeHash, objectFormat, 'resultTreeHash');
  validateVerificationInvocation(verificationInvocation);
  const entries = changes.map(normalizeInputEntry).sort((a, b) => compareUtf8Path(a.path, b.path));
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i - 1].path === entries[i].path) throw new Error(`duplicate package path: ${entries[i].path}`);
  }
  const manifest = {
    format: FORMAT,
    base_revision: baseRevision,
    git_object_format: objectFormat,
    result_tree_hash: resultTreeHash,
    evidence: normalizeEvidence(evidence),
    verification_invocation: JSON.parse(JSON.stringify(verificationInvocation)),
    entries
  };
  const bytes = Buffer.from(`${JSON.stringify(manifest)}\n`, 'utf8');
  return { bytes, sha256: hash(bytes), manifest };
}

function parseJson(bytes) {
  try {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const text = buffer.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(buffer)) throw new Error('invalid UTF-8');
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`change package must be valid UTF-8 JSON: ${error.message}`);
  }
}

function validateManifestEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('package entry must be an object');
  assertGitPath(entry.path);
  if (entry.op === 'delete') {
    if (Object.keys(entry).some((key) => !['op', 'path'].includes(key))) throw new Error(`delete entry contains unexpected payload fields for ${entry.path}`);
    return;
  }
  if (entry.op !== 'upsert') throw new Error(`unsupported package operation ${entry.op}`);
  if (!SUPPORTED_MODES.has(entry.mode)) throw new Error(`unsupported Git mode ${entry.mode} for ${entry.path}`);
  if (!Number.isInteger(entry.size) || entry.size < 0 || !SHA256.test(entry.sha256 ?? '')) throw new Error(`invalid payload metadata for ${entry.path}`);
  if (typeof entry.content_base64 !== 'string') throw new Error(`content_base64 is required for ${entry.path}`);
  const decoded = Buffer.from(entry.content_base64, 'base64');
  if (decoded.toString('base64') !== entry.content_base64 || decoded.length !== entry.size || hash(decoded) !== entry.sha256) {
    throw new Error(`payload size or sha256 mismatch for ${entry.path}`);
  }
}

export function validateChangePackageBytes(bytes) {
  const manifest = parseJson(bytes);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('change package root must be an object');
  if (manifest.format !== FORMAT) throw new Error(`unsupported change package format ${manifest.format}`);
  if (!['sha1', 'sha256'].includes(manifest.git_object_format)) throw new Error('git_object_format must be sha1 or sha256');
  assertObjectId(manifest.base_revision, manifest.git_object_format, 'base_revision');
  assertObjectId(manifest.result_tree_hash, manifest.git_object_format, 'result_tree_hash');
  normalizeEvidence(manifest.evidence);
  validateVerificationInvocation(manifest.verification_invocation);
  if (!Array.isArray(manifest.entries)) throw new Error('entries must be an array');
  let prior = null;
  const seen = new Set();
  for (const entry of manifest.entries) {
    validateManifestEntry(entry);
    if (seen.has(entry.path)) throw new Error(`duplicate package path: ${entry.path}`);
    seen.add(entry.path);
    if (prior !== null && compareUtf8Path(prior, entry.path) > 0) throw new Error('package entries must be sorted by UTF-8 path bytes');
    prior = entry.path;
  }
  return manifest;
}

export function changePackageSha256(bytes) {
  return hash(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
}
