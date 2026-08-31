import os from 'node:os';
import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { sha256File } from './hash.mjs';
import { toManifestRelativePath } from './paths.mjs';

export function createManifest({ experimentRunId, planSha256, harnessRevision, planPath = null, createdAt = new Date() }) {
  if (!experimentRunId) throw new Error('experimentRunId is required');
  if (!/^[0-9a-f]{64}$/.test(planSha256)) throw new Error('planSha256 must be a lowercase SHA-256 hex digest');
  if (!harnessRevision) throw new Error('harnessRevision is required');
  return {
    manifest_version: 'm0-evidence-manifest-v0',
    experiment_run_id: experimentRunId,
    plan_path: planPath,
    plan_sha256: planSha256,
    harness_revision: harnessRevision,
    created_at: createdAt.toISOString(),
    environment: {
      platform: process.platform,
      os_release: os.release(),
      architecture: process.arch,
      node_version: process.version
    },
    evidence_files: [],
    reruns: [],
    manual_interventions: [],
    redaction_notes: [],
    evidence_loss_notes: []
  };
}

export async function writeManifest(manifestPath, manifest) {
  await mkdir(path.dirname(path.resolve(manifestPath)), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export async function indexEvidenceFile(manifestPath, evidenceFile) {
  const resolvedManifestPath = path.resolve(manifestPath);
  const runRoot = path.dirname(resolvedManifestPath);
  const relativePath = toManifestRelativePath(runRoot, evidenceFile);
  if (relativePath === 'manifest.json') throw new Error('manifest.json cannot index itself');
  const fileStat = await stat(evidenceFile);
  if (!fileStat.isFile()) throw new Error('Evidence path must be a file');
  const manifest = JSON.parse(await readFile(resolvedManifestPath, 'utf8'));
  const record = { path: relativePath, size: fileStat.size, sha256: await sha256File(evidenceFile) };
  manifest.evidence_files = manifest.evidence_files.filter((item) => item.path !== relativePath);
  manifest.evidence_files.push(record);
  manifest.evidence_files.sort((a, b) => a.path.localeCompare(b.path));
  await writeManifest(resolvedManifestPath, manifest);
  return record;
}
