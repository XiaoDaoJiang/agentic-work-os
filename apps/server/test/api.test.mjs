import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { request as httpRequest } from 'node:http';
import { createApplication } from '../dist/app.js';
import { parseTaskInput, parseStartInput } from '../dist/contracts.js';

const valid = { goal: 'A fixture task', definition_of_done: ['Observable outcome'], repository_path: 'C:\\disposable\\not-opened', verification_draft: { command: 'DO_NOT_RUN', timeout_seconds: 60 } };
async function setup(t, intervalMs = 25) {
  const dir = mkdtempSync(join(tmpdir(), 'workos-api-'));
  const databasePath = join(dir, 'test.sqlite');
  const app = await createApplication({ databasePath, port: 0, intervalMs });
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const { session_token } = await (await fetch(`${app.origin}/api/session`)).json();
  const headers = { Origin: app.origin, 'X-WorkOS-Session': session_token, 'Content-Type': 'application/json' };
  async function request(path, method = 'GET', value, custom = {}) {
    // Raw HTTP is intentional: fetch can replace forbidden Host/Fetch Metadata headers.
    return new Promise((resolve, reject) => {
      const req = httpRequest(app.origin + path, { method, headers: { ...headers, ...custom } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          try { resolve({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()), response }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.end(value === undefined ? undefined : JSON.stringify(value));
    });
  }
  const create = async (input = valid) => (await request('/api/tasks', 'POST', input)).data;
  const start = async (id, scenario = 'success', request_id = randomUUID()) => request(`/api/tasks/${id}/runs`, 'POST', { execution_mode: 'mock', scenario, request_id });
  return { app, databasePath, dir, headers, request, create, start };
}
async function eventually(fn) {
  const end = Date.now() + 5000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r, 10)); }
  assert.fail('Expected condition did not become true within 5 seconds');
}

test('all required input fields and invalid payload shapes are rejected explicitly', () => {
  for (const key of Object.keys(valid)) {
    const missing = { ...valid }; delete missing[key];
    assert.throws(() => parseTaskInput(missing), e => e.status === 400 && Object.keys(e.fields).some(k => k.startsWith(key)));
  }
  for (const value of [null, [], {}, { ...valid, goal: '  ' }, { ...valid, definition_of_done: [''] },
    { ...valid, repository_path: '../relative' }, { ...valid, repository_path: '/bad\npath' },
    { ...valid, verification_draft: { command: 'echo hello', timeout_seconds: Infinity } },
    { ...valid, state: 'done' }]) assert.throws(() => parseTaskInput(value), /输入/);
  assert.equal(parseTaskInput(valid).repository_path, valid.repository_path);
  assert.equal(parseTaskInput({ ...valid, repository_path: '/tmp/never-read' }).repository_path, '/tmp/never-read');
  assert.throws(() => parseStartInput({ execution_mode: 'mock', scenario: ['success'], request_id: 'valid-request' }));
});

test('server returns field errors; Task edit is persisted without mutating Run input', async t => {
  const { create, start, request } = await setup(t, 500);
  const invalid = await request('/api/tasks', 'POST', {});
  assert.equal(invalid.status, 400); assert.ok(invalid.data.fields.goal);
  const task = await create(); const first = await start(task.id);
  assert.equal(first.status, 201);
  const edited = await request(`/api/tasks/${task.id}`, 'PATCH', { ...valid, goal: 'Updated task' });
  assert.equal(edited.data.revision, 2);
  assert.equal((await request(`/api/runs/${first.data.run.id}`)).data.input_snapshot.task.goal, valid.goal);
  assert.equal((await request(`/api/tasks/${task.id}`)).data.goal, 'Updated task');
});

test('parallel requests: exactly one active Run; same-key retry and cross-task conflict', async t => {
  const { create, start, request } = await setup(t, 1000);
  const first = await create(); const second = await create({ ...valid, goal: 'Other task' });
  const results = await Promise.all(Array.from({ length: 16 }, () => start(first.id)));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409 && r.data.code === 'ACTIVE_RUN').length, 15);
  assert.equal((await start(second.id)).status, 409);
  const active = (await request('/api/runs')).data[0];
  await request(`/api/runs/${active.id}/cancel`, 'POST', {});
  const key = randomUUID();
  const replay = await Promise.all(Array.from({ length: 8 }, () => start(first.id, 'success', key)));
  assert.equal(new Set(replay.map(r => r.data.run.id)).size, 1);
  assert.equal(replay.filter(r => r.status === 201).length, 1);
  assert.equal((await start(second.id, 'success', key)).data.code, 'IDEMPOTENCY_CONFLICT');
});

for (const [scenario, state] of [['success', 'succeeded'], ['failure', 'failed'], ['cancel', 'cancelled']]) {
  test(`deterministic ${scenario}: logs arrive progressively, persist, and never mark Task done`, async t => {
    const { app, databasePath, request, create, start, dir } = await setup(t, 50);
    const marker = join(dir, 'verification-must-not-run');
    const task = await create({ ...valid, verification_draft: { command: `node -e "require('fs').writeFileSync('${marker}','BAD')"`, timeout_seconds: 60 } });
    const { data: { run } } = await start(task.id, scenario);
    const initial = (await request(`/api/runs/${run.id}/logs`)).data;
    const during = await eventually(async () => {
      const current = (await request(`/api/runs/${run.id}`)).data;
      const logs = (await request(`/api/runs/${run.id}/logs`)).data;
      return current.state === 'running' && logs.length > initial.length && logs;
    });
    assert.ok(during.length > initial.length);
    await eventually(async () => (await request(`/api/runs/${run.id}`)).data.state === state);
    const logs = (await request(`/api/runs/${run.id}/logs`)).data;
    assert.ok(logs.every(x => x.execution_mode === 'mock'));
    assert.deepEqual(logs.map(x => x.sequence), logs.map((_, i) => i + 1));
    assert.equal((await request(`/api/tasks/${task.id}`)).data.state, 'ready');
    assert.equal(existsSync(marker), false);
    await app.close();
    const reopened = await createApplication({ databasePath, port: 0, intervalMs: 25 });
    try {
      const history = await (await fetch(`${reopened.origin}/api/runs/${run.id}/logs`)).json();
      assert.deepEqual(history, logs);
      assert.equal((await (await fetch(`${reopened.origin}/api/runs/${run.id}`)).json()).state, state);
    } finally { await reopened.close(); }
  });
}

test('explicit Cancel is terminal/idempotent: no late logs, no second terminal', async t => {
  const { request, create, start } = await setup(t, 30);
  const task = await create(); const { data: { run } } = await start(task.id);
  await eventually(async () => (await request(`/api/runs/${run.id}/logs`)).data.length > 1);
  const decisions = await Promise.all(Array.from({ length: 10 }, () => request(`/api/runs/${run.id}/cancel`, 'POST', {})));
  assert.ok(decisions.every(x => x.data.state === 'cancelled'));
  const saved = (await request(`/api/runs/${run.id}/logs`)).data;
  await new Promise(r => setTimeout(r, 220));
  assert.deepEqual((await request(`/api/runs/${run.id}/logs`)).data, saved);
  assert.equal(saved.filter(x => x.message.includes('mock_user_cancel')).length, 1);
  assert.equal((await start(task.id)).status, 201);
});

test('local protection: host, origin, session, Fetch Metadata, JSON and real capability barriers', async t => {
  const { app, request, create, start } = await setup(t);
  assert.equal(app.server.address().address, '127.0.0.1');
  for (const custom of [ { Origin: 'https://attacker.example' }, { Origin: 'null' },
    { Origin: '' }, { 'X-WorkOS-Session': '' }, { 'X-WorkOS-Session': 'wrong' },
    { Host: 'attacker.example' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Content-Type': 'text/plain' } ]) {
    const result = await request('/api/tasks', 'POST', valid, custom);
    assert.ok([403, 415].includes(result.status), JSON.stringify(custom));
  }
  assert.equal((await request('/api/session', 'GET', undefined, { Origin: 'https://attacker.example' })).status, 403);
  const task = await create();
  assert.equal((await request(`/api/tasks/${task.id}/runs`, 'POST', { execution_mode: 'real', scenario: 'success', request_id: randomUUID() })).status, 403);
  for (const path of ['/api/runs/real', '/api/runs/any/accept', '/api/runs/any/delivery', '/api/accepted-deliveries', '/api/verification']) {
    const result = await request(path, 'POST', {});
    assert.equal(result.status, 403, path); assert.equal(result.data.code, 'CAPABILITY_DISABLED');
  }
  const capabilities = (await request('/api/capabilities')).data;
  for (const key of ['real_execution', 'verification_execution', 'accept', 'accepted_delivery']) assert.equal(capabilities[key], false);
  assert.equal((await request('/api/tasks')).data.length, 1);
  assert.equal((await request('/api/runs')).data.length, 0);
  assert.equal((await start(task.id)).status, 201);
});

test('malformed/oversized JSON, unknown API/static paths and log cursors are rejected', async t => {
  const { app, headers, request, create, start } = await setup(t);
  const malformed = await fetch(app.origin + '/api/tasks', { method: 'POST', headers, body: '{broken' });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/api/tasks', 'POST', { ...valid, goal: 'x'.repeat(40000) })).status, 413);
  assert.equal((await request('/api/not-here')).status, 404);
  assert.equal((await fetch(app.origin + '/AGENTS.md')).status, 404);
  const task = await create(); const { data: { run } } = await start(task.id);
  assert.equal((await request(`/api/runs/${run.id}/logs?after=-1`)).status, 400);
  const logs = (await request(`/api/runs/${run.id}/logs`)).data;
  assert.equal((await request(`/api/runs/${run.id}/logs?after=${logs.at(-1).sequence}`)).data.length, 0);
});

test('second service sharing the DB cannot interrupt a live mock; port failure releases mutex', async t => {
  const { app, databasePath, dir, request, create, start } = await setup(t, 1000);
  const task = await create(); const { data: { run } } = await start(task.id);
  await assert.rejects(createApplication({ databasePath, port: 0 }), /DATABASE_IN_USE/);
  assert.equal((await request(`/api/runs/${run.id}`)).data.state, 'running');
  const otherDb = join(dir, 'other.sqlite');
  await assert.rejects(createApplication({ databasePath: otherDb, port: app.server.address().port }), /EADDRINUSE/);
  const other = await createApplication({ databasePath: otherDb, port: 0 }); await other.close();
});

test('product sources have no process launch, real CLI adapter or shell execution import', () => {
  const source = readdirSync(new URL('../src/', import.meta.url)).filter(n => n.endsWith('.ts'))
    .map(n => readFileSync(new URL(`../src/${n}`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(source, /(?:node:)?child_process|worker_threads|\beval\s*\(|new Function\b|import\s*\(/);
  assert.doesNotMatch(source, /\.codex|auth\.json|process\.env\.(?:HOME|USERPROFILE|OPENAI_API_KEY)/);
});
