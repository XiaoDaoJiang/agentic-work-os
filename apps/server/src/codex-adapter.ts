import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const codexProfile = {
  id: 'windows-processkit-codex-app-server',
  available: false,
  reason: 'G1 尚未完成。仅允许在一次性仓库中运行诊断；真实任务启动保持关闭。',
} as const;

export function resolveCodexExecutable(searchPath = process.env.PATH ?? ''): string {
  if (process.platform !== 'win32') throw new Error('Codex diagnostic profile requires Windows');
  for (const directory of searchPath.split(path.delimiter)) {
    for (const candidate of [
      path.join(directory, 'codex.exe'),
      path.join(directory, 'node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'),
      path.join(directory, 'node_modules/@openai/codex/vendor/x86_64-pc-windows-msvc/codex/codex.exe'),
    ]) {
      if (existsSync(candidate)) return realpathSync(candidate);
    }
  }
  throw new Error('未找到 Codex 原生 exe。诊断不执行 cmd/PowerShell shim。');
}

export function codexInvocation(cwd: string, prompt: string, model: string, executable: string) {
  if (!path.isAbsolute(cwd) || cwd.includes('\0')) throw new Error('cwd must be an absolute path');
  if (!prompt.trim() || prompt.includes('\0')) throw new Error('prompt is required and must be NUL-free');
  if (typeof model !== 'string' || !model.trim() || model.includes('\0')) throw new Error('model is required and must be NUL-free');
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || executable.includes('\0')) throw new Error('executable must be absolute and NUL-free');
  return {
    program: process.execPath,
    argv: [fileURLToPath(new URL('./codex-app-server-driver.js', import.meta.url)), JSON.stringify({ cwd, prompt, model, executable })],
    cwd,
    environmentPolicy: 'allowlist' as const,
    inheritNames: ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'CODEX_HOME'],
  };
}
