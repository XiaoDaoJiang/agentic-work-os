import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { release } from 'node:os';
import { verificationShell } from './verification.js';
import { codexProfile } from './codex-adapter.js';
export const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const g1Cases = ['normal', 'nonzero', 'cancel', 'timeout', 'exit-race', 'owner-crash', 'helper-crash', 'restart-lock', 'source-drift', 'workspace-drift', 'receipt-integrity', 'idempotency', 'request-protection', 'preparation-lock', 'post-run-git-failure', 'verification-boundary', 'capture-consistency', 'verification-pipeline'];
export const executionSources = [...readdirSync(join(sourceRoot, 'apps/server/src')).filter(name => name.endsWith('.ts') && !name.endsWith('.d.ts')).sort().map(name => `apps/server/src/${name}`), 'experiments/milestone-0/src/repository-marker.mjs', 'experiments/milestone-0/native-runner/src/bin/diagnostic-runner.rs', 'tools/verify-g1.mjs', 'tools/g1-owner.mjs', 'tools/capture-version.mjs', 'tools/verify-verification.mjs', 'experiments/milestone-0/src/git-result-tree.mjs', 'experiments/milestone-0/src/verification-invocation.mjs', 'package.json', 'apps/server/package.json', 'package-lock.json', 'tools/patch-codex-provider.mjs'];
export function sha256File(path: string) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function dependencySources() {
    const files = new Set<string>();
    const packages = new Set<string>();
    function collect(directory: string) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const file = join(directory, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') collect(file);
            else if (entry.isFile() && /\.(?:[cm]?js|json|wasm)$/.test(entry.name)) files.add(file);
        }
    }
    function visit(name: string, from: string) {
        const candidate = createRequire(from).resolve.paths(name)?.map(directory => join(directory, name, 'package.json')).find(existsSync);
        if (!candidate) throw new Error('Missing execution dependency: ' + name);
        const manifestPath = realpathSync(candidate);
        if (packages.has(manifestPath)) return;
        const local = relative(sourceRoot, manifestPath);
        if (local.startsWith('..') || isAbsolute(local)) throw new Error('Execution dependency outside application: ' + name);
        packages.add(manifestPath);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.name !== name) throw new Error('Execution dependency identity mismatch: ' + name);
        collect(dirname(manifestPath));
        for (const dependency of Object.keys(manifest.dependencies ?? {})) visit(dependency, manifestPath);
    }
    // Hash installed runtime bytes as well as the lockfile; local package edits must close G1.
    const serverManifest = join(sourceRoot, 'apps/server/package.json');
    for (const name of Object.keys(JSON.parse(readFileSync(serverManifest, 'utf8')).dependencies ?? {})) visit(name, serverManifest);
    return [...files].map(file => relative(sourceRoot, file).replaceAll('\\', '/')).sort();
}
export function executionIdentity() {
    const files = [...executionSources, ...dependencySources(), ...executionSources.filter(name => name.startsWith('apps/server/src/') && name.endsWith('.ts')).map(name => name.replace('/src/', '/dist/').replace(/\.ts$/, '.js'))];
    return Object.fromEntries(files.map(name => [name, sha256File(join(sourceRoot, name))]));
}
export const g2Cases=['gate-off','same-capture-package','verification-nonzero','verification-timeout','version-drift','workspace-deleted-replay','sealed-corruption','decision-idempotency','decision-atomicity','waiting-restart','check-owner-loss','sealed-evidence-immutable','request-protection','cancel-seal','artifact-crash-recovery','ignored-tracked-package','delivery-recovery','review-boundary-failures'];
executionSources.push(...['artifact-db','artifact-store','artifact-reconciliation','change-package','change-package-seal','change-package-replay','delivery-integrity'].map(name=>`experiments/milestone-0/src/${name}.mjs`),'tools/check-package.mjs','tools/verify-g2.mjs','tools/test-review-recovery.mjs','tools/test-review-boundaries.mjs','experiments/milestone-0/test/ignored-tracked-package.test.mjs');
export function readReviewProfile(profile:ExecutionProfile|null,g2EvidencePath?:string):string|null {
  if(!profile||!g2EvidencePath||JSON.stringify(readExecutionProfile(profile.evidence_path))!==JSON.stringify(profile))return null;
  try {
    const value=JSON.parse(readFileSync(g2EvidencePath,'utf8'));
    return value.schema==='fmvp-g2-v1'&&value.activation==='passed'&&value.source_identity===profile.source_identity
      &&value.executable_sha256===sha256File(profile.executable)&&value.helper_sha256===sha256File(profile.helper)
      &&value.node===process.version&&value.os_release===release()&&value.platform==='win32/x64'
      &&value.node_executable===realpathSync(process.execPath)&&value.node_executable_sha256===sha256File(process.execPath)
      &&value.verification_shell_sha256===sha256File(verificationShell())&&value.model===profile.model
      &&g2Cases.every(name=>value.cases?.[name]==='passed')?profile.source_identity:null;
  }catch{return null;}
}
export interface ExecutionProfile {
    executable: string;
    helper: string;
    helper_revision: string;
    model: string;
    codex_version: string;
    evidence_path: string;
    source_identity: string;
}
export function readExecutionProfile(evidencePath?: string): ExecutionProfile | null {
    if (!evidencePath || process.platform !== 'win32' || process.arch !== 'x64')
        return null;
    try {
        const v = JSON.parse(readFileSync(evidencePath, 'utf8'));
        if (v.schema !== 'fmvp-g1-v1' || v.activation !== 'passed' || v.profile !== codexProfile.id || v.platform !== 'win32/x64'
            || v.node !== process.version || v.os_release !== release() || v.model !== 'gpt-6.1-sol' || !/^[a-f0-9]{40}$/.test(v.code_sha)
            || v.node_executable !== realpathSync(process.execPath) || v.node_executable_sha256 !== sha256File(process.execPath)
            || g1Cases.some(name => v.cases?.[name] !== 'passed')
            || JSON.stringify(v.sources) !== JSON.stringify(executionIdentity())
            || v.verification_shell !== verificationShell() || sha256File(v.verification_shell) !== v.verification_shell_sha256
            || sha256File(v.executable) !== v.executable_sha256 || sha256File(v.helper) !== v.helper_sha256)
            return null;
        return { executable: realpathSync(v.executable), helper: realpathSync(v.helper), helper_revision: v.helper_sha256, model: v.model, codex_version: v.codex_version, evidence_path: realpathSync(evidencePath), source_identity: createHash('sha256').update(JSON.stringify(v.sources)).digest('hex') };
    }
    catch {
        return null;
    }
}
