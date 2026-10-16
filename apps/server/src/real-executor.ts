import { spawn, execFileSync, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { ensureRepositoryMarker } from '../../../experiments/milestone-0/src/repository-marker.mjs';
import { ApiError, type Run, type RealSnapshot, type ExecutionStage, type VerificationSelection, type VerificationResult, type CapturedVersion } from './contracts.js';
import { Store } from './store.js';
import { codexInvocation } from './codex-adapter.js';
import { sourceRoot, sha256File, type ExecutionProfile } from './execution-profile.js';
import { freezeVerification, verificationArgv, verificationEnvironment } from './verification.js';
type BoundaryResult = { safe: true; terminal: Record<string, unknown> } | {safe: false; terminal: Record<string, unknown>};
type StageCommand = {stage: ExecutionStage; program: string; argv: string[]; timeout: number; names: string[]};
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
export function receiptMatches(run: Run, snapshot?: RealSnapshot): boolean {
    try {
        const x = snapshot ?? run.input_snapshot.execution!;
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
        child?: ChildProcessWithoutNullStreams;
        done: Promise<void>;
        cancelRequested: boolean;
    };
    private preparing = false;
    private closing = false;
    private preparationDone: Promise<void> = Promise.resolve();
    constructor(private store: Store, private directory: string, private profile: ExecutionProfile, private diagnosticRoot?: string) { }
    async start(taskId: string, requestId: string, selection: VerificationSelection = {verify:false}) {
        if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))
            throw new ApiError(400, 'INVALID_INPUT', '需要 8–100 位幂等请求 ID');
        if (this.closing)
            throw new ApiError(503, 'CLOSING', '执行器正在关闭');
        const replay = this.store.replayRealRun(taskId, requestId, selection);
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
            if (selection.verify && task.revision !== selection.expected_task_revision) throw new ApiError(409, "TASK_CHANGED", "所见 Task 版本已变化，请重新查看验证命令后启动");
            const verification = selection.verify ? freezeVerification(task) : undefined;
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
            const result = this.store.startRealRun(taskId, requestId, execution, task.revision, selection, verification);
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
        return `Work only in this trusted-local disposable working copy. Do not push, access production credentials, or modify the source repository. Complete the goal below. Verification is coordinator-owned; do not run the verification draft.\nGoal:\n${task.goal}\nDefinition of done:\n${task.definition_of_done.join('\n')}`;
    }
    private launch(run: Run) {
        const active = {run,child:undefined as ChildProcessWithoutNullStreams|undefined,done:Promise.resolve(),cancelRequested:false};
        this.active=active;
        active.done=this.execute(run).catch(()=>{
            try {this.store.finishRealRun(run.id,'interrupted','coordinator_error',{resource_state:'unknown',resource_lock:'held'},false,
                run.input_snapshot.verification ? {outcome:'interrupted',exit_code:null,version_match:'unknown',reason:'coordinator_error'} : undefined);}
            catch {console.error('Execution evidence could not be persisted; durable resource lock retained.');}
        }).finally(()=>{this.active=undefined;});
    }
    private async execute(run: Run) {
        const x=run.input_snapshot.execution!;
        const agent=codexInvocation(x.workspace_path,this.prompt(run.input_snapshot.task),x.model);
        let last=await this.executeBoundary(run,{stage:'agent',program:this.profile.executable,argv:agent.argv,timeout:x.timeout_ms,names:agent.inheritNames});
        if(!run.input_snapshot.verification) {
            let safe=last.safe, drift=false;
            try {assertBaseline(x.source_path,x.base_revision); drift=git(x.workspace_path,['rev-parse','HEAD'])!==x.base_revision;}
            catch(error){drift=true;if(!(error instanceof ApiError))safe=false;}
            const terminal=last.terminal;
            const state=!safe?'interrupted':this.active?.cancelRequested||terminal.trigger==='cancel'?'cancelled':terminal.trigger==='timeout'?'failed':terminal.exit_code===0&&!drift?'succeeded':'failed';
            this.store.finishRealRun(run.id,state,!safe?'resource_unknown':drift?'workspace_drift':terminal.trigger==='timeout'?'agent_timeout':state==='cancelled'?'agent_cancelled':terminal.exit_code===0?'agent_exited_unverified':'agent_nonzero',{...terminal,drift,resource_state:safe?'safe':'unknown',resource_lock:safe?'releasable':'held'},safe);
            return;
        }
        let result:VerificationResult={outcome:'error',exit_code:null,version_match:'unknown',reason:'agent_not_successful'};
        let before:CapturedVersion|undefined;
        let after:CapturedVersion|undefined;
        const cancelled=()=>this.active?.cancelRequested || last.terminal.trigger==='cancel';
        if(last.safe && !cancelled() && last.terminal.trigger!=='timeout' && last.terminal.exit_code===0) {
            const first=await this.capture(run,'before');last=first.boundary;before=first.version;
            if(before) this.store.recordCapture(run.id,'before',before);
            if(before && last.safe && !cancelled()) {
                const frozen=run.input_snapshot.verification;
                const invocation=frozen.verification_invocation_v0;
                if(sha256File(invocation.execution.shell_path)!==frozen.shell_sha256) throw new Error('verification shell changed');
                last=await this.executeBoundary(run,{stage:'verification',program:invocation.execution.shell_path,argv:verificationArgv(frozen),timeout:invocation.timeout_ms,names:invocation.env.inherit_names});
                result={outcome:!last.safe?'interrupted':cancelled()?'cancelled':last.terminal.trigger==='timeout'?'timeout':last.terminal.exit_code===0?'passed':'failed',exit_code:typeof last.terminal.exit_code==='number'?last.terminal.exit_code:null,version_match:'unknown',reason:'verification_command_exit'};
                if(last.safe && !cancelled()) {
                    const final=await this.capture(run,'after');last=final.boundary;after=final.version;
                    if(after) {this.store.recordCapture(run.id,'after',after);result.version_match=before.resultTreeHash===after.resultTreeHash&&before.manifestSha256===after.manifestSha256?'match':'changed';}
                    else {result.outcome=last.safe?'error':'interrupted';result.reason='final_capture_error';}
                }
            } else {result.reason='initial_capture_error';}
        }
        if(!last.safe) {result.outcome='interrupted';result.reason='resource_unknown';}
        else if(cancelled()) {result.outcome='cancelled';result.reason='cancelled_no_further_stage';}
        const state=result.outcome==='interrupted'?'interrupted':result.outcome==='cancelled'?'cancelled':result.outcome==='passed'&&result.version_match==='match'?'succeeded':'failed';
        this.store.finishRealRun(run.id,state,result.reason,{...last.terminal,resource_state:last.safe?'safe':'unknown',resource_lock:last.safe?'releasable':'held'},last.safe,result);
    }
    private async capture(run:Run, point:'before'|'after'):Promise<{boundary:BoundaryResult;version?:CapturedVersion}> {
        const x=run.input_snapshot.execution!;
        const output=join(x.workspace_path,'..',`capture-${point}.json`);
        const boundary=await this.executeBoundary(run,{stage:`capture-${point}`,program:process.execPath,argv:[join(sourceRoot,'tools/capture-version.mjs'),x.workspace_path,x.base_revision,x.source_path,output],timeout:60000,names:verificationEnvironment});
        if(!boundary.safe || boundary.terminal.exit_code!==0 || boundary.terminal.trigger==='cancel'||boundary.terminal.trigger==='timeout')return {boundary};
        try {
            if(statSync(output).size>8*1024*1024)throw new Error('capture too large');
            const version=JSON.parse(readFileSync(output,'utf8')) as CapturedVersion;
            if(version.baseRevision!==x.base_revision||!['sha1','sha256'].includes(version.objectFormat)||!new RegExp(version.objectFormat==='sha1'?'^[a-f0-9]{40}$':'^[a-f0-9]{64}$').test(version.resultTreeHash)||!Array.isArray(version.entries)||typeof version.diff!=='string'||createHash('sha256').update(JSON.stringify(version.entries)).digest('hex')!==version.manifestSha256)throw new Error('capture invalid');
            return {boundary,version};
        } catch {return {boundary};}
    }
    private executeBoundary(run: Run, command:StageCommand):Promise<BoundaryResult> {
        if(this.active?.cancelRequested) return Promise.resolve({safe:true,terminal:{trigger:'cancel',exit_code:null,resource_state:'safe',resource_lock:'releasable'}});
        const original=run.input_snapshot.execution!;
        const x=command.stage==='agent'?original:{...original,receipt_path:join(original.workspace_path,'..',`${command.stage}.receipt.json`),runtime_id:randomUUID(),spawn_nonce:randomUUID(),timeout_ms:command.timeout};
        const requestPath=join(x.workspace_path,'..',`${command.stage}.request.json`);
        writeFileSync(requestPath,JSON.stringify({start:{kind:'start',protocol:'local-runner-jsonl-v0',request_id:`${command.stage}-${run.id}`,run_id:run.id,program:command.program,argv:command.argv,cwd:x.workspace_path,env:{inheritance_policy:'allowlist',inherit_names:command.names,overrides:{},unset:[]},timeout_ms:command.timeout},runtime_id:x.runtime_id,spawn_nonce:x.spawn_nonce,repository_identity:x.repository_identity,base_revision:x.base_revision,helper_revision:x.helper_revision,receipt_path:x.receipt_path}),{flag:'wx'});
        const child = spawn(this.profile.helper, [requestPath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
        let terminal: Record<string, unknown> | undefined;
        let pending = '';
        let invalid = false;
        let started = false;
        let outputBytes=0;
        let outputLimit=false;
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
            this.store.appendProgress(run.id, command.stage === 'agent' ? 'agent' : 'test', message);
        }
        catch {
            invalid = true;
            child.stdin.end();
        } };
        const watchdog = setTimeout(() => { invalid = true; child.kill(); }, x.timeout_ms + 20000);
        const done = new Promise<BoundaryResult>(resolve => {
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
                            if (started || !receiptMatches(run,x))
                                invalid = true;
                            started = true;
                            save(`${command.stage} 已启动；原生进程边界已登记。`);
                        }
                        else if (event.kind === 'output' && ['stdout', 'stderr'].includes(event.stream) && Array.isArray(event.bytes)) {
                            if(!started) throw new Error('output before started');
                            outputBytes+=event.bytes.length;
                            if(outputBytes>8*1024*1024){outputLimit=true;throw new Error('output size limit exceeded');}
                            const stream = event.stream as 'stdout' | 'stderr';
                            if (!event.bytes.every((byte:unknown)=>typeof byte==='number'&&Number.isInteger(byte)&&byte>=0&&byte<=255)) throw new Error('invalid bytes');
                            const text = decoders[stream].write(Buffer.from(event.bytes));
                            if (text) this.store.appendOutput(run.id,command.stage,stream,text);
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
                        if (tail) {this.store.appendOutput(run.id,command.stage,stream,tail);save(`${stream} ${tail}`);}
                    }
                    pending+=protocolDecoder.end();
                    const safe = code === 0 && !invalid && !pending.trim() && started && receiptMatches(run,x) && terminal?.resource_state === 'safe' && terminal.resource_lock === 'releasable' && terminal.stdout_drained === true && terminal.stderr_drained === true;
                    const facts={...terminal,protocol_invalid:invalid,output_limit_exceeded:outputLimit,helper_exit_code:code,receipt_matches:receiptMatches(run,x),receipt_path:x.receipt_path,runtime_id:x.runtime_id,spawn_nonce:x.spawn_nonce,resource_state:safe?'safe':'unknown',resource_lock:safe?'releasable':'held'};
                    this.store.recordStage(run.id,command.stage,facts);
                    if(this.active)this.active.child=undefined;
                    resolve({safe,terminal:facts});
                } catch {resolve({safe:false,terminal:{resource_state:'unknown',resource_lock:'held'}});}
            });
        });
        if(this.active)this.active.child=child;
        return done;
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
            active.child?.stdin.write('cancel\n');
        }
        return this.store.getRun(id);
    }
    async close() { this.closing = true; await this.preparationDone; const active = this.active; if (active) {
        this.cancel(active.run.id);
        await active.done;
    } }
}
