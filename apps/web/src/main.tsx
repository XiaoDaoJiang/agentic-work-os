import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Pure shared contract only; no server/runtime module is bundled into the browser.
import { ApiError, parseTaskInput, type Task, type TaskInput, type Run, type RunLog, type Scenario } from '../../server/src/contracts';
import './style.css';

let sessionToken = '';
async function api<T>(path: string, method = 'GET', value?: unknown): Promise<T> {
  if (method !== 'GET' && !sessionToken) {
    const session = await api<{ session_token: string }>('/api/session'); sessionToken = session.session_token;
  }
  const response = await fetch(path, { method, cache: 'no-store',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-WorkOS-Session': sessionToken },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
  const data = await response.json();
  if (!response.ok) {
    if (data.code === 'LOCAL_SESSION_REQUIRED') sessionToken = '';
    throw new ApiError(response.status, data.code, data.message ?? '请求失败', data.fields, data.active_run_id);
  }
  return data as T;
}
const message = (error: unknown) => error instanceof Error ? error.message : '操作失败，请刷新并查看持久化状态';
const states: Record<Run['state'], string> = { running: '模拟运行中', succeeded: '模拟成功', failed: '模拟失败', cancelled: '模拟取消', interrupted: '模拟中断' };
const phases = ['prepare', 'agent', 'test', 'review', 'complete'];
function readLocation() { const q = new URLSearchParams(location.hash.slice(1)); return { taskId: q.get('task') ?? '', runId: q.get('run') ?? '' }; }

function TaskForm({ task, onSaved }: { task?: Task; onSaved: (task: Task) => void }) {
  const [goal, setGoal] = useState(task?.goal ?? '');
  const [dod, setDod] = useState(task?.definition_of_done.join('\n') ?? '');
  const [repository, setRepository] = useState(task?.repository_path ?? '');
  const [command, setCommand] = useState(task?.verification_draft.command ?? '');
  const [timeout, setTimeoutValue] = useState(String(task?.verification_draft.timeout_seconds ?? 60));
  const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setFields({}); setSaving(true);
    try {
      const input: TaskInput = parseTaskInput({ goal, definition_of_done: dod.split('\n'), repository_path: repository,
        verification_draft: { command, timeout_seconds: Number(timeout) } });
      const result = await api<Task>(task ? `/api/tasks/${task.id}` : '/api/tasks', task ? 'PATCH' : 'POST', input);
      onSaved(result);
    } catch (err) { setError(message(err)); if (err instanceof ApiError) setFields(err.fields ?? {}); }
    finally { setSaving(false); }
  }
  const fieldError = (key: string) => fields[key] ? <small className="field-error" id={`error-${key}`}>{fields[key]}</small> : null;
  return <form onSubmit={submit} noValidate>
    <div className="section-heading"><div><span className="eyebrow">01 / TASK INPUT</span><h2>{task ? '任务上下文' : '创建第一张任务卡'}</h2></div><span className="badge muted">{task ? `v${task.revision}` : 'DRAFT'}</span></div>
    <p className="hint">输入会真实保存；仓库路径不会被读取，Verification 草稿不会被执行。请勿填写密钥或生产凭据。</p>
    {error && <div role="alert" className="error">{error}</div>}
    <label htmlFor="goal">目标</label>
    <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} required maxLength={4000} rows={3} aria-invalid={!!fields.goal} aria-describedby="error-goal" placeholder="这次工作需要解决什么？" />{fieldError('goal')}
    <label htmlFor="dod">DoD（每行一条）</label>
    <textarea id="dod" value={dod} onChange={e => setDod(e.target.value)} required rows={3} aria-invalid={!!fields.definition_of_done} aria-describedby="error-definition_of_done" placeholder="描述可观察的完成标准" />{fieldError('definition_of_done')}
    <label htmlFor="repository">仓库绝对路径</label>
    <input id="repository" value={repository} onChange={e => setRepository(e.target.value)} required maxLength={2048} aria-invalid={!!fields.repository_path} aria-describedby="error-repository_path" placeholder="C:\Projects\example 或 /path/to/example" />{fieldError('repository_path')}
    <label htmlFor="verification">Verification 草稿（仅保存）</label>
    <textarea id="verification" value={command} onChange={e => setCommand(e.target.value)} required maxLength={8000} rows={2} aria-invalid={!!fields['verification_draft.command']} aria-describedby="error-verification_draft.command" placeholder="例如 npm test；本切片绝不执行" />{fieldError('verification_draft.command')}
    <label htmlFor="timeout">草稿超时（秒）</label>
    <input id="timeout" type="number" min={1} max={3600} value={timeout} onChange={e => setTimeoutValue(e.target.value)} required aria-invalid={!!fields['verification_draft.timeout_seconds']} aria-describedby="error-verification_draft.timeout_seconds" />{fieldError('verification_draft.timeout_seconds')}
    <button className="primary full" disabled={saving} type="submit">{saving ? '保存中…' : task ? '保存 Task 修改' : '创建 Task'}</button>
    {task && <p className="hint">修改仅影响下一次 Run。已有 Run 的输入快照不会改变。</p>}
  </form>;
}
function RunDetail({ run, onCancel, busy }: { run?: Run; onCancel: () => void; busy: boolean }) {
  const [logs, setLogs] = useState<RunLog[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    setLogs([]); setError(''); if (!run) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try { const result = await api<RunLog[]>(`/api/runs/${run.id}/logs`); if (!stopped) { setLogs(result); setError(''); } }
      catch (err) { if (!stopped) setError(message(err)); }
      finally { if (!stopped) timer = setTimeout(refresh, 300); }
    };
    void refresh(); return () => { stopped = true; clearTimeout(timer); };
  }, [run?.id]);
  if (!run) return <section className="empty detail-empty"><span className="empty-symbol">↗</span><h2>运行记录将在这里出现</h2><p>保存 Task 后启动 mock Run，观察模拟步骤与持久化日志。每次尝试都会保留独立历史。</p></section>;
  return <section>
    <div className="section-heading"><div><span className="eyebrow">03 / RUN DETAIL</span><h2>运行详情</h2></div><span data-testid="run-state" className={`badge ${run.state}`}>{states[run.state]}</span></div>
    <code data-testid="run-id" className="identity">{run.id}</code>
    <p className="hint">execution_mode=mock · 输入版本 v{run.input_snapshot.task.revision}</p>
    <ol className="phases" aria-label="模拟步骤">{phases.map(phase => <li key={phase} className={run.phase === phase ? 'current' : ''}>{phase}</li>)}</ol>
    {run.state === 'running' && <button type="button" className="danger" onClick={onCancel} disabled={busy}>取消 mock Run</button>}
    {run.state === 'interrupted' && <p className="warning">服务重启时未完成的 mock 已标为 interrupted，不会自动续跑或补写成功。可保留历史并发起新的尝试。</p>}
    {run.state !== 'running' && <p className="terminal-reason">{run.terminal_reason}<br />这不是代码交付或 OS 进程终止证据。</p>}
    <div className="log-heading"><h3>持久化模拟日志</h3><span>{logs.length} 条 · 自动刷新</span></div>
    {error && <p role="alert" className="error">日志暂不可更新：{error}。已保存内容保留。</p>}
    <div role="log" aria-label="持久化模拟日志" aria-live="polite" className="logs">{logs.map(log => <p key={log.sequence}><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleTimeString('zh-CN', { hour12: false })}</time><span>{log.message}</span></p>)}</div>
    <details><summary>不可变输入快照 · v1</summary><pre data-testid="snapshot">{JSON.stringify(run.input_snapshot, null, 2)}</pre></details>
  </section>;
}
function App() {
  const [tasks, setTasks] = useState<Task[]>([]); const [runs, setRuns] = useState<Run[]>([]);
  const [selection, setSelection] = useState(readLocation);
  const [scenario, setScenario] = useState<Scenario>('success');
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState(''); const [busy, setBusy] = useState(false);
  const attempt = useRef<{ taskId: string; scenario: Scenario; id: string } | null>(null);
  function navigate(taskId: string, runId = '') {
    const q = new URLSearchParams(); if (taskId) q.set('task', taskId); if (runId) q.set('run', runId);
    history.replaceState(null, '', `#${q}`); setSelection({ taskId, runId }); setError('');
  }
  useEffect(() => {
    const onHash = () => setSelection(readLocation()); window.addEventListener('hashchange', onHash);
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [nextTasks, nextRuns] = await Promise.all([api<Task[]>('/api/tasks'), api<Run[]>('/api/runs')]);
        if (!stopped) { setTasks(nextTasks); setRuns(nextRuns); setConnectionError(''); }
      } catch (err) { if (!stopped) setConnectionError(`暂时无法连接本地服务：${message(err)}。记录保存在本地数据库；服务恢复后将继续读取。`); }
      finally { if (!stopped) timer = setTimeout(refresh, 300); }
    };
    void refresh(); return () => { stopped = true; clearTimeout(timer); window.removeEventListener('hashchange', onHash); };
  }, []);
  const task = tasks.find(t => t.id === selection.taskId);
  const run = runs.find(r => r.id === selection.runId);
  const active = runs.find(r => r.state === 'running');
  const taskRuns = task ? runs.filter(r => r.task_id === task.id) : runs;
  async function start() {
    if (!task) return; setBusy(true); setError(''); setNotice('');
    attempt.current ??= { taskId: task.id, scenario, id: crypto.randomUUID() };
    const request = attempt.current;
    try {
      const result = await api<{ run: Run; replay: boolean }>(`/api/tasks/${request.taskId}/runs`, 'POST',
        { execution_mode: 'mock', scenario: request.scenario, request_id: request.id });
      setRuns(old => [result.run, ...old.filter(r => r.id !== result.run.id)]);
      attempt.current = null; navigate(result.run.task_id, result.run.id);
      setNotice(result.replay ? '已恢复同一请求的 Run，没有创建重复运行' : 'mock Run 已创建；没有启动真实 Agent');
    } catch (err) { setError(`${message(err)}。再次点击将重试同一个请求，不覆盖历史。`); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!run) return; setBusy(true); setError('');
    try { const result = await api<Run>(`/api/runs/${run.id}/cancel`, 'POST', {}); setRuns(old => old.map(r => r.id === result.id ? result : r)); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <>
    <header><div className="brand"><span className="brand-mark">W</span><strong>Agentic Work OS</strong><span className="version">FOUNDER MVP / 01</span></div><span className="badge local">● 仅本机访问</span></header>
    <main>
      <div className="intro"><div><span className="eyebrow">LOCAL WORK CONTROL</span><h1>让每次尝试，都有迹可循。</h1><p>保存目标，观察运行，随时回来继续查看。</p></div><div className="counters"><span><strong>{tasks.length}</strong>Tasks</span><span><strong>{runs.length}</strong>Runs</span><span><strong>{active ? '1 / 1' : '0 / 1'}</strong>活动 mock</span></div></div>
      <div className="mode-banner"><span className="badge mock">MOCK ONLY</span><p><strong>execution_mode=mock</strong> · 界面、API 和存储真实工作；执行过程全部模拟。无 Git / Codex preflight，无真实 Verification、Diff、Accept 或 Delivery。</p></div>
      {connectionError && <p role="alert" className="error">{connectionError}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {active && <div className="active-strip">全局已有一个活动 mock Run。<button type="button" className="link" onClick={() => navigate(active.task_id, active.id)}>查看活动 mock</button></div>}
      <div className="workspace">
        <aside className="panel task-list"><div className="section-heading"><h2>任务</h2><button className="link" type="button" disabled={busy} onClick={() => { attempt.current = null; navigate(''); setNotice(''); }}>＋ 新建 Task</button></div>
          {tasks.length === 0 ? <p className="empty-note">还没有 Task。<br />从右侧保存一个清晰的工作目标。</p> : tasks.map(t => <button type="button" key={t.id} className={`task-card ${t.id === task?.id ? 'selected' : ''}`} aria-label={`查看 Task ${t.goal}`} onClick={() => { if (!busy) { attempt.current = null; navigate(t.id, runs.find(r => r.task_id === t.id)?.id); } }}><strong>{t.goal}</strong><small>mock · v{t.revision}</small><code>{t.repository_path}</code></button>)}
          <div className="closed-capabilities"><h3>仍然关闭</h3><p>真实 Agent 执行<br />Verification 执行<br />Accept / Accepted Delivery</p><small>G1 / G2 未开放<br />原 Product / Technical Gate 不变</small></div>
        </aside>
        <div className="panel task-panel"><TaskForm key={task?.id ?? 'new'} task={task} onSaved={saved => { setTasks(old => [saved, ...old.filter(t => t.id !== saved.id)]); if (saved.id !== task?.id) navigate(saved.id); setNotice('Task 已保存'); }} />
          {task && <section className="run-control"><span className="eyebrow">02 / MOCK EXECUTION</span><h2>发起一次模拟</h2><code className="identity">{task.id}</code><p className="task-state">ready · 无真实交付</p>
            <label htmlFor="scenario">模拟场景</label><select id="scenario" value={scenario} disabled={busy || !!attempt.current} onChange={e => setScenario(e.target.value as Scenario)}><option value="success">成功 · 固定模拟步骤</option><option value="failure">失败 · 模拟 Agent 阶段失败</option><option value="cancel">取消 · 固定模拟取消</option></select>
            <button type="button" className="primary full" disabled={busy || !!active} onClick={() => void start()}>{busy ? '操作中…' : '启动 mock Run'}</button><p className="hint">每次新尝试单独保存。取消只停止模拟，不代表 OS 进程树终止。</p>
          </section>}
        </div>
        <div className="panel run-panel"><RunDetail run={run} onCancel={() => void cancel()} busy={busy} />
          <section className="history"><div className="section-heading"><h2>运行历史</h2><span className="hint">{taskRuns.length} 次尝试</span></div>
            {taskRuns.length === 0 ? <p className="empty-note">尚无运行记录。模拟结束也不会把 Task 标记为 done。</p> : taskRuns.map(r => <button type="button" className={`history-item ${r.id === run?.id ? 'selected' : ''}`} key={r.id} onClick={() => navigate(r.task_id, r.id)}><span><strong>{states[r.state]}</strong><small>{new Date(r.created_at).toLocaleString('zh-CN')} · {r.scenario}</small><code>{r.id}</code></span><span className="badge mock">mock</span></button>)}
          </section>
        </div>
      </div>
      <footer>Founder v0 · SQLite 本地持久化 · 页面关闭不清除历史 · 无真实交付物</footer>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
