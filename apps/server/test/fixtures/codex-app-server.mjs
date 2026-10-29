import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { appendFileSync, writeFileSync, existsSync } from 'node:fs';
const send = (value, callback) => process.stdout.write(JSON.stringify(value) + '\n', callback);
const record = value => appendFileSync('rpc.jsonl', JSON.stringify(value) + '\n');
record({ argv: process.argv.slice(2), pid: process.pid });
let model;
let worker;
let workerClosed;
async function closeAfterEof() {
  if (model === 'eof-worker') {
    worker.send('stop');
    const exitCode = await workerClosed;
    if (exitCode !== 0) throw new Error('owned worker failed to exit cleanly');
    writeFileSync('worker-closed.txt', 'worker-exited-after-eof');
  }
  if (model === 'eof-output') {
    const stdout = JSON.stringify({ method: 'fixture/eof-output', params: { data: 'o'.repeat(256 * 1024) } }) + '\n';
    const stderr = 'e'.repeat(256 * 1024) + '\n';
    await Promise.all([
      new Promise((resolve, reject) => process.stdout.write(stdout, error => error ? reject(error) : resolve())),
      new Promise((resolve, reject) => process.stderr.write(stderr, error => error ? reject(error) : resolve())),
    ]);
    writeFileSync('flushed.json', JSON.stringify({ stdout: Buffer.byteLength(stdout), stderr: Buffer.byteLength(stderr) }));
  }
  writeFileSync('closed.txt', 'stdin-drained');
}
const turn = status => ({ id: 'turn-fixture', status, items: [], error: null });
const command = status => ({ id: 'command', type: 'commandExecution', command: 'fixture-only', cwd: process.cwd(), processId: null, status, commandActions: [], aggregatedOutput: '', exitCode: null, durationMs: null });
const finish = () => {
  if (model === 'late-crash') {
    send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', itemId: 'message', delta: 'x'.repeat(512 * 1024) } });
    return send({ method: 'turn/completed', params: { threadId: 'thread-fixture', turn: turn('completed') } }, () => {
      setTimeout(() => {
        writeFileSync('exiting.json', JSON.stringify({ pid: process.pid, code: 7 }));
        process.exit(7);
      }, 30);
    });
  }
  if (model === 'malformed') process.stdout.write('not-json\n');
  if (model === 'invalid-notification') send({ method: 'item/completed', params: { broken: true } });
  if (model === 'approval') send({ method: 'item/completed', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', item: command('declined') } });
  send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', itemId: 'message', delta: 'hello' } });
  send({ method: 'item/completed', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', item: { id: 'message', type: 'agentMessage', text: 'hello' } } });
  send({ method: 'turn/completed', params: { threadId: 'thread-fixture', turn: turn(model === 'failed' ? 'failed' : 'completed') } });
};
readline.createInterface({ input: process.stdin }).on('close', () => { closeAfterEof().catch(error => { console.error(error); process.exitCode = 1; }); }).on('line', line => {
  const message = JSON.parse(line); record(message);
  if (message.method === 'initialize') send({ id: message.id, result: { userAgent: 'codex/0.165.0' } });
  if (message.method === 'mcpServerStatus/list') send({ id: message.id, result: { data: [{ runtimeStatus: model === 'active-mcp' && message.params.cursor ? 'ready' : 'disabled', tools: {} }], nextCursor: message.params.cursor ? null : 'next' } });
  if (message.method === 'config/read') send({ id: message.id, result: { config: existsSync('invalid-config') ? null : { approval_policy: 'never', sandbox_mode: 'workspace-write', model_provider: 'openai', windows: { sandbox: 'elevated' }, features: { apps: false, hooks: false, plugins: false, unified_exec: false }, notify: [], mcp_servers: { 'personal.server': { command: 'must-not-start' }, disabled: { enabled: false } } } } });
  if (message.method === 'thread/start') {
    model = message.params.model;
    if (model === 'close-timeout') setInterval(() => {}, 1000);
    if (model === 'eof-worker') {
      worker = spawn(process.execPath, ['-e', "const fs=require('node:fs'); const timer=setInterval(()=>{},1000); process.on('message',message=>{if(message==='stop'){clearInterval(timer);fs.writeFileSync('worker-stopped.txt','stop-requested-after-eof');process.disconnect();}});"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
      workerClosed = new Promise((resolve, reject) => { worker.once('error', reject); worker.once('close', resolve); });
      writeFileSync('worker.json', JSON.stringify({ pid: worker.pid }));
    }
    send({ id: message.id, result: { thread: { id: 'thread-fixture' }, approvalPolicy: model === 'unsafe-policy' ? 'on-request' : 'never', modelProvider: 'openai', cwd: process.cwd(), sandbox: { type: 'workspaceWrite', networkAccess: false, writableRoots: [] } } });
  }
  if (message.method === 'turn/start') {
    if (model === 'rpc-error') return send({ id: message.id, error: { code: -32602, message: 'fixture rejected turn' } });
    send({ id: message.id, result: { turn: turn('inProgress') } });
    send({ method: 'turn/started', params: { threadId: 'thread-fixture', turn: turn('inProgress') } });
    if (model === 'crash') return process.exit(7);
    if (model === 'approval') {
      send({ method: 'item/started', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', item: command('inProgress') } });
      send({ id: 'approval', method: 'item/commandExecution/requestApproval', params: { threadId: 'thread-fixture', turnId: 'turn-fixture', itemId: 'command', approvalId: null } });
    }
    else setTimeout(finish, 30);
  }
  if (message.id === 'approval' && message.result) { writeFileSync('approval.json', JSON.stringify(message.result)); finish(); }
});
