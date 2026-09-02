# Agentic Work OS — Local Runtime Host Decision

> 状态：Accepted — Technical Validation architecture refinement  
> 日期：2026-09-02  
> 决策人：Project owner  
> 上游基线：[Milestone 0 Experiment Plan](./50-milestone-0-experiment-plan.md)、[Cross-platform Runtime Decision](./55-cross-platform-runtime-decision.md)  
> 适用范围：Local Runtime、Agent Driver、Workspace、Process Boundary、Runtime ownership / reconciliation

## 1. 决策摘要

在 Orca、Herdr、Buzz、Goose、Multica 等本地 Agent Runtime / supervisor 实现的横向研究，以及当前 Milestone 0 hostile-process 证据之后，Agentic Work OS 将本地执行问题进一步拆为独立职责，而不再把 `LocalRunner`、PTY 或 ProcessKit 当成完整 Local Runtime。

统一架构边界：

```text
LocalRuntimeHost
├── RunSupervisor
├── AgentDriver
├── WorkspaceProvider
├── TerminalTransport
├── ProcessBoundary
├── AgentSessionBinding
└── Reconciler / Reaper
```

关键约束：

- `ProcessKit` 是 `ProcessBoundary` 的首个实验 backend，不是 Agentic Work OS 的 Runtime domain model；
- PTY / Terminal 只属于 `TerminalTransport`，终端关闭或 child 退出不能直接证明整个 Run 已安全停止；
- Workspace isolation 与 Sandbox 分离；Git worktree / disposable working copy 不构成宿主机安全边界；
- Agent session 与 OS process 分离；provider session id 不能单独代表可恢复 Run；
- Run 的“cancelled / safe”只能由 ProcessBoundary、stream drain、Workspace lease 与 reconciliation 机器事实共同支持；
- M0 继续使用一次性 Rust helper，不因为本决策提前建设 persistent daemon、detach/reattach、Session Resume、多 Agent 或 Remote Runner。

本决策只收敛技术职责和后续验证合同，不改变 Product Validation Protocol，不构成 Spike 1 / Technical Gate PASS，也不解锁产品 MVP WWA。

## 2. 横向研究后的共同事实

### 2.1 Terminal ownership 不等于 process ownership

Orca / Herdr 类工具证明 PTY 是控制交互式 Coding Agent 的高价值抽象，但 PTY 生命周期与整个 descendant process tree 的物理生命周期并不等价。

因此 Agentic Work OS 必须保留独立 `ProcessBoundary`：

```text
TerminalTransport
  ├── stdio
  └── PTY / ConPTY

ProcessBoundary
  ├── ownership
  ├── membership
  ├── cancel / timeout
  ├── descendant teardown
  └── post-stop observation
```

上层不得以 terminal close、TUI idle、root PID exit 或 Agent 文案作为 `resource_state=safe` 的替代证据。

### 2.2 Runtime Host 与 Agent Runtime 必须分层

Multica 的 daemon / runtime target 模型、Herdr 的 persistent terminal server、Buzz 的 managed-agent lifecycle 都表明：长期产品需要一个机器级 Runtime Host 概念，而不是每个 Agent Adapter 自己 spawn 进程。

但 M0 当前只需要证明一次 Run 的执行边界可信，因此：

```text
M0
Node Harness / Control Plane
        │ JSONL over stdio
        ▼
Rust local runtime helper
        ▼
ProcessBoundary backend
```

未来若出现真实需求，再演化为：

```text
LocalRuntimeHost daemon
├── local IPC
├── RuntimeRegistry
├── active Run ownership
├── startup reconciliation
└── reaper
```

persistent daemon 不是当前 Gate 前置条件。

### 2.3 Agent Harness / Driver 不应拥有物理进程语义

Buzz 的 harness / ACP 抽象与 Goose 的 Agent/Extension 分层支持以下长期边界：

```text
AgentDriver
├── CodexDriver
├── ClaudeDriver
├── ACPDriver
└── CustomCliDriver
```

`AgentDriver` 负责：

- Agent capability discovery；
- prompt / input 映射；
- structured event / hook / ACP 适配；
- provider session id；
- Agent semantic state。

`AgentDriver` 不负责：

- descendant tree ownership；
- OS process kill；
- Job / cgroup / process-group membership；
- orphan reaping；
- Workspace filesystem isolation。

所有 AgentDriver 必须通过 Runtime Host / ProcessBoundary 执行，而不能绕过它直接 spawn。

### 2.4 Ownership 需要 receipt，而不是只有 PID

Buzz 的 instance marker / runtime receipt / orphan sweep 说明 PID 只能作为一个瞬时定位信息，不能单独证明 ownership。结合当前 M0 已遇到的 PID liveness / Job membership disagreement，Agentic Work OS 增加一个实验级 `RuntimeReceipt` 合同。

首版必须绑定：

```yaml
runtime_receipt_v0:
  runtime_instance_id: <opaque id>
  run_id: <run id>
  spawn_nonce: <random nonce>
  root_pid: <pid-or-null>
  process_identity:
    kind: <platform-specific identity kind>
    token: <opaque reuse-safe token-or-null>
  containment:
    mechanism: <actual runtime mechanism>
    boundary_id: <opaque boundary id>
  workspace:
    workspace_id: <id>
    repository_identity: <repo-marker-v1 identity>
    canonical_path: <path evidence ref>
  started_at: <timestamp>
  helper_revision: <revision>
```

子进程环境至少允许注入非秘密 ownership marker：

```text
AGENTIC_RUNTIME_ID
AGENTIC_RUN_ID
AGENTIC_SPAWN_NONCE
```

规则：

1. receipt 在成功创建 process boundary 后立即持久化；
2. `root_pid` 必须与 reuse-safe `process_identity` 配对，禁止只存裸 PID；
3. ownership marker 只能证明“该进程声称属于某 Run”，不能单独证明进程仍存活或安全停止；
4. ProcessBoundary membership、OS truth、receipt、marker 可以互相交叉验证，但任一来源冲突必须 fail closed / reconciliation_required；
5. stale / malformed receipt 不自动删除，先进入 reconciliation 并保存诊断证据；
6. cleanup 成功不能回写或删除先前观测到的 survivor / late-write 硬失败事实。

该 Schema 仅用于 M0 进一步验证，不冻结生产数据库 Schema 或 API。

## 3. Local Runtime 职责模型

### 3.1 `RunSupervisor`

负责单次 Run 的确定性执行生命周期：

```text
prepare
→ boundary create
→ agent start
→ input / stream
→ timeout / cancel / natural exit
→ drain
→ reconcile
→ seal evidence
```

它只能消费下层事实，不能自己推断 OS 资源已安全停止。

### 3.2 `AgentDriver`

负责 Agent-specific protocol，不拥有进程。

首个真实候选：`CodexDriver`。

### 3.3 `WorkspaceProvider`

负责 working-copy lifecycle 与 workspace lease。M0 仍以 disposable Git working copy / worktree 类方案为候选。

明确：

```text
WorkspaceProvider != Sandbox
```

### 3.4 `TerminalTransport`

统一交互传输：

```text
stdio
PTY / ConPTY (future when real Agent requires)
```

首个 Codex Spike 优先使用可审计、非 TTY 的 structured / stdio 路径；只有真实能力缺口才引入 PTY。

### 3.5 `ProcessBoundary`

负责物理进程所有权与 teardown。

```text
ProcessBoundary
└── ProcessBoundaryBackend
    ├── ProcessKitBackend       # current M0 candidate
    ├── WindowsNativeBackend    # fallback if Job evidence requires
    ├── LinuxCgroupBackend      # possible future first-party backend
    └── SandboxBackend          # deferred, not equivalent to local containment
```

当前 ProcessKit 3.3.4 必须继续被 adapter 包装，任何 ProcessKit 类型或 mechanism enum 都不得泄漏成为上层长期 domain API。

### 3.6 `AgentSessionBinding`

Agent session 必须绑定到执行上下文：

```yaml
agent_session_binding:
  agent_driver: <driver id>
  provider_session_id: <opaque provider id>
  runtime_instance_id: <runtime id>
  workspace_id: <workspace id>
  repository_identity: <repository identity>
```

M0 不实现 Session Resume；本合同只防止未来把一个 provider session id 错误建模为完整可恢复状态。

### 3.7 `Reconciler / Reaper`

负责 owner crash / app restart / stale receipt / orphan process 等异常路径。

必须区分：

```text
observe
classify
record immutable facts
attempt cleanup
re-observe
```

cleanup 是补救动作，不是删除失败证据的理由。

## 4. M0 允许新增的 ownership 验证

本决策允许在 Spike 1 内增加以下纯技术用例，但不扩大产品 MVP：

| ID | 场景 | 必需结果 |
|---|---|---|
| OWN-01 | boundary 创建并启动 root | receipt 与实际 Run / workspace / mechanism 一致 |
| OWN-02 | root + child + grandchild | ownership marker / receipt 可关联到同一 Run；物理 membership 仍由 OS/backend 证明 |
| OWN-03 | root 提前退出、descendant 尚存 | Run 不因 root exit 被判 safe |
| OWN-04 | duplicate Cancel | receipt 不重复创建；Cancel 幂等 |
| OWN-05 | helper / owner crash | startup reconciliation 发现 nonterminal receipt 并阻断同资源新 Run |
| OWN-06 | stale receipt + process gone | 明确收敛为 interrupted/reconciled；保留原 receipt/evidence |
| OWN-07 | PID reuse | receipt identity token 阻止把新进程当成旧 Run |
| OWN-08 | ownership marker 冲突/缺失 | 不以 marker 单独推断 ownership；冲突进入 INCONCLUSIVE / reconciliation_required |
| OWN-09 | cleanup 后重新观察 | cleanup 结果单独记录，不覆盖先前 survivor / late-write verdict |

这些用例应复用现有 hostile fixture、Resource Reconciliation 与 Windows truth diagnostic，不创建第二套进程测试框架。

## 5. 对当前技术路线的影响

### 保留

- Node / JavaScript M0 Harness；
- Rust native helper；
- Tokio；
- ProcessKit 3.3.4 作为 `ProcessBoundaryBackend` 候选；
- Windows Job Object / Win32 truth 作为 Windows 机器事实；
- Git common-dir persisted UUID repository identity；
- hostile fixture、post-stop observer、artifact/change-package evidence discipline。

### 重新命名 / 收窄

```text
旧理解：ProcessKit / Rust helper = Local Runtime

新理解：Rust helper currently hosts a ProcessBoundary candidate;
        LocalRuntimeHost is the larger ownership/lifecycle abstraction.
```

### 延后

在真实证据出现前不实现：

- persistent Runtime daemon；
- PTY multiplexer；
- detach / reattach；
- Agent Session Resume；
- multi-agent runtime；
- ACP/A2A 全量平台；
- Remote Runner；
- Sandbox；
- runtime marketplace。

## 6. 下一步技术验证顺序

```text
TECH-XP-04 Windows truth diagnostic
        ↓
RuntimeReceipt / OWN-01..OWN-09 contract tests
        ↓
Spike 1 process ownership verdict
        ↓
real CodexDriver / Adapter Spike
        ↓
Spike 2 verdict
        ↓
remaining cross-contracts + Spike 3 / Spike 4
        ↓
Technical Gate
```

若 Windows truth 证明 ProcessKit liveness 与 Win32 terminated state 不一致：

- 保留 ProcessKit containment candidate；
- prospectively 替换/包装 Windows liveness observer；
- 历史 FAIL 不改写。

若 Win32 truth 证明存在 `ACTIVE_ORIGINAL` survivor：

- Spike 1 保持 FAIL；
- 调查 ProcessKit Job assignment / escape；
- 必要时比较 first-party Windows Job backend。

若 independent truth 无法稳定建立：

- Spike 1 = INCONCLUSIVE；
- 不进入真实 Codex。

## 7. 参考项目的使用边界

本轮研究用于架构借鉴，不把任何外部项目的实现当成 Agentic Work OS 已验证事实：

- Orca：Worktree / Terminal / Agent 分层与 terminal lifecycle 参考；
- Herdr：persistent terminal host、local socket、detach/reattach 的长期参考；
- Buzz：Harness / ACP、runtime receipt、ownership marker、orphan reaper 参考；
- Goose：Agent / Extension / Session 分层参考；
- Multica：machine daemon、runtime target、task claim、workspace/session binding 的长期参考。

当前 M0 的 process ownership 结论只允许来自本仓库冻结的 hostile matrix、OS truth、CI artifacts 和 Decision Record。

## 8. 非声明

本文件不声明：

- ProcessKit 已通过 Spike 1；
- Windows/Linux/macOS 已达到相同 containment 强度；
- Runtime daemon 是 MVP Required；
- PTY 是 Codex 必需路径；
- Workspace 是 Sandbox；
- Session Resume 属于 MVP；
- Technical Gate 已通过。
