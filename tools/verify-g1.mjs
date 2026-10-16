import assert from 'node:assert/strict';
import { spawn, spawnSync, fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexInvocation } from '../apps/server/dist/codex-adapter.js';
import { Store } from '../apps/server/dist/store.js';
import { assertBaseline, receiptMatches } from '../apps/server/dist/real-executor.js';
import { createApplication } from '../apps/server/dist/app.js';
import { executionIdentity, sha256File, g1Cases } from '../apps/server/dist/execution-profile.js';
import { verifyVerification } from './verify-verification.mjs';
import { verificationShell } from '../apps/server/dist/verification.js';
import { ensureRepositoryMarker } from '../experiments/milestone-0/src/repository-marker.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
assert.equal(process.platform, 'win32');
const executable = process.argv[2];
assert.ok(executable && path.isAbsolute(executable), 'supply explicit Codex exe');
const helper = path.join(root, 'experiments/milestone-0/native-runner/target/debug/diagnostic-runner.exe');
const directory = mkdtempSync(path.join(os.tmpdir(), 'workos-g1-'));
const evidence = path.join(root, 'verification-output/fmvp-03', path.basename(directory));
mkdirSync(evidence, { recursive: true });
const git = (cwd, args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const version = spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true });
assert.equal(version.status, 0);
writeFileSync(path.join(directory, '.g1-disposable-fixture'), 'diagnostic-only\n');
const diagnostic = { fixtureRoot: directory, profile: { executable, helper, helper_revision: sha256File(helper), model: 'gpt-6.1-sol', codex_version: version.stdout.trim(), evidence_path: '' } };
const cases = {};
const save = () => writeFileSync(path.join(evidence, 'progress.json'), JSON.stringify({ directory, cases }, null, 2));
const pass = name => { cases[name] = 'passed'; save(); console.log(`PASS ${name}`); };
async function eventually(fn, budget = 20000) { const end = Date.now() + budget; while (Date.now() < end) {
    const value = await fn();
    if (value)
        return value;
    await new Promise(r => setTimeout(r, 50));
} throw new Error('condition timeout'); }
function fixture(name) { const cwd = path.join(directory, name); mkdirSync(cwd); git(cwd, ['init']); writeFileSync(path.join(cwd, 'README.md'), 'Disposable G1 fixture\n'); writeFileSync(path.join(cwd, 'long-task.cjs'), `const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync('tool-started.json',JSON.stringify({pid:process.pid,child:child.pid}));setInterval(()=>{},1000);`); writeFileSync(path.join(cwd, 'finite-task.cjs'), `require('node:fs').writeFileSync('finite-started.txt','started');setTimeout(()=>console.log('finite-finished'),5000);`); git(cwd, ['add', '.']); git(cwd, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'baseline']); return cwd; }
const source = fixture('source');
const base = git(source, ['rev-parse', 'HEAD']);
const repository = await ensureRepositoryMarker(source);
async function native(name, { invalidConfig = false, timeout = 180000, cancel = false, race = false, prompt = 'Create marker.txt containing exactly g1-ok followed by a newline. Do not commit or access other directories.' } = {}) {
    const cwd = fixture(name);
    const id = randomUUID();
    const nonce = randomUUID();
    const receipt = path.join(evidence, `${name}.receipt.json`);
    const invocation = codexInvocation(cwd, prompt, 'gpt-6.1-sol');
    if (invalidConfig) invocation.argv.splice(invocation.argv.indexOf('--'), 0, '--config', 'model_provider="g1-fixture-missing-provider"');
    const req = path.join(evidence, `${name}.request.json`);
    writeFileSync(req, JSON.stringify({ start: { kind: 'start', protocol: 'local-runner-jsonl-v0', request_id: `start-${id}`, run_id: id, program: executable, argv: invocation.argv, cwd, env: { inheritance_policy: 'allowlist', inherit_names: invocation.inheritNames, overrides: {}, unset: [] }, timeout_ms: timeout }, runtime_id: randomUUID(), spawn_nonce: nonce, repository_identity: repository.repositoryIdentity, base_revision: git(cwd, ['rev-parse', 'HEAD']), helper_revision: git(root, ['rev-parse', 'HEAD']), receipt_path: receipt }));
    const child = spawn(helper, [req], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let pending = '';
    const events = [];
    let stderr = '';
    let sent = false;
    let output = '';
    child.stdin.on('error', () => { });
    child.stderr.on('data', chunk => stderr += chunk);
    const watchdog = setTimeout(() => child.kill(), timeout + 20000);
    const cancelTimer = cancel ? setInterval(() => { if (!sent && existsSync(path.join(cwd, 'tool-started.json'))) {
        sent = true;
        child.stdin.write('cancel\ncancel\n');
    } }, 50) : null;
    child.stdout.on('data', chunk => {
        pending += chunk;
        for (;;) {
            const end = pending.indexOf('\n');
            if (end < 0)
                break;
            const event = JSON.parse(pending.slice(0, end));
            pending = pending.slice(end + 1);
            events.push(event);
            if (event.kind === 'output')
                output += Buffer.from(event.bytes).toString();
            if (race && !sent && output.includes('turn.completed') && event.kind !== 'terminal') {
                sent = true;
                child.stdin.write('cancel\ncancel\n');
            }
        }
    });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    clearTimeout(watchdog);
    if (cancelTimer)
        clearInterval(cancelTimer);
    child.stdin.destroy();
    writeFileSync(path.join(evidence, `${name}.events.json`), JSON.stringify({ code, events, stderr }, null, 2));
    assert.equal(code, 0);
    const terminals = events.filter(event => event.kind === 'terminal');
    assert.equal(terminals.length, 1);
    const terminal = terminals[0];
    assert.equal(terminal.resource_state, 'safe');
    assert.equal(terminal.stdout_drained, true);
    assert.equal(terminal.stderr_drained, true);
    if (race)
        assert.ok(sent, 'cancel raced after turn completion but before helper terminal');
    if (cancel) {
        assert.ok(sent, 'actual tool child started before cancellation');
        assert.equal(terminal.trigger, 'cancel');
    }
    if (cancel || name === 'timeout') {
        assert.ok(existsSync(path.join(cwd, 'tool-started.json')), 'actual shell tool and child must start');
        const pids = JSON.parse(readFileSync(path.join(cwd, 'tool-started.json'), 'utf8'));
        for (const pid of [pids.pid, pids.child])
            await eventually(() => { try {
                process.kill(pid, 0);
                return false;
            }
            catch (error) {
                if (error.code === 'ESRCH')
                    return true;
                throw error;
            } });
        writeFileSync(path.join(evidence, `${name}.process-proof.json`), JSON.stringify({ pids, stopped: true, terminal }, null, 2));
    }
    return { cwd, terminal, events };
}
console.log(JSON.stringify({ evidence, directory, node: process.version, codex: version.stdout.trim() }));
try {
    const normal = await native('normal');
    assert.equal(normal.terminal.exit_code, 0);
    assert.equal(readFileSync(path.join(normal.cwd, 'marker.txt'), 'utf8'), 'g1-ok\n');
    pass('normal');
    const bad = await native('nonzero', { invalidConfig: true });
    assert.notEqual(bad.terminal.exit_code, 0);
    pass('nonzero');
    await native('cancel', { cancel: true, prompt: 'Run node long-task.cjs in this repository using the shell tool and wait for it. Do not access other directories.' });
    pass('cancel');
    const timed = await native('timeout', { timeout: 60000, prompt: 'Run node long-task.cjs in this repository using the shell tool and wait for it. Do not access other directories.' });
    assert.equal(timed.terminal.trigger, 'timeout');
    pass('timeout');
    const raced = await native('exit-race', { race: true });
    assert.ok(['natural', 'cancel'].includes(raced.terminal.trigger));
    pass('exit-race');
    writeFileSync(path.join(source, 'drift.txt'), 'drift');
    assert.throws(() => assertBaseline(source, base), /漂移/);
    const clean = fixture('baseline');
    const frozen = git(clean, ['rev-parse', 'HEAD']);
    writeFileSync(path.join(clean, 'workspace-drift.txt'), 'drift');
    assert.throws(() => assertBaseline(clean, frozen), /漂移/);
    async function client(origin) {
        const session = await (await fetch(origin + '/api/session')).json();
        const get = async (url) => (await fetch(origin + url)).json();
        const call = async (url, body, headers = {}) => { const response = await fetch(origin + url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-WorkOS-Session': session.session_token, ...headers }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
        const task = async (name, goal = 'Run node long-task.cjs using the shell tool and wait for it.') => (await call('/api/tasks', { goal, definition_of_done: ['fixture only'], repository_path: fixture(name), verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } })).body;
        const start = async (task) => (await call(`/api/tasks/${task.id}/runs`, { execution_mode: 'real', request_id: randomUUID() })).body.run;
        const turn = async (run) => eventually(async () => (await get(`/api/runs/${run.id}/logs`)).some(log => log.message.includes('turn.started')), 45000);
        return { get, call, task, start, turn };
    }
    for (const kind of ['owner-crash', 'helper-crash']) {
        const data = path.join(directory, kind);
        mkdirSync(data);
        const owner = fork(path.join(root, 'tools/g1-owner.mjs'), [data, executable, helper, directory], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
        let origin;
        owner.on('message', value => { origin = value.origin; });
        await eventually(() => origin);
        const c = await client(origin);
        const task = await c.task(`${kind}-source`);
        const run = await c.start(task);
        assert.ok(run);
        await c.turn(run);
        const lock = await c.get('/api/resource-lock');
        assert.ok(lock.facts.helper_pid);
        if (kind === 'owner-crash') {
            const exit = new Promise(r => owner.once('exit', r));
            owner.kill();
            await exit;
        }
        else {
            process.kill(lock.facts.helper_pid);
            await eventually(async () => (await c.get(`/api/runs/${run.id}`)).state === 'interrupted');
            const exit = new Promise(r => owner.once('exit', r));
            owner.send('close');
            await exit;
        }
        const restarted = await createApplication({ databasePath: path.join(data, 'state.sqlite'), port: 0, diagnostic });
        try {
            const r = await client(restarted.origin);
            assert.equal((await r.get(`/api/runs/${run.id}`)).state, 'interrupted');
            assert.ok(await r.get('/api/resource-lock'));
            for (const request of [{ execution_mode: 'mock', scenario: 'success', request_id: 'blocked-mock-after-crash' }, { execution_mode: 'real', request_id: 'blocked-real-after-crash' }]) {
                const result = await r.call(`/api/tasks/${task.id}/runs`, request);
                assert.equal(result.status, 409);
                assert.equal(result.body.code, 'RESOURCE_HELD');
            }
            writeFileSync(path.join(evidence, `${kind}.json`), JSON.stringify({ state: await r.get(`/api/runs/${run.id}`), lock: await r.get('/api/resource-lock'), restart: 'blocked' }, null, 2));
        }
        finally {
            await restarted.close();
        }
        pass(kind);
    }
    pass('restart-lock');
    const driftApp = await createApplication({ databasePath: path.join(directory, 'source-drift.sqlite'), port: 0, diagnostic });
    try {
        const c = await client(driftApp.origin);
        const task = await c.task('running-drift-source', 'Use a shell command to wait for 5 seconds, then create drift-marker.txt with content ok.');
        const run = await c.start(task);
        await c.turn(run);
        writeFileSync(path.join(task.repository_path, 'external.txt'), 'outside change');
        await eventually(() => driftApp.store.getRun(run.id).state !== 'running', 200000);
        assert.equal(driftApp.store.getRun(run.id).state, 'failed');
        assert.equal(driftApp.store.getExecutionFacts(run.id).drift, true);
        assert.equal(driftApp.store.resourceLock(), null);
        pass('source-drift');
    }
    finally {
        await driftApp.close();
    }
    const workspaceApp = await createApplication({ databasePath: path.join(directory, 'workspace-drift.sqlite'), port: 0, diagnostic });
    try {
        const c = await client(workspaceApp.origin);
        const task = await c.task('running-workspace-source', 'Run node finite-task.cjs using the shell tool and wait for it, then report completion. Do not commit.');
        const run = await c.start(task);
        await eventually(() => existsSync(path.join(run.input_snapshot.execution.workspace_path, 'finite-started.txt')), 45000);
        git(run.input_snapshot.execution.workspace_path, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'external head drift']);
        await eventually(() => workspaceApp.store.getRun(run.id).state !== 'running', 200000);
        assert.equal(workspaceApp.store.getRun(run.id).state, 'failed');
        assert.equal(workspaceApp.store.getRun(run.id).terminal_reason, 'workspace_drift');
        assert.equal(workspaceApp.store.getExecutionFacts(run.id).drift, true);
        assert.equal(workspaceApp.store.resourceLock(), null);
        pass('workspace-drift');
    }
    finally {
        await workspaceApp.close();
    }
    const receiptApp = await createApplication({ databasePath: path.join(directory, 'receipt.sqlite'), port: 0, diagnostic });
    try {
        const c = await client(receiptApp.origin);
        const task = await c.task('receipt-source');
        const run = await c.start(task);
        await c.turn(run);
        assert.equal(receiptMatches(run), true);
        writeFileSync(run.input_snapshot.execution.receipt_path, '{}');
        assert.equal(receiptMatches(run), false);
        unlinkSync(run.input_snapshot.execution.receipt_path);
        await c.call(`/api/runs/${run.id}/cancel`, {});
        await eventually(() => receiptApp.store.getRun(run.id).state !== 'running');
        assert.equal(receiptApp.store.getRun(run.id).state, 'interrupted');
        assert.ok(receiptApp.store.resourceLock());
        pass('receipt-integrity');
    }
    finally {
        await receiptApp.close();
    }
    const unit = spawnSync(process.execPath, ['--test', 'apps/server/test/real-execution.test.mjs', 'apps/server/test/real-preflight.test.mjs', 'apps/server/test/api.test.mjs'], { cwd: root, encoding: 'utf8', windowsHide: true });
    writeFileSync(path.join(evidence, 'unit-tests.txt'), unit.stdout + unit.stderr);
    assert.equal(unit.status, 0);
    pass('idempotency');
    pass('request-protection');
    pass('preparation-lock');
    pass('post-run-git-failure');
    const app = await createApplication({ databasePath: path.join(directory, 'http.sqlite'), port: 0, diagnostic });
    try {
        const session = await (await fetch(app.origin + '/api/session')).json();
        assert.equal(session.real_execution, true);
        assert.equal(session.g1, 'diagnostic_not_passed');
        const call = async (url, body) => { const response = await fetch(app.origin + url, { method: 'POST', headers: { Origin: app.origin, 'Content-Type': 'application/json', 'X-WorkOS-Session': session.session_token }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
        const task = (await call('/api/tasks', { goal: 'Create http-marker.txt containing exactly http-ok followed by a newline. Do not commit.', definition_of_done: ['fixture only'], repository_path: fixture('http-source'), verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } })).body;
        const request = { execution_mode: 'real', request_id: 'http-normal-request' };
        const first = await call(`/api/tasks/${task.id}/runs`, request);
        assert.equal(first.status, 201);
        assert.equal((await call(`/api/tasks/${task.id}/runs`, request)).body.run.id, first.body.run.id);
        await eventually(() => app.store.getRun(first.body.run.id).state !== 'running', 200000);
        assert.equal(app.store.getRun(first.body.run.id).state, 'succeeded');
        assert.equal(app.store.getRun(first.body.run.id).phase, 'agent');
        assert.equal(app.store.resourceLock(), null);
        assert.equal(readFileSync(path.join(first.body.run.input_snapshot.execution.workspace_path, 'http-marker.txt'), 'utf8'), 'http-ok\n');
        const cancelTask = (await call('/api/tasks', { goal: 'Run node long-task.cjs using the shell tool and wait for it.', definition_of_done: ['fixture only'], repository_path: fixture('http-cancel-source'), verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } })).body;
        const started = await call(`/api/tasks/${cancelTask.id}/runs`, { execution_mode: 'real', request_id: 'http-cancel-request' });
        assert.equal(started.status, 201);
        await eventually(() => existsSync(path.join(started.body.run.input_snapshot.execution.workspace_path, 'tool-started.json')), 45000);
        await Promise.all([call(`/api/runs/${started.body.run.id}/cancel`, {}), call(`/api/runs/${started.body.run.id}/cancel`, {})]);
        await eventually(() => app.store.getRun(started.body.run.id).state !== 'running');
        assert.equal(app.store.getRun(started.body.run.id).state, 'cancelled');
        assert.equal(app.store.resourceLock(), null);
        writeFileSync(path.join(evidence, 'http-results.json'), JSON.stringify({ normal: 'passed', duplicate_start: 'passed', duplicate_cancel: 'passed', agent_phase: 'passed', no_delivery: 'passed' }, null, 2));
    }
    finally {
        await app.close();
    }
    await verifyVerification({helper,evidence:path.join(evidence,'verification-native')});
    pass('verification-boundary');
    pass('capture-consistency');
    const verificationApp=await createApplication({databasePath:path.join(directory,'verification-http.sqlite'),port:0,diagnostic});
    try {
      const session=await (await fetch(verificationApp.origin+'/api/session')).json();
      const post=async(url,value)=>{const response=await fetch(verificationApp.origin+url,{method:'POST',headers:{Origin:verificationApp.origin,'Content-Type':'application/json','X-WorkOS-Session':session.session_token},body:JSON.stringify(value)});return {status:response.status,body:await response.json()};};
      const task=(await post('/api/tasks',{goal:'Create verified-marker.txt containing exactly verified followed by a newline. Do not commit or run tests.',definition_of_done:['fixture'],repository_path:fixture('verified-source'),verification_draft:{command:`node -e "require('node:assert/strict').equal(require('node:fs').readFileSync('verified-marker.txt','utf8'),'verified\\n');console.log('verification-ok')"`,timeout_seconds:20}})).body;
      assert.equal((await post(`/api/tasks/${task.id}/runs`,{execution_mode:'real',request_id:'missing-revision',verify:true})).status,400);
      assert.equal((await post(`/api/tasks/${task.id}/runs`,{execution_mode:'real',request_id:'stale-revision',verify:true,expected_task_revision:2})).status,409);
      const request={execution_mode:'real',request_id:'verified-real-http',verify:true,expected_task_revision:task.revision};
      const started=await post(`/api/tasks/${task.id}/runs`,request);assert.equal(started.status,201);
      assert.equal((await post(`/api/tasks/${task.id}/runs`,request)).body.run.id,started.body.run.id);
      assert.equal((await post(`/api/tasks/${task.id}/runs`,{execution_mode:'real',request_id:request.request_id})).status,409);
      await eventually(()=>verificationApp.store.getRun(started.body.run.id).state!=='running',240000);
      const run=verificationApp.store.getRun(started.body.run.id);const proof=verificationApp.store.getRunEvidence(run.id);
      writeFileSync(path.join(evidence,'verification-http.json'),JSON.stringify({run,proof},null,2));
      assert.equal(run.state,'succeeded');assert.equal(run.phase,'test');assert.equal(proof.verification.outcome,'passed');assert.equal(proof.verification.version_match,'match');assert.equal(proof.stages.length,4);assert.equal(verificationApp.store.resourceLock(),null);assert.equal(session.accept,false);assert.equal(session.accepted_delivery,false);
      pass('verification-pipeline');
    } finally {await verificationApp.close();}
    const manifest = { verification_shell: verificationShell(), verification_shell_sha256: sha256File(verificationShell()), schema: 'fmvp-g1-v1', activation: 'passed', profile: 'windows-processkit-codex-exec', platform: `${process.platform}/${process.arch}`, node: process.version, os_release: os.release(), model: 'gpt-6.1-sol', code_sha: git(root, ['rev-parse', 'HEAD']), sources: executionIdentity(), executable, codex_version: version.stdout.trim(), executable_sha256: sha256File(executable), helper, helper_sha256: sha256File(helper), cases, versions: { git: spawnSync('git', ['--version'], { encoding: 'utf8' }).stdout.trim(), rust: spawnSync('rustc', ['--version'], { encoding: 'utf8' }).stdout.trim() } };
    const manifestPath = path.join(evidence, 'g1.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    assert.ok(g1Cases.every(name => cases[name] === 'passed'));
    console.log(JSON.stringify({ g1: 'passed_current_profile', manifest: manifestPath }));
}
catch (error) {
    writeFileSync(path.join(evidence, 'failure.txt'), String(error.stack));
    console.error(error);
    process.exitCode = 1;
}
