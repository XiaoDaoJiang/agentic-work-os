import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRepositoryIdentityVector, verifyCanonicalRepositoryIdentityVector } from '../src/repository-identity.mjs';

test('RI-11 canonical vector matches frozen plan', () => {
  const result = computeRepositoryIdentityVector('0123456789abcdef', '000102030405060708090a0b0c0d0e0f');
  assert.equal(result.payloadByteLength, 83);
  assert.equal(result.sha256, '6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4');
  assert.equal(result.repositoryIdentity, 'repo-local-git-v0:6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4');
  assert.equal(verifyCanonicalRepositoryIdentityVector(), true);
});
