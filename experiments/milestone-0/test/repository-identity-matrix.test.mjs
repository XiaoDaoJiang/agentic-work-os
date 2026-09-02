import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import {
  RI_CASE_IDS,
  reduceRepositoryIdentityVerdict,
  runRepositoryIdentityCaseRunners,
  runRepositoryIdentityMatrix
} from '../src/repository-identity-matrix.mjs';

test('matrix declares exactly RI-01 through RI-11', () => {
  assert.deepEqual(RI_CASE_IDS, Array.from({ length: 11 }, (_, index) => `RI-${String(index + 1).padStart(2, '0')}`));
});

test('overall verdict is strict conjunction with FAIL stronger than INCONCLUSIVE', () => {
  assert.equal(reduceRepositoryIdentityVerdict(RI_CASE_IDS.map((id) => ({ id, verdict: 'PASS' }))), 'PASS');
  assert.equal(reduceRepositoryIdentityVerdict(RI_CASE_IDS.map((id, index) => ({ id, verdict: index === 3 ? 'INCONCLUSIVE' : 'PASS' }))), 'INCONCLUSIVE');
  assert.equal(reduceRepositoryIdentityVerdict(RI_CASE_IDS.map((id, index) => ({ id, verdict: index === 3 ? 'INCONCLUSIVE' : index === 7 ? 'FAIL' : 'PASS' }))), 'FAIL');
});

test('case runner converts thrown case errors into FAIL without skipping later cases', async () => {
  const seen = [];
  const runners = Object.fromEntries(RI_CASE_IDS.map((id) => [id, async () => {
    seen.push(id);
    if (id === 'RI-04') throw new Error('boom');
    return { verdict: id === 'RI-02' ? 'INCONCLUSIVE' : 'PASS', details: { id } };
  }]));
  const results = await runRepositoryIdentityCaseRunners(runners);
  assert.deepEqual(seen, RI_CASE_IDS);
  assert.equal(results.find((item) => item.id === 'RI-04').verdict, 'FAIL');
  assert.match(results.find((item) => item.id === 'RI-04').reason, /boom/);
  assert.equal(results.at(-1).id, 'RI-11');
});

test('non-Windows matrix records RI-01..RI-10 as INCONCLUSIVE and still verifies RI-11', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'm0-ri-matrix-'));
  const result = await runRepositoryIdentityMatrix({ parent, experimentRunId: 'exp_test', platform: 'linux' });
  assert.equal(result.overallVerdict, 'INCONCLUSIVE');
  for (const row of result.cases.slice(0, 10)) {
    assert.equal(row.verdict, 'INCONCLUSIVE');
    assert.match(row.reason, /requires Windows/);
  }
  assert.equal(result.cases[10].id, 'RI-11');
  assert.equal(result.cases[10].verdict, 'PASS');
});
