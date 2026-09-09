import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, type SQLOutputValue } from 'node:sqlite';
import { migrate } from './migrations.js';
import { ApiError, parseTaskInput, parseStartInput, type Task, type Run, type RunLog, type Phase, type RunState } from './contracts.js';

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
        if (existing.task_id !== taskId || existing.scenario !== input.scenario) {
          throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key 已用于不同的 Task 或模拟场景');
        }
        return { run: this.run(existing), replay: true };
      }
      const task = this.getTask(taskId); const active = this.activeRun();
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
    this.db.prepare(`INSERT INTO run_logs (run_id,sequence,execution_mode,created_at,message)
      SELECT ?,COALESCE(MAX(sequence),0)+1,'mock',?,? FROM run_logs WHERE run_id=?`)
      .run(id, now(), `[mock] ${message}`, id);
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
      this.log(id, `${reason}；仅模拟终态 ${state}。无真实交付、无 OS 进程树终止声明；Task 保持 ready。`);
      return this.getRun(id);
    });
  }
  recoverInterrupted(): number {
    const active = this.activeRun();
    if (!active) return 0;
    this.finishRun(active.id, 'interrupted', active.phase, 'service_restart_no_resume'); return 1;
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
