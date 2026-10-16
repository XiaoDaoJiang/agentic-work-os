import { spawn, execFileSync, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { ensureRepositoryMarker } from '../../../experiments/milestone-0/src/repository-marker.mjs';
import { ApiError, type Run, type RealSnapshot } from './contracts.js';
import { Store } from './store.js';
import { codexInvocation } from './codex-adapter.js';
import type { ExecutionProfile } from './execution-profile.js';
export function gitEnvironment() {
    return { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: 'NUL', GIT_TERMINAL_PROMPT: '0' };
}
function git(cwd: string, args: string[]) {
    return execFileSync('git', ['-c', 'core.hooksPath=NUL', '-c', 'core.fsmonitor=false', '-C', cwd, ...args], { encoding: 'utf8', env: gitEnvironment(), windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 }).trim();
}
export function assertBaseline(source: string, base?: string) {
    const canonical = realpathSync(source);
    if (realpathSync(git(canonical, ['rev-parse', '--show-toplevel'])) !== canonical)
        throw new ApiError(400, 'REPOSITORY_ROOT_REQUIRED', '请使用 Git 仓库根目录');
    const head = git(canonical, ['rev-parse', 'HEAD']);
    if ((base && head !== base) || git(canonical, ['status', '--porcelain', '--untracked-files=all']))
        throw new ApiError(409, 'WORKSPACE_DRIFT', '仓库基线或工作副本发生漂移；请先处理本地修改');
    if (git(canonical, ['ls-files', '--stage']).split('\n').some(line => line.startsWith('160000 ')))
        throw new ApiError(400, 'SUBMODULE_UNSUPPORTED', '当前 profile 不支持包含 submodule 的仓库');
    return { canonical, head };
}
export function receiptMatches(run: Run): boolean {
    try {
        const x = run.input_snapshot.execution!;
        const envelope = JSON.parse(readFileSync(x.receipt_path, 'utf8'));
        if (!Array.isArray(envelope.raw_bytes) || !envelope.raw_bytes.every((byte: unknown) => typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255)) return false;
        const raw = Buffer.from(envelope.raw_bytes);
        const receipt = JSON.parse(raw.toString('utf8'));
        return envelope.schema === 'runtime-receipt-store-v0' && receipt.schema === 'runtime-receipt-v0'
            && Number.isInteger(receipt.root_pid) && receipt.root_pid > 0 && receipt.root_pid <= 0xffffffff
            && typeof receipt.process_identity === 'string' && !!receipt.process_identity.trim()
            && typeof receipt.started_at === 'string' && !!receipt.started_at.trim()
            && envelope.run_id === run.id && envelope.spawn_nonce === x.spawn_nonce
            && createHash('sha256').update(raw).digest('hex') === envelope.sha256
            && receipt.run_id === run.id && receipt.runtime_instance_id === x.runtime_id && receipt.spawn_nonce === x.spawn_nonce
            && realpathSync(receipt.workspace.canonical_path) === realpathSync(x.workspace_path)
            && receipt.workspace.repository_identity === x.repository_identity && receipt.workspace.workspace_id === run.id
            && receipt.helper_revision === x.helper_revision
            && receipt.containment.mechanism === 'job_object' && receipt.containment.boundary_id === `diagnostic:${run.id}`;
    }
    catch {
        return false;
    }
}
export class RealExecutor {
    private active?: {
        run: Run;
        child: ChildProcessWithoutNullStreams;
        done: Promise<void>;
        cancelRequested: boolean;
    };
    private preparing = false;
    private closing = false;
    private preparationDone: Promise<void> = Promise.resolve();
    constructor(private store: Store, private directory: string, private profile: ExecutionProfile, private diagnosticRoot?: string) { }
    async start(taskId: string, requestId: string) {
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))
            throw new ApiError(400, 'INVALID_INPUT', '需要 8–100 位幂等请求 ID');
        if (this.closing)
            throw new ApiError(503, 'CLOSING', '执行器正在关闭');
        const replay = this.store.replayRealRun(taskId, requestId);
        if (replay)
            return { run: replay, replay: true };
        this.store.assertResourcesAvailable();
        if (this.preparing)
            throw new ApiError(409, 'ACTIVE_RUN', '已有 Run 正在准备');
        const active = this.store.activeRun();
        if (active)
            throw new ApiError(409, 'ACTIVE_RUN', '全局已有活动 Run', undefined, active.id);
        this.preparing = true;
        let prepared!: () => void;
        this.preparationDone = new Promise(resolve => { prepared = resolve; });
        let gitConfirmed = true;
        let reserved = false;
        try {
            const task = this.store.reservePreparation(taskId, requestId);
            reserved = true;
            const canonical = realpathSync(task.repository_path);
            if (this.diagnosticRoot) {
                const within = relative(realpathSync(this.diagnosticRoot), canonical);
                if (within.startsWith('..') || isAbsolute(within))
                    throw new ApiError(403, 'FIXTURE_ONLY', '诊断仅允许本次一次性仓库');
            }
            gitConfirmed = false;
            const source = assertBaseline(canonical);
            gitConfirmed = true;
            const repository = await ensureRepositoryMarker(source.canonical, { execute: async (program: string, args: string[], options: object) => {
                gitConfirmed = false;
                const result = await promisify(execFile)(program, ['-c', 'core.fsmonitor=false', ...args], { ...options, env: gitEnvironment(), timeout: 30000 });
                gitConfirmed = true;
                return result;
            } });
            if (this.closing)
                throw new ApiError(503, 'CLOSING', '服务关闭期间不再启动执行');
            const directory = join(this.directory, randomUUID());
            mkdirSync(directory, { recursive: true });
            const execution: RealSnapshot = { profile_id: 'windows-processkit-codex-exec', model: this.profile.model, base_revision: source.head,
                repository_identity: repository.repositoryIdentity, source_path: source.canonical, workspace_path: join(directory, 'workspace'),
                receipt_path: join(directory, 'receipt.json'), runtime_id: randomUUID(), spawn_nonce: randomUUID(), timeout_ms: 180000,
                executable: this.profile.executable, codex_version: this.profile.codex_version, helper_revision: this.profile.helper_revision };
            const invocation = codexInvocation(execution.workspace_path, this.prompt(task), execution.model);
            if (Buffer.byteLength(JSON.stringify(invocation.argv)) > 50000)
                throw new ApiError(400, 'INPUT_TOO_LARGE', '当前执行输入超出原生请求大小限制');
            execution.argv = invocation.argv;
            execution.environment_names = invocation.inheritNames;
            const result = this.store.startRealRun(taskId, requestId, execution, task.revision);
            try {
                git(source.canonical, ['clone', '--no-local', '--no-hardlinks', '--', source.canonical, execution.workspace_path]);
                git(execution.workspace_path, ['checkout', '--detach', source.head]);
                git(execution.workspace_path, ['remote', 'remove', 'origin']);
                assertBaseline(source.canonical, source.head);
                assertBaseline(execution.workspace_path, source.head);
            }
            catch {
                this.store.finishRealRun(result.run.id, 'interrupted', 'preparation_resources_unknown', { resource_state: 'unknown', resource_lock: 'held', reason: 'git_preparation_failed_no_agent_spawned' }, false);
                return { run: this.store.getRun(result.run.id), replay: false };
            }
            try {
                this.launch(result.run);
            }
            catch {
                this.store.finishRealRun(result.run.id, 'interrupted', 'launch_unknown', { resource_state: 'unknown', resource_lock: 'held' }, false);
            }
            return { run: this.store.getRun(result.run.id), replay: false };
        }
        catch (error) {
            if (reserved) this.store.failPreparation(requestId, gitConfirmed || error instanceof ApiError);
            if (error instanceof ApiError) throw error;
            throw new ApiError(gitConfirmed ? 400 : 409, gitConfirmed ? 'REPOSITORY_UNAVAILABLE' : 'RESOURCE_HELD', gitConfirmed ? '无法准备 Git 仓库，请检查本地根目录与访问权限' : 'Git 准备过程异常，资源锁保持；请保留本地证据并检查受控进程');
        }
        finally {
            this.preparing = false;
            prepared();
        }
    }
    private prompt(task: Run['input_snapshot']['task']) {
        return `Work only in this trusted-local disposable working copy. Do not push, access production credentials, or modify the source repository. Complete the goal below. Verification is not enabled; do not run the verification draft.\nGoal:\n${task.goal}\nDefinition of done:\n${task.definition_of_done.join('\n')}`;
    }
    private launch(run: Run) {
        const x = run.input_snapshot.execution!;
        const prompt = this.prompt(run.input_snapshot.task);
        const invocation = codexInvocation(x.workspace_path, prompt, x.model);
        const requestPath = join(x.workspace_path, '..', 'request.json');
        writeFileSync(requestPath, JSON.stringify({ start: { kind: 'start', protocol: 'local-runner-jsonl-v0', request_id: `start-${run.id}`, run_id: run.id, program: this.profile.executable, argv: invocation.argv, cwd: invocation.cwd, env: { inheritance_policy: 'allowlist', inherit_names: invocation.inheritNames, overrides: {}, unset: [] }, timeout_ms: x.timeout_ms }, runtime_id: x.runtime_id, spawn_nonce: x.spawn_nonce, repository_identity: x.repository_identity, base_revision: x.base_revision, helper_revision: x.helper_revision, receipt_path: x.receipt_path }), { flag: 'wx' });
        const child = spawn(this.profile.helper, [requestPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        let terminal: Record<string, unknown> | undefined;
        let pending = '';
        let invalid = false;
        let started = false;
        try {
            this.store.recordResourceFacts(run.id, { resource_state: 'unknown', resource_lock: 'held', helper_pid: child.pid ?? null, receipt_path: x.receipt_path });
        }
        catch {
            invalid = true;
            child.stdin.end();
        }
        const protocolDecoder = new StringDecoder('utf8');
        const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
        const save = (message: string) => { try {
            this.store.appendProgress(run.id, 'agent', message);
        }
        catch {
            invalid = true;
            child.stdin.end();
        } };
        const watchdog = setTimeout(() => { invalid = true; child.kill(); }, x.timeout_ms + 20000);
        const done = new Promise<void>(resolve => {
            child.stdin.on('error', () => { invalid = true; });
            child.on('error', () => { invalid = true; });
            child.stderr.on('data', () => { invalid = true; });
            child.stdout.on('data', (chunk: Buffer) => {
                pending += protocolDecoder.write(chunk);
                if (pending.length > 1024 * 1024) {
                    invalid = true;
                    child.stdin.end();
                    return;
                }
                for (;;) {
                    const newline = pending.indexOf('\n');
                    if (newline < 0)
                        break;
                    const line = pending.slice(0, newline);
                    pending = pending.slice(newline + 1);
                    try {
                        const event = JSON.parse(line);
                        if (terminal) invalid = true;
                        if (event.kind === 'started') {
                            if (started || !receiptMatches(run))
                                invalid = true;
                            started = true;
                            save('Codex 已启动；原生进程边界已登记。');
                        }
                        else if (event.kind === 'output' && ['stdout', 'stderr'].includes(event.stream) && Array.isArray(event.bytes)) {
                            const stream = event.stream as 'stdout' | 'stderr';
                            const text = decoders[stream].write(Buffer.from(event.bytes));
                            if (text)
                                save(`${stream} ${text}`);
                        }
                        else if (event.kind === 'terminal') {
                            if (terminal)
                                invalid = true;
                            terminal = event;
                        }
                        else
                            invalid = true;
                    }
                    catch {
                        invalid = true;
                        child.stdin.end();
                    }
                }
            });
            child.on('close', (code) => {
                clearTimeout(watchdog);
                try {
                    for (const stream of ['stdout', 'stderr'] as const) {
                        const tail = decoders[stream].end();
                        if (tail)
                            save(`${stream} ${tail}`);
                    }
                    let safe = code === 0 && !invalid && !pending.trim() && started && receiptMatches(run) && terminal?.resource_state === 'safe' && terminal.resource_lock === 'releasable' && terminal.stdout_drained === true && terminal.stderr_drained === true;
                    let drift = false;
                    try {
                        assertBaseline(x.source_path, x.base_revision);
                        drift = git(x.workspace_path, ['rev-parse', 'HEAD']) !== x.base_revision;
                    }
                    catch (error) {
                        drift = true;
                        if (!(error instanceof ApiError)) safe = false;
                    }
                    const state = !safe ? 'interrupted' : terminal?.trigger === 'cancel' ? 'cancelled' : terminal?.trigger === 'timeout' ? 'failed' : terminal?.exit_code === 0 && !drift ? 'succeeded' : 'failed';
                    this.store.finishRealRun(run.id, state, !safe ? 'resource_unknown' : drift ? 'workspace_drift' : terminal?.trigger === 'timeout' ? 'agent_timeout' : terminal?.trigger === 'cancel' ? 'agent_cancelled' : terminal?.exit_code === 0 ? 'agent_exited_unverified' : 'agent_nonzero', { ...terminal, helper_exit_code: code, receipt_matches: receiptMatches(run), drift, resource_state: safe ? 'safe' : 'unknown', resource_lock: safe ? 'releasable' : 'held' }, safe);
                }
                catch {
                    console.error('Real execution persistence failed; durable resource lock retained.');
                }
                this.active = undefined;
                resolve();
            });
        });
        this.active = { run, child, done, cancelRequested: false };
    }
    cancel(id: string): Run {
        const run = this.store.getRun(id);
        if (run.state !== 'running')
            return run;
        const active = this.active;
        if (!active || active.run.id !== id)
            throw new ApiError(409, 'RESOURCE_HELD', '执行所有者状态未知；资源锁保持');
        if (!active.cancelRequested) {
            active.cancelRequested = true;
            active.child.stdin.write('cancel\n');
        }
        return this.store.getRun(id);
    }
    async close() { this.closing = true; await this.preparationDone; const active = this.active; if (active) {
        this.cancel(active.run.id);
        await active.done;
    } }
}
