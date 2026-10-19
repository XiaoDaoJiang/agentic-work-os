CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT;
CREATE TABLE tasks (
 id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0),
 execution_mode TEXT NOT NULL CHECK(execution_mode = 'mock'), state TEXT NOT NULL CHECK(state = 'ready'),
 input_json TEXT NOT NULL CHECK(json_valid(input_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
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
CREATE TABLE run_logs (
 run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL CHECK(sequence>0),
 execution_mode TEXT NOT NULL CHECK(execution_mode IN ('mock','real')), created_at TEXT NOT NULL,
 message TEXT NOT NULL, PRIMARY KEY(run_id,sequence),
 CHECK((execution_mode='mock' AND substr(message,1,6)='[mock]') OR (execution_mode='real' AND substr(message,1,6)='[real]'))
) STRICT;
CREATE TABLE execution_facts (
 run_id TEXT PRIMARY KEY REFERENCES runs(id), facts_json TEXT NOT NULL CHECK(json_valid(facts_json))
) STRICT;
CREATE TABLE resource_lock (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), run_id TEXT UNIQUE REFERENCES runs(id),
 task_id TEXT REFERENCES tasks(id), request_id TEXT,
 facts_json TEXT NOT NULL CHECK(json_valid(facts_json)),
 CHECK((run_id IS NOT NULL AND task_id IS NULL AND request_id IS NULL)
 OR (run_id IS NULL AND task_id IS NOT NULL AND request_id IS NOT NULL))
) STRICT;
CREATE TABLE stage_observations(run_id TEXT NOT NULL REFERENCES runs(id), stage TEXT NOT NULL, facts_json TEXT NOT NULL CHECK(json_valid(facts_json)), PRIMARY KEY(run_id,stage)) STRICT;
CREATE TABLE captured_versions(run_id TEXT NOT NULL REFERENCES runs(id), point TEXT NOT NULL CHECK(point IN ('before','after')), version_json TEXT NOT NULL CHECK(json_valid(version_json)), PRIMARY KEY(run_id,point)) STRICT;
CREATE TABLE verification_results(run_id TEXT PRIMARY KEY REFERENCES runs(id), result_json TEXT NOT NULL CHECK(json_valid(result_json))) STRICT;
CREATE TABLE stage_output(run_id TEXT NOT NULL REFERENCES runs(id), sequence INTEGER NOT NULL, stage TEXT NOT NULL, stream TEXT NOT NULL CHECK(stream IN ('stdout','stderr')), text TEXT NOT NULL, PRIMARY KEY(run_id,sequence)) STRICT;
CREATE UNIQUE INDEX one_active_run ON runs((1)) WHERE state='running';
CREATE INDEX runs_by_task ON runs(task_id,created_at);
CREATE TRIGGER immutable_run_input BEFORE UPDATE OF input_snapshot,task_id,request_id,scenario,execution_mode,id,created_at ON runs
BEGIN SELECT RAISE(ABORT, 'run input is immutable'); END;
CREATE TRIGGER immutable_terminal BEFORE UPDATE ON runs WHEN OLD.state!='running'
BEGIN SELECT RAISE(ABORT, 'terminal run is immutable'); END;
CREATE TRIGGER immutable_log_update BEFORE UPDATE ON run_logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
CREATE TRIGGER immutable_log_delete BEFORE DELETE ON run_logs BEGIN SELECT RAISE(ABORT, 'logs are append-only'); END;
CREATE TRIGGER immutable_stage_observations_update BEFORE UPDATE ON stage_observations BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_stage_observations_delete BEFORE DELETE ON stage_observations BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_captured_versions_update BEFORE UPDATE ON captured_versions BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_captured_versions_delete BEFORE DELETE ON captured_versions BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_verification_results_update BEFORE UPDATE ON verification_results BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_verification_results_delete BEFORE DELETE ON verification_results BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_stage_output_update BEFORE UPDATE ON stage_output BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_stage_output_delete BEFORE DELETE ON stage_output BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_execution_facts_update BEFORE UPDATE ON execution_facts BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
CREATE TRIGGER immutable_execution_facts_delete BEFORE DELETE ON execution_facts BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;
PRAGMA user_version=4;
