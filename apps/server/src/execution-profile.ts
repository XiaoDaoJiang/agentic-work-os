import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { release } from 'node:os';
export const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const g1Cases = ['normal', 'nonzero', 'cancel', 'timeout', 'exit-race', 'owner-crash', 'helper-crash', 'restart-lock', 'source-drift', 'workspace-drift', 'receipt-integrity', 'idempotency', 'request-protection', 'preparation-lock', 'post-run-git-failure'];
export const executionSources = [...readdirSync(join(sourceRoot, 'apps/server/src')).filter(name => name.endsWith('.ts') && !name.endsWith('.d.ts')).sort().map(name => `apps/server/src/${name}`), 'experiments/milestone-0/src/repository-marker.mjs', 'experiments/milestone-0/native-runner/src/bin/diagnostic-runner.rs', 'tools/verify-g1.mjs', 'tools/g1-owner.mjs'];
export function sha256File(path: string) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
export function executionIdentity() {
    const files = [...executionSources, ...executionSources.filter(name => name.startsWith('apps/server/src/') && name.endsWith('.ts')).map(name => name.replace('/src/', '/dist/').replace(/\.ts$/, '.js'))];
    return Object.fromEntries(files.map(name => [name, sha256File(join(sourceRoot, name))]));
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
        if (v.schema !== 'fmvp-g1-v1' || v.activation !== 'passed' || v.profile !== 'windows-processkit-codex-exec' || v.platform !== 'win32/x64'
            || v.node !== process.version || v.os_release !== release() || v.model !== 'gpt-6.1-sol' || !/^[a-f0-9]{40}$/.test(v.code_sha)
            || g1Cases.some(name => v.cases?.[name] !== 'passed')
            || JSON.stringify(v.sources) !== JSON.stringify(executionIdentity())
            || sha256File(v.executable) !== v.executable_sha256 || sha256File(v.helper) !== v.helper_sha256)
            return null;
        return { executable: realpathSync(v.executable), helper: realpathSync(v.helper), helper_revision: v.helper_sha256, model: v.model, codex_version: v.codex_version, evidence_path: realpathSync(evidencePath), source_identity: createHash('sha256').update(JSON.stringify(v.sources)).digest('hex') };
    }
    catch {
        return null;
    }
}
