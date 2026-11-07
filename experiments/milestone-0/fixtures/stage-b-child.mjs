#!/usr/bin/env node

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith('--') || value === undefined) {
      throw new Error(`Expected --name value near ${name ?? '<end>'}`);
    }
    options[name.slice(2)] = value;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const mode = options.mode ?? 'success';
const nonce = options.nonce ?? 'missing-nonce';
const exitCode = Number(options['exit-code'] ?? (mode === 'failure' ? 7 : 0));
const chunks = [];

process.stdout.write(`stdout:start:${nonce}\n`);
process.stderr.write(`stderr:start:${nonce}\n`);
process.stdin.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
process.stdin.on('end', () => {
  const observation = {
    cwd: process.cwd(),
    nonce,
    stdin_base64: Buffer.concat(chunks).toString('base64'),
    env_value: process.env.STAGE_B_NONCE ?? null,
    inherited_probe: process.env.STAGE_B_INHERITED ?? null
  };
  process.stdout.write(`observation:${JSON.stringify(observation)}\n`);
  process.stderr.write(`stderr:end:${nonce}\n`);

  if (mode === 'hang') {
    setInterval(() => process.stdout.write(`stdout:tick:${nonce}\n`), 50);
    return;
  }
  process.exitCode = Number.isInteger(exitCode) ? exitCode : 1;
});
process.stdin.resume();
