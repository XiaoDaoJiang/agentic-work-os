import { validateRunnerRequest } from './runner-contract.mjs';

export const STAGE_B_MAX_STDIN_BYTES = 1024 * 1024;

export function validateStageBRequestBatch(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('Stage B request batch must be a non-empty array');
  }

  const validated = requests.map((request) => validateRunnerRequest(request));
  if (validated[0].kind !== 'start') throw new Error('first request must be start');

  const start = validated[0];
  const seenRequestIds = new Set();
  const inputRequests = [];
  const chunks = [];
  let totalBytes = 0;
  let startCount = 0;
  let finishCount = 0;
  let finished = false;

  for (const request of validated) {
    if (seenRequestIds.has(request.request_id)) {
      throw new Error(`request_id must be unique: ${request.request_id}`);
    }
    seenRequestIds.add(request.request_id);

    if (request.run_id !== start.run_id) {
      throw new Error('every request run_id must match the start request');
    }

    if (finished) {
      if (request.kind === 'finish_input') throw new Error('finish_input may occur exactly once');
      throw new Error('request arrived after finish_input');
    }

    if (request.kind === 'start') {
      startCount += 1;
      if (startCount > 1) throw new Error('start may occur exactly once');
      continue;
    }

    if (request.kind === 'cancel') throw new Error('cancel is not supported in Stage B');

    if (request.kind === 'input') {
      const bytes = Buffer.from(request.bytes_base64, 'base64');
      totalBytes += bytes.length;
      if (totalBytes > STAGE_B_MAX_STDIN_BYTES) {
        throw new Error(`Stage B stdin exceeds ${STAGE_B_MAX_STDIN_BYTES} bytes`);
      }
      inputRequests.push(request);
      chunks.push(bytes);
      continue;
    }

    if (request.kind === 'finish_input') {
      finishCount += 1;
      if (finishCount > 1) throw new Error('finish_input may occur exactly once');
      finished = true;
    }
  }

  if (startCount !== 1) throw new Error('start may occur exactly once');
  if (finishCount !== 1) throw new Error('finish_input is required exactly once');

  return {
    start,
    inputRequests,
    stdinBytes: Buffer.concat(chunks, totalBytes)
  };
}
