import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedTrustedLocalAck, renderTrustedLocalPrompt, verifyTrustedLocalAck } from '../src/trusted-local.mjs';

test('trusted-local prompt renders source, workspace and experiment id', () => {
  const text = renderTrustedLocalPrompt({ sourceRepository: 'C:/repo', assignedWorkspace: 'C:/tmp/work space', experimentRunId: 'm0-123' });
  assert.match(text, /Source repository: C:\/repo/);
  assert.match(text, /Assigned Workspace: C:\/tmp\/work space/);
  assert.match(text, /Experiment: m0-123/);
  assert.match(text, /ACK-TRUSTED-LOCAL:m0-123/);
});

test('trusted-local acknowledgement requires exact run-bound value', () => {
  assert.equal(expectedTrustedLocalAck('m0-123'), 'ACK-TRUSTED-LOCAL:m0-123');
  assert.equal(verifyTrustedLocalAck('m0-123', 'ACK-TRUSTED-LOCAL:m0-123\n'), true);
  assert.equal(verifyTrustedLocalAck('m0-123', 'ACK-TRUSTED-LOCAL:m0-999'), false);
  assert.equal(verifyTrustedLocalAck('m0-123', 'yes'), false);
});
