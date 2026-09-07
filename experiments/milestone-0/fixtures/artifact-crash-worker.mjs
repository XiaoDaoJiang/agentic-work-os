#!/usr/bin/env node
import { createArtifactStore, sealArtifact } from '../src/artifact-store.mjs';
import { openArtifactExperimentDb } from '../src/artifact-db.mjs';

function parseOptions(args) {
  const out = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Expected --name value near ${key ?? '<end>'}`);
    out[key.slice(2)] = value;
  }
  return out;
}

const options = parseOptions(process.argv.slice(2));
for (const required of ['store','db','fault-point']) if (!options[required]) throw new Error(`--${required} is required`);
const store = await createArtifactStore(options.store);
const db = openArtifactExperimentDb(options.db);
const faultPoint = options['fault-point'];

const fault = (point) => {
  if (point !== faultPoint) return;
  process.kill(process.pid, 'SIGKILL');
  throw new Error(`SIGKILL did not terminate process at ${point}`);
};

await sealArtifact({
  store,
  db,
  runId:'run-1',
  artifactId:`artifact-${faultPoint.replaceAll('_','-')}`,
  type:'diff',
  bytes:`crash-bytes-${faultPoint}`,
  producerStopped:true,
  outputDrained:true,
  transition:{ phase:'review', state:'waiting_review' },
  fault
});

db.close();
process.stderr.write(`fault point was not reached: ${faultPoint}\n`);
process.exitCode = 3;
