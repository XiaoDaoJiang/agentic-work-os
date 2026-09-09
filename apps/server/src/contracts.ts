// Pure input/types module: no filesystem, process, credentials or runtime imports.
export interface TaskInput {
  goal: string;
  definition_of_done: string[];
  repository_path: string;
  verification_draft: { command: string; timeout_seconds: number };
}
export interface Task extends TaskInput {
  id: string; revision: number; state: 'ready'; execution_mode: 'mock';
  created_at: string; updated_at: string;
}
export type Scenario = 'success' | 'failure' | 'cancel';
export type Phase = 'prepare' | 'agent' | 'test' | 'review' | 'complete';
export type RunState = 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
export interface StartInput { execution_mode: 'mock'; scenario: Scenario; request_id: string }
export interface Run {
  id: string; task_id: string; execution_mode: 'mock'; scenario: Scenario;
  state: RunState; phase: Phase; created_at: string; finished_at: string | null;
  terminal_reason: string | null;
  input_snapshot: { snapshot_version: 1; execution_mode: 'mock'; scenario: Scenario; task: Task };
}
export interface RunLog {
  run_id: string; sequence: number; execution_mode: 'mock'; created_at: string; message: string;
}
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string,
    public fields?: Record<string, string>, public active_run_id?: string) { super(message); }
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function rejectUnknown(value: Record<string, unknown>, allowed: string[], errors: Record<string, string>) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors[key] = '不支持的字段';
}
export function parseTaskInput(value: unknown): TaskInput {
  const v = object(value); const errors: Record<string, string> = Object.create(null);
  rejectUnknown(v, ['goal', 'definition_of_done', 'repository_path', 'verification_draft'], errors);
  const text = (raw: unknown, key: string, max: number): string => {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > max || raw.includes('\0')) {
      errors[key] = `必填文本，最多 ${max} 字符，不能包含 NUL`; return '';
    }
    return raw.trim();
  };
  const goal = text(v.goal, 'goal', 4000);
  const repository_path = text(v.repository_path, 'repository_path', 2048);
  if (repository_path && (!/^(\/|[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(repository_path)
    || /[\r\n]/.test(repository_path))) errors.repository_path = '请输入本地绝对路径；本切片不检查路径是否存在';
  const definition_of_done: string[] = [];
  if (!Array.isArray(v.definition_of_done) || v.definition_of_done.length < 1 || v.definition_of_done.length > 20) {
    errors.definition_of_done = '至少一条、最多 20 条 DoD';
  } else {
    v.definition_of_done.forEach(item => definition_of_done.push(text(item, 'definition_of_done', 2000)));
  }
  const draft = object(v.verification_draft);
  const nested: Record<string, string> = Object.create(null);
  rejectUnknown(draft, ['command', 'timeout_seconds'], nested);
  for (const [key, error] of Object.entries(nested)) errors[`verification_draft.${key}`] = error;
  const command = text(draft.command, 'verification_draft.command', 8000);
  const timeout = draft.timeout_seconds;
  if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout < 1 || timeout > 3600) {
    errors['verification_draft.timeout_seconds'] = '草稿超时应为 1–3600 的整数秒';
  }
  if (Object.keys(errors).length) throw new ApiError(400, 'INVALID_INPUT', '请修正必填输入或不支持的字段', errors);
  return { goal, definition_of_done, repository_path, verification_draft: { command, timeout_seconds: timeout as number } };
}
export function parseStartInput(value: unknown): StartInput {
  const v = object(value); const errors: Record<string, string> = Object.create(null);
  if (v.execution_mode !== 'mock') throw new ApiError(403, 'CAPABILITY_DISABLED', '真实执行未开放；execution_mode 必须为 mock');
  rejectUnknown(v, ['execution_mode', 'scenario', 'request_id'], errors);
  if (typeof v.scenario !== 'string' || !['success', 'failure', 'cancel'].includes(v.scenario)) errors.scenario = '请选择确定性模拟场景';
  if (typeof v.request_id !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(v.request_id)) errors.request_id = '需要 8–100 位幂等请求 ID';
  if (Object.keys(errors).length) throw new ApiError(400, 'INVALID_INPUT', '模拟运行输入不合法', errors);
  return v as unknown as StartInput;
}
