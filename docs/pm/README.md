# Agentic Work OS：PM Skills 与双 Gate 工作区

本目录用于把 Agentic Work OS 已完成的 Idea、竞品研究和架构探索，转化为可验证、可决策，并最终可进入开发的 MVP 需求基线。

> 当前状态：需求收敛与 Red Team 修订已完成；Validation Prototype / Concierge Validation 与 Milestone 0 已具备执行协议。2026-09-01 已接受 [`55-cross-platform-runtime-decision.md`](./55-cross-platform-runtime-decision.md)，将 Technical Validation 的平台边界修订为 cross-platform-first。产品 MVP WWA、实施计划和产品化开发仍被 Product Validation Gate 与 Technical Gate 共同阻断。

## 当前执行顺序

1. 所有活动先读取 [`00-project-context.md`](./00-project-context.md)，并以 [`20-mvp-prd.md`](./20-mvp-prd.md) 与 [`30-prd-red-team.md`](./30-prd-red-team.md) 作为当前需求边界。
2. 按 [`01-pm-skills-runbook.md`](./01-pm-skills-runbook.md) 执行当前阶段，而不是直接运行 `wwas`。
3. 两条证据线可以并行：
   - [`40-validation-protocol.md`](./40-validation-protocol.md) → Product Validation Gate；
   - [`50-milestone-0-experiment-plan.md`](./50-milestone-0-experiment-plan.md) + [`55-cross-platform-runtime-decision.md`](./55-cross-platform-runtime-decision.md) → Technical Gate。
4. `55` 是对冻结 PRD / Milestone 0 的平台范围 amendment：上层合同跨平台，Windows/Linux/macOS 使用不同 Platform Provider；它不改变 Product Validation 判据，也不声称任何平台已经通过。
5. 使用 [`60-gate-execution-index.md`](./60-gate-execution-index.md) 记录执行分支、证据根目录、Decision Record 和 Gate 状态。
6. 任一产品子决策为 `Modify / Remove` 时，先修改 PRD 并重新评审受影响边界。
7. 两个独立 Gate 都完成后，形成 Product + Technical Gate 联合 Decision Record。
8. 只有两个 Gate 都为最终 `PASS`、联合记录为 Final，且必要 PRD 修订已完成并重新评审后，才允许运行 `wwas`，生成 `docs/pm/70-mvp-wwa-backlog.md`，再进入 implementation plan 与 coding。

```text
identify assumptions → create PRD → red team → revise PRD
                                           ↓
              ┌────────────────────────────┴────────────────────────────┐
              ↓                                                         ↓
Validation Prototype / Concierge Validation                 Milestone 0 Spikes
              │                                           + cross-platform amendment
              ↓                                                         ↓
   Product Validation Gate                                  Technical Gate
              └────────────────────────────┬────────────────────────────┘
                                           ↓
                            Product + Technical Gate
                                           ↓
                      70-mvp-wwa-backlog.md → implementation plan → coding
```

## 文件地图

```text
docs/pm/
├── README.md                              # 当前流程、编号与门控说明
├── 00-project-context.md                  # 当前已知事实、方向、边界和研究结论
├── 01-pm-skills-runbook.md                # PM Skills 与双 Gate 执行手册
├── 10-key-assumptions.md                  # identify-assumptions-new 输出
├── 20-mvp-prd.md                          # 证据门控的候选 MVP PRD
├── 30-prd-red-team.md                     # strategy-red-team 输出
├── 40-validation-protocol.md              # Product Validation 执行协议
├── 50-milestone-0-experiment-plan.md      # Technical Validation 原始实验计划
├── 55-cross-platform-runtime-decision.md  # Technical Validation 平台范围 amendment
├── 60-gate-execution-index.md             # 双 Gate 执行状态与证据索引
└── 70-mvp-wwa-backlog.md                  # 双 Gate 解锁后才允许创建；当前不存在
```

## 编号约定

- `40` 已固定用于 Product Validation Protocol，不再用于 WWA。
- `50` 已固定用于 Milestone 0 Experiment Plan。
- `55` 用于已接受的 Cross-platform Runtime Decision；它覆盖 `20/50` 中冲突的平台实现范围，但不抹除原冻结文本。
- `60` 用于双 Gate 的执行与决策索引。
- `70` 预留给双 Gate 通过后的 MVP WWA Backlog。

任何旧提示中的 `40-wwa-backlog.md` 均视为已废弃路径，不应创建或恢复。

## 当前阻断规则

在联合 Gate 解锁前，不得：

- 生成产品 MVP WWA 或完整产品实施计划；
- 实现 Project / Task 产品化 UI；
- 冻结 Task 中心生产 Schema、API、导航或生命周期；
- 建设通用 Workflow、Workflow Canvas、多 Runtime、Sandbox、Session Resume、Remote Runner 或其他 Deferred 产品能力；
- 把协议中的样本数、通过信号和失败信号写成已经取得的验证结果；
- 把某一个 OS 的成功外推为跨平台 Technical Gate PASS；
- 隐藏平台 capability 差异，或把 process-group 级保证宣传为强 containment。

允许立即推进的只有两类工作：

- `40-validation-protocol.md` 明确允许的低保真产品验证与礼宾验证准备、执行和证据记录；
- `50-milestone-0-experiment-plan.md` 与 `55-cross-platform-runtime-decision.md` 共同允许的诊断 Harness、跨平台 Runner/Repository Identity Spike、故障注入、三平台 CI 和证据记录。

## 技术范围解释

从 `55` 起，以下上层合同必须保持平台无关：

```text
Run / FixedRunCoordinator
AgentAdapter
VerificationInvocation
Boundary Protocol
Resource Reconciliation
Artifact Store
Change Package
ReviewDecision
```

操作系统差异只能存在于薄 Platform Provider：

```text
ProcessContainmentProvider
RepositoryIdentityProvider
platform process/filesystem probes
shell/executable discovery
```

Windows Job Object 和 Windows `FILE_ID_INFO` 代码继续作为 reference candidate 保留，但不能代表跨平台默认实现或最终结论。

## 工作原则

- **证据先于产品化。** 当前目标不是扩展功能，而是分别回答产品价值与技术可行性问题。
- **事实、决策、假设分开。** 研究判据不是结果；技术计划不是已通过的能力。
- **两个 Gate 独立。** Product Validation Gate 与 Technical Gate 不能互相替代或抵消失败。
- **反证必须回写。** `Modify / Remove` 必须先修订 PRD 并重新评审，不能由新增功能掩盖。
- **平台合同统一，能力诚实分级。** Windows、Linux、macOS 使用同一上层合同，但实际 mechanism 与保证必须显式记录。
- **完成定义依赖证据。** “Agent 表示完成”不是验收依据；必须引用可审计的运行、Diff、Verification、Artifact、OS 事实或人工决定。
