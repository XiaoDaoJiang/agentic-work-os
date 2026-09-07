# FMVP-ADR-001 — Founder MVP 有限开工与分层能力验收

> 日期：2026-09-07  
> 状态：ACCEPTED FOR THIS MVP BRANCH  
> 决策依据：项目负责人明确要求快速进入 MVP，并授权创建研究交接与 MVP 分支及前置文档  
> 适用范围：本分支及由其派生的 Founder MVP 实现；不是 main 合并记录、外部发布许可或旧 Gate PASS

## 1. 决策与非结论

允许立即编写 Founder MVP 的 WWA、最小产品 UI、本地可迁移 Schema 与实施计划。完整 Product Validation 与跨平台 Technical Gate 不再是这些开发活动的共同前置条件。

采用“代码可以先开发；能力必须验收后才开放”。未验证的真实执行和 Accept 在服务端默认关闭；mock/只读界面允许先交付。一次性、安全的 fixture 中为取得证据而进行的诊断仍可执行，不计为已对用户开放。

这是一项范围/投入决策，不是用户研究证据。原 Product Gate、Technical Gate、样本数量、独立性要求、实验次数、历史 FAIL 与未完成项保持原样。Founder 使用只能支持 Founder 适用性，不补足外部参与者或独立自发复用人数。

## 2. 与历史合同的关系

转段事实统一见 [Research 快照](../research/2026-09-07-pre-mvp-handoff.md)。

本修订显式覆盖旧 `docs/pm/01-pm-skills-runbook.md`、`20-mvp-prd.md`、`30-prd-red-team.md`、`40-validation-protocol.md`、`50-milestone-0-experiment-plan.md` 以及转段前 `60-gate-execution-index.md` 中以下限制，且只覆盖这些限制：

- 未取得完整双 Gate PASS 前不得创建任何产品 WWA/实施计划。
- 未完成全部外部验证与技术矩阵前不得实现任何 Project/Task UI 或本地 Schema。
- 把所有平台的完整实验收口作为首个平台产品开发的先决条件。

允许的 Schema 是带版本、可迁移的 Founder v0 实现，不是长期公共 API/ABI 或多租户生产模型冻结。其余不冲突的正确性、安全与证据合同保持有效。`55` 的跨平台上层合同、`56` 的职责边界继续保留。

不要重写历史 PRD/协议来使过去看起来已经满足新规则。新的研究结果更新其自身记录；本修订也不自动关闭任何旧 Issue/PR。

## 3. 最小产品边界

目标：发起者能完成一项真实代码任务，稍后回来理解结果、审核交付，并愿意处理下一项真实任务。

首版单用户、本地 Web、一个 Codex Adapter、全局一个活动 Run、一种已验收 working-copy 策略、一个 VerificationInvocation。架构跨平台，按实际 profile 分批开放；首个真实 profile 在执行机器可用时记录，不把“使用何种 OS”当成 FMVP-01 的阻塞。

Project 最初只是仓库上下文，不建设独立项目管理平台。Task v0 保存目标与 DoD；Run 具有独立 ID 和完整输入快照，Runner 不依赖 Task UI 字段。固定路径保持 `prepare → agent → test → review → complete`，先允许 mock 驱动界面，后接真实执行。

接受结果仍是一份 sealed、可重放、绑定 base_revision 的 Change Package。Task done 表示已接受交付物可用，不表示 commit/merge/push/release；原生 Agent 若产生 commit，仍按 frozen base 计算实际变更，不能遗漏到 Package 之外。

暂不增加通用 Workflow、Canvas、多人、Remote Runner、多 Runtime、自动 Merge/Push、Session Resume、Memory、Collaboration 或自主调度。全局单运行是减少首版并发复杂度的选择，不允许忽略未知/存活的旧进程。

## 4. 从开工前置条件移出的任务

| 项目 | 新处理时点 | 不改变什么 |
|---|---|---|
| 3 名外部参与者、5 个外部问题、2 名独立复用、14 天窗口 | 自用闭环形成后的外部验证与扩大投入评估 | 原协议计数和独立性要求不变 |
| 完整 A/B/C 和剩余 6 类真实异常覆盖 | 开发中观察与自然案例采集 | 工程测试不冒充真实产品证据 |
| Task 最终中心模型 | 先局部 v0，出现表达困难时迁移 | 不宣称最终聚合已验证 |
| 全部平台相同交付进度 | 按 profile 激活前验收 | 不隐藏 compatible/unsupported，不外推 PASS |
| 完整故障矩阵和格式泛化 | 随相关切片与声明的发布范围推进 | 已知损坏/缺证据 Accept 不可延期，原完整 Gate 仍须按原矩阵判断 |
| 长期依赖/公共 API 冻结 | 使用形成约束后 | 实验候选不自动升级为生产保证 |

## 5. 四层许可与能力开放条件

### G0 — 有限编码许可：本分支已允许

可以实现产品界面、本地模型、mock/只读链路、WWA 和针对当前切片的计划。真实执行与真实 Accept 保持关闭。不需要再为 G0 招募用户、补齐自然异常或运行全面 Red Team。

### G1 — 当前 profile 的真实执行激活：尚未评估

在 UI/服务端对用户开放真实启动之前，必须在 disposable fixture 中取得该 profile/adapter 的实际证据：明确 cwd、输入、输出/退出；正常/非零退出；Cancel/timeout、重复请求与退出竞态；owned boundary、drain；owner-loss 后不误报安全且阻塞新执行；working copy/baseline 与定向 drift 检测。

复用已有 #17 等实验合同与判据，不能靠修改次数或删除失败使测试变绿。其他平台未完成不阻塞该 profile；但该 profile 的必要验证不得跳过。Linux containment PASS 不替代 owner-loss；macOS compatible 不能执行需要强边界的模式。

必须记录精确 code SHA、platform/profile、Node/Rust/Git/Codex 版本、测试/原始证据链接和已知限制。未通过则保持 mock/诊断模式，不启动真实用户仓库任务。

真实执行仍为 trusted-local，不自建 Sandbox，但保留 Agent 原生权限限制。不得默认开放危险的全权限绕过、自动 push 或生产凭据。localhost 的执行入口必须有服务端请求来源与本地会话校验，不能只靠隐藏按钮。

### G2 — Accept / Accepted Delivery 激活：尚未评估

同时满足：日志、Diff、Verification 与唯一 Change Package 已 sealed/readable/hash-match；Package 可在删除源 Workspace 后从 frozen base 重建相同 result tree；Review 引用同一不可变 Package；未解决 drift、未知资源或完整性异常禁止 Accept；重复 Review 请求不会产生两个决定；状态/Event/决定的事务一致性成立。

必须测试最小恢复路径：staging 写入中断、finalize 后 DB 提交前中断、DB 登记后对象缺失/损坏、等待 Review 重启与重复决定。全矩阵继续执行，不能借 G2 宣称原 Spike 4 Final PASS。failed/cancelled 的历史允许只有当时可安全保存的部分证据；它们不能获得可 Accept 的成功交付。

Verification 是证据，不证明全部 DoD；结果必须与所审核的版本关联，不能把旧代码上的 passed 当成新 Package 已验证。损坏后的 delivery_integrity 单独显示，不能篡改历史接受。

### G3 — 外部试用 / 更广发布：本次不授权

准备外部使用时，针对要开放的 profile 与功能完成相关可靠性和数据处理检查，并由负责人明确授权；保留已知限制和回退方式。独立需求/复用协议用于扩大投入判断，不能把技术验收或 Founder 自用当作市场验证。

## 6. 执行与证据维护

[G0 六个 WWA](../pm/70-mvp-wwa-backlog.md) 是当前开发队列。每个实现 PR 自带 Acceptance、测试命令、结果、code SHA 和尚未开放能力，不为每个微小决定新增顶层 Gate 文档。

G1/G2 的证据记录在对应切片 PR 中并链接原实验；不同证据类别分别标记，不要求外部参与者来验证文件哈希或进程行为。后续正式 Gate 只引用其协议允许的证据。

研究快照不再作为可编辑进度表；新进展更新 WWA 状态/实现 PR，重大范围改变才增补本修订。
