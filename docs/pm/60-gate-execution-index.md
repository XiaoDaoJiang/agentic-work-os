# Agentic Work OS — Gate Execution Index

> 状态：Active governance index  
> 日期：2026-09-01  
> 需求基线：[MVP PRD](./20-mvp-prd.md)、[PRD Red Team](./30-prd-red-team.md)  
> 执行协议：[Validation Protocol](./40-validation-protocol.md)、[Milestone 0 Experiment Plan](./50-milestone-0-experiment-plan.md)

## 1. 目的与边界

本文件是 Product Validation 与 Technical Validation 的执行治理索引，用于记录当前证据线状态、证据位置、独立 Decision Record 和被 Gate 阻断的产品工作。

本文件不是产品 Backlog、实施计划或生产 Schema。没有可引用的 Final Decision Record 时，不得补写 `PASS` 或产品结论。

## 2. 当前门控状态

| 轨道 / 门槛 | 当前执行状态 | 最终 verdict | 后果 |
|---|---|---|---|
| Product Validation | **IN_PROGRESS**：执行分支 `validation/concierge-execution` 已有真实证据快照；9/9 first-nine fit 已完成，trajectory 与外部 Concierge 仍阻塞 | `NOT_RECORDED` | 不能授权产品 MVP WWA |
| Technical Validation | **IN_PROGRESS / independent**：`spike/milestone-0-harness` 持续执行；Technical Gate 尚未 Final | `NOT_RECORDED` | 不能授权产品 MVP WWA |
| Product + Technical Gate | `BLOCKED`：等待两个独立 Gate Final、必要 PRD 修订闭环及联合 Decision Record | `NOT_EVALUATED` | WWA、实施计划和生产 Schema/API 冻结保持 No-Go |
| Product MVP WWA | `BLOCKED` | 不适用 | 不得创建 `docs/pm/70-mvp-wwa-backlog.md` |

`IN_PROGRESS` 不代表通过；只表示已经存在可引用的执行证据。

## 3. Product Validation 执行线

### 执行分支

`validation/concierge-execution`

Draft PR：`#3 docs(validation): execute Product Validation evidence collection`

### 当前证据快照

`evidence/product-validation/pv-2026-09-01-real-instance-freeze-v1/`

当前事实：

- Nine Real Instances：9 / 9 frozen；
- neutral mapping：9 / 9；
- first-pass fit：9 / 9 `natural_fit` for known facts；
- first-nine `strained_fit = 0`、`model_break = 0`；
- giant Task / special FK / ambiguous ownership / exception lifecycle：0 / 0 / 0 / 0；
- strict distinct actual trajectory：0 / required 6；
- Founder signal：`STRONG_SIGNAL_SUPPORTING_ONLY`；
- external participants：0 / 3；
- external real problems：0 / 5；
- independent qualifying reuse users：0 / 2；
- Product Validation Gate Final：`NOT_RECORDED`。

### 独立 Decision Record

| Decision Record | 允许 Final 结论 | 当前状态 |
|---|---|---|
| Project-native | `Keep / Modify / Remove` | `NOT_RECORDED` |
| Task-first | `Keep / Modify / Remove` | `NOT_RECORDED` |
| Task Aggregation | `Keep / Modify / Remove` | **Draft `CONTINUE_VALIDATION`**：9/9 known-fact natural fit，但 trajectory 0/6 |
| Product Validation Gate | `PASS / CONTINUE_VALIDATION / FAIL_AND_REVISE` | **Draft `CONTINUE_VALIDATION`；Final `NOT_RECORDED`** |

### Active Product Validation work

- Issue #9 `VAL-01`：补至少 6 条不同真实 `actual_end_to_end` trajectory，并 Finalize Task Aggregation。
- Issue #11 `VAL-02`：招募 P01..P03，执行 5 个外部真实问题、A↔B / B↔C、14 天无提醒 reuse audit。

### 证据纪律

- CI checkpoint 是 Verification Event，不自动等于 Agent Run。
- `unknown` 不得转换成支持证据。
- 失败、Cancel、Reject、Supersede 不能因结果不利而从样本删除。
- Counterfactual 不计入 6 条 actual trajectory。
- Technical Validation fault injection 默认不得回填 Product Validation。
- Founder 不计 external participant / qualifying reuse。

## 4. Technical Validation 执行线

执行分支：`spike/milestone-0-harness`

Technical Validation 保持独立。Product Gate 的进展、Founder 证据和 first-nine fit 都不能抵消 Technical Gate 的 FAIL / INCONCLUSIVE；反之亦然。

Technical Gate 仍需依据 `50-milestone-0-experiment-plan.md` 完成独立 Spike、跨切合同和 Final Decision Record。

## 5. 联合 Gate Decision Record

只有 Product Validation Gate 与 Technical Gate 都形成 Final Decision Record 后，才允许生成：

`evidence/gates/<joint_gate_id>/product-and-technical-gate-decision.md`

联合记录只检查合取条件，不能重新解释或抵消单独 Gate 的失败/未运行。

## 6. 当前被阻断的产品工作

| 工作 | 当前状态 | 解锁条件 |
|---|---|---|
| 产品 MVP WWA 拆解 | `BLOCKED` | 两个独立 Gate PASS + PRD 修订闭环 + joint Final |
| 完整 MVP Implementation Plan | `BLOCKED` | `70-mvp-wwa-backlog.md` 生成并通过评审 |
| Project / Task 产品化 UI | `BLOCKED` | 联合 Gate 通过且门控后 PRD 仍保留该入口 |
| Task 中心生产 Schema/API/导航/生命周期 | `BLOCKED` | Task Aggregation Final + 联合 Gate 支持 |
| 通用 WorkflowDefinition / Canvas | `DEFERRED` | 独立真实复用/第二流程证据 |
| 多 Runtime / Sandbox / Session Resume / Remote Runner | `DEFERRED` | 独立真实证据与新范围决策 |

## 7. WWA 解锁规则

只有以下表达式为真：

```text
wwa_unlocked =
  product_validation_gate.verdict == PASS
  AND technical_gate.verdict == PASS
  AND all_modify_or_remove_consequences_applied_to_prd
  AND affected_prd_boundaries_re_reviewed
  AND joint_gate_decision_record.final == true
```

才允许运行 `wwas` 并创建 `docs/pm/70-mvp-wwa-backlog.md`。

## 8. 更新纪律

每次状态更新必须：

1. 引用已保存、可审计的 evidence snapshot / Final Decision Record；
2. 将判据、事实、解释和 verdict 分开；
3. 未运行、被排除、混杂、unknown 必须显式标记；
4. 不复制敏感原始证据到公开记录；
5. Product 与 Technical Gate 互不替代；
6. Gate PASS 不表述为市场验证完成。

## 9. 下一次允许的 Product 状态变化

当前 Product Validation 下一次合法变化仅包括：

- `actual_end_to_end` trajectory 从 0 增加到有真实证据支持的计数；
- P01..P03 由真实 Qualification 产生；
- 外部真实问题与 A/B/C observation 被记录；
- qualifying reuse 经双评审通过；
- 三份独立 Product Decision Record 进入 Final；
- 最后才评估 Product Validation Gate Final。

在这些记录闭环之前，Product MVP WWA 必须保持 `BLOCKED`。
