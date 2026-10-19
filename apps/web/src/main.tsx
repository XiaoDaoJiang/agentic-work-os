import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
// Pure shared contract only; no server/runtime module is bundled into the browser.
import { ApiError, parseTaskInput, type Task, type TaskInput, type Run, type RunLog, type Scenario, type RunEvidence, type ReviewContext } from '../../server/src/contracts';
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
const states: Record<Run['state'], string> = { waiting_review:'待审核', completed:'审核完成', running: '模拟运行中', succeeded: '模拟成功', failed: '模拟失败', cancelled: '模拟取消', interrupted: '模拟中断' };
const stateLabel = (run: Run) => run.execution_mode === 'mock' ? states[run.state] : run.input_snapshot.verification ? ({waiting_review:'等待人工审核',completed:'审核完成',running:'执行与验证中',succeeded:'验证命令通过 · 捕获版本一致',failed:'执行或验证未通过',cancelled:'已确认取消',interrupted:'停止状态未知 · 资源保持锁定'})[run.state] : ({ waiting_review:'等待人工审核',completed:'审核完成', running: 'Codex 执行中', succeeded: 'Agent 已退出 · 尚未验证', failed: 'Agent 执行失败', cancelled: '已确认取消', interrupted: '停止状态未知 · 资源保持锁定' })[run.state];
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
    <p className="hint">保存时仅记录输入；启动真实执行时将检查仓库并创建独立工作副本。验证草稿仅保存，运行时另行选择才执行。请勿填写密钥或生产凭据。</p>
    {error && <div role="alert" className="error">{error}</div>}
    <label htmlFor="goal">目标</label>
    <textarea id="goal" value={goal} onChange={e => setGoal(e.target.value)} required maxLength={4000} rows={3} aria-invalid={!!fields.goal} aria-describedby="error-goal" placeholder="这次工作需要解决什么？" />{fieldError('goal')}
    <label htmlFor="dod">DoD（每行一条）</label>
    <textarea id="dod" value={dod} onChange={e => setDod(e.target.value)} required rows={3} aria-invalid={!!fields.definition_of_done} aria-describedby="error-definition_of_done" placeholder="描述可观察的完成标准" />{fieldError('definition_of_done')}
    <label htmlFor="repository">仓库绝对路径</label>
    <input id="repository" value={repository} onChange={e => setRepository(e.target.value)} required maxLength={2048} aria-invalid={!!fields.repository_path} aria-describedby="error-repository_path" placeholder="C:\Projects\example 或 /path/to/example" />{fieldError('repository_path')}
    <label htmlFor="verification">Verification 草稿（仅保存）</label>
    <textarea id="verification" value={command} onChange={e => setCommand(e.target.value)} required maxLength={8000} rows={2} aria-invalid={!!fields['verification_draft.command']} aria-describedby="error-verification_draft.command" placeholder="例如 npm test；保存草稿不会执行" />{fieldError('verification_draft.command')}
    <label htmlFor="timeout">草稿超时（秒）</label>
    <input id="timeout" type="number" min={1} max={3600} value={timeout} onChange={e => setTimeoutValue(e.target.value)} required aria-invalid={!!fields['verification_draft.timeout_seconds']} aria-describedby="error-verification_draft.timeout_seconds" />{fieldError('verification_draft.timeout_seconds')}
    <button className="primary full" disabled={saving} type="submit">{saving ? '保存中…' : task ? '保存 Task 修改' : '创建 Task'}</button>
    {task && <p className="hint">修改仅影响下一次 Run。已有 Run 的输入快照不会改变。</p>}
  </form>;
}
function ReviewPanel({run,evidence,onChanged}:{run:Run;evidence:RunEvidence|null;onChanged:(run:Run)=>void}) {
  const [context,setContext]=useState<ReviewContext|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const pending=useRef<{decision:'accept'|'reject';request_id:string}|null>(null);
  useEffect(()=>{let stopped=false;let timer:ReturnType<typeof setTimeout>;setContext(null);setError('');pending.current=null;
    const refresh=async()=>{try{const next=await api<ReviewContext>(`/api/runs/${run.id}/review`);if(!stopped)setContext(next);}catch(err){if(!stopped)setError(message(err));}finally{if(!stopped)timer=setTimeout(refresh,2000);}};
    void refresh();return()=>{stopped=true;clearTimeout(timer);};
  },[run.id,run.state]);
  async function decide(decision:'accept'|'reject') {
    if(!context?.package)return;setBusy(true);setError('');
    if(pending.current?.decision!==decision)pending.current={decision,request_id:crypto.randomUUID()};
    try {const result=await api<{run:Run}>(`/api/runs/${run.id}/review`,'POST',{...pending.current,package_id:context.package.id,package_sha256:context.package.sha256,note:''});pending.current=null;onChanged(result.run);setContext(await api<ReviewContext>(`/api/runs/${run.id}/review`));}
    catch(err){setError(message(err));}finally{setBusy(false);}
  }
  async function download() {
    setBusy(true);setError('');
    try {if(!sessionToken)sessionToken=(await api<{session_token:string}>('/api/session')).session_token;
      const response=await fetch(`/api/runs/${run.id}/delivery`,{method:'POST',headers:{'Content-Type':'application/json','X-WorkOS-Session':sessionToken},body:'{}'});
      if(!response.ok){const failure=await response.json();if(failure.code==='LOCAL_SESSION_REQUIRED')sessionToken='';throw new Error(failure.message);}
      const href=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=href;link.download=`${context?.package?.id??run.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(href),1000);setContext(await api<ReviewContext>(`/api/runs/${run.id}/review`));
    }catch(err){setError(message(err));}finally{setBusy(false);}
  }
  const packageReadable=context?.artifacts.some(item=>item.artifact.type==='change_package'&&item.status==='healthy');
  const gateClosed=context?.blockers.some(reason=>reason.includes('G2'));
  const resourceHeld=context?.blockers.some(reason=>reason.includes('保持全局锁'));
  const acceptBlocked=!context||context.blockers.some(reason=>!reason.startsWith('上次检查'));
  const result=evidence?.verification;
  return <section className="review-panel" aria-label="交付物审核">
    <span className="eyebrow">FROZEN RESULT</span><h3>本次目标</h3><p className="frozen-goal">{run.input_snapshot.task.goal}</p>
    <ul className="dod-list">{run.input_snapshot.task.definition_of_done.map((item,index)=><li key={index}>{item}</li>)}</ul>
    <h3>最终变更</h3>{context?.diff!==null&&context?.diff!==undefined?<pre data-testid="review-diff" className="review-diff">{context.diff||'没有文件变更'}</pre>:<p className="warning">封存变更尚不可读取。</p>}
    <h3>验证结果</h3><pre>{run.input_snapshot.verification?.requested_command}</pre>
    {result&&<p data-testid="verification-result"><strong>{{passed:'命令通过',failed:'命令失败',error:'验证执行错误',timeout:'已确认超时',cancelled:'已取消',interrupted:'资源未知'}[result.outcome]}</strong> · 退出码 {result.exit_code??'未取得'}<br/>{result.version_match==='match'?'验证前后捕获版本一致':'最终版本未被同一验证结果证明'}</p>}
    {result&&result.outcome!=='passed'&&<p className="warning">验证未通过。请结合冻结目标与变更自行判断，接受不会把失败的验证改写为通过。</p>}
    {(['stdout','stderr'] as const).map(stream=><details key={stream}><summary>封存验证 {stream}</summary><pre>{context?.diff!==null?evidence?.output.filter(row=>row.stage==='verification'&&row.stream===stream).map(row=>row.text).join('')||'没有输出':'封存证据不可用'}</pre></details>)}
    {context?.blockers.map(reason=><p className="warning" key={reason}>{reason}</p>)}
    {context?.decision?<div className="review-decision"><strong data-testid="review-decision">{context.decision.decision==='accept'?'已接受交付物':'已拒绝本次结果'}</strong><p className="hint">{new Date(context.decision.decided_at).toLocaleString('zh-CN')} · 历史决定保持不变</p>
      {context.delivery_integrity&&<p data-testid="delivery-integrity" className={context.delivery_integrity.value==='healthy'?'notice':'error'}>{{healthy:'当前封存对象完整',missing:'当前交付物缺失',corrupt:'当前交付物损坏'}[context.delivery_integrity.value]}。接受记录不会因此改写。</p>}
      {context.decision.decision==='accept'&&<button type="button" className="primary" disabled={busy||gateClosed||resourceHeld||context.delivery_integrity?.value!=='healthy'} onClick={()=>void download()}>{busy?'检查交付物…':'检查并下载交付物'}</button>}
    </div>:<div className="review-actions"><button type="button" className="primary" disabled={busy||acceptBlocked||run.state!=='waiting_review'} onClick={()=>void decide('accept')}>{busy?'检查与提交中…':context?.last_check?.drift==='clear'?'接受交付物':'重新检查并接受'}</button><button type="button" className="danger" disabled={busy||gateClosed||!packageReadable||run.state!=='waiting_review'} onClick={()=>void decide('reject')}>拒绝本次结果</button></div>}
    <p className="hint">接受表示获得同一 Run 的可重放交付物，不会 merge、push 或发布。资源状态未知时继续阻止新运行。</p>
    {error&&<p role="alert" className="error">{error}</p>}
    <details><summary>封存身份与上次重放检查</summary><p className="hint">普通刷新只检查封存对象。接受和下载会重新检查当前漂移并重放。</p><pre>{JSON.stringify({package:context?.package,last_check:context?.last_check},null,2)}</pre></details>
  </section>;
}
function RunDetail({ run, onCancel, busy, onChanged }: { run?: Run; onCancel: () => void; busy: boolean; onChanged:(run:Run)=>void }) {
  const [logs, setLogs] = useState<RunLog[]>([]); const [evidence,setEvidence]=useState<RunEvidence|null>(null); const [error, setError] = useState('');
  useEffect(() => {
    setLogs([]); setEvidence(null); setError(''); if (!run) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try { const [result,proof] = await Promise.all([api<RunLog[]>(`/api/runs/${run.id}/logs`),api<RunEvidence>(`/api/runs/${run.id}/evidence`)]); if (!stopped) { setLogs(result);setEvidence(proof); setError(''); } }
      catch (err) { if (!stopped) setError(message(err)); }
      finally { if (!stopped) timer = setTimeout(refresh, 300); }
    };
    void refresh(); return () => { stopped = true; clearTimeout(timer); };
  }, [run?.id]);
  if (!run) return <section className="empty detail-empty"><span className="empty-symbol">↗</span><h2>运行记录将在这里出现</h2><p>保存 Task 后启动 mock Run，观察模拟步骤与持久化日志。每次尝试都会保留独立历史。</p></section>;
  return <section>
    <div className="section-heading"><div><span className="eyebrow">03 / RUN DETAIL</span><h2>运行详情</h2></div><span data-testid="run-state" className={`badge ${run.state}`}>{stateLabel(run)}</span></div>
    <code data-testid="run-id" className="identity">{run.id}</code>
    <p className="hint">execution_mode={run.execution_mode} · 输入版本 v{run.input_snapshot.task.revision}</p>
    <ol className="phases" aria-label="运行步骤">{(run.execution_mode === 'mock' ? phases : run.input_snapshot.execution?.review_identity?phases:run.input_snapshot.verification ? ['prepare','agent','test'] : ['prepare', 'agent']).map(phase => <li key={phase} className={run.phase === phase ? 'current' : ''}>{phase}</li>)}</ol>
    {run.state === 'running' && <button type="button" className="danger" onClick={onCancel} disabled={busy}>{run.execution_mode === 'mock' ? '取消 mock Run' : run.input_snapshot.verification ? '请求取消 Run' : '请求取消 Codex'}</button>}
    {run.execution_mode === 'mock' && run.state === 'interrupted' && <p className="warning">服务重启时未完成的 mock 已标为 interrupted，不会自动续跑或补写成功。可保留历史并发起新的尝试。</p>}
    {!['running','waiting_review','completed'].includes(run.state) && <p className="terminal-reason">{run.terminal_reason}<br />{run.execution_mode === 'mock' ? '这不是代码交付或 OS 进程终止证据。' : run.input_snapshot.verification ? '验证仅为命令与捕获版本证据，不代表全部 DoD。Review / Delivery 仍关闭。' : '仅为 Agent 阶段结果；未执行 Verification，尚无 Review 或交付。资源未知时禁止新运行。'}</p>}
    {['waiting_review','completed'].includes(run.state)&&<ReviewPanel key={run.id} run={run} evidence={evidence} onChanged={onChanged}/> }
    {run.input_snapshot.verification&&!['waiting_review','completed'].includes(run.state) && <section aria-label="验证证据" className="verification-evidence">
      <h3>本次验证</h3>
      <p className="hint">验证命令只执行一次。以下均为已保存的捕获版本，当前 Workspace 未重新检查。尚无封存 Package 或交付。</p>
      <pre>{run.input_snapshot.verification.requested_command}</pre>
      {evidence?.verification ? <p data-testid="verification-result"><strong>{{passed:'命令通过',failed:'命令失败',error:'证据捕获或执行错误',timeout:'已确认超时',cancelled:'已取消',interrupted:'资源未知'}[evidence.verification.outcome]}</strong> · 退出码 {evidence.verification.exit_code ?? '未取得'}<br />{{match:'验证前后捕获版本一致',changed:'验证期间版本发生变化，最终版本未被同一结果证明',unknown:'最终版本关系尚未确认'}[evidence.verification.version_match]}</p> : <p>验证结果尚未形成；不会从 Agent 自述推断通过。</p>}
      {evidence?.captures.map(capture=><details key={capture.point}><summary>{capture.point==='before'?'验证前 Diff':'验证后 Diff'} · {capture.version.entries.length} 个变更</summary><p className="hint">树版本 <code>{capture.version.resultTreeHash}</code><br />忽略规则：未跟踪且被 Git 忽略的文件不包含；已跟踪文件仍包含。</p><pre>{capture.version.diff || '没有文件变更'}</pre></details>)}
      {(['stdout','stderr'] as const).map(stream=><details key={stream}><summary>验证 {stream}</summary><pre>{evidence?.output.filter(x=>x.stage==='verification'&&x.stream===stream).map(x=>x.text).join('') || '尚无输出'}</pre></details>)}
    </section>}
    <details open={run.state==='running'||run.execution_mode==='mock'}><summary>执行日志 · {logs.length} 条</summary>
    <div className="log-heading"><h3>{run.execution_mode === 'mock' ? '持久化模拟日志' : run.input_snapshot.verification ? 'Run 执行日志' : 'Codex 执行日志'}</h3><span>{logs.length} 条 · 自动刷新</span></div>
    {error && <p role="alert" className="error">日志暂不可更新：{error}。已保存内容保留。</p>}
    <div role="log" aria-label={run.execution_mode === 'mock' ? '持久化模拟日志' : run.input_snapshot.verification ? 'Run 执行日志' : 'Codex 执行日志'} aria-live="polite" className="logs">{logs.map(log => <p key={log.sequence}><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleTimeString('zh-CN', { hour12: false })}</time><span>{log.message}</span></p>)}</div></details>
    {run.input_snapshot.execution && <p className="hint">trusted-local · Workspace 不是 Sandbox<br />基线 <code>{run.input_snapshot.execution.base_revision}</code><br />工作副本 <code>{run.input_snapshot.execution.workspace_path}</code></p>}
    <details><summary>不可变输入快照 · v1</summary><pre data-testid="snapshot">{JSON.stringify(run.input_snapshot, null, 2)}</pre></details>
  </section>;
}
function App() {
  const [tasks, setTasks] = useState<Task[]>([]); const [runs, setRuns] = useState<Run[]>([]);
  const [selection, setSelection] = useState(readLocation);
  const [verificationChoice,setVerificationChoice]=useState<{taskId:string;revision:number;command:string;timeout:number}|null>(null);
  const [mode, setMode] = useState<'mock' | 'real'>('mock');
  const [capabilities, setCapabilities] = useState<{ real_execution: boolean; accept:boolean; codex_profile: { reason: string } }>({ real_execution: false, accept:false, codex_profile: { reason: '正在读取当前能力' } });
  const [resourceLock, setResourceLock] = useState<{run_id: string | null; task_id: string | null} | null>(null);
  const [scenario, setScenario] = useState<Scenario>('success');
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState(''); const [busy, setBusy] = useState(false);
  const attempt = useRef<{ taskId: string; scenario: Scenario; mode: 'mock' | 'real'; id: string; revision?:number } | null>(null);
  function navigate(taskId: string, runId = '') {
    const q = new URLSearchParams(); if (taskId) q.set('task', taskId); if (runId) q.set('run', runId);
    history.replaceState(null, '', `#${q}`); setSelection({ taskId, runId }); setError('');
  }
  useEffect(() => {
    const onHash = () => setSelection(readLocation()); window.addEventListener('hashchange', onHash);
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const [nextTasks, nextRuns, nextCapabilities, nextLock] = await Promise.all([api<Task[]>('/api/tasks'), api<Run[]>('/api/runs'), api<typeof capabilities>('/api/capabilities'), api<typeof resourceLock>('/api/resource-lock')]);
        if (!stopped) { setTasks(nextTasks); setRuns(nextRuns); setCapabilities(nextCapabilities); setResourceLock(nextLock); setConnectionError(''); }
      } catch (err) { if (!stopped) setConnectionError(`暂时无法连接本地服务：${message(err)}。记录保存在本地数据库；服务恢复后将继续读取。`); }
      finally { if (!stopped) timer = setTimeout(refresh, 300); }
    };
    void refresh(); return () => { stopped = true; clearTimeout(timer); window.removeEventListener('hashchange', onHash); };
  }, []);
  const task = tasks.find(t => t.id === selection.taskId);
  const run = runs.find(r => r.id === selection.runId);
  const active = runs.find(r => r.state === 'running'||r.state==='waiting_review');
  const taskRuns = task ? runs.filter(r => r.task_id === task.id) : runs;
  async function start() {
    if (!task) return; setBusy(true); setError(''); setNotice('');
    attempt.current ??= { taskId: task.id, scenario, mode, id: crypto.randomUUID(), ...(mode==='real'&&verificationChoice?.taskId===task.id ? {revision:verificationChoice.revision}: {}) };
    const request = attempt.current;
    try {
      const result = await api<{ run: Run; replay: boolean }>(`/api/tasks/${request.taskId}/runs`, 'POST',
        request.mode === 'mock' ? { execution_mode: 'mock', scenario: request.scenario, request_id: request.id } : { execution_mode: 'real', request_id: request.id, ...(request.revision ? {verify:true,expected_task_revision:request.revision}: {}) });
      setRuns(old => [result.run, ...old.filter(r => r.id !== result.run.id)]);
      attempt.current = null; navigate(result.run.task_id, result.run.id);
      setNotice(result.replay ? '已恢复同一请求的 Run，没有创建重复运行' : result.run.execution_mode === 'mock' ? 'mock Run 已创建；没有启动真实 Agent' : 'Codex Run 已创建；结果尚未验证');
    } catch (err) { if(err instanceof ApiError && err.code==='TASK_CHANGED'){attempt.current=null;setVerificationChoice(null);setError(`${message(err)}。请重新选择当前保存的验证命令。`);} else setError(`${message(err)}。再次点击将重试同一个请求，不覆盖历史。`); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!run) return; setBusy(true); setError('');
    try { const result = await api<Run>(`/api/runs/${run.id}/cancel`, 'POST', {}); setRuns(old => old.map(r => r.id === result.id ? result : r)); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <>
    <header><div className="brand"><span className="brand-mark">W</span><strong>Agentic Work OS</strong><span className="version">FOUNDER MVP / 04</span></div><span className="badge local">● 仅本机访问</span></header>
    <main>
      <div className="intro"><div><span className="eyebrow">LOCAL WORK CONTROL</span><h1>让每次尝试，都有迹可循。</h1><p>保存目标，观察运行，随时回来继续查看。</p></div><div className="counters"><span><strong>{tasks.length}</strong>Tasks</span><span><strong>{runs.length}</strong>Runs</span><span><strong>{active ? '1 / 1' : '0 / 1'}</strong>活动运行</span></div></div>
      <div className="mode-banner"><span className="badge mock">{capabilities.real_execution ? 'TRUSTED LOCAL' : 'MOCK ONLY'}</span><p><strong>{capabilities.real_execution ? '当前 Windows Codex profile 可用' : 'execution_mode=mock'}</strong> · {capabilities.codex_profile.reason} {capabilities.accept?'可审核并下载封存交付物。':'Accept / Delivery 仍关闭。'}</p></div>
      {connectionError && <p role="alert" className="error">{connectionError}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {resourceLock && !active && <p role="alert" className="warning">停止状态尚未确认，资源锁保持。已阻止新运行，请保留历史并检查本地受控进程。没有自动重试或强制解锁。<button type="button" className="link" onClick={() => { const locked = runs.find(r => r.id === resourceLock.run_id); if (locked) navigate(locked.task_id, locked.id); else if (resourceLock.task_id) navigate(resourceLock.task_id); }}>{resourceLock.run_id ? '查看阻塞 Run' : '查看准备中的 Task'}</button></p>}
      {active && <div className="active-strip">全局已有一个活动 Run。<button type="button" className="link" onClick={() => navigate(active.task_id, active.id)}>查看活动运行</button></div>}
      <div className="workspace">
        <aside className="panel task-list"><div className="section-heading"><h2>任务</h2><button className="link" type="button" disabled={busy} onClick={() => { attempt.current = null; navigate(''); setNotice(''); }}>＋ 新建 Task</button></div>
          {tasks.length === 0 ? <p className="empty-note">还没有 Task。<br />从右侧保存一个清晰的工作目标。</p> : tasks.map(t => <button type="button" key={t.id} className={`task-card ${t.id === task?.id ? 'selected' : ''}`} aria-label={`查看 Task ${t.goal}`} onClick={() => { if (!busy) { attempt.current = null; navigate(t.id, runs.find(r => r.task_id === t.id)?.id); } }}><strong>{t.goal}</strong><small>{{ready:'待执行',review:'待审核',done:'已接受交付',blocked:'资源待核对'}[t.state]} · v{t.revision}</small><code>{t.repository_path}</code></button>)}
          <div className="closed-capabilities"><h3>能力范围</h3><p>{!capabilities.real_execution && <>真实 Agent 执行未开放<br /></>}{capabilities.accept?'封存审核 / 交付已开放':'Accept / Accepted Delivery 关闭'}</p><small>{capabilities.real_execution ? capabilities.accept?'G1 / G2 限当前 profile':'G1 限当前 profile · G2 关闭' : 'G1 / G2 未开放'}<br />原 Product / Technical Gate 不变</small></div>
        </aside>
        <div className="panel task-panel"><TaskForm key={task?.id ?? 'new'} task={task} onSaved={saved => { setTasks(old => [saved, ...old.filter(t => t.id !== saved.id)]); if (saved.id !== task?.id) navigate(saved.id); setNotice('Task 已保存'); }} />
          {task && <section className="run-control"><span className="eyebrow">02 / RUN</span><h2>{mode === 'mock' ? '发起一次模拟' : '交给 Codex 执行'}</h2><code className="identity">{task.id}</code><p className="task-state">{{ready:'ready · 待执行',review:'review · 等待审核本次结果',done:'done · 已接受可重放交付物',blocked:'blocked · 已拒绝结果，资源仍待核对'}[task.state]}</p>
            <label htmlFor="execution-mode">执行方式</label><select id="execution-mode" value={mode} disabled={busy || !!attempt.current} onChange={e => setMode(e.target.value as 'mock' | 'real')}><option value="mock">模拟 · 不读取仓库</option><option value="real" disabled={!capabilities.real_execution}>Codex · 当前 Windows profile</option></select>
            {mode === 'mock' && <><label htmlFor="scenario">模拟场景</label><select id="scenario" value={scenario} disabled={busy || !!attempt.current} onChange={e => setScenario(e.target.value as Scenario)}><option value="success">成功 · 固定模拟步骤</option><option value="failure">失败 · 模拟 Agent 阶段失败</option><option value="cancel">取消 · 固定模拟取消</option></select></>}
            {mode==='real' && <div className="verification-choice"><label><input type="checkbox" checked={verificationChoice?.taskId===task.id} disabled={busy||!!attempt.current} onChange={e=>setVerificationChoice(e.target.checked?{taskId:task.id,revision:task.revision,command:task.verification_draft.command,timeout:task.verification_draft.timeout_seconds}:null)} /> 本次执行验证</label><p className="hint">明确选择后，Agent 成功且安全退出才运行下面已保存的命令。表单中未保存的编辑不参与本次运行。</p><pre>{verificationChoice?.taskId===task.id ? verificationChoice.command : task.verification_draft.command}</pre><p className="hint">Task v{verificationChoice?.taskId===task.id?verificationChoice.revision:task.revision} · {verificationChoice?.taskId===task.id?verificationChoice.timeout:task.verification_draft.timeout_seconds} 秒 · Windows PowerShell · 独立工作副本</p></div>}
            <button type="button" className="primary full" disabled={busy || !!active || !!resourceLock || (mode === 'real' && !capabilities.real_execution)} onClick={() => void start()}>{busy ? '操作中…' : mode === 'mock' ? '启动 mock Run' : '启动 Codex Run'}</button><p className="hint">{mode === 'mock' ? '每次新尝试单独保存。取消只停止模拟，不代表 OS 进程树终止。' : 'trusted-local，保留 Codex 原生权限限制。只支持干净的普通 Git 仓库；独立工作副本，Agent 最长 3 分钟，验证使用所选超时。取消需等待停止和输出收尾确认。'}</p>
          </section>}
        </div>
        <div className="panel run-panel"><RunDetail run={run} onCancel={() => void cancel()} busy={busy} onChanged={changed=>setRuns(old=>old.map(item=>item.id===changed.id?changed:item))} />
          <section className="history"><div className="section-heading"><h2>运行历史</h2><span className="hint">{taskRuns.length} 次尝试</span></div>
            {taskRuns.length === 0 ? <p className="empty-note">尚无运行记录。模拟结束也不会把 Task 标记为 done。</p> : taskRuns.map(r => <button type="button" className={`history-item ${r.id === run?.id ? 'selected' : ''}`} key={r.id} onClick={() => navigate(r.task_id, r.id)}><span><strong>{stateLabel(r)}</strong><small>{new Date(r.created_at).toLocaleString('zh-CN')} · {r.execution_mode === 'mock' ? r.scenario : r.input_snapshot.verification ? 'Codex · 单次验证' : 'Codex · Agent 阶段'}</small><code>{r.id}</code></span><span className="badge mock">{r.execution_mode}</span></button>)}
          </section>
        </div>
      </div>
      <footer>Founder v0 · SQLite 本地持久化 · 页面关闭不清除历史 · done 不等于合并或发布</footer>
    </main>
  </>;
}
createRoot(document.getElementById('root')!).render(<App />);
