import { ApiError, type Run } from './contracts.js';
import { Store } from './store.js';

// Deliberately tiny executor boundary. No real adapter registration, command or process API.
export interface MockExecution {
  start(run: Run): void;
  cancel(id: string): Run;
  close(): void;
}
export class MockExecutor implements MockExecution {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private healthy = true;
  constructor(private store: Store, private intervalMs = 650) {}
  assertHealthy() { if (!this.healthy) throw new ApiError(503, 'MOCK_UNAVAILABLE', '模拟调度器状态未知；请重启服务后查看 interrupted 记录'); }
  start(run: Run) {
    this.assertHealthy();
    if (this.timers.has(run.id) || run.state !== 'running') return;
    let step = 0;
    const tick = () => {
      try {
        if (this.store.getRun(run.id).state !== 'running') { this.stop(run.id); return; }
        step += 1;
        if (step === 1) this.store.appendProgress(run.id, 'prepare', 'prepare：模拟准备完成，仓库路径仅作为输入保存。');
        if (step === 2) this.store.appendProgress(run.id, 'agent', 'agent：模拟日志 1/2；没有启动真实 Coding Agent。');
        if (step === 3) this.store.appendProgress(run.id, 'agent', 'agent：模拟日志 2/2；没有修改任何仓库文件。');
        if (step === 4 && run.scenario !== 'success') {
          this.store.finishRun(run.id, run.scenario === 'failure' ? 'failed' : 'cancelled', 'agent',
            run.scenario === 'failure' ? 'mock_failure' : 'mock_scenario_cancel');
          this.stop(run.id); return;
        }
        if (step === 4) this.store.appendProgress(run.id, 'test', 'test：Verification 草稿只保存、不执行；没有验证结果。');
        if (step === 5) this.store.appendProgress(run.id, 'review', 'review：真实 Accept / Delivery 关闭；未生成 Diff 或 Change Package。');
        if (step === 6) {
          this.store.finishRun(run.id, 'succeeded', 'complete', 'mock_success'); this.stop(run.id); return;
        }
        this.timers.set(run.id, setTimeout(tick, this.intervalMs));
      } catch {
        this.healthy = false; this.close();
        console.error('Mock persistence/scheduling failure. New starts disabled; restart to reconcile saved state.');
      }
    };
    this.timers.set(run.id, setTimeout(tick, this.intervalMs));
  }
  private stop(id: string) { clearTimeout(this.timers.get(id)); this.timers.delete(id); }
  cancel(id: string): Run {
    this.assertHealthy(); const run = this.store.getRun(id);
    const result = this.store.finishRun(id, 'cancelled', run.phase, 'mock_user_cancel');
    this.stop(id); return result;
  }
  close() { for (const id of this.timers.keys()) this.stop(id); }
}
