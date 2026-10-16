import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { migrate } from './migrations.js';
import { ApiError, parseTaskInput, parseStartInput, type Task, type Run, type RunLog, type Phase, type RunState, type RealSnapshot, type VerificationSelection, type FrozenVerification, type RunEvidence, type VerificationResult, type ExecutionStage, type CapturedVersion } from './contracts.js';

type Row = Record<string, SQLOutputValue>;
const now = () => new Date().toISOString();
export class Store {
  readonly db: DatabaseSync;
  private closed = false;
  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    try { this.db.exec('PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;'); migrate(this.db); }
    catch (error) { this.db.close(); this.closed = true; throw error; }
  }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }
  schemaVersion() { return Number(this.db.prepare('PRAGMA user_version').get()!.user_version); }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private task(row: Row): Task {
    const { input_json, ...metadata } = row;
    return { ...metadata, ...JSON.parse(String(input_json)) } as Task;
  }
  private run(row: Row): Run {
    const { request_id: _request, input_snapshot, ...metadata } = row;
    return { ...metadata, input_snapshot: JSON.parse(String(input_snapshot)) } as Run;
  }
  listTasks(): Task[] { return this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC,id').all().map(r => this.task(r)); }
  getTask(id: string): Task {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Task 不存在'); return this.task(row);
  }
  createTask(value: unknown): Task {
    const input = parseTaskInput(value); const id = `task_${randomUUID()}`; const at = now();
    this.db.prepare("INSERT INTO tasks VALUES (?,1,'mock','ready',?,?,?)").run(id, JSON.stringify(input), at, at);
    return this.getTask(id);
  }
  updateTask(id: string, value: unknown): Task {
    const input = parseTaskInput(value);
    return this.transaction(() => {
      this.getTask(id);
      this.db.prepare('UPDATE tasks SET revision=revision+1,input_json=?,updated_at=? WHERE id=?').run(JSON.stringify(input), now(), id);
      return this.getTask(id);
    });
  }
  listRuns(taskId?: string): Run[] {
    return (taskId ? this.db.prepare('SELECT * FROM runs WHERE task_id=? ORDER BY created_at DESC,id').all(taskId)
      : this.db.prepare('SELECT * FROM runs ORDER BY created_at DESC,id').all()).map(r => this.run(r));
  }
  getRun(id: string): Run {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id);
    if (!row) throw new ApiError(404, 'NOT_FOUND', 'Run 不存在'); return this.run(row);
  }
  activeRun(): Run | null {
    const row = this.db.prepare("SELECT * FROM runs WHERE state='running'").get(); return row ? this.run(row) : null;
  }
  startRun(taskId: string, value: unknown): { run: Run; replay: boolean } {
    const input = parseStartInput(value);
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT * FROM runs WHERE request_id=?').get(input.request_id);
      if (existing) {
        if (existing.task_id !== taskId || existing.scenario !== input.scenario || existing.execution_mode !== 'mock') {
          throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key 已用于不同的 Task 或模拟场景');
        }
        return { run: this.run(existing), replay: true };
      }
      const task = this.getTask(taskId); const active = this.activeRun();
      this.assertResourcesAvailable();
      if (active) throw new ApiError(409, 'ACTIVE_RUN', 'An active mock Run already exists；请查看或取消它', undefined, active.id);
      const id = `run_${randomUUID()}`;
      const snapshot: Run['input_snapshot'] = { snapshot_version: 1, execution_mode: 'mock', scenario: input.scenario, task };
      this.db.prepare("INSERT INTO runs VALUES (?,?,?,?,'mock','running','prepare',?,?,NULL,NULL)")
        .run(id, taskId, input.request_id, input.scenario, JSON.stringify(snapshot), now());
      this.log(id, '模拟开始；输入已冻结。未读取仓库，未进行 Git / Workspace / Codex preflight。');
      return { run: this.getRun(id), replay: false };
    });
  }
  private log(id: string, message: string) {
    const mode = this.getRun(id).execution_mode;
    this.db.prepare(`INSERT INTO run_logs (run_id,sequence,execution_mode,created_at,message)
      SELECT ?,COALESCE(MAX(sequence),0)+1,?,?,? FROM run_logs WHERE run_id=?`)
      .run(id, mode, now(), `[${mode}] ${message}`, id);
  }
  getLogs(id: string, after = 0): RunLog[] {
    this.getRun(id);
    return this.db.prepare('SELECT * FROM run_logs WHERE run_id=? AND sequence>? ORDER BY sequence').all(id, after) as unknown as RunLog[];
  }
  appendProgress(id: string, phase: Phase, message: string): boolean {
    return this.transaction(() => {
      if (this.getRun(id).state !== 'running') return false;
      this.db.prepare('UPDATE runs SET phase=? WHERE id=?').run(phase, id); this.log(id, message); return true;
    });
  }
  finishRun(id: string, state: Exclude<RunState, 'running'>, phase: Phase, reason: string): Run {
    return this.transaction(() => {
      const run = this.getRun(id); if (run.state !== 'running') return run;
      this.db.prepare('UPDATE runs SET state=?,phase=?,finished_at=?,terminal_reason=? WHERE id=?').run(state, phase, now(), reason, id);
      this.log(id, run.execution_mode === 'mock' ? `${reason}；仅模拟终态 ${state}。无真实交付、无 OS 进程树终止声明；Task 保持 ready。` : `${reason}；已保存中断或终态事实，不续跑后续阶段；已有证据保留，Review / Delivery 仍关闭，Task 保持 ready。`);
      return this.getRun(id);
    });
  }
  recoverInterrupted(): number {
    const active = this.activeRun();
    if (!active) return 0;
    this.finishRun(active.id, 'interrupted', active.phase, 'service_restart_no_resume'); return 1;
  }
  resourceLock(): { run_id: string | null; task_id: string | null; request_id: string | null; facts: unknown } | null {
    const row = this.db.prepare('SELECT * FROM resource_lock WHERE singleton=1').get();
    return row ? { run_id: row.run_id === null ? null : String(row.run_id), task_id: row.task_id === null ? null : String(row.task_id), request_id: row.request_id === null ? null : String(row.request_id), facts: JSON.parse(String(row.facts_json)) } : null;
  }
  assertResourcesAvailable() {
    const lock = this.resourceLock();
    if (lock) throw new ApiError(409, 'RESOURCE_HELD', '资源事实尚未确认安全；禁止启动新 Run，请保留记录并检查本地进程', undefined, lock.run_id ?? undefined);
  }
  recordResourceFacts(id: string, facts: Record<string, unknown>) {
    this.db.prepare('UPDATE resource_lock SET facts_json=? WHERE run_id=?').run(JSON.stringify(facts), id);
  }
  reservePreparation(taskId: string, requestId: string): Task {
    return this.transaction(() => {
      this.assertResourcesAvailable();
      const active = this.activeRun();
      if (active) throw new ApiError(409, 'ACTIVE_RUN', '全局已有活动 Run', undefined, active.id);
      const task = this.getTask(taskId);
      this.db.prepare('INSERT INTO resource_lock VALUES (1,NULL,?,?,?)').run(taskId, requestId, JSON.stringify({resource_state:'unknown',resource_lock:'held',reason:'before_git_preflight'}));
      return task;
    });
  }
  failPreparation(requestId: string, resourcesConfirmed: boolean) {
    if (resourcesConfirmed) this.db.prepare('DELETE FROM resource_lock WHERE run_id IS NULL AND request_id=?').run(requestId);
    else this.db.prepare('UPDATE resource_lock SET facts_json=? WHERE run_id IS NULL AND request_id=?').run(JSON.stringify({resource_state:'unknown',resource_lock:'held',reason:'git_preflight_unconfirmed_no_agent_spawned'}),requestId);
  }
  replayRealRun(taskId: string, requestId: string, selection: VerificationSelection = {verify:false}): Run | null {
    const row = this.db.prepare('SELECT * FROM runs WHERE request_id=?').get(requestId);
    if (!row) return null;
    if (row.task_id !== taskId || row.execution_mode !== 'real') throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', '请求 ID 已用于其他执行');
    const run = this.run(row);
    const previous = run.input_snapshot.verification_selection ?? {verify:false};
    if (previous.verify !== selection.verify || previous.expected_task_revision !== selection.expected_task_revision) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "请求 ID 已用于不同的验证选择或 Task 版本");
    return run;
  }
  startRealRun(taskId: string, requestId: string, execution: RealSnapshot, taskRevision?: number, selection: VerificationSelection = {verify:false}, verification?: FrozenVerification): { run: Run; replay: boolean } {
    return this.transaction(() => {
      const existing = this.replayRealRun(taskId, requestId, selection);
      if (existing) return { run: existing, replay: true };
      const reservation = this.resourceLock();
      if (reservation && !(reservation.run_id === null && reservation.task_id === taskId && reservation.request_id === requestId)) this.assertResourcesAvailable();
      const active = this.activeRun();
      if (active) throw new ApiError(409, 'ACTIVE_RUN', '全局已有活动 Run', undefined, active.id);
      const task = this.getTask(taskId); const id = `run_${randomUUID()}`;
      if (taskRevision !== undefined && task.revision !== taskRevision) throw new ApiError(409, 'TASK_CHANGED', '准备期间 Task 已修改，请重新启动以冻结一致的输入');
      const snapshot: Run['input_snapshot'] = { snapshot_version: 1, execution_mode: 'real', scenario: 'success', task, execution, verification_selection: selection, ...(verification ? {verification} : {}) };
      this.db.prepare("INSERT INTO runs VALUES (?,?,?,'success','real','running','prepare',?,?,NULL,NULL)")
        .run(id, taskId, requestId, JSON.stringify(snapshot), now());
      const facts = JSON.stringify({ resource_state: 'unknown', resource_lock: 'held', reason: 'before_spawn' });
      if (reservation) this.db.prepare('UPDATE resource_lock SET run_id=?,task_id=NULL,request_id=NULL,facts_json=? WHERE singleton=1').run(id,facts);
      else this.db.prepare('INSERT INTO resource_lock VALUES (1,?,NULL,NULL,?)').run(id, facts);
      this.log(id, verification ? '输入与本次验证已冻结；全程保持资源锁。' : '输入已冻结；仅执行 Agent，验证草稿不执行。');
      return { run: this.getRun(id), replay: false };
    });
  }
  getExecutionFacts(id: string): unknown {
    this.getRun(id); const row = this.db.prepare('SELECT facts_json FROM execution_facts WHERE run_id=?').get(id);
    return row ? JSON.parse(String(row.facts_json)) : null;
  }
  recordStage(id: string, stage: ExecutionStage, facts: Record<string, unknown>) {
    this.db.prepare('INSERT INTO stage_observations VALUES (?,?,?)').run(id,stage,JSON.stringify(facts));
  }
  recordCapture(id: string, point: 'before' | 'after', version: CapturedVersion) {
    this.db.prepare('INSERT INTO captured_versions VALUES (?,?,?)').run(id,point,JSON.stringify(version));
  }
  appendOutput(id: string, stage: ExecutionStage, stream: 'stdout' | 'stderr', text: string) {
    this.db.prepare('INSERT INTO stage_output SELECT ?,COALESCE(MAX(sequence),0)+1,?,?,? FROM stage_output WHERE run_id=?').run(id,stage,stream,text,id);
  }
  getRunEvidence(id: string): RunEvidence {
    this.getRun(id);
    const result = this.db.prepare('SELECT result_json FROM verification_results WHERE run_id=?').get(id);
    return {
      stages:this.db.prepare('SELECT stage,facts_json FROM stage_observations WHERE run_id=? ORDER BY rowid').all(id).map(row=>({stage:row.stage as ExecutionStage,facts:JSON.parse(String(row.facts_json))})),
      captures:this.db.prepare('SELECT point,version_json FROM captured_versions WHERE run_id=? ORDER BY rowid').all(id).map(row=>({point:row.point as 'before'|'after',version:JSON.parse(String(row.version_json))})),
      output:this.db.prepare('SELECT sequence,stage,stream,text FROM stage_output WHERE run_id=? ORDER BY sequence').all(id) as unknown as RunEvidence['output'],
      verification: result ? JSON.parse(String(result.result_json)) : null
    };
  }
  finishRealRun(id: string, state: Exclude<RunState, 'running'>, reason: string, facts: Record<string, unknown>, safe: boolean, verification?: VerificationResult): Run {
    return this.transaction(() => {
      const run = this.getRun(id);
      if (run.state !== 'running') return run;
      this.db.prepare('INSERT INTO execution_facts VALUES (?,?)').run(id, JSON.stringify(facts));
      if (verification) this.db.prepare('INSERT INTO verification_results VALUES (?,?)').run(id,JSON.stringify(verification));
      if (safe) this.db.prepare('DELETE FROM resource_lock WHERE run_id=?').run(id);
      else this.db.prepare('UPDATE resource_lock SET facts_json=? WHERE run_id=?').run(JSON.stringify(facts), id);
      this.db.prepare("UPDATE runs SET state=?,phase=?,finished_at=?,terminal_reason=? WHERE id=?").run(state, run.phase, now(), reason, id);
      this.log(id, `${reason}；资源${safe ? '已确认停止且输出已收尾' : '未知，保持全局锁'}。Review / Delivery 仍关闭；Task 保持 ready。`);
      return this.getRun(id);
    });
  }
}

// A SQLite-managed application mutex, not an Agent process-ownership system.
// The OS releases the database lock on crash; no stale PID heuristics or auto unlock.
export function acquireDatabaseMutex(path: string): () => void {
  mkdirSync(dirname(path), { recursive: true });
  const mutex = new DatabaseSync(`${path}.owner.sqlite`);
  try { mutex.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE;'); }
  catch { mutex.close(); throw new Error('DATABASE_IN_USE: another service owns this data directory; no recovery or new Run allowed'); }
  let released = false;
  return () => { if (!released) { released = true; mutex.exec('ROLLBACK'); mutex.close(); } };
}
