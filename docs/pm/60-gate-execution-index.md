# Agentic Work OS — Gate Execution Index

> 状态：Active governance index；不包含任何验证结果  
> 日期：2026-09-01  
> 需求基线：[MVP PRD](./20-mvp-prd.md)、[PRD Red Team](./30-prd-red-team.md)  
> 执行协议：[Validation Protocol](./40-validation-protocol.md)、[Milestone 0 Experiment Plan](./50-milestone-0-experiment-plan.md)  
> Technical scope amendment：[Cross-platform Runtime Decision](./55-cross-platform-runtime-decision.md)

## 1. 目的与边界

本文件是 Product Validation 与 Technical Validation 的执行治理索引，用于记录：

- 当前证据线处于什么状态；
- 建议在哪个分支执行；
- 原始证据与 Decision Record 放在哪里；
- 哪些工作仍被 Gate 阻断；
- 何时允许生成产品 MVP WWA。

本文件不是验证报告、产品 Backlog、实施计划或生产 Schema。没有可引用的最终 Decision Record 时，不得在这里补写 `PASS`、用户结论或技术能力结论。

`55-cross-platform-runtime-decision.md` 自 2026-09-01 起覆盖 `20/50` 中冲突的平台实现范围：Windows 不再代表整个 LocalRunner，Technical Validation 改为统一合同 + Windows/Linux/macOS Platform Profile。该 amendment 不改变 Product Validation 判据，也不使任何已有代码自动获得跨平台结论。

## 2. 当前门控状态

以下状态只描述已合并治理基线；未合并分支中的实现、测试或口头说明不能在这里直接变成 Gate verdict：

| 轨道 / 门槛 | 依据 | 当前记录状态 | 最终 verdict | 后果 |
|---|---|---|---|---|
| Product Validation | [`40-validation-protocol.md`](./40-validation-protocol.md) | `READY_TO_EXECUTE`：协议已冻结；尚无最终参与者证据、独立 Decision Record 或 Gate 结果记录 | `NOT_RECORDED` | 不能授权产品 MVP WWA |
| Technical Validation | [`50-milestone-0-experiment-plan.md`](./50-milestone-0-experiment-plan.md) + [`55-cross-platform-runtime-decision.md`](./55-cross-platform-runtime-decision.md) | `AMENDED_READY_TO_EXECUTE`：Technical scope 已改为 cross-platform-first；尚无三个平台的最终 Runner/Profile 证据或 Technical Gate 记录 | `NOT_RECORDED` | 不能授权产品 MVP WWA |
| Product + Technical Gate | [`20-mvp-prd.md`](./20-mvp-prd.md) | `BLOCKED`：等待两个独立 Gate 的最终结果、必要 PRD 修订闭环及联合 Decision Record | `NOT_EVALUATED` | WWA、产品实施计划和生产 Schema/API 冻结保持 No-Go |
| Product MVP WWA | 本文件第 7 节 | `BLOCKED` | 不适用 | 不得创建 `docs/pm/70-mvp-wwa-backlog.md` |

`READY_TO_EXECUTE / AMENDED_READY_TO_EXECUTE` 只表示协议、计划和 amendment 已具备执行条件，不表示活动已开始、样本已招募、用例已运行或能力已经通过。

## 3. Product Validation 执行线

### 执行分支

```text
validation/concierge-execution
```

### 协议与范围

- 唯一产品执行协议：[`40-validation-protocol.md`](./40-validation-protocol.md)
- 允许：低保真 A/B/C 对照、Founder Validation、领域模型走查、Concierge Validation、复用审计和去敏证据整理；
- 禁止：产品化入口、Project / Task UI、生产 Schema/API、产品 MVP WWA 和 Deferred 能力。

### 建议证据根目录

```text
evidence/product-validation/<evidence_snapshot_id>/
```

建议目录：

```text
evidence/product-validation/<evidence_snapshot_id>/
├── manifest.json
├── protocol-lock.json
├── entry-comparison/
├── domain-walkthrough/
├── concierge/
├── reuse-audit/
└── decisions/
    ├── project-native-decision.md
    ├── task-first-decision.md
    ├── task-aggregation-decision.md
    └── product-validation-gate-decision.md
```

目录结构是研究证据组织约定，不是生产 Artifact Schema。参与者身份映射、未去敏仓库内容、录屏、凭据和生产数据不得进入公开仓库；公开分支只保留允许公开的去敏索引、哈希、协议版本和 Decision Record。

### 必需 Decision Record

| Decision Record | 允许结论 | 当前状态 | 证据引用 |
|---|---|---|---|
| Project-native | `Keep / Modify / Remove` | `NOT_RECORDED` | — |
| Task-first | `Keep / Modify / Remove` | `NOT_RECORDED` | — |
| Task Aggregation | `Keep / Modify / Remove` | `NOT_RECORDED` | — |
| Product Validation Gate | `PASS / CONTINUE_VALIDATION / FAIL_AND_REVISE` | `NOT_RECORDED` | — |

Founder evidence 可以用于修订材料和发现反证，但不能代替协议要求的独立用户与自发复用证据。

## 4. Technical Validation 执行线

### 执行分支

```text
spike/milestone-0-harness
```

跨平台决策治理变更先通过独立 `decision/cross-platform-runtime` 分支进入 `main`，随后技术执行分支吸收该基线。禁止在长期 Spike 分支中悄悄重写已冻结的产品治理边界。

### 协议与范围

- 原始实验计划：[`50-milestone-0-experiment-plan.md`](./50-milestone-0-experiment-plan.md)
- 平台范围 amendment：[`55-cross-platform-runtime-decision.md`](./55-cross-platform-runtime-decision.md)
- 允许：disposable fixture、诊断 Harness、跨平台 LocalRunner contract、Platform Provider / native helper Spike、repository marker、四个独立 Spike、故障注入、重放、reconciliation、三平台 CI 和证据采集；
- 禁止：产品 UI、通用 Workflow、多 Runtime 产品化、Sandbox、Session Resume、Remote Runner 和其他 Deferred 能力。

### 技术分层

平台无关：

```text
FixedRunCoordinator
Run / Event / ReviewDecision
AgentAdapter
VerificationInvocation
Boundary Protocol
Resource Reconciliation
Artifact Store
Change Package
```

平台相关的薄层：

```text
ProcessContainmentProvider
RepositoryIdentityProvider
platform process/filesystem probes
shell/executable discovery
```

Windows Job Object 与 Windows `FILE_ID_INFO` 实现当前仅为 reference candidate；未经新矩阵验证，不代表默认跨平台实现，也不能单独授权 Technical Gate。

### 证据根目录

```text
evidence/milestone-0/<experiment_run_id>/
├── manifest.json
├── spike-1-runner/
│   ├── contract/
│   └── platforms/
│       ├── windows/
│       ├── linux/
│       └── macos/
├── spike-2-codex-adapter/
├── spike-3-change-package/
├── spike-4-artifact-durability/
├── cross-contracts/
│   ├── repository-identity/
│   │   ├── marker/
│   │   └── reference-windows-file-id/
│   ├── trusted-local/
│   ├── verification-invocation/
│   ├── resource-reconciliation/
│   └── runtime-capabilities/
└── technical-gate-decision.md
```

新的 manifest 必须记录原 Milestone 0 plan hash、cross-platform amendment hash、Harness revision、OS/architecture、Node/Rust/Git 版本和实际 containment mechanism。旧 evidence 不追溯补写 amendment hash。

### 必需独立结论

| 技术决策单元 | 允许结论 | 当前状态 | 证据引用 |
|---|---|---|---|
| Cross-platform LocalRunner contract | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Windows Platform Profile | `PASS / FAIL / INCONCLUSIVE` + capability | `NOT_RECORDED` | — |
| Linux Platform Profile | `PASS / FAIL / INCONCLUSIVE` + capability | `NOT_RECORDED` | — |
| macOS Platform Profile | `PASS / FAIL / INCONCLUSIVE` + capability | `NOT_RECORDED` | — |
| Repository Identity — `repo-marker-v1` | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Spike 1 — Runner-owned process containment / Cancel | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Spike 2 — Real Codex Adapter capability | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Spike 3 — Change Package seal / replay | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Spike 4 — Artifact durability / fault injection / reconciliation | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Other cross-cutting contracts | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |
| Technical Gate | `PASS / FAIL / INCONCLUSIVE` | `NOT_RECORDED` | — |

任一关键 case 未运行、证据缺失或结果无法解释，都必须保留为 `INCONCLUSIVE`；不能用其他 Spike 或其他 OS 的成功抵消。

### Runner Gate 合取规则

```text
runner_gate =
  platform_neutral_contract_passes_on_windows_linux_macos
  AND every_profile_reports_actual_capability
  AND no_profile_claims_stronger_guarantees_than_evidence
  AND teardown_failure_never_maps_to_cancelled_safe
```

允许 macOS 等平台明确记录较弱的 `escapeResistance=process_group`，但普通 descendant tree、Cancel、stream drain、post-stop 与 fail-closed 合同仍必须通过。若某平台无法满足其声明合同，该 Platform Profile 为 `FAIL`。

## 5. 联合 Gate Decision Record

两个独立 Gate 都形成 Final Decision Record 后，还必须生成一份联合决策记录，用于检查“合取门槛”而不是重新评判各自证据：

```text
evidence/gates/<joint_gate_id>/product-and-technical-gate-decision.md
```

该记录至少引用：

- 最终 Product Validation Gate Decision Record；
- 最终 Technical Gate Decision Record；
- 所有 `Modify / Remove` 对应的 PRD 修订与重新评审记录；
- 两个 Gate 使用的协议、计划、scope amendment、证据快照和内容哈希；
- 联合结论：`PASS / BLOCKED`。

联合记录不能把一个 Gate 的成功用于覆盖另一个 Gate 的失败、未运行或 `INCONCLUSIVE`。只有两个独立 verdict 都为 `PASS` 且 PRD 修订闭环完成时，联合结论才允许为 `PASS`。

## 6. 当前被阻断的产品工作

| 工作 | 当前状态 | 解锁条件 |
|---|---|---|
| 产品 MVP WWA 拆解 | `BLOCKED` | 第 7 节全部条件满足 |
| 完整产品 MVP Implementation Plan | `BLOCKED` | `70-mvp-wwa-backlog.md` 生成并通过评审 |
| Project / Task 产品化 UI | `BLOCKED` | 联合 Gate 通过，并且门控后 PRD 仍保留该入口与范围 |
| Task 中心生产 Schema、API、导航和生命周期 | `BLOCKED` | Task Aggregation 最终决策及联合 Gate 支持，必要 PRD 修订完成 |
| 通用 WorkflowDefinition、YAML / DAG、Workflow Canvas | `DEFERRED` | 出现真实第二流程、改序或复用证据后另行立项 |
| 多 Runtime 产品化、Sandbox、Session Resume、Remote Runner 等 | `DEFERRED` | 不由本轮 Gate 自动解锁；需要独立真实证据和新范围决策 |

以下内容是 Technical Validation 实验，不属于被阻断的产品实现：

```text
cross-platform LocalRunner contract
small native helper spike
Windows/Linux/macOS CI matrix
repo-marker-v1
hostile fixture execution
```

## 7. WWA 解锁规则与编号

旧路径 `docs/pm/40-wwa-backlog.md` 已废弃。编号现已固定为：

```text
40 = Product Validation Protocol
50 = Milestone 0 Experiment Plan
55 = Cross-platform Runtime Decision
60 = Gate Execution Index
70 = 门控后的 Product MVP WWA Backlog
```

只有以下逻辑表达式为真，才允许把 WWA 状态改为 `UNLOCKED`：

```text
wwa_unlocked =
  product_validation_gate.verdict == PASS
  AND technical_gate.verdict == PASS
  AND all_modify_or_remove_consequences_applied_to_prd
  AND affected_prd_boundaries_re_reviewed
  AND joint_gate_decision_record.final == true
```

解锁后才允许：

1. 将本文件中的 Product + Technical Gate 更新为 `PASS`；
2. 将 Product MVP WWA 更新为 `UNLOCKED`；
3. 运行 `wwas`；
4. 创建 `docs/pm/70-mvp-wwa-backlog.md`；
5. 在 WWA 评审通过后进入产品 MVP Implementation Plan 与 Coding。

以下情况都不能解锁 WWA：

- Product Validation Gate 为 `CONTINUE_VALIDATION` 或 `FAIL_AND_REVISE`；
- Technical Gate 为 `FAIL` 或 `INCONCLUSIVE`；
- 任一 Gate 尚未形成最终 Decision Record；
- 联合 Product + Technical Gate Decision Record 尚未形成 Final 记录；
- `Modify / Remove` 后果尚未回写 PRD；
- 受影响 PRD 边界尚未重新评审；
- 只有口头确认、未引用原始证据或未运行关键用例；
- 只有单一 OS 通过，或平台 capability 与实际证据冲突。

## 8. 更新纪律

每次执行线更新本索引时必须：

1. 记录执行分支、基线 commit、协议/计划/amendment 内容哈希；
2. 只引用已保存、可审计的证据和 Final Decision Record；
3. 将判据、事实、解释和 verdict 分开记录；
4. 对未运行、被排除、混杂或证据缺失的 case 明确标记；
5. 对每个平台分别记录 OS image、architecture、mechanism、capability 与限制；
6. 不在本索引中复制敏感原始证据；
7. 不以 Product Gate 的结果替代 Technical Gate，反之亦然；
8. 不用一个 OS 的 PASS 覆盖另一个 OS 的 FAIL/INCONCLUSIVE；
9. 不把 Gate 通过、有限产品化投资或 MVP 构建完成表述为市场验证完成。

## 9. 下一次允许的状态变化

当前只允许把以下条目从 `NOT_RECORDED` 更新为有证据支持的执行中状态或最终结论：

- Product Validation 的四份 Decision Record；
- Cross-platform LocalRunner contract 与三个 Platform Profile；
- `repo-marker-v1` Repository Identity；
- Technical Validation 的四个 Spike、其他跨切合同与 Technical Gate；
- 必要 PRD 修订及重新评审记录；
- Product + Technical Gate 的联合 Decision Record。

在这些记录闭环之前，Product + Technical Gate 与 Product MVP WWA 必须保持 `BLOCKED`。
