import { verificationShell } from '../dist/verification.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../dist/store.js';
import { RealExecutor, assertBaseline, receiptMatches } from '../dist/real-executor.js';
import { executionIdentity, readExecutionProfile, sha256File, g1Cases } from '../dist/execution-profile.js';
import { createApplication } from '../dist/app.js';
import { release } from 'node:os';
function fixture(t) { const directory = mkdtempSync(join(tmpdir(), 'workos-g1-unit-')); const source = join(directory, 'source'); mkdirSync(source); const git = args => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true }).trim(); git(['init']); writeFileSync(join(source, 'a.txt'), 'baseline'); git(['add', '.']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']); const store = new Store(join(directory, 'state.sqlite')); t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); }); const task = store.createTask({ goal: 'no process should start', definition_of_done: ['fixture'], repository_path: source, verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } }); const profile = { executable: process.execPath, helper: process.execPath, model: 'gpt-6.1-sol', codex_version: 'fixture', evidence_path: '' }; return { directory, source, store, task, profile, git }; }
test('forward migration preserves v1 mock snapshots, logs and immutable guards', t => {
    const dir = mkdtempSync(join(tmpdir(), 'workos-v1-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const file = join(dir, 'state.sqlite');
    const old = new DatabaseSync(file);
    old.exec(readFileSync(new URL('./fixtures/schema-v1.sql', import.meta.url), 'utf8'));
    old.exec('PRAGMA user_version=1');
    old.prepare('INSERT INTO schema_migrations VALUES(1,?,?)').run('task_mock_run_v1', 'fixture');
    old.prepare("INSERT INTO tasks VALUES('task',1,'mock','ready','{}','a','a')").run();
    const snapshot = JSON.stringify({ execution_mode: 'mock', task: { goal: 'old fixture' } });
    old.prepare("INSERT INTO runs VALUES('run','task','old-request','success','mock','succeeded','complete',?,'a','b','mock_success')").run(snapshot);
    old.prepare("INSERT INTO run_logs VALUES('run',1,'mock','a','[mock] old history')").run();
    const originalRun = {...old.prepare('SELECT * FROM runs').get()};
    const originalTask = {...old.prepare('SELECT * FROM tasks').get()};
    old.close();
    const store = new Store(file);
    try {
        assert.equal(store.schemaVersion(), 6);
        assert.deepEqual({...store.db.prepare('SELECT * FROM runs').get()},originalRun);
        assert.deepEqual({...store.db.prepare('SELECT * FROM tasks').get()},originalTask);
        assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
        assert.equal(store.db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
        assert.equal(store.getRun('run').input_snapshot.task.goal, 'old fixture');
        assert.equal(store.getLogs('run')[0].message, '[mock] old history');
        assert.throws(() => store.db.exec("UPDATE runs SET input_snapshot='{}' WHERE id='run'"), /immutable/);
        assert.throws(() => store.db.exec("DELETE FROM run_logs"), /append-only/);
    }
    finally {
        store.close();
    }
});
test('Git target is independent of inherited GIT_DIR and GIT_WORK_TREE', t => {
    const { source, git } = fixture(t);
    const expected = git(['rev-parse', 'HEAD']);
    const before = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
    process.env.GIT_DIR = 'Z:/wrong/git';
    process.env.GIT_WORK_TREE = 'Z:/wrong/work';
    try {
        assert.equal(assertBaseline(source).head, expected);
    }
    finally {
        for (const [name, value] of Object.entries(before)) {
            if (value === undefined)
                delete process.env[name];
            else
                process.env[name] = value;
        }
    }
});
test('closing while repository marker is pending prevents late spawn', async (t) => {
    const { directory, store, task, profile } = fixture(t);
    const executor = new RealExecutor(store, join(directory, 'runs'), profile);
    const pending = executor.start(task.id, 'closing-request');
    const rejection = assert.rejects(pending, error => error.code === 'CLOSING');
    await executor.close();
    await rejection;
    assert.equal(store.listRuns().length, 0);
    assert.equal(store.resourceLock(), null);
});
test('Task edited during asynchronous preflight cannot mix old repository and new goal', async (t) => {
    const { directory, store, task, profile } = fixture(t);
    const executor = new RealExecutor(store, join(directory, 'runs'), profile);
    const pending = executor.start(task.id, 'editing-request');
    const rejection = assert.rejects(pending, error => error.code === 'TASK_CHANGED');
    store.updateTask(task.id, { goal: 'edited', definition_of_done: ['edited'], repository_path: task.repository_path, verification_draft: task.verification_draft });
    await rejection;
    await executor.close();
    assert.equal(store.listRuns().length, 0);
});
test('G1 default denies absent, incomplete, stale and tampered evidence', t => {
    const { directory } = fixture(t);
    assert.equal(readExecutionProfile(), null);
    const file = join(directory, 'evidence.json');
    const sources = executionIdentity();
    const manifest = { verification_shell:verificationShell(), verification_shell_sha256:sha256File(verificationShell()), schema: 'fmvp-g1-v1', activation: 'passed', profile: 'windows-processkit-codex-exec', platform: 'win32/x64', node: process.version, os_release: release(), model: 'gpt-6.1-sol', code_sha: 'a'.repeat(40), sources, executable: process.execPath, helper: process.execPath, executable_sha256: sha256File(process.execPath), helper_sha256: sha256File(process.execPath), codex_version: 'fixture', cases: Object.fromEntries(g1Cases.map(name => [name, 'passed'])) };
    writeFileSync(file, JSON.stringify(manifest));
    assert.ok(readExecutionProfile(file));
    for (const patch of [{ activation: 'diagnostic' }, { node: 'v0' }, { sources: {} }, { helper_sha256: 'wrong' }, { cases: {} }]) {
        writeFileSync(file, JSON.stringify({ ...manifest, ...patch }));
        assert.equal(readExecutionProfile(file), null);
    }
});
test('application revalidates activation evidence before each actual start', async (t) => {
    const { directory, source } = fixture(t);
    const evidence = join(directory, 'g1.json');
    const sources = executionIdentity();
    const manifest = { verification_shell:verificationShell(), verification_shell_sha256:sha256File(verificationShell()), schema: 'fmvp-g1-v1', activation: 'passed', profile: 'windows-processkit-codex-exec', platform: 'win32/x64', node: process.version, os_release: release(), model: 'gpt-6.1-sol', code_sha: 'a'.repeat(40), sources, executable: process.execPath, helper: process.execPath, executable_sha256: sha256File(process.execPath), helper_sha256: sha256File(process.execPath), codex_version: 'fixture', cases: Object.fromEntries(g1Cases.map(name => [name, 'passed'])) };
    writeFileSync(evidence, JSON.stringify(manifest));
    const app = await createApplication({ databasePath: join(directory, 'app.sqlite'), port: 0, g1EvidencePath: evidence });
    try {
        const session = await (await fetch(app.origin + '/api/session')).json();
        assert.equal(session.real_execution, true);
        const task = app.store.createTask({ goal: 'not executed', definition_of_done: ['fixture'], repository_path: source, verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } });
        writeFileSync(evidence, JSON.stringify({ ...manifest, sources: {} }));
        const response = await fetch(`${app.origin}/api/tasks/${task.id}/runs`, { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json', 'X-WorkOS-Session': session.session_token }, body: JSON.stringify({ execution_mode: 'real', request_id: 'must-not-spawn' }) });
        assert.equal(response.status, 403);
        assert.equal(app.store.listRuns().length, 0);
    }
    finally {
        await app.close();
    }
});

// Git can leave descendants when its synchronous timeout kills only the command root.
test('Git preparation timeout retains durable lock and blocks new execution', async t => {
    const { default: childProcess } = await import('node:child_process');
    const { syncBuiltinESMExports } = await import('node:module');
    const { directory, store, task, profile } = fixture(t);
    const execute = childProcess.execFileSync;
    childProcess.execFileSync = (program, args, options) => {
        if (program === 'git' && args.includes('clone')) throw Object.assign(new Error('fixture Git timeout'), { code: 'ETIMEDOUT', signal: 'SIGTERM' });
        return execute(program, args, options);
    };
    syncBuiltinESMExports();
    const executor = new RealExecutor(store, join(directory, 'runs'), profile);
    try {
        const result = await executor.start(task.id, 'git-timeout-request');
        assert.equal(result.run.state, 'interrupted');
        assert.equal(result.run.terminal_reason, 'preparation_resources_unknown');
        assert.equal(store.resourceLock().run_id, result.run.id);
        assert.throws(() => store.startRun(task.id, { execution_mode: 'mock', scenario: 'success', request_id: 'blocked-by-git-timeout' }), /资源/);
    } finally {
        childProcess.execFileSync = execute;
        syncBuiltinESMExports();
        await executor.close();
    }
});

test('preflight owner is durable before the first Git command and survives restart', async t => {
    const { default: childProcess } = await import('node:child_process');
    const { syncBuiltinESMExports } = await import('node:module');
    const { directory, store, task, profile } = fixture(t);
    const execute = childProcess.execFileSync;
    childProcess.execFileSync = (program, args, options) => {
        if (program === 'git') {
            assert.equal(store.resourceLock().request_id, 'preflight-timeout-request');
            throw Object.assign(new Error('fixture preflight timeout'), { code: 'ETIMEDOUT', signal: 'SIGTERM' });
        }
        return execute(program, args, options);
    };
    syncBuiltinESMExports();
    const executor = new RealExecutor(store, join(directory, 'runs'), profile);
    try {
        await assert.rejects(executor.start(task.id, 'preflight-timeout-request'), error => error.code === 'RESOURCE_HELD');
        assert.equal(store.listRuns().length, 0);
        assert.equal(store.resourceLock().task_id, task.id);
        assert.equal(store.resourceLock().run_id, null);
        const reopened = new Store(join(directory, 'state.sqlite'));
        try {
            reopened.recoverInterrupted();
            assert.equal(reopened.resourceLock().request_id, 'preflight-timeout-request');
            assert.throws(() => reopened.startRun(task.id, { execution_mode: 'mock', scenario: 'success', request_id: 'blocked-after-preflight' }), /资源/);
        } finally { reopened.close(); }
    } finally {
        childProcess.execFileSync = execute;
        syncBuiltinESMExports();
        await executor.close();
    }
});

test('post-Agent Git observation failure cannot release a safe Agent boundary lock', async t => {
    const { default: childProcess } = await import('node:child_process');
    const { syncBuiltinESMExports } = await import('node:module');
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const { createHash } = await import('node:crypto');
    const { directory, store, task, profile } = fixture(t);
    const spawn = childProcess.spawn;
    const execute = childProcess.execFileSync;
    const helper = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), pid: 12345, kill() {} });
    let helperClosed = false;
    helper.once('close', () => { helperClosed = true; });
    childProcess.spawn = () => helper;
    syncBuiltinESMExports();
    const executor = new RealExecutor(store, join(directory, 'runs'), { ...profile, helper_revision: 'fixture-helper' });
    try {
        const { run } = await executor.start(task.id, 'post-agent-git-timeout');
        const execution = run.input_snapshot.execution;
        const raw = Buffer.from(JSON.stringify({ schema: 'runtime-receipt-v0', root_pid: 23456, process_identity: 'fixture-identity', started_at: 'fixture', run_id: run.id, runtime_instance_id: execution.runtime_id, spawn_nonce: execution.spawn_nonce, helper_revision: execution.helper_revision, containment: { mechanism: 'job_object', boundary_id: `diagnostic:${run.id}` }, workspace: { canonical_path: execution.workspace_path, repository_identity: execution.repository_identity, workspace_id: run.id } }));
        writeFileSync(execution.receipt_path, JSON.stringify({schema:'runtime-receipt-store-v0',run_id:run.id,spawn_nonce:execution.spawn_nonce,raw_bytes:[...raw],sha256:createHash('sha256').update(raw).digest('hex')}));
        assert.equal(receiptMatches(run),true);
        const validEnvelope = readFileSync(execution.receipt_path,'utf8');
        writeFileSync(execution.receipt_path,JSON.stringify({...JSON.parse(validEnvelope),raw_bytes:raw.toString('utf8')}));
        assert.equal(receiptMatches(run),false);
        writeFileSync(execution.receipt_path,validEnvelope);
        assert.equal(receiptMatches(run),true);
        helper.stdout.write(JSON.stringify({kind:'started'})+'\n');
        helper.stdout.write(JSON.stringify({kind:'terminal',trigger:'natural',exit_code:0,resource_state:'safe',resource_lock:'releasable',stdout_drained:true,stderr_drained:true})+'\n');
        childProcess.execFileSync = () => { throw Object.assign(new Error('fixture post-Agent Git timeout'), {code:'ETIMEDOUT',signal:'SIGTERM'}); };
        syncBuiltinESMExports();
        helper.emit('close',0);
        await new Promise(resolve=>setImmediate(resolve));
        assert.equal(store.getRun(run.id).state,'interrupted');
        assert.equal(store.resourceLock().run_id,run.id);
        assert.equal(store.getExecutionFacts(run.id).resource_state,'unknown');
        assert.equal(store.getExecutionFacts(run.id).receipt_matches,true);
    } finally {
        childProcess.spawn = spawn;
        childProcess.execFileSync = execute;
        syncBuiltinESMExports();
        if (!helperClosed) helper.emit('close', null);
        await executor.close();
    }
});

test('v2 held Run owner migrates intact to the preparation-aware v3 lock', t => {
    const { directory, store, task } = fixture(t);
    const execution = {profile_id:'fixture',model:'fixture',base_revision:'a'.repeat(40),repository_identity:'fixture',source_path:task.repository_path,workspace_path:join(directory,'workspace'),receipt_path:join(directory,'receipt.json'),runtime_id:'runtime',spawn_nonce:'nonce',timeout_ms:1000};
    const {run} = store.startRealRun(task.id,'v2-held-request',execution);
    store.db.exec('DROP TABLE resource_lock; CREATE TABLE resource_lock(singleton INTEGER PRIMARY KEY CHECK(singleton=1),run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),facts_json TEXT NOT NULL CHECK(json_valid(facts_json))) STRICT;');
    store.db.prepare('INSERT INTO resource_lock VALUES(1,?,?)').run(run.id,JSON.stringify({resource_state:'unknown',resource_lock:'held',reason:'v2'}));
    store.db.exec('DROP TABLE review_decisions; DROP TABLE artifacts; DROP TABLE events; DROP TRIGGER review_transition; DROP TRIGGER completed_decision; DROP TRIGGER sealed_execution_facts_insert; DROP TRIGGER sealed_run_logs_insert; DROP TABLE stage_observations; DROP TABLE captured_versions; DROP TABLE verification_results; DROP TABLE stage_output; DROP TRIGGER immutable_execution_facts_update; DROP TRIGGER immutable_execution_facts_delete; DELETE FROM schema_migrations WHERE version>=3; PRAGMA user_version=2;');
    store.close();
    const reopened = new Store(join(directory,'state.sqlite'));
    try {
        assert.equal(reopened.schemaVersion(),6);
        assert.equal(reopened.resourceLock().run_id,run.id);
        assert.equal(reopened.resourceLock().request_id,null);
        assert.throws(()=>reopened.reservePreparation(task.id,'blocked-by-v2-lock'),/资源/);
    } finally {reopened.close();}
});


test('Agent budget is finite and frozen independently of Verification and later Task edits', async t => {
    const { directory, store, task, profile } = fixture(t);
    const executor = new RealExecutor(store, join(directory, 'runs'), profile);
    let launched;
    executor.launch = run => { launched = run; };
    try {
        const { run } = await executor.start(task.id, 'agent-budget-request', { verify: true, expected_task_revision: task.revision });
        assert.equal(launched.id, run.id);
        assert.equal(run.input_snapshot.execution.timeout_ms, 600000);
        assert.equal(run.input_snapshot.verification.verification_invocation_v0.timeout_ms, 60000);
        store.updateTask(task.id, { goal: 'next attempt', definition_of_done: task.definition_of_done, repository_path: task.repository_path, verification_draft: { command: 'NEXT_NOT_RUN', timeout_seconds: 1 } });
        const frozen = store.getRun(run.id).input_snapshot;
        assert.equal(frozen.execution.timeout_ms, 600000);
        assert.equal(frozen.verification.verification_invocation_v0.timeout_ms, 60000);
    } finally { await executor.close(); }
});
