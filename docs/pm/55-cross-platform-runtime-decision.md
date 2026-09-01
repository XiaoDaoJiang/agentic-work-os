# Agentic Work OS — Cross-platform Runtime Decision

> 状态：Accepted — Technical Validation scope amendment  
> 日期：2026-09-01  
> 决策人：Project owner  
> 上游基线：[MVP PRD](./20-mvp-prd.md)、[Milestone 0 Experiment Plan](./50-milestone-0-experiment-plan.md)  
> 适用范围：LocalRunner、process containment、repository identity、平台验证矩阵

## 1. 决策摘要

Agentic Work OS 从本决策起采用 **cross-platform-first** 技术边界：

- Windows、Linux、macOS 都属于目标本地运行平台；
- 上层 Run、Agent Adapter、VerificationInvocation、Artifact、Change Package 和 reconciliation 合同必须与操作系统无关；
- 操作系统差异只能存在于可替换的 Platform Provider / native helper 中；
- 不要求不同 OS 提供虚假的同等级内核保证，差异必须通过 Capability 明确暴露；
- Windows Job Object 原型继续保留为参考 Adapter，不再代表 `LocalRunner` 本身；
- `repo-local-git-v0 / Windows FILE_ID_INFO` 继续作为已实现实验候选保留，但默认跨平台候选改为 Git common-dir 中的持久 UUID marker；
- Technical Gate 必须引用同一合同测试在 Windows、Linux、macOS 上的机器证据，而不能再由单一 Windows 环境代表跨平台可行性。

本决策不改变 Product Validation Protocol，不构成任何技术 `PASS`，也不解锁产品 MVP WWA。

## 2. 为什么需要修订

现有 PRD 与 Milestone 0 将“Windows 优先”进一步写进了底层实现：

- `LocalRunner` 被描述为负责 Windows process containment；
- `repository_identity` 使用 Windows `FILE_ID_INFO` 与 Volume Serial Number；
- Spike 1 的主要结论依赖 Windows Job Object；
- RI-01..RI-10 被设计为 Windows 文件系统身份矩阵。

这些选择适合验证第一个 Windows 原型，但不应成为 Agentic Work OS 的产品架构边界。继续沿 Windows-only 实现扩展，会让 CodexAdapter、调度锁、资源恢复和测试设施逐渐绑定 Win32 语义，增加以后支持 Linux/macOS 的返工。

真正需要统一的是工作语义：

```text
start → stream/input → timeout/cancel → stop → drain → reconcile
```

而不是底层 OS 原语。Job Object、cgroup v2 与 POSIX process group 都只是实现该合同的不同机制。

## 3. 对冻结文档的覆盖规则

为保持证据可追溯性，本决策**不就地重写**已冻结的 `20-mvp-prd.md` 与 `50-milestone-0-experiment-plan.md`。自本决策合并后：

1. 原文中“Windows 优先”仍描述最初验证背景，但不再表示产品架构只支持 Windows；
2. 原文中 Windows-specific `LocalRunner` 描述，被本文件第 4、5 节的跨平台合同覆盖；
3. 原文中 `repo-local-git-v0` 仍可作为 filesystem identity 实验结果保留，但不再是默认跨平台调度键候选；
4. 原 RI 与 Runner 用例继续保留历史编号；新增跨平台用例使用 `XP-*`、`RID-*` 编号，避免悄悄改写既有判据；
5. 新的 experiment manifest 必须同时记录：
   - `docs/pm/50-milestone-0-experiment-plan.md` 内容哈希；
   - 本决策文件内容哈希；
   - Harness revision；
   - OS、架构与实际 containment mechanism。
6. 本决策之前生成的实验记录保持原样，不追溯伪造 amendment hash。

## 4. 统一 LocalRunner 合同

上层只依赖一个平台无关合同：

```typescript
interface LocalRunner {
  capabilities(): Promise<RunnerCapabilities>;
  start(input: RunStartInput): Promise<RunnerSession>;
}

interface RunnerSession {
  sendInput(bytes: Uint8Array): Promise<InputReceipt>;
  cancel(requestId: string): Promise<CancelReceipt>;
  events(): AsyncIterable<RunnerEvent>;
  wait(): Promise<RunExit>;
  snapshot(): Promise<ResourceSnapshot>;
}
```

`RunStartInput` 至少冻结：

```text
program
argv[]
cwd
env inheritance policy + overrides
timeout_ms
stdin policy
run_id
```

`RunnerEvent` 至少覆盖：

```text
runner.ready
boundary.created
process.started
stdout.frame
stderr.frame
cancel.requested
boundary.termination.started
boundary.termination.completed
stdout.drained
stderr.drained
process.exited
boundary.snapshot
runner.error
```

事件必须携带单调 sequence；stdout/stderr 各自还必须有独立 stream sequence。不得从人类终端文案推断退出原因、Cancel 成功或 boundary 安全。

## 5. Platform Provider 与 Capability

`LocalRunner` 通过 Platform Provider 获得 process containment：

```text
LocalRunner
  └── ProcessContainmentProvider
        ├── Windows: Job Object
        ├── Linux: cgroup v2; POSIX process group fallback
        └── macOS: POSIX process group/session
```

统一能力模型至少包含：

```typescript
type RunnerCapabilities = {
  platform: "windows" | "linux" | "macos";
  architecture: string;
  mechanism:
    | "windows_job_object"
    | "linux_cgroup_v2"
    | "posix_process_group"
    | "none";
  wholeTreeTermination: boolean;
  killOnOwnerExit: boolean;
  membershipObservable: boolean;
  softStopScope: "whole_tree" | "direct_child" | "best_effort" | "unsupported";
  escapeResistance: "strong" | "process_group" | "best_effort";
  separateStdoutStderr: boolean;
  interactiveStdin: boolean;
  timeout: boolean;
};
```

规则：

- Capability 来自运行时探测和实际运行结果，不从 OS 名称硬编码推断；
- 平台合同统一，但能力值允许不同；
- `safe` 只表示在当前已声明 capability 范围内，进程、drain、Workspace lease 和 drift 机器事实全部满足；
- Capability 为 `process_group` 时，UI/日志不得宣传为强 escape-resistant containment；
- mechanism 不可用时 fail closed，不自动降级为“只杀 root PID”后继续声称成功。

## 6. Native Runner 技术路线

首选实验路线：

```text
TypeScript / Node control plane
          │ JSONL over stdio
          ▼
small Rust native runner
          │
          └── processkit 3.3.4 evaluation candidate
```

边界：

- Node/TypeScript 继续拥有 Project、Task、Run、AgentAdapter、Event、Artifact、VerificationInvocation 与 API；
- Rust helper 只拥有 process spawn、stdin/stdout/stderr、timeout、Cancel、process containment 与 capability detection；
- helper 不是常驻服务，不监听网络端口；
- IPC 首版使用 UTF-8 JSON Lines；二进制输出使用 base64，不假设 Agent 输出永远是合法 UTF-8；
- helper 崩溃、协议损坏或 teardown 无法确认时，Run 必须进入 `interrupted / reconciliation_required`；
- `processkit = 3.3.4` 仅为 Milestone 0 可重复 Spike 的固定候选，不是生产依赖冻结；Technical Gate 必须审查 API、许可证、维护状态与机制限制。

现有 PowerShell/C# Windows Job Object helper：

- 保留为 reference implementation 与对照证据；
- 不继续向其增加产品协议能力；
- 不作为跨平台 Runner 的默认入口；
- 其 Windows 测试结果不能替代 Rust candidate 的三平台矩阵。

## 7. 跨平台 Repository Identity

默认候选由 filesystem-object identity 改为 persisted Git repository marker：

```text
git rev-parse --path-format=absolute --git-common-dir
                     ↓
<git-common-dir>/agentic-work-os/repository-id
                     ↓
UUID v4, created once with exclusive atomic create
```

候选 scheme：

```text
repo-marker-v1:<uuid>
```

规则：

1. 输入路径必须先通过 Git 解析到 absolute common-dir；
2. marker 必须位于 common-dir 内，不能写入 working tree；
3. 首次创建使用 exclusive create；并发创建冲突时读取已经成功写入的 winner；
4. marker 内容必须是规范 lowercase UUID，并以换行结束；
5. 同一 repository 的 linked worktree 共享 common-dir，因此共享 identity；
6. 独立 clone 有独立 common-dir，因此生成新 identity；
7. 仓库目录 rename 不改变 marker；删除后重新 clone 生成新 identity；
8. common-dir 只读、marker 损坏或无法原子创建时返回 `identity_unavailable`，不得回退到 path、remote URL、branch 或 commit；
9. marker 是本机仓库实例身份，不进入 Git history，也不在 clone 之间复制。

原 `repo-local-git-v0`：

- 作为 Windows filesystem identity 对照候选保留；
- 不删除其源码和 RI 证据；
- 不再作为跨平台默认调度键；
- 若未来需要检测 marker 被复制/篡改，可作为辅助机器事实重新评估，但不能悄悄改变 `repo-marker-v1` 语义。

## 8. 验证矩阵

### 8.1 Platform-neutral contract

相同测试必须在三个平台执行：

| ID | 合同 |
|---|---|
| XP-01 | cwd、argv、env 与 stdin bytes 准确 |
| XP-02 | stdout/stderr 分流、独立保序、退出前增量到达 |
| XP-03 | 正常退出、非零退出、启动失败与 timeout 有结构化结果 |
| XP-04 | Cancel 幂等，Cancel/自然退出竞态只产生一个业务终态 |
| XP-05 | parent/child/grandchild 在声明 mechanism 范围内被停止 |
| XP-06 | root 先退出、延迟派生和持续输出不会绕过 teardown/drain |
| XP-07 | 完整 post-stop window 内零 survivor、零 late output、零 late marker |
| XP-08 | helper 崩溃或事实不足收敛到 reconciliation_required |
| XP-09 | Cancel 后不进入 Test/Review，不 seal 新运行 Artifact |
| XP-10 | capability report 与实际 mechanism/evidence 一致 |

### 8.2 Repository marker

| ID | 合同 |
|---|---|
| RID-01 | root/subdirectory/relative path 得到同一 identity |
| RID-02 | 空格、中文和平台分隔符不改变 identity |
| RID-03 | linked worktree 共享 identity |
| RID-04 | 同源独立 clone 获得不同 identity |
| RID-05 | repository rename 后 identity 不变 |
| RID-06 | 删除并重新 clone 到同路径后 identity 改变 |
| RID-07 | nested repository 获得自己的 identity |
| RID-08 | 两个并发首次注册只留下一个合法 marker |
| RID-09 | 损坏 marker fail closed，不自动覆盖 |
| RID-10 | 只读/unavailable common-dir 不回退到路径或 remote |

### 8.3 CI platforms

Milestone 0 首轮固定使用：

```text
ubuntu-24.04
windows-2025
macos-15
```

固定标签避免 `*-latest` 迁移造成未审计的环境变化。CI runner 证明的是对应 hosted image，不代表已经覆盖每个桌面发行版；进入产品发布前仍需补充 Windows 10/11、目标 macOS 版本和声明支持的 Linux 发行版 smoke matrix。

每个 CI job 保存：

```text
OS / architecture
Rust / Node / Git version
native runner version + Cargo.lock hash
processkit version
reported mechanism/capabilities
完整测试结果
hostile fixture seed
raw JSONL events
post-stop samples
```

## 9. Technical Gate 影响

Technical Gate 的 Runner 部分改为合取检查：

```text
runner_gate =
  platform_neutral_contract_passes_on_all_three_ci_platforms
  AND every_platform_reports_actual_capabilities
  AND no_platform_claims_stronger_guarantees_than_its_evidence
  AND teardown_failure_never_maps_to_cancelled_safe
```

允许的平台差异：

- Windows/Linux 可能达到 `escapeResistance=strong`；
- macOS 可能只有 `escapeResistance=process_group`；
- 差异本身不自动导致 Gate 失败，但必须与产品承诺一致；
- 若某平台连普通 descendant tree、Cancel、drain 或 post-stop 合同都无法满足，则该平台 profile 为 `FAIL`，不能被其他平台的成功抵消。

Repository Identity 只有 RID-01..RID-10 在三平台通过后，才允许 `repo-marker-v1` 作为跨平台调度锁主键。

## 10. Product Validation 影响

本决策不改变 A/B/C 入口、Task-first、Project-native、Task 聚合或自发复用判据。产品验证可以继续 Founder Validation 与外部参与者验证。

产品观察记录增加一个环境字段即可：

```text
participant_os
runner_mechanism_if_available
```

不得把“支持三个 OS”当作已验证产品价值，也不得因为技术轨改为跨平台而提前修改 Product Gate verdict。

## 11. 明确不做

本修订不建设：

- Sandbox 或宿主机安全隔离；
- Remote Runner、Runner 集群或分布式 Worker；
- 通用 Workflow Engine；
- 自动下载/升级 native helper；
- PTY/ConPTY 通用终端仿真；
- 任意进程治理或系统级 daemon；
- 全平台完全相同的内核保证；
- 产品 UI、生产 Schema/API 或 WWA。

## 12. 后续执行顺序

```text
1. 合并本决策到 main
2. 让 spike/milestone-0-harness 吸收新基线
3. 冻结 LocalRunner JSONL contract + capability schema
4. 实现 repo-marker-v1，并在 Node 测试中完成 RID 合同
5. 建立 Rust native-runner feasibility spike
6. 添加 Windows/Linux/macOS CI matrix
7. 使用同一 hostile fixture 运行 XP-01..XP-10
8. 评审 processkit candidate 与现有 Windows reference adapter
9. Runner contract 获得机器证据后，再进入真实 Codex Adapter
```

## 13. 参考资料

- processkit documentation: https://docs.rs/processkit/
- processkit source: https://github.com/ZelAnton/ProcessKit-rs
- GitHub-hosted runner images: https://github.com/actions/runner-images
