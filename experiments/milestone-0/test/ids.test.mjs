import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperimentRunId } from '../src/ids.mjs';

test('createExperimentRunId includes UTC timestamp and uuid suffix', () => {
  const id = createExperimentRunId(new Date('2026-08-31T08:00:01.234Z'), () => '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(id, 'm0-20260831T080001234Z-123e4567e89b12d3a456426614174000');
});

test('createExperimentRunId uses a fresh uuid per call', () => {
  const values = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
  const id1 = createExperimentRunId(new Date('2026-08-31T08:00:00Z'), () => values.shift());
  const id2 = createExperimentRunId(new Date('2026-08-31T08:00:00Z'), () => values.shift());
  assert.notEqual(id1, id2);
});
