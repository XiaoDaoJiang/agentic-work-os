# ADR-0001：跨平台 Local Runtime 架构

> 状态：Accepted  
> 日期：2026-09-01  
> 决策人：项目负责人  
> 影响范围：Milestone 0 Technical Validation、LocalRunner、Repository Identity、平台支持矩阵  
> 上游依据：[MVP PRD](../pm/20-mvp-prd.md)、[Milestone 0 Experiment Plan](../pm/50-milestone-0-experiment-plan.md)

## 1. 背景

需求基线最初把 Windows 本地 Codex 作为第一验证环境，因此 Milestone 0 中出现了 Windows Job Object、`FILE_ID_INFO`、Windows 路径和 Windows strong-kill 等具体实现假设。

项目现已明确采用以下产品方向：

- Windows、Linux、macOS 均属于目标平台；
- 上层 Project、Task、Run、Workflow、Agent Adapter、Artifact 和 Review 语义不得依赖具体操作系统；
- 各平台可以提供不同强度的进程 containment，但差异必须以机器可读 Capability 暴露，不得伪装成完全等价；
- Windows 是第一个 Platform Adapter，而不是产品边界。

## 2. 决策

### 2.1 分层

采用两层运行时：

```text
TypeScript / Node Control Plane
  ├── FixedRunCoordinator
  ├── LocalRunner contract
  ├── Agent Adapter
  ├── VerificationInvocation
  ├── Event / Artifact / Review
  └── Resource Reconciliation
              │ JSONL over stdio
              ▼
Small native runner helper
  ├── process spawn
  ├── stdin / stdout / stderr
  ├── timeout / cancel
  ├── process containment
  └── platform capability detection
```

Native helper 首选使用 Rust 进行可行性验证。Rust 仅承担 OS-sensitive 执行原语，不拥有 Project、Task、Workflow 或产品状态机。

### 2.2 统一 LocalRunner 合同

上层只依赖以下逻辑能力：

```text
capabilities
start
send_input
cancel
wait
snapshot
reconcile
```

统一合同必须覆盖：

- 精确 `program + argv[]`，默认不经过 shell；
- 冻结的 cwd 与环境策略；
- stdin 字节输入；
- stdout / stderr 分流、各自严格递增序号和 drain 事实；
- 正常退出、非零退出、启动失败、timeout 和 cancel；
- 幂等 Cancel；
- 每个 Run 最多一个业务终态；
- 终态后只允许 resource reconciliation；
- 进程、输出、Workspace lease 和 drift 事实不足时 fail closed。

### 2.3 平台 Containment Profile

```text
Windows
  preferred: Job Object

Linux
  preferred: cgroup v2
  fallback: POSIX process group

macOS
  preferred: POSIX process group / session
```

每次 Runner 启动必须返回实际采用的机制及 Capability，而不是只返回操作系统名称。

最低 Capability 模型：

```text
platform
mechanism
whole_tree_termination
owner_exit_cleanup
membership_observable
escape_resistance
stdin
separate_output_streams
timeout
```

`escape_resistance` 至少区分：

```text
strong
process_group
best_effort
```

### 2.4 支持等级

平台支持不再是单一布尔值：

- `managed`：存在可观测、抗普通进程逃逸的 owned boundary；
- `compatible`：满足通用 Run 合同，但 containment 只能在 process-group 或 best-effort 边界内承诺；
- `unsupported`：连通用 Run 合同也无法通过。

Product UI 后续必须展示实际支持等级和限制。Milestone 0 只生成 Capability Matrix，不在本 ADR 中承诺某个平台最终达到哪个等级。

### 2.5 Repository Identity

默认候选从 Windows `FILE_ID_INFO` 改为 Git common-dir 下持久化随机标识：

```text
git rev-parse --path-format=absolute --git-common-dir
  → <common-dir>/agentic-work-os/repository-id
  → UUID
```

规则：

- 同一 repository 的普通工作目录与 linked worktree 共享 common-dir，因此共享 ID；
- 独立 clone 拥有独立 common-dir，因此创建独立 ID；
- 仓库目录改名不改变 ID；
- 删除并重新 clone 后创建新 ID；
- 创建、读取、校验或原子写入失败时 identity 为 unavailable，禁止使用路径、remote URL、branch 或 commit 作为静默 fallback；
- Windows `FILE_ID_INFO` 实现保留为实验性 filesystem identity provider，不再是默认跨平台方案。

Marker 格式和写入协议必须通过单独测试冻结；在生产 Schema/API 冻结前仍属于 Experiment。

### 2.6 验证策略

验证分为三层：

1. **Contract tests**：平台无关 reducer、状态机、协议、输入输出和错误语义；
2. **Platform integration tests**：同一 hostile fixture 在 Windows、Ubuntu、macOS 运行；
3. **Evidence runs**：将原始输出、平台机制、版本、PID/boundary facts、marker、hash 和完整观察窗结果写入 Milestone 0 evidence manifest。

GitHub Actions 使用三平台 Matrix 作为持续回归，但 CI 绿色本身不自动等于 Technical Gate PASS。Gate 仍要求冻结用例、可解释原始证据和独立 Decision Record。

### 2.7 现有 Windows 原型

现有 PowerShell/C# Job Object helper 与 Node wrapper：

- 保留为 `reference adapter`；
- 可继续用于验证 Windows profile；
- 不再定义 `LocalRunner` 上层接口；
- 不得阻止 Linux/macOS 合同和 Adapter 独立推进；
- 未在真实 Windows 上执行前，不产生 Windows containment PASS 结论。

## 3. Technical Gate 调整

原问题：

> Windows LocalRunner 是否能可靠控制真实 Codex？

调整为：

> 跨平台 LocalRunner 合同能否由各 Platform Adapter 以显式 Capability 满足，并在目标平台上产生可复查的进程、输出、Cancel、reconciliation 和 Artifact 证据？

Technical Gate 由以下结果共同组成：

- platform-neutral contract verdict；
- Windows profile verdict；
- Linux profile verdict；
- macOS profile verdict；
- Repository Identity verdict；
- Artifact / Change Package / VerificationInvocation verdict；
- Real Codex Adapter verdict。

平台 Profile 可以具有不同支持等级，但任一未执行用例、缺失证据或无法解释的差异必须保持 `INCONCLUSIVE`，不得聚合成总体 PASS。

## 4. 后果

### 正面影响

- Project/Workflow/Agent 上层模型不再绑定 Windows；
- 同一个 hostile fixture 和 Run 合同可用于三平台；
- 平台能力差异被显式治理，而不是隐藏在条件分支中；
- Windows 原型成果可以复用，不必推倒；
- 后续 Agent Runtime 可以在不同平台替换 Codex、Claude Code、Pi 等实现。

### 成本与风险

- 引入一个小型 Rust 构建与发布链；
- 需要三平台 CI 和发布产物；
- macOS/process-group 可能只能获得较弱的 escape resistance；
- Linux cgroup v2 在容器、无 delegation 或受限 CI 环境中可能降级；
- Capability 与支持等级必须进入后续产品信息架构。

## 5. 明确不做

本决策不授权：

- 产品化 Project/Task UI；
- 通用 Workflow Engine；
- Sandbox 或容器隔离；
- Remote Runner / Runner 集群；
- 多 Agent 协商；
- 自动 Merge / Push / Publish；
- Technical Gate 或 Product Validation Gate PASS。

## 6. 后续动作

1. 增加平台无关 `LocalRunner` contract 和 Capability schema；
2. 实现并测试 Git common-dir UUID marker identity；
3. 增加 Windows/Linux/macOS CI Matrix；
4. 建立 Rust runner feasibility spike，仅实现 Capability 与最小进程协议，再决定是否接入第三方 containment library；
5. 复用现有 hostile fixture 验证各 Platform Adapter；
6. 在 owned boundary 被证明前，不启动真实 Codex Spike 2。
