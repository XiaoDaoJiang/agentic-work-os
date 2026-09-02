import { randomUUID } from 'node:crypto';

export function createExperimentRunId(now = new Date(), randomUUIDFn = randomUUID) {
  const timestamp = now.toISOString().replace(/[-:.]/g, '');
  const uuid = randomUUIDFn().replaceAll('-', '');
  return `m0-${timestamp}-${uuid}`;
}
