import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codexInvocation } from '../dist/codex-adapter.js';
for (const model of ['success', 'failed', 'rpc-error', 'crash', 'approval', 'close-timeout', 'eof-worker', 'eof-output', 'malformed', 'invalid-notification']) {
  test('real AI SDK/provider JSON-RPC transport: ' + model, () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'workos-sdk-unit-'));
    const executable = fileURLToPath(new URL('./fixtures/codex-app-server.mjs', import.meta.url));
    const invocation = codexInvocation(cwd, 'literal fixture prompt', model, executable);
    const result = spawnSync(invocation.program, invocation.argv, { cwd, encoding: 'utf8', timeout: 20000, windowsHide: true });
    assert.equal(result.error, undefined);
    assert.equal(result.status, ['success', 'approval', 'eof-worker', 'eof-output'].includes(model) ? 0 : 1, result.stderr + result.stdout);
    const rpc = readFileSync(path.join(cwd, 'rpc.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.ok(rpc[0].argv.includes('hooks') && rpc[0].argv.includes('plugins'));
    assert.ok(rpc[0].argv.includes('notify=[]'));
    assert.ok(rpc[0].argv.includes('approval_policy="never"'));
    const start = rpc.find(message => message.method === 'thread/start').params;
    assert.equal(start.ephemeral, true);
    assert.equal(start.approvalPolicy, 'never');
    assert.equal(start.sandbox, 'workspace-write');
    assert.deepEqual(start.config.mcp_servers, { 'personal.server': { enabled: false }, disabled: { enabled: false } });
    const configIndex = rpc.findIndex(message => message.method === 'config/read');
    assert.ok(configIndex > 0 && configIndex < rpc.findIndex(message => message.method === 'thread/start'));
    assert.equal(rpc[configIndex].params.cwd, cwd);
    assert.equal(rpc.filter(message => message.method === 'turn/start').length, 1, 'no automatic retry');
    if (['success', 'eof-worker', 'eof-output'].includes(model)) {
      const events = result.stdout.trim().split('\n').map(JSON.parse);
      assert.ok(events.some(event => event.type === 'turn.started'));
      assert.ok(events.some(event => event.type === 'text-delta' && event.text === 'hello'));
      assert.ok(events.some(event => event.type === 'turn.completed' && event.status === 'completed'));
    }
    if (model === 'approval') assert.equal(JSON.parse(readFileSync(path.join(cwd, 'approval.json'), 'utf8')).decision, 'decline');
    if (model !== 'crash') assert.equal(readFileSync(path.join(cwd, 'closed.txt'), 'utf8'), 'stdin-drained', 'close must allow native shutdown on EOF');
    assert.throws(() => process.kill(rpc[0].pid, 0), { code: 'ESRCH' });
    if (model === 'eof-worker') {
      assert.equal(readFileSync(path.join(cwd, 'worker-stopped.txt'), 'utf8'), 'stop-requested-after-eof');
      assert.equal(readFileSync(path.join(cwd, 'worker-closed.txt'), 'utf8'), 'worker-exited-after-eof');
      const { pid } = JSON.parse(readFileSync(path.join(cwd, 'worker.json'), 'utf8'));
      assert.ok(Number.isInteger(pid) && pid > 0);
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }
    if (model === 'eof-output') {
      const flushed = JSON.parse(readFileSync(path.join(cwd, 'flushed.json'), 'utf8'));
      assert.ok(flushed.stdout > 256 * 1024);
      assert.ok(flushed.stderr > 256 * 1024);
    }
  });
}
test('invalid effective config prevents thread and turn creation', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'workos-sdk-unit-'));
  writeFileSync(path.join(cwd, 'invalid-config'), 'fixture');
  const invocation = codexInvocation(cwd, 'fixture', 'success', fileURLToPath(new URL('./fixtures/codex-app-server.mjs', import.meta.url)));
  const result = spawnSync(invocation.program, invocation.argv, { cwd, encoding: 'utf8', timeout: 20000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const rpc = readFileSync(path.join(cwd, 'rpc.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(rpc.some(message => message.method === 'config/read'));
  assert.ok(!rpc.some(message => ['thread/start', 'turn/start'].includes(message.method)));
  assert.equal(readFileSync(path.join(cwd, 'closed.txt'), 'utf8'), 'stdin-drained');
  assert.throws(() => process.kill(rpc[0].pid, 0), { code: 'ESRCH' });
});

test('AppServer nonzero exit after completed message cannot succeed under stdout backpressure', async t => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'workos-sdk-late-crash-'));
  const invocation = codexInvocation(cwd, 'fixture', 'late-crash', fileURLToPath(new URL('./fixtures/codex-app-server.mjs', import.meta.url)));
  const child = spawn(invocation.program, invocation.argv, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const closed = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code)); });
  const timeout = setTimeout(() => child.kill(), 15000);
  t.after(() => { clearTimeout(timeout); if (child.exitCode === null && child.signalCode === null) child.kill(); });
  const deadline = Date.now() + 10000;
  const marker = path.join(cwd, 'exiting.json');
  while (!existsSync(marker) && Date.now() < deadline) await delay(5);
  assert.ok(existsSync(marker), 'AppServer must flush completed before exiting');
  const exiting = JSON.parse(readFileSync(marker, 'utf8'));
  assert.equal(exiting.code, 7);
  let alive = true;
  while (alive && Date.now() < deadline) {
    try { process.kill(exiting.pid, 0); await delay(5); }
    catch (error) { assert.equal(error.code, 'ESRCH'); alive = false; }
  }
  assert.equal(alive, false);
  await delay(20);
  child.stdout.on('data', data => { stdout += data; });
  const code = await closed;
  assert.ok(stdout.split('\n').filter(Boolean).map(JSON.parse).some(event => event.type === 'turn.started'));
  assert.equal(code, 1, 'nonzero AppServer exit must override completed turn success: ' + stderr);
});
for (const model of ['unsafe-policy', 'active-mcp']) test(model + ' prevents a model turn', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'workos-sdk-unit-'));
  const invocation = codexInvocation(cwd, 'fixture', model, fileURLToPath(new URL('./fixtures/codex-app-server.mjs', import.meta.url)));
  const result = spawnSync(invocation.program, invocation.argv, { cwd, encoding: 'utf8', timeout: 20000, windowsHide: true });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  const rpc = readFileSync(path.join(cwd, 'rpc.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(rpc.some(message => message.method === 'thread/start'));
  assert.ok(!rpc.some(message => message.method === 'turn/start'));
  assert.throws(() => process.kill(rpc[0].pid, 0), { code: 'ESRCH' });
});
