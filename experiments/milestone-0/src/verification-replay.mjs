import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateVerificationInvocation } from './verification-invocation.mjs';

export function prepareVerificationReplay({ verificationInvocation, originalResolvedCwd, replayCheckout }) {
  validateVerificationInvocation(verificationInvocation);
  if (typeof originalResolvedCwd !== 'string' || originalResolvedCwd.length === 0) throw new Error('originalResolvedCwd is required');
  if (typeof replayCheckout !== 'string' || replayCheckout.length === 0) throw new Error('replayCheckout is required');
  const bytes = Buffer.from(JSON.stringify(verificationInvocation), 'utf8');
  return {
    verificationInvocation: JSON.parse(bytes.toString('utf8')),
    logicalContractSha256: createHash('sha256').update(bytes).digest('hex'),
    cwdBinding: 'assigned_workspace',
    originalResolvedCwd: path.resolve(originalResolvedCwd),
    replayResolvedCwd: path.resolve(replayCheckout)
  };
}
