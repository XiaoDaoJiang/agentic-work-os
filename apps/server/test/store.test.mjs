import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../dist/store.js';

const input = {
  goal: 'Fix the fixture only', definition_of_done: ['A test documents the behavior'],
  repository_path: '/not-opened/fixture',
  verification_draft: { command: 'DO_NOT_EXECUTE_VERIFICATION', timeout_seconds: 60 },
};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'workos-store-'));
  const stores = [];
  const open = () => { const s = new Store(join(dir, 'test.sqlite')); stores.push(s); return s; };
  t.after(() => { for (const s of stores) s.close(); rmSync(dir, { recursive: true, force: true }); });
  return { open, dir };
}

test('Task/Run stable independent IDs, immutable complete snapshots and persistent history', t => {
  const { open } = fixture(t); const store = open();
  const task = store.createTask(input);
  assert.match(task.id, /^task_/);
  const { run } = store.startRun(task.id, { execution_mode: 'mock', scenario: 'success', request_id: 'request-one' });
  assert.match(run.id, /^run_/); assert.notEqual(task.id, run.id);
  assert.deepEqual(run.input_snapshot.task, task);
  store.updateTask(task.id, { ...input, goal: 'Changed after start' });
  assert.equal(store.getRun(run.id).input_snapshot.task.goal, input.goal);
  assert.throws(() => store.db.prepare('UPDATE runs SET input_snapshot = ? WHERE id = ?').run('{}', run.id), /immutable/);
  store.finishRun(run.id, 'succeeded', 'complete', 'mock_success');
  assert.equal(store.getTask(task.id).state, 'ready');
  const history = store.getLogs(run.id); assert.ok(history.length >= 2);
  store.close(); const reopened = open();
  assert.equal(reopened.getTask(task.id).id, task.id);
  assert.equal(reopened.getRun(run.id).input_snapshot.task.goal, input.goal);
  assert.deepEqual(reopened.getLogs(run.id), history);
  assert.ok(history.every(log => log.execution_mode === 'mock' && log.message.startsWith('[mock]')));
});

test('database singleton + persistent idempotency, conflicting replay and new attempt', t => {
  const { open } = fixture(t); const a = open(); const b = open();
  const task = a.createTask(input);
  const req = { execution_mode: 'mock', scenario: 'failure', request_id: 'request-two' };
  const first = a.startRun(task.id, req);
  assert.equal(b.startRun(task.id, req).run.id, first.run.id);
  assert.throws(() => b.startRun(task.id, { ...req, request_id: 'competitor' }), /active/i);
  assert.throws(() => b.startRun(task.id, { ...req, scenario: 'success' }), /idempotency/i);
  a.finishRun(first.run.id, 'failed', 'agent', 'mock_failure');
  assert.equal(b.startRun(task.id, req).run.id, first.run.id);
  const next = b.startRun(task.id, { ...req, request_id: 'next-attempt' });
  assert.notEqual(next.run.id, first.run.id);
  assert.equal(a.listRuns(task.id).length, 2);
});

test('recovery is explicit interrupted, idempotent and does not manufacture success', t => {
  const { open } = fixture(t); const s = open();
  const task = s.createTask(input);
  const { run } = s.startRun(task.id, { execution_mode: 'mock', scenario: 'success', request_id: 'interrupted' });
  s.appendProgress(run.id, 'agent', 'saved before restart');
  s.close(); const r = open();
  assert.equal(r.recoverInterrupted(), 1); assert.equal(r.recoverInterrupted(), 0);
  assert.equal(r.getRun(run.id).state, 'interrupted');
  assert.equal(r.getRun(run.id).terminal_reason, 'service_restart_no_resume');
  assert.equal(r.getTask(task.id).state, 'ready');
  assert.ok(r.getLogs(run.id).some(x => x.message.includes('saved before restart')));
  assert.ok(!r.getLogs(run.id).some(x => x.message.includes('mock_success')));
  assert.equal(r.appendProgress(run.id, 'complete', 'late output'), false);
});

test('migration is versioned/idempotent; newer schema fails closed; logs append-only', t => {
  const { open } = fixture(t); const s = open();
  assert.equal(s.schemaVersion(), 1);
  const task = s.createTask(input);
  const { run } = s.startRun(task.id, { execution_mode: 'mock', scenario: 'cancel', request_id: 'migration-test' });
  assert.throws(() => s.db.prepare('DELETE FROM run_logs WHERE run_id = ?').run(run.id), /append-only/);
  s.close(); const r = open(); assert.equal(r.schemaVersion(), 1);
  r.db.exec('PRAGMA user_version = 999'); r.close();
  assert.throws(open, /newer schema/i);
});
