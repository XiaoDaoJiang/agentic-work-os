import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../dist/store.js';
import { RealExecutor, assertBaseline } from '../dist/real-executor.js';
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
    old.close();
    const store = new Store(file);
    try {
        assert.equal(store.schemaVersion(), 2);
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
    const manifest = { schema: 'fmvp-g1-v1', activation: 'passed', profile: 'windows-processkit-codex-exec', platform: 'win32/x64', node: process.version, os_release: release(), model: 'gpt-6.1-sol', code_sha: 'a'.repeat(40), sources, executable: process.execPath, helper: process.execPath, executable_sha256: sha256File(process.execPath), helper_sha256: sha256File(process.execPath), codex_version: 'fixture', cases: Object.fromEntries(g1Cases.map(name => [name, 'passed'])) };
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
    const manifest = { schema: 'fmvp-g1-v1', activation: 'passed', profile: 'windows-processkit-codex-exec', platform: 'win32/x64', node: process.version, os_release: release(), model: 'gpt-6.1-sol', code_sha: 'a'.repeat(40), sources, executable: process.execPath, helper: process.execPath, executable_sha256: sha256File(process.execPath), helper_sha256: sha256File(process.execPath), codex_version: 'fixture', cases: Object.fromEntries(g1Cases.map(name => [name, 'passed'])) };
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
