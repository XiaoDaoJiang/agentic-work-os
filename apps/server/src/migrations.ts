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
` }, { version: 2, name: 'real_execution_resource_lock', sql: `
DROP TRIGGER immutable_run_input;
DROP TRIGGER immutable_terminal;
DROP TRIGGER immutable_log_update;
DROP TRIGGER immutable_log_delete;
ALTER TABLE run_logs RENAME TO old_logs;
ALTER TABLE runs RENAME TO old_runs;
CREATE TABLE runs (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), request_id TEXT NOT NULL UNIQUE,
 scenario TEXT NOT NULL CHECK(scenario IN ('success','failure','cancel')),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('mock','real')),
 state TEXT NOT NULL CHECK(state IN ('running','succeeded','failed','cancelled','interrupted')),
 phase TEXT NOT NULL CHECK(phase IN ('prepare','agent','test','review','complete')),
 input_snapshot TEXT NOT NULL CHECK(json_valid(input_snapshot) AND json_extract(input_snapshot,'$.execution_mode')=execution_mode),
 created_at TEXT NOT NULL, finished_at TEXT, terminal_reason TEXT,
 CHECK((state='running' AND finished_at IS NULL AND terminal_reason IS NULL) OR (state!='running' AND finished_at IS NOT NULL AND terminal_reason IS NOT NULL))
) STRICT;
INSERT INTO runs SELECT * FROM old_runs;
CREATE TABLE run_logs (
 run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL CHECK(sequence>0),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('mock','real')), created_at TEXT NOT NULL,
 message TEXT NOT NULL, PRIMARY KEY(run_id,sequence),
 CHECK((execution_mode='mock' AND substr(message,1,6)='[mock]') OR (execution_mode='real' AND substr(message,1,6)='[real]'))
) STRICT;
INSERT INTO run_logs SELECT * FROM old_logs;
DROP TABLE old_logs;
DROP TABLE old_runs;
CREATE UNIQUE INDEX one_active_run ON runs((1)) WHERE state='running';
CREATE INDEX runs_by_task ON runs(task_id,created_at);
CREATE TABLE resource_lock (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
 facts_json TEXT NOT NULL CHECK(json_valid(facts_json))
) STRICT;
CREATE TABLE execution_facts (
 run_id TEXT PRIMARY KEY REFERENCES runs(id), facts_json TEXT NOT NULL CHECK(json_valid(facts_json))
) STRICT;
CREATE TRIGGER immutable_run_input BEFORE UPDATE OF input_snapshot,task_id,request_id,scenario,execution_mode,id,created_at ON runs
BEGIN SELECT RAISE(ABORT, 'run input is immutable'); END;
CREATE TRIGGER immutable_terminal BEFORE UPDATE ON runs WHEN OLD.state!='running'
BEGIN SELECT RAISE(ABORT, 'terminal run is immutable'); END;
CREATE TRIGGER immutable_log_update BEFORE UPDATE ON run_logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
CREATE TRIGGER immutable_log_delete BEFORE DELETE ON run_logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
` }, { version: 3, name: 'durable_preparation_owner', sql: `
ALTER TABLE resource_lock RENAME TO old_resource_lock;
CREATE TABLE resource_lock (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), run_id TEXT UNIQUE REFERENCES runs(id),
 task_id TEXT REFERENCES tasks(id), request_id TEXT,
 facts_json TEXT NOT NULL CHECK(json_valid(facts_json)),
 CHECK((run_id IS NOT NULL AND task_id IS NULL AND request_id IS NULL)
 OR (run_id IS NULL AND task_id IS NOT NULL AND request_id IS NOT NULL))
) STRICT;
INSERT INTO resource_lock SELECT singleton,run_id,NULL,NULL,facts_json FROM old_resource_lock;
DROP TABLE old_resource_lock;
` }, { version: 4, name: 'verification_evidence', sql: `
CREATE TABLE stage_observations(run_id TEXT NOT NULL REFERENCES runs(id), stage TEXT NOT NULL, facts_json TEXT NOT NULL CHECK(json_valid(facts_json)), PRIMARY KEY(run_id,stage)) STRICT;
CREATE TABLE captured_versions(run_id TEXT NOT NULL REFERENCES runs(id), point TEXT NOT NULL CHECK(point IN ('before','after')), version_json TEXT NOT NULL CHECK(json_valid(version_json)), PRIMARY KEY(run_id,point)) STRICT;
CREATE TABLE verification_results(run_id TEXT PRIMARY KEY REFERENCES runs(id), result_json TEXT NOT NULL CHECK(json_valid(result_json))) STRICT;
CREATE TABLE stage_output(run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL, stage TEXT NOT NULL, stream TEXT NOT NULL CHECK(stream IN ('stdout','stderr')), text TEXT NOT NULL, PRIMARY KEY(run_id,sequence)) STRICT;
${['stage_observations','captured_versions','verification_results','stage_output','execution_facts'].map(table => `CREATE TRIGGER immutable_${table}_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END; CREATE TRIGGER immutable_${table}_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;`).join('\n')}
` }, {version:5,name:'sealed_review_decisions',sql:`
CREATE TABLE tasks_next (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>0), execution_mode TEXT NOT NULL CHECK(execution_mode='mock'),
 state TEXT NOT NULL CHECK(state IN ('ready','review','done')), input_json TEXT NOT NULL CHECK(json_valid(input_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
INSERT INTO tasks_next SELECT * FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_next RENAME TO tasks;
DROP TRIGGER immutable_run_input;
DROP TRIGGER immutable_terminal;
CREATE TABLE runs_next (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), request_id TEXT NOT NULL UNIQUE,
 scenario TEXT NOT NULL CHECK(scenario IN ('success','failure','cancel')), execution_mode TEXT NOT NULL CHECK(execution_mode IN ('mock','real')),
 state TEXT NOT NULL CHECK(state IN ('running','waiting_review','completed','succeeded','failed','cancelled','interrupted')),
 phase TEXT NOT NULL CHECK(phase IN ('prepare','agent','test','review','complete')),
 input_snapshot TEXT NOT NULL CHECK(json_valid(input_snapshot) AND json_extract(input_snapshot,'$.execution_mode')=execution_mode),
 created_at TEXT NOT NULL, finished_at TEXT, terminal_reason TEXT,
 CHECK((state IN ('running','waiting_review') AND finished_at IS NULL AND terminal_reason IS NULL) OR (state NOT IN ('running','waiting_review') AND finished_at IS NOT NULL AND terminal_reason IS NOT NULL)),
 CHECK(state!='waiting_review' OR (phase='review' AND execution_mode='real')),
 CHECK(state!='completed' OR (phase='complete' AND execution_mode='real'))
) STRICT;
INSERT INTO runs_next SELECT * FROM runs;
DROP TABLE runs;
ALTER TABLE runs_next RENAME TO runs;
CREATE UNIQUE INDEX one_active_run ON runs((1)) WHERE state IN ('running','waiting_review');
CREATE INDEX runs_by_task ON runs(task_id,created_at);
CREATE TRIGGER immutable_run_input BEFORE UPDATE OF input_snapshot,task_id,request_id,scenario,execution_mode,id,created_at ON runs
BEGIN SELECT RAISE(ABORT,'run input is immutable'); END;
CREATE TRIGGER immutable_terminal BEFORE UPDATE ON runs WHEN OLD.state NOT IN ('running','waiting_review')
BEGIN SELECT RAISE(ABORT,'terminal run is immutable'); END;
CREATE TRIGGER review_transition BEFORE UPDATE ON runs WHEN OLD.state='waiting_review' AND NEW.state!='completed'
BEGIN SELECT RAISE(ABORT,'review only completes through a decision'); END;
CREATE TABLE artifacts(id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),type TEXT NOT NULL CHECK(type IN ('agent_log','diff','verification_result','change_package')),content_location TEXT NOT NULL,sha256 TEXT NOT NULL CHECK(length(sha256)=64),size INTEGER NOT NULL CHECK(size>=0),sealed_at TEXT NOT NULL) STRICT;
CREATE UNIQUE INDEX one_artifact_type_per_run ON artifacts(run_id,type);
CREATE TABLE events(id INTEGER PRIMARY KEY,run_id TEXT NOT NULL REFERENCES runs(id),sequence INTEGER NOT NULL,type TEXT NOT NULL,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),UNIQUE(run_id,sequence)) STRICT;
CREATE UNIQUE INDEX one_terminal_event ON events(run_id) WHERE type='run.terminal';
CREATE TABLE review_decisions(run_id TEXT PRIMARY KEY REFERENCES runs(id),decision TEXT NOT NULL CHECK(decision IN ('accept','reject')),change_package_artifact_id TEXT NOT NULL REFERENCES artifacts(id),change_package_sha256 TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,note TEXT NOT NULL,decided_at TEXT NOT NULL) STRICT;
CREATE TRIGGER decision_package BEFORE INSERT ON review_decisions WHEN NOT EXISTS(SELECT 1 FROM artifacts a JOIN runs r ON r.id=a.run_id WHERE a.id=NEW.change_package_artifact_id AND a.run_id=NEW.run_id AND a.type='change_package' AND a.sha256=NEW.change_package_sha256 AND r.state='waiting_review')
BEGIN SELECT RAISE(ABORT,'decision requires same Run sealed package'); END;
CREATE TRIGGER completed_decision BEFORE UPDATE ON runs WHEN NEW.state='completed' AND NOT EXISTS(SELECT 1 FROM review_decisions WHERE run_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'completed requires review decision'); END;
${['artifacts','review_decisions','events'].map(table=>`CREATE TRIGGER immutable_${table}_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END; CREATE TRIGGER immutable_${table}_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;`).join('\n')}
${['artifacts','stage_observations','captured_versions','verification_results','stage_output','execution_facts','run_logs'].map(table=>`CREATE TRIGGER sealed_${table}_insert BEFORE INSERT ON ${table} WHEN (SELECT state FROM runs WHERE id=NEW.run_id)!='running' BEGIN SELECT RAISE(ABORT,'sealed business evidence is immutable'); END;`).join('\n')}
` }, {version:6,name:'sealed_event_boundaries',sql:`
CREATE TABLE tasks_next (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision>0), execution_mode TEXT NOT NULL CHECK(execution_mode='mock'),
 state TEXT NOT NULL CHECK(state IN ('ready','review','done','blocked')), input_json TEXT NOT NULL CHECK(json_valid(input_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
INSERT INTO tasks_next SELECT * FROM tasks;
DROP TABLE tasks;
ALTER TABLE tasks_next RENAME TO tasks;
CREATE TRIGGER sealed_event_insert BEFORE INSERT ON events
WHEN (SELECT state FROM runs WHERE id=NEW.run_id)!='running'
AND NOT (NEW.type IN ('resource.reconciliation.started','resource.reconciliation.succeeded','resource.reconciliation.blocked')
 OR (NEW.type='review.ready' AND (SELECT state FROM runs WHERE id=NEW.run_id)='waiting_review')
 OR (NEW.type='review.decided' AND (SELECT state FROM runs WHERE id=NEW.run_id)='waiting_review' AND EXISTS(SELECT 1 FROM review_decisions WHERE run_id=NEW.run_id))
 OR (NEW.type='run.terminal' AND (SELECT state FROM runs WHERE id=NEW.run_id)='completed' AND EXISTS(SELECT 1 FROM review_decisions WHERE run_id=NEW.run_id)))
BEGIN SELECT RAISE(ABORT,'sealed business events are immutable'); END;
CREATE UNIQUE INDEX one_review_ready ON events(run_id) WHERE type='review.ready';
CREATE UNIQUE INDEX one_review_decided ON events(run_id) WHERE type='review.decided';
` }];

export function migrate(db: DatabaseSync): void {
  // Table replacement preserves dependent foreign keys without rewriting historical rows.
  db.exec('PRAGMA foreign_keys=OFF');
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
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Migration foreign key check failed');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  finally {db.exec('PRAGMA foreign_keys=ON');}
}
