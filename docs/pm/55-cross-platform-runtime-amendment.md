# Agentic Work OS — Cross-platform Runtime Amendment

> 状态：Accepted — baseline amendment  
> 日期：2026-09-01  
> 决策依据：[ADR-0001](../architecture/0001-cross-platform-local-runtime.md)  
> 被修订文档：[MVP PRD](./20-mvp-prd.md)、[Milestone 0 Experiment Plan](./50-milestone-0-experiment-plan.md)、[Gate Execution Index](./60-gate-execution-index.md)

## 1. 修订目的

本文件将已冻结需求基线中的“Windows-first 产品边界”修正为“cross-platform-first 架构边界”。原文档继续保留作为决策历史；与本修订冲突的 Windows-only 表述，以本修订和 ADR-0001 为准。

这不是 Product Validation 或 Technical Validation 的结果，不声称任何平台已经通过验证，也不解除 MVP WWA 的双 Gate 阻断。

## 2. 产品平台范围

目标平台：

```text
Windows 10/11
Linux（首轮以 GitHub Actions Ubuntu runner 和主流 cgroup v2 主机为验证对象）
macOS（Intel/Apple Silicon 的发行支持由后续构建矩阵决定）
```

MVP 的产品模型、Run 生命周期、Artifact、Review、VerificationInvocation 和 Agent Adapter 必须保持平台无关。

## 3. 对 MVP PRD 的规范性修订

### 3.1 第一验证环境

原“Windows 优先”调整为：

- cross-platform by architecture；
- Windows、Linux、macOS 分别拥有 Platform Profile；
- 可以先完成其中一个 Adapter 的实现，但不能把该实现定义成 `LocalRunner` 本身；
- 发布支持等级必须由 Capability Matrix 和真实平台证据决定。

### 3.2 LocalRunner

原“LocalRunner 负责 Windows 进程……”替换为：

> `LocalRunner` 定义平台无关的进程启动、stdin/stdout/stderr、timeout、Cancel、drain、终态竞态和 resource reconciliation 合同；具体 process containment 由 Platform Adapter 实现，并暴露实际 mechanism 与 Capability。

### 3.3 平台支持等级

新增：

```text
managed
compatible
unsupported
```

- `managed`：owned boundary 与 membership 可观测，whole-tree termination 和 owner-exit cleanup 由目标平台证据支持；
- `compatible`：通用 Run 合同成立，但 containment 只在 process-group 或 best-effort 范围内成立；
- `unsupported`：通用 Run 合同或最低安全约束未通过。

状态名称是实验期术语，不冻结生产 API。

### 3.4 Repository Identity

默认候选改为：

```text
Git common-dir + persisted UUID marker
```

现有 Windows `FILE_ID_INFO` 方案降级为实验性 filesystem identity provider。任何 identity provider 失败时必须 fail closed，不得以规范化路径、remote URL、branch 或 commit 静默替代。

### 3.5 Trusted-local

Workspace 仍然不是 Sandbox。任何平台的 `managed` 或 `compatible` 均只描述进程管理能力，不表示文件、网络、凭据或宿主机隔离。

## 4. 对 Milestone 0 的规范性修订

### 4.1 Spike 1 新名称

```text
Cross-platform LocalRunner Process Containment and Cancel
```

分为：

1. platform-neutral contract；
2. Windows Job Object profile；
3. Linux cgroup v2 profile，必要时显式 process-group fallback；
4. macOS process-group/session profile；
5. 汇总 Capability Matrix。

### 4.2 用例结构

原 R-01..R-11 继续有效，但结果必须同时记录：

```text
platform
architecture
runtime version
containment mechanism
capability level
case verdict
evidence refs
limitations
```

不得以某个平台的 PASS 替代另一个平台的未执行用例。

### 4.3 Repository Identity Matrix

原 RI-01..RI-11 的行为目标继续有效，但默认实现改为 UUID marker candidate。Windows `FILE_ID_INFO` matrix 作为替代 Provider 的补充实验，不再是跨平台 Technical Gate 的唯一前置条件。

UUID marker matrix至少覆盖：

- 仓库根与子目录；
- 相对/绝对路径；
- linked worktree；
- 独立 clone；
- 仓库目录 rename；
- 删除后重新 clone；
- nested repository；
- 并发首次初始化；
- 只读 common-dir；
- malformed marker；
- atomic write crash window。

### 4.4 Rust Runner Spike

允许建立小型 Rust helper 可行性实验：

- 使用 stdio JSONL；
- 第一增量只冻结协议和 Capability discovery；
- containment library 选择必须通过独立 spike，不在本修订中预先锁定；
- Rust helper 不拥有业务状态和数据库；
- 任一 helper crash 或协议中断进入 `interrupted / reconciliation_required`，不得伪造 cancelled。

### 4.5 CI Matrix

三平台 CI 是持续验证入口：

```text
windows-latest
ubuntu-latest
macos-latest
```

CI 结果属于实现/回归证据。Technical Gate 仍要求冻结版本、保存原始 evidence、解释 capability 降级并形成 Decision Record。

## 5. Gate 状态

本修订写入时：

| Gate / Track | 状态 |
|---|---|
| Product Validation | `NOT_RECORDED` / 执行材料已准备 |
| Cross-platform contract | `READY_TO_IMPLEMENT` |
| Windows profile | `NOT_EVALUATED` |
| Linux profile | `NOT_EVALUATED` |
| macOS profile | `NOT_EVALUATED` |
| Repository Identity v1 | `NOT_EVALUATED` |
| Real Codex Adapter | `NOT_STARTED` |
| Technical Gate | `NOT_EVALUATED` |
| Product MVP WWA | `BLOCKED` |

## 6. 当前允许推进的工作

允许：

- LocalRunner contract / Capability schema；
- UUID marker identity；
- Rust runner feasibility spike；
- 三平台 CI；
- hostile fixture 的平台适配；
- Artifact / Change Package / VerificationInvocation 的跨平台回归；
- Founder Validation 和真实参与者准备。

继续阻断：

- `docs/pm/70-mvp-wwa-backlog.md`；
- 产品化 Project/Task UI；
- 生产 Schema/API 冻结；
- 通用 Workflow Engine；
- Sandbox、Remote Runner、多 Runtime 产品化；
- 任何未经真实证据支持的 PASS 声明。

## 7. 解锁规则不变

只有 Product Validation Gate 和修订后的 Technical Gate 均通过，且所有 `Modify / Remove` 后果已经回写并重新评审后，才能生成 `docs/pm/70-mvp-wwa-backlog.md`。
