import { createHash } from 'node:crypto';

const VERSION = 'repo-local-git-v0';
const CANONICAL_SHA = '6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4';

function assertHex(value, length, label) {
  if (typeof value !== 'string' || value.length !== length || !/^[0-9a-f]+$/.test(value)) {
    throw new Error(`${label} must be exactly ${length} lowercase hex characters`);
  }
}

export function computeRepositoryIdentityVector(volumeSerialHex, fileIdHex) {
  assertHex(volumeSerialHex, 16, 'volumeSerialHex');
  assertHex(fileIdHex, 32, 'fileIdHex');
  const payload = Buffer.from(`${VERSION}\0windows-file-id\0${volumeSerialHex}\0${fileIdHex}`, 'utf8');
  const sha256 = createHash('sha256').update(payload).digest('hex');
  return {
    version: VERSION,
    payloadByteLength: payload.length,
    sha256,
    repositoryIdentity: `${VERSION}:${sha256}`
  };
}

export function verifyCanonicalRepositoryIdentityVector() {
  const result = computeRepositoryIdentityVector('0123456789abcdef', '000102030405060708090a0b0c0d0e0f');
  return result.payloadByteLength === 83 && result.sha256 === CANONICAL_SHA && result.repositoryIdentity === `${VERSION}:${CANONICAL_SHA}`;
}
