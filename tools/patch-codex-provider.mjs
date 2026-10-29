import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// shortcut: provider 2.3.0 lacks startup isolation and graceful close; remove when upstream supports both.
const file = fileURLToPath(import.meta.resolve('ai-sdk-provider-codex-cli'));
const original = 'const args = [...base.args, "app-server", "--listen", "stdio://"];';
const flags = ['-c', 'approval_policy="never"', '-c', 'sandbox_mode="workspace-write"', '-c', 'windows.sandbox="elevated"', '-c', 'notify=[]', '-c', 'model_provider="openai"', '--disable', 'unified_exec', '--disable', 'apps', '--disable', 'hooks', '--disable', 'plugins', 'app-server', '--listen', 'stdio://'];
const replacement = 'const args = [...base.args, ' + flags.map(value => JSON.stringify(value)).join(', ') + '];';
const oldClose = `    if (this.child) {
      this.expectedExitSignal = "SIGTERM";
      this.child.kill("SIGTERM");
      this.child = void 0;
    }
    this.writeQueue = Promise.resolve();
  }
  async dispose() {`;
const newClose = `    if (this.child) {
      const child = this.child;
      this.child = void 0;
      child.stdout.resume();
      child.stderr.resume();
      await new Promise((resolve, reject) => {
        let forced = false;
        let killTimer;
        const timer = setTimeout(() => {
          forced = true;
          child.kill("SIGTERM");
          killTimer = setTimeout(() => reject(new Error("Codex App Server close unconfirmed after termination")), 2000);
        }, 5000);
        child.once("close", (code, signal) => {
          clearTimeout(timer);
          clearTimeout(killTimer);
          !forced && code === 0 ? resolve() : reject(new Error("Codex App Server shutdown failed: " + (forced ? "stdin EOF timeout" : String(code) + "/" + String(signal))));
        });
        child.stdin.on("error", () => {});
        child.stdin.end();
      });
    }
    this.writeQueue = Promise.resolve();
  }
  async dispose() {`;
const oldPool = `await Promise.allSettled(
        Array.from(sharedClients.values())`;
const newPool = `await Promise.all(
        Array.from(sharedClients.values())`;
const oldStart = `  async threadStart(params) {
    return await this.request("thread/start", params);
  }`;
const newStart = `  async threadStart(params) {
    const response = await this.request("config/read", { cwd: params.cwd, includeLayers: false });
    const config = response?.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Codex effective config unavailable");
    if (config.approval_policy !== "never" || config.sandbox_mode !== "workspace-write" || config.model_provider !== "openai"
        || config.windows?.sandbox !== "elevated" || !Array.isArray(config.notify) || config.notify.length
        || ["apps", "hooks", "plugins", "unified_exec"].some(name => config.features?.[name] !== false)) throw new Error("Codex startup policy mismatch");
    const servers = config.mcp_servers === undefined ? {} : config.mcp_servers;
    if (!servers || typeof servers !== "object" || Array.isArray(servers)) throw new Error("Codex MCP config invalid");
    const disabled = Object.fromEntries(Object.keys(servers).map(name => [name, { enabled: false }]));
    const result = await this.request("thread/start", { ...params, config: { ...params.config, mcp_servers: disabled } });
    const path = await import("node:path");
    const canonical = value => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
    if (result.approvalPolicy !== "never" || result.modelProvider !== "openai" || result.sandbox?.type !== "workspaceWrite"
        || result.sandbox.networkAccess !== false || !Array.isArray(result.sandbox.writableRoots) || result.sandbox.writableRoots.length
        || typeof result.cwd !== "string" || canonical(result.cwd) !== canonical(params.cwd)) throw new Error("Codex effective thread policy mismatch");
    const cursors = new Set();
    let cursor = null;
    do {
      const status = await this.request("mcpServerStatus/list", { threadId: result.thread.id, detail: "toolsAndAuthOnly", cursor });
      if (!Array.isArray(status.data) || status.data.some(server => server.runtimeStatus !== "disabled" || !server.tools
          || typeof server.tools !== "object" || Array.isArray(server.tools) || Object.keys(server.tools).length)) throw new Error("Codex MCP isolation unconfirmed");
      cursor = status.nextCursor;
      if (cursor !== null && (typeof cursor !== "string" || !cursor || cursors.has(cursor))) throw new Error("Codex MCP status pagination invalid");
      cursors.add(cursor);
    } while (cursor !== null);
    return result;
  }`;
const patches = [[original, replacement], [oldClose, newClose], [oldPool, newPool], [oldStart, newStart]];
const source = readFileSync(file, 'utf8');
const pristine = patches.reduce((value, [before, after]) => value.replace(after, before), source);
if (createHash('sha256').update(pristine).digest('hex') !== '62bbbcc9b0c2228b211f6052606352cc51370cb123f339d3b8cec281b03ac6e2'
    || patches.some(([before]) => pristine.split(before).length !== 2)) throw new Error('Unrecognized Codex provider bytes; review the pinned patch before installing.');
const patched = patches.reduce((value, [before, after]) => value.replace(before, after), pristine);
if (source !== patched) writeFileSync(file, patched);
