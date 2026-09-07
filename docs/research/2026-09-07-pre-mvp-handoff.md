# Agentic Work OS — Research 阶段交接快照

> 快照日期：2026-09-07  
> 类型：研究阶段决策、状态、进展与未完成工作的一份集中记录  
> 状态：FROZEN SNAPSHOT；不是 Product / Technical Gate PASS  
> 研究快照分支：`research/pre-mvp-handoff`  
> 后续开发分支：`mvp/founder-foundation`

## 1. 阶段结论

需求收敛、PRD、Red Team 和验证协议已经建立；技术实验已经产生真实代码、CI 和部分限定范围决策。项目不是只有文档，但也还没有通过完整产品验证或真实 Codex 执行验收。

项目负责人本轮要求：保留研究阶段记录，然后进入 Founder MVP，避免继续把完整外部验证和全部技术实验作为任何产品编码的共同前置条件。**这是新的有限开工决策，不是把旧 Gate 改成 PASS。** 新开工规则由后续 MVP 分支的 `docs/mvp/00-founder-mvp-scope.md` 明确定义；本快照保留转段时的原始证据状态。

Founder MVP 是供发起者真实使用的小范围应用。允许 UI、本地可演进 Schema、WWA 和实现；真实 Agent 执行、Accept 与 Delivery 仍必须通过各自能力验收。外部用户研究继续独立记录，不以 Founder 替代独立参与者。

## 2. 冻结的源分支与提交

| 角色 | 分支 | 本次读取的 commit |
|---|---|---|
| 已接受治理基线 | `main` | `f1280437959a7dca4797c8da3bceb2204018c02e` |
| 早期 PM 实践 | `pm/requirements-discovery` | `cba1d655ee2c1f39c08c4a898407b3e2f482fa10` |
| 技术实验汇总 / 本快照代码基底 | `spike/milestone-0-harness` | `d543dfa825dab14e2948abffb6367ad3ed3bbdea` |
| 产品验证证据 | `validation/concierge-execution` | `49a1883f8aa71cdcdc3f6439f3ac95b85f3ebc6a` |
| 尚未通过的技术增量 | `spike/spike1-remaining-races` | `6cc4fafb81d8b333f3b02360b369de8bf7866cc3` |

GitHub compare 确认技术汇总相对上述 main 为 ahead 246 / behind 0，因此继承技术汇总不会遗漏该 main 基线。研究快照从技术汇总创建，只添加本文件；MVP 从研究快照继续创建，实验代码保持在 `experiments/`，不自动升级为生产组件。[S1]

产品验证分支的独有内容不做未经审查的整分支合并；通过本记录中的固定 commit 链接保留入口。PR #49 的未通过增量不作为 MVP 基底。没有删除、重命名、强推或重置原分支，也不因建立快照而关闭原 Issue / PR。

## 3. 已接受的方向与尚未验证的假设

| 已形成的方向 | 证据边界 |
|---|---|
| 长期愿景：Project + Workflow + Agent Runtime，执行结果回到项目 | 愿景不是 MVP 功能清单，也不是市场需求证据 |
| 首条候选路径：目标 / DoD → 本地 Coding Agent → Verification → Review → 历史 | Project-native、Task-first、Task 聚合和重复使用价值仍未全部验证 |
| 一个 Run、固定 `prepare → agent → test → review → complete` | 不增加通用 WorkflowDefinition / NodeRun / Workflow Canvas |
| Change Package 在 Review 前 seal；决定绑定不可变 ID/hash | `done` 指已接受的可重放交付物，不表示 merge、push 或发布 |
| trusted-local + working-copy isolation + drift detection | Workspace 不等于 Sandbox；检测不等于阻止宿主机访问 |
| 业务终态与资源 reconciliation 分离 | 未确认安全停止不能显示 cancelled-safe，不能解锁冲突执行 |
| 跨平台上层合同，平台能力显式分级 | `55` 覆盖旧 Windows-only 实现边界，不保证三平台能力相同 |
| Runtime Host 职责分层 | `56` 明确 PTY ≠ 进程所有权；ProcessKit 仅为 ProcessBoundaryBackend 候选 |

来源：[S2]、[S3]。转段不重新运行全面 brainstorming / PRD / Red Team；新的事实只触发受影响部分的调整。

## 4. 产品验证进展

以下来自产品分支固定 commit 的 Draft Decision Record，而非从 PR 数量推断：[S4]

| 指标 | 转段快照 |
|---|---|
| 冻结的前九个真实实例 | 9 / 9 |
| 中性映射、初步匹配分类 | 各 9 / 9 |
| 前九个已知事实的 natural_fit | 9 / 9 |
| 补充不利案例 | 1；S01 为 natural_fit |
| 合计 fit | natural 10 / strained 0 / model_break 0 |
| distinct actual_end_to_end 轨迹 | 1 / required 6；只有 TR-09 |
| Founder Validation | STRONG_SIGNAL_SUPPORTING_ONLY |
| 合格外部参与者 | 0 / 3 |
| 外部真实问题完成 | 0 / 5 |
| 合格独立自发复用用户 | 0 / 2 |
| Project-native / Task-first Final | NOT_RECORDED |
| Task Aggregation | Draft CONTINUE_VALIDATION；未 Final |
| Product Validation Gate | Draft CONTINUE_VALIDATION；Final NOT_RECORDED |

TR-09 的有效观察是 Orbis 的历史接受与实际目标分支交付失配、随后恢复；它支持“历史决定”和“当前 delivery_integrity”分离，不能替代 Cancel、Review Reject、Prepare failure 或其他轨迹证据。

不能把未知 Run/Session/Workspace 事实写为支持；不能把开发中间 RED/GREEN、PR 关闭、重复提交或技术故障注入自动算成产品真实轨迹。现有九个实例不重采；后续自然发生的案例通过 #9/#37 补充。外部 A/B/C 与复用通过 #11/#38 继续，Founder 不计入外部指标。

## 5. 技术进展

| 工作 | 已获得的结果 | 未获得的结论 |
|---|---|---|
| Harness / 跨平台合同 / JSONL / repo-marker-v1 | 代码与测试已存在 | 不等于全部物理能力或生产依赖已冻结 |
| ProcessKit 3.3.4 | 被选为后续实验候选 | 未冻结为生产依赖 |
| Windows observer | 诊断 OBSERVER_MISMATCH；后续 Win32 truth 已合入；PR #35 记录新矩阵 200/200 physical PASS | 历史 94 FAIL 不改写；不是 Windows 全局 managed 声明 |
| RuntimeReceipt OWN-01..09 | #20 / PR #36，限定实验范围 Final PASS | 不替代真实 abrupt owner-loss、Spike 1 或真实 Codex 验证 |
| Linux cgroup_v2 | #15/#47、PR #48，限定环境与冻结矩阵 200/200 physical PASS | 不证明 owner-exit cleanup、资源限额、任意 Linux 环境或全局 managed |
| macOS | #16 / PR #45：KEEP LIMITED，process_group / compatible | 不宣称 escape-resistant / managed |
| 剩余 Spike 1 races | #17 / PR #49 进行中；R-05 优先 | R-05、R-07、R-10/R-11 尚未完整收口 |
| Spike 2 real Codex | 尚未完成实际接入验证 | NOT EVALUATED |
| Spike 3 Change Package | change-package-v0、seal/replay 与测试候选已存在 | 最终 indexed evidence / 独立 verdict 未完成 |
| Spike 4 Artifact durability | 本地 Artifact / SQLite / reconciliation 候选已存在 | F-01..F-17 完整最终 verdict 未完成 |
| Technical Gate | 尚无最终 PASS | NOT EVALUATED |

来源：[S5]、[S6]、[S7]、[S8]。Harness success 表示实验正常执行，不意味着其每条物理场景都 PASS；限定范围 PASS 也不能上推为整个 Gate PASS。

### 技术基底的 CI 快照

对 `d543dfa825dab14e2948abffb6367ad3ed3bbdea` 读取到四条 completed / success：[S9]

- M0 cross-platform runtime：34097672659。
- M0 containment provider eval：34097672613。
- M0 ProcessKit hostile containment：34097672483。
- M0 Linux cgroup-v2 hostile containment：34097672683。

本次只是核对已有 Actions 记录，没有重跑矩阵，也没有启动真实 Codex。

### 未继承的 PR #49 增量

`6cc4faf...` 的 cross-platform runtime（34098640923）与 hostile containment（34098641078）为 failure；Linux cgroup-v2（34098640933）为 success。此前源码/日志核对定位到 R-05 模块文件已存在，但 `lib.rs` 未导出 `r05_cancel_natural_race`；这不是该竞态的正式 GREEN 或 50 次实验通过。[S10]

后续处理应在 #17 原执行线上完成，复用现有 fixture、reducer、RuntimeReceipt 和 ResourceLock；不能因创建 MVP 分支就复制另一套进程框架。合入 MVP 前重新读取最新 head、diff 和同 head 的验证结果。

## 6. 未完成工作如何转入开发

| 工作 | 后续位置 | 对 Founder MVP 的影响 |
|---|---|---|
| 外部 P01 招募、3 人 / 5 问题 / 2 人复用、14 天观察 | 产品研究 #11/#38；自用稳定后继续 | 不再阻塞 UI / Schema / WWA 开工；仍阻止宣称外部价值已验证 |
| A/B/C、Task 聚合剩余真实轨迹 | #9/#37；开发中持续采集 | 不再要求全齐才实现 v0；有反证就调整，不伪造证据 |
| #17 剩余 races、真实 Codex Spike 2 | 实际运行能力开发与激活前验收 | 不阻塞 mock/UI；未证明的运行模式不开放 |
| Package replay、Artifact 最小恢复 | Review / Delivery 切片 | Accept 开放前必须完成相关不变量测试 |
| 完整跨平台与完整故障矩阵 | 对应 profile/保证范围发布前 | 按配置逐步开放，不降低历史实验判据 |
| 生产依赖、公共 API、领域泛化 | 产品使用形成约束后 | 当前仅局部可迁移实现，不冻结长期 ABI/API |

保留所有既有 FAIL / INCONCLUSIVE / NOT_RECORDED，延期不是 PASS。不能确认进程停机、已知数据损坏、缺证据却 Accept、或审核后偷偷换交付物，都不是可延期的便利性问题。

## 7. 本轮分支整理边界

目标分支关系：

```text
spike/milestone-0-harness@d543dfa...
  └─ research/pre-mvp-handoff        # 本文件 + 原技术基底
       └─ mvp/founder-foundation    # 开工范围修订、WWA、执行入口
```

研究快照不删除原协议、决策、实验代码、测试或锁文件。产品证据继续留在其原分支，并以固定 commit 链接引用。本文件集中保存阶段状态，不替代原始证据。

Actions artifact 的 ID/hash 是证据索引，不代表本次已永久下载归档；其可用性与保留期需在后续复用时核对。未在本轮确认的原始字节不声称已经校验。

新分支不代表 main 已更新、旧 PR 已合并、原 Gate 已通过或应用已经实现。本次只做分支与文档，不修改实验实现，不自动 merge。

## 8. 首个 MVP 开发入口

MVP 分支先读 `AGENTS.md` → `docs/mvp/README.md` → `docs/mvp/00-founder-mvp-scope.md` → `docs/pm/70-mvp-wwa-backlog.md`。

第一切片：创建 Task → 创建明确标记的 mock Run → 日志/详情 → 本地持久化 → 重开可查看。该切片不启动真实 Agent，不把 mock 记录算为真实使用或技术能力证据。之后逐步接真实 Codex、Verification、交付和历史恢复。

## 9. 固定来源

- [S1：main 与技术基底 compare](https://github.com/XiaoDaoJiang/agentic-work-os/compare/f1280437959a7dca4797c8da3bceb2204018c02e...d543dfa825dab14e2948abffb6367ad3ed3bbdea)
- [S2：转段前 PM 入口](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/README.md)
- [S3：Local Runtime Host 决策](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/56-local-runtime-host-decision.md)
- [S4：产品 Gate Draft 原记录](https://github.com/XiaoDaoJiang/agentic-work-os/blob/49a1883f8aa71cdcdc3f6439f3ac95b85f3ebc6a/evidence/product-validation/pv-2026-09-01-real-instance-freeze-v1/decisions/product-validation-gate-decision.md)
- [S5：RuntimeReceipt Final Decision](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/58-runtime-receipt-ownership-decision.md)
- [S6：macOS KEEP LIMITED](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/59-macos-containment-profile-decision.md)
- [S7：Linux 限定范围 PASS](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/61-linux-cgroup-v2-final-window-decision.md)
- [S8：Harness / Package / durability 候选](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/experiments/milestone-0/README.md)
- [S9：基底 cross-platform CI](https://github.com/XiaoDaoJiang/agentic-work-os/actions/runs/34097672659)、[provider eval](https://github.com/XiaoDaoJiang/agentic-work-os/actions/runs/34097672613)、[hostile](https://github.com/XiaoDaoJiang/agentic-work-os/actions/runs/34097672483)、[Linux cgroup-v2](https://github.com/XiaoDaoJiang/agentic-work-os/actions/runs/34097672683)
- [S10：R-05 失败 CI](https://github.com/XiaoDaoJiang/agentic-work-os/actions/runs/34098640923)、[该 head 的 lib.rs](https://github.com/XiaoDaoJiang/agentic-work-os/blob/6cc4fafb81d8b333f3b02360b369de8bf7866cc3/experiments/milestone-0/native-runner/src/lib.rs)
- [Windows prospective observer PR #35](https://github.com/XiaoDaoJiang/agentic-work-os/pull/35)、[当前技术增量 PR #49](https://github.com/XiaoDaoJiang/agentic-work-os/pull/49)

这里的固定 commit 文件用于冻结快照；Issue/PR 页面可能继续更新，后续进展应形成新记录，不回写本快照的历史计数或 verdict。
