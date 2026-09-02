import test from 'node:test';
import assert from 'node:assert/strict';
import { getWindowsFileIdentity, getWindowsShortPath } from '../src/windows-file-identity.mjs';

test('rejects non-Windows hosts before invoking PowerShell', async () => {
  let called = false;
  await assert.rejects(
    getWindowsFileIdentity('/tmp/repo', {
      platform: 'linux',
      execute: async () => {
        called = true;
        return { stdout: '', stderr: '' };
      }
    }),
    /requires Windows/
  );
  assert.equal(called, false);
});

test('parses fixed-width lowercase FILE_ID_INFO output from PowerShell', async () => {
  const result = await getWindowsFileIdentity('C:\\repo\\.git', {
    platform: 'win32',
    powershellExecutable: 'powershell.exe',
    scriptPath: 'C:\\helper.ps1',
    execute: async (program, args) => {
      assert.equal(program, 'powershell.exe');
      assert.deepEqual(args.slice(0, 5), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass']);
      assert.ok(args.includes('file-id'));
      assert.ok(args.includes('C:\\repo\\.git'));
      return {
        stdout: '{"finalPath":"C:\\\\repo\\\\.git","volumeSerialHex":"0123456789abcdef","fileIdHex":"000102030405060708090a0b0c0d0e0f"}\n',
        stderr: ''
      };
    }
  });
  assert.deepEqual(result, {
    finalPath: 'C:\\repo\\.git',
    volumeSerialHex: '0123456789abcdef',
    fileIdHex: '000102030405060708090a0b0c0d0e0f'
  });
});

test('rejects malformed native hex instead of normalizing or guessing', async () => {
  await assert.rejects(
    getWindowsFileIdentity('C:\\repo\\.git', {
      platform: 'win32',
      execute: async () => ({
        stdout: '{"finalPath":"C:\\\\repo\\\\.git","volumeSerialHex":"ABC","fileIdHex":"0"}',
        stderr: ''
      })
    }),
    /volumeSerialHex must be exactly 16 lowercase hex characters/
  );
});

test('wraps native helper execution failure as fail-closed error', async () => {
  await assert.rejects(
    getWindowsFileIdentity('C:\\missing', {
      platform: 'win32',
      execute: async () => { throw new Error('native boom'); }
    }),
    /Windows file identity helper failed: native boom/
  );
});

test('returns a short alias only when the helper reports one', async () => {
  const alias = await getWindowsShortPath('C:\\Long Folder\\repo', {
    platform: 'win32',
    execute: async () => ({ stdout: '{"available":true,"shortPath":"C:\\\\LONGFO~1\\\\repo"}', stderr: '' })
  });
  assert.equal(alias, 'C:\\LONGFO~1\\repo');

  const unavailable = await getWindowsShortPath('C:\\Long Folder\\repo', {
    platform: 'win32',
    execute: async () => ({ stdout: '{"available":false,"shortPath":null}', stderr: '' })
  });
  assert.equal(unavailable, null);
});

test('rejects an all-zero FILE_ID_128 as unsupported instead of creating a colliding identity', async () => {
  await assert.rejects(
    getWindowsFileIdentity('C:\\repo\\.git', {
      platform: 'win32',
      execute: async () => ({
        stdout: '{"finalPath":"C:\\\\repo\\\\.git","volumeSerialHex":"0123456789abcdef","fileIdHex":"00000000000000000000000000000000"}',
        stderr: ''
      })
    }),
    /all-zero FILE_ID_128 is unsupported/
  );
});
