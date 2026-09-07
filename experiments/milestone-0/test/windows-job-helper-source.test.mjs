import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = new URL('../scripts/windows-job-runner.ps1', import.meta.url);

test('Windows helper source freezes Job Object APIs and suspended assign-before-resume ordering', async () => {
  const source=await readFile(helper,'utf8');
  for (const token of [
    'CREATE_SUSPENDED','JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE',
    'CreateJobObjectW','SetInformationJobObject','CreateProcessW',
    'AssignProcessToJobObject','ResumeThread','QueryInformationJobObject',
    'JobObjectBasicProcessIdList','TerminateJobObject','GetProcessTimes'
  ]) assert.ok(source.includes(token),`missing ${token}`);
  assert.ok(source.includes(String.raw`new char[]{' ', '\t', '\n', '\v', '"'}`),'C# quote parser must use valid single-character escape literals');
  assert.ok(source.includes(String.raw`if (c == '\\')`),'C# quote parser must count literal backslashes');
  assert.ok(source.includes(String.raw`b.Append('\\',`),'C# quote parser must append literal backslashes');
  const create=source.indexOf('Native.CreateProcessW(');
  const assign=source.indexOf('Native.AssignProcessToJobObject(');
  const resume=source.indexOf('Native.ResumeThread(');
  assert.ok(create>=0 && assign>create && resume>assign,'CreateProcessW -> AssignProcessToJobObject -> ResumeThread ordering must be explicit');
});

test('Windows helper does not use taskkill, WMI or PID ancestry as containment', async () => {
  const source=(await readFile(helper,'utf8')).toLowerCase();
  for(const forbidden of ['taskkill','get-ciminstance','win32_process','parentprocessid','wmic']) {
    assert.equal(source.includes(forbidden),false,`forbidden fallback ${forbidden}`);
  }
});
