import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestService } from '../../../tools/test-service.mjs';

// Actual process replacement (not just reopening a Store); fixture is API-only.
test('SIGKILL + real service restart preserves history, interrupts in-flight mock and rotates local session', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'workos-process-'));
  const fixture = 'apps/server/test/fixtures/service.mjs'; let service;
  try {
    service = await startTestService(directory, 0, fixture);
    const origin = service.origin; const port = Number(new URL(origin).port);
    const firstSession = await (await fetch(origin + '/api/session')).json();
    const headers = { Origin: origin, 'Content-Type': 'application/json', 'X-WorkOS-Session': firstSession.session_token };
    const input = { goal: 'Process restart fixture', definition_of_done: ['Retain all saved logs'], repository_path: '/never-opened', verification_draft: { command: 'NEVER_EXECUTE', timeout_seconds: 60 } };
    const task = await (await fetch(origin + '/api/tasks', { method: 'POST', headers, body: JSON.stringify(input) })).json();
    const request = { execution_mode: 'mock', scenario: 'success', request_id: 'process-restart-attempt' };
    const { run } = await (await fetch(`${origin}/api/tasks/${task.id}/runs`, { method: 'POST', headers, body: JSON.stringify(request) })).json();
    let saved;
    for (let i = 0; i < 100; i++) {
      saved = await (await fetch(`${origin}/api/runs/${run.id}/logs`)).json();
      if (saved.length >= 2) break;
      await new Promise(r => setTimeout(r, 10));
    }
    assert.ok(saved.length >= 2);
    await service.stop('SIGKILL');
    service = await startTestService(directory, port, fixture);
    const secondSession = await (await fetch(origin + '/api/session')).json();
    assert.notEqual(secondSession.session_token, firstSession.session_token);
    assert.equal((await fetch(origin + '/api/tasks', { method: 'POST', headers, body: JSON.stringify(input) })).status, 403);
    const recovered = await (await fetch(`${origin}/api/runs/${run.id}`)).json();
    assert.equal(recovered.state, 'interrupted'); assert.equal(recovered.terminal_reason, 'service_restart_no_resume');
    const logs = await (await fetch(`${origin}/api/runs/${run.id}/logs`)).json();
    assert.deepEqual(logs.slice(0, saved.length), saved);
    assert.equal(logs.filter(x => x.message.includes('service_restart_no_resume')).length, 1);
    headers['X-WorkOS-Session'] = secondSession.session_token;
    const replay = await (await fetch(`${origin}/api/tasks/${task.id}/runs`, { method: 'POST', headers, body: JSON.stringify(request) })).json();
    assert.equal(replay.replay, true); assert.equal(replay.run.id, run.id); assert.equal(replay.run.state, 'interrupted');
    await new Promise(r => setTimeout(r, 650));
    assert.deepEqual(await (await fetch(`${origin}/api/runs/${run.id}/logs`)).json(), logs);
    assert.equal((await (await fetch(`${origin}/api/tasks/${task.id}`)).json()).state, 'ready');
  } finally { await service?.stop(); rmSync(directory, { recursive: true, force: true }); }
});
