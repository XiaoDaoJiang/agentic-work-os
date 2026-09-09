import type { DatabaseSync } from 'node:sqlite';

// Forward-only, transactionally applied migrations. Never silently open a newer schema.
const migrations = [{ version: 1, name: 'task_mock_run_v1', sql: `
CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT;
CREATE TABLE tasks (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0),
 execution_mode TEXT NOT NULL CHECK(execution_mode = 'mock'), state TEXT NOT NULL CHECK(state = 'ready'),
 input_json TEXT NOT NULL CHECK(json_valid(input_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE runs (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
 request_id TEXT NOT NULL UNIQUE, scenario TEXT NOT NULL CHECK(scenario IN ('success','failure','cancel')),
 execution_mode TEXT NOT NULL CHECK(execution_mode = 'mock'),
 state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed','cancelled','interrupted')),
 phase TEXT NOT NULL CHECK(phase IN ('prepare','agent','test','review','complete')),
 input_snapshot TEXT NOT NULL CHECK(json_valid(input_snapshot) AND json_extract(input_snapshot,'$.execution_mode') = 'mock'),
 created_at TEXT NOT NULL, finished_at TEXT, terminal_reason TEXT,
 CHECK((state = 'running' AND finished_at IS NULL AND terminal_reason IS NULL)
 OR (state != 'running' AND finished_at IS NOT NULL AND terminal_reason IS NOT NULL))
) STRICT;
CREATE UNIQUE INDEX one_active_mock_run ON runs((1)) WHERE state = 'running';
CREATE INDEX runs_by_task ON runs(task_id, created_at);
CREATE TABLE run_logs (
 run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL CHECK(sequence > 0),
 execution_mode TEXT NOT NULL CHECK(execution_mode = 'mock'), created_at TEXT NOT NULL,
 message TEXT NOT NULL CHECK(substr(message,1,6) = '[mock]'), PRIMARY KEY(run_id, sequence)
) STRICT;
CREATE TRIGGER immutable_run_input BEFORE UPDATE OF input_snapshot,task_id,request_id,scenario,execution_mode,id,created_at ON runs
BEGIN SELECT RAISE(ABORT, 'run input is immutable'); END;
CREATE TRIGGER immutable_terminal BEFORE UPDATE ON runs WHEN OLD.state != 'running'
BEGIN SELECT RAISE(ABORT, 'terminal run is immutable'); END;
CREATE TRIGGER immutable_log_update BEFORE UPDATE ON run_logs
BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
CREATE TRIGGER immutable_log_delete BEFORE DELETE ON run_logs
BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
` }];

export function migrate(db: DatabaseSync): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = Number(db.prepare('PRAGMA user_version').get()!.user_version);
    if (current > migrations.length) throw new Error(`Unsupported newer schema ${current}`);
    for (const migration of migrations) {
      if (migration.version <= current) continue;
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(migration.version, migration.name, new Date().toISOString());
      db.exec(`PRAGMA user_version = ${migration.version}`);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
