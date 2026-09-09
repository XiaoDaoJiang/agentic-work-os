import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Store, acquireDatabaseMutex } from './store.js';
import { ApiError } from './contracts.js';
import { MockExecutor } from './mock-executor.js';

const capabilities = Object.freeze({ execution_mode: 'mock', real_execution: false,
  verification_execution: false, accept: false, accepted_delivery: false, g1: 'closed', g2: 'closed' });
const maxBodyBytes = 32 * 1024;
function readJson(req: IncomingMessage): Promise<unknown> {
  if (req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    req.resume(); throw new ApiError(415, 'JSON_REQUIRED', '状态修改接口仅接受 application/json');
  }
  return new Promise((resolveBody, reject) => {
    let bytes = 0; const chunks: Buffer[] = []; let oversized = false;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        if (!oversized) { oversized = true; chunks.length = 0; reject(new ApiError(413, 'BODY_TOO_LARGE', '请求体超过 32 KiB')); }
      } else if (!oversized) chunks.push(chunk);
    });
    req.on('end', () => {
      if (oversized) return;
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new ApiError(400, 'INVALID_JSON', '请求体不是有效 JSON')); }
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new ApiError(400, 'ABORTED_REQUEST', '请求被中断')));
  });
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body));
}
export interface ApplicationOptions {
  databasePath: string; port?: number; intervalMs?: number; staticDir?: string;
}
export async function createApplication(options: ApplicationOptions) {
  const port = options.port ?? 4317;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port must be an integer from 0 through 65535');
  const interval = options.intervalMs ?? 650;
  if (!Number.isFinite(interval) || interval < 1 || interval > 60000) throw new Error('Invalid mock interval');
  const release = acquireDatabaseMutex(resolve(options.databasePath));
  let store: Store;
  try { store = new Store(resolve(options.databasePath)); } catch (error) { release(); throw error; }
  const executor = new MockExecutor(store, interval);
  const token = randomBytes(32).toString('base64url');
  let closing = false; let closePromise: Promise<void> | undefined;
  const server = createServer({ requestTimeout: 10000, headersTimeout: 5000, maxHeaderSize: 16384 }, (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'");
    void handle(req, res).catch(error => {
      if (res.destroyed || res.writableEnded) return;
      if (error instanceof ApiError) {
        send(res, error.status, { code: error.code, message: error.message, fields: error.fields, active_run_id: error.active_run_id });
      } else {
        // Do not return database paths, request input or internal errors to the client.
        console.error('Request failed; inspect local application state.');
        send(res, 500, { code: 'INTERNAL_ERROR', message: '本地服务发生错误；请重新读取状态后再操作' });
      }
    });
  });
  async function handle(req: IncomingMessage, res: ServerResponse) {
    if (closing) throw new ApiError(503, 'CLOSING', '服务正在关闭');
    const address = server.address();
    if (!address || typeof address === 'string') throw new ApiError(503, 'NOT_READY', '服务未就绪');
    const allowedHosts = [`127.0.0.1:${address.port}`, `localhost:${address.port}`];
    const host = req.headers.host;
    if (!host || !allowedHosts.includes(host)
      || !['127.0.0.1', '::ffff:127.0.0.1', '::1'].includes(req.socket.remoteAddress ?? '')) {
      throw new ApiError(403, 'LOCAL_ONLY', '拒绝非 loopback 或不受信任的 Host');
    }
    const origin = `http://${host}`;
    if ((req.headers.origin !== undefined && req.headers.origin !== origin)
      || (req.headers['sec-fetch-site'] !== undefined && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) {
      throw new ApiError(403, 'ORIGIN_DENIED', '拒绝跨源请求');
    }
    const method = req.method ?? 'GET';
    const mutating = !['GET', 'HEAD'].includes(method);
    if (mutating) {
      const supplied = req.headers['x-workos-session'];
      if (req.headers.origin !== origin || typeof supplied !== 'string'
        || Buffer.byteLength(supplied) !== Buffer.byteLength(token)
        || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
        throw new ApiError(403, 'LOCAL_SESSION_REQUIRED', '需要同源 Origin 与当前本地会话令牌；服务重启后请刷新页面');
      }
    }
    const url = new URL(req.url ?? '/', origin); const path = url.pathname;
    if (method === 'GET' && path === '/api/session') { send(res, 200, { session_token: token, ...capabilities }); return; }
    if (method === 'GET' && path === '/api/capabilities') { send(res, 200, capabilities); return; }
    if (method === 'GET' && path === '/api/health') { send(res, 200, { status: 'ok', execution_mode: 'mock', schema_version: store.schemaVersion() }); return; }
    if (mutating && (/^\/api\/(?:accepted-deliveries|deliveries|verification|execute)(?:\/|$)/.test(path)
      || /^\/api\/runs\/real$/.test(path) || /^\/api\/runs\/[^/]+\/(?:accept|delivery|deliveries|verification|execute)$/.test(path))) {
      throw new ApiError(403, 'CAPABILITY_DISABLED', '真实执行、Verification、Accept 和 Accepted Delivery 均未开放');
    }
    if (path === '/api/tasks' && method === 'GET') { send(res, 200, store.listTasks()); return; }
    if (path === '/api/tasks' && method === 'POST') { send(res, 201, store.createTask(await readJson(req))); return; }
    const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(path);
    if (taskMatch && method === 'GET') { send(res, 200, store.getTask(taskMatch[1]!)); return; }
    if (taskMatch && method === 'PATCH') { send(res, 200, store.updateTask(taskMatch[1]!, await readJson(req))); return; }
    const startMatch = /^\/api\/tasks\/([^/]+)\/runs$/.exec(path);
    if (startMatch && method === 'POST') {
      const input = await readJson(req); executor.assertHealthy();
      const result = store.startRun(startMatch[1]!, input);
      if (!result.replay) executor.start(result.run);
      send(res, result.replay ? 200 : 201, result); return;
    }
    if (path === '/api/runs' && method === 'GET') { send(res, 200, store.listRuns(url.searchParams.get('task_id') ?? undefined)); return; }
    const runMatch = /^\/api\/runs\/([^/]+)$/.exec(path);
    if (runMatch && method === 'GET') { send(res, 200, store.getRun(runMatch[1]!)); return; }
    const logMatch = /^\/api\/runs\/([^/]+)\/logs$/.exec(path);
    if (logMatch && method === 'GET') {
      const cursor = url.searchParams.get('after') ?? '0';
      if (!/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor))) throw new ApiError(400, 'INVALID_CURSOR', 'after 必须为非负安全整数');
      send(res, 200, store.getLogs(logMatch[1]!, Number(cursor))); return;
    }
    const cancelMatch = /^\/api\/runs\/([^/]+)\/cancel$/.exec(path);
    if (cancelMatch && method === 'POST') {
      await readJson(req); send(res, 200, executor.cancel(cancelMatch[1]!)); return;
    }
    const assets: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/app.css': ['app.css', 'text/css; charset=utf-8'],
    };
    const asset = assets[path];
    if (['GET', 'HEAD'].includes(method) && options.staticDir && asset) {
      const data = readFileSync(join(options.staticDir, asset[0]));
      res.writeHead(200, { 'Content-Type': asset[1] }); res.end(method === 'HEAD' ? undefined : data); return;
    }
    throw new ApiError(404, 'NOT_FOUND', '入口不存在；本应用只提供 Task 与 mock Run');
  }
  try {
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolveListen(); });
    });
    store.recoverInterrupted();
  } catch (error) {
    server.close(); store.close(); release(); throw error;
  }
  const bound = server.address();
  if (!bound || typeof bound === 'string') throw new Error('Unexpected listen address');
  return {
    server, store, origin: `http://127.0.0.1:${bound.port}`,
    close(): Promise<void> {
      if (!closePromise) {
        closing = true; executor.close();
        closePromise = new Promise<void>((resolveClose, reject) => {
          server.close(error => {
            try { store.close(); release(); } catch (closeError) { reject(closeError); return; }
            if (error) reject(error); else resolveClose();
          });
          server.closeAllConnections();
        });
      }
      return closePromise;
    },
  };
}
