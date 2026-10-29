import { once } from 'node:events';
import { streamText } from 'ai';
import { createCodexAppServer } from 'ai-sdk-provider-codex-cli';
import { codexInvocation } from './codex-adapter.js';

async function emit(value: unknown) {
  if (!process.stdout.write(JSON.stringify(value) + '\n')) await once(process.stdout, 'drain');
}

async function main() {
  const input = JSON.parse(process.argv[2] ?? 'null');
  if (!input || Object.keys(input).sort().join(',') !== 'cwd,executable,model,prompt') throw new Error('Invalid driver input');
  codexInvocation(input.cwd, input.prompt, input.model, input.executable);
  let protocolWarning = false;
  const provider = createCodexAppServer({ defaultSettings: {
    codexPath: input.executable, cwd: input.cwd, threadMode: 'stateless',
    approvalPolicy: 'never', sandboxPolicy: 'workspace-write', autoApprove: false,
    configOverrides: { model_provider: 'openai', notify: [], 'windows.sandbox': 'elevated', 'features.unified_exec': false, 'features.apps': false, 'features.hooks': false, 'features.plugins': false },
    connectionTimeoutMs: 15000, requestTimeoutMs: 30000,
    logger: { debug() {}, info() {}, warn() { protocolWarning = true; }, error() { protocolWarning = true; } },
  } });
  let completed = false;
  try {
    const result = streamText({ model: provider(input.model), prompt: input.prompt, maxRetries: 0, include: { rawChunks: true } });
    for await (const part of result.fullStream) {
      if (part.type === 'error') throw part.error;
      if (part.type === 'raw') {
        const event = part.rawValue as { method?: string; params?: { threadId?: string; turn?: { id?: string; status?: string } } };
        if (event.method === 'turn/started' || event.method === 'turn/completed') {
          const turn = event.params?.turn;
          await emit({ type: event.method.replace('/', '.'), thread_id: event.params?.threadId, turn_id: turn?.id, status: turn?.status });
          if (event.method === 'turn/completed') completed = turn?.status === 'completed';
        }
      } else if (['text-delta', 'reasoning-delta', 'tool-call', 'tool-result', 'tool-error'].includes(part.type)) await emit(part);
    }
    if (!completed) throw new Error('Codex turn did not complete successfully');
  } finally {
    // The outer Runner still proves process exit, descendant cleanup and output drain.
    await provider.close();
  }
  // The provider can silently discard malformed messages after warning; never accept that stream.
  if (protocolWarning) throw new Error('Codex Provider reported an incomplete or invalid protocol stream');
}

// An unresolved SDK stream does not keep Node alive after its child crashes.
process.exitCode = 1;
main().then(() => { process.exitCode = 0; }).catch(async error => {
  process.exitCode = 1;
  await emit({ type: 'agent.error', message: String(error instanceof Error ? error.message : error).slice(0,4000) });
});
