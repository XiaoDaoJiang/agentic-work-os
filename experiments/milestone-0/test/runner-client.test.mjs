import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { runNativeRunnerDoctor } from '../src/runner-client.mjs';

const capabilities = {
  capability_version: 'runner-capabilities-v0',
  platform: 'linux',
  architecture: 'x86_64',
  mechanism: 'posix_process_group',
  whole_tree_termination: true,
  kill_on_owner_exit: false,
  membership_observable: true,
  soft_stop_scope: 'whole_tree',
  escape_resistance: 'process_group',
  separate_stdout_stderr: true,
  interactive_stdin: true,
  timeout: true,
  provider: { name: 'processkit', version: '3.3.4' },
  provider_details: {
    probe_kind: 'spawn_free_preflight',
    raw_mechanism: 'process_group',
    raw_soft_stop_scope: 'whole_tree',
    raw_parent_death_cleanup: 'direct_child_only'
  }
};

function spawnScript(script) {
  return (_executable, args, options) => {
    assert.deepEqual(args, ['doctor']);
    assert.equal(options.shell, false);
    return spawn(process.execPath, ['-e', script], options);
  };
}

test('returns validated capabilities while preserving exact stdout and stderr', async () => {
  const document = JSON.stringify(capabilities);
  const result = await runNativeRunnerDoctor({
    executable: path.resolve('native-runner'),
    spawnFn: spawnScript(`process.stdout.write(${JSON.stringify(`${document}\n`)}); process.stderr.write('diagnostic\\n')`)
  });
  assert.deepEqual(result.capabilities, capabilities);
  assert.equal(result.stdout, `${document}\n`);
  assert.equal(result.stderr, 'diagnostic\n');
  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
});

test('rejects a nonzero exit and exposes captured diagnostics', async () => {
  await assert.rejects(
    () => runNativeRunnerDoctor({
      executable: path.resolve('native-runner'),
      spawnFn: spawnScript("process.stderr.write('doctor failed\\n'); process.exit(7)")
    }),
    (error) => {
      assert.equal(error.name, 'NativeRunnerDoctorError');
      assert.equal(error.code, 'NATIVE_RUNNER_EXIT');
      assert.equal(error.exitCode, 7);
      assert.equal(error.stderr, 'doctor failed\n');
      return true;
    }
  );
});

test('rejects malformed or multiple stdout lines instead of guessing', async () => {
  await assert.rejects(
    () => runNativeRunnerDoctor({
      executable: path.resolve('native-runner'),
      spawnFn: spawnScript("process.stdout.write('{\\n')")
    }),
    /invalid runner JSON/i
  );
  const line = `${JSON.stringify(capabilities)}\n`;
  await assert.rejects(
    () => runNativeRunnerDoctor({
      executable: path.resolve('native-runner'),
      spawnFn: spawnScript(`process.stdout.write(${JSON.stringify(line + line)})`)
    }),
    /exactly one non-empty JSON line/i
  );
});

test('rejects capability schema inflation emitted by a helper', async () => {
  const invalid = {
    ...capabilities,
    platform: 'macos',
    escape_resistance: 'strong'
  };
  await assert.rejects(
    () => runNativeRunnerDoctor({
      executable: path.resolve('native-runner'),
      spawnFn: spawnScript(`process.stdout.write(${JSON.stringify(`${JSON.stringify(invalid)}\n`)})`)
    }),
    /process group cannot claim strong/i
  );
});

test('requires an absolute executable path', async () => {
  await assert.rejects(
    () => runNativeRunnerDoctor({ executable: 'relative-runner' }),
    /absolute executable path/i
  );
});
