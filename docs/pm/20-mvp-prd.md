# Agentic Work OS — Validation + Milestone 0 + MVP PRD

> 版本状态：Frozen for Validation Prototype / Milestone 0；Not frozen for Product MVP WWA
> 日期：2026-08-25
> 范围：Validation Prototype / Concierge Validation、Milestone 0 与门控后的 MVP
> 输入：[项目上下文](./00-project-context.md)、[关键假设](./10-key-assumptions.md)、[PRD Red Team](./30-prd-red-team.md)

## 标签说明

- `[Required]`：MVP 黄金路径不可缺少；未达到验收标准则不能发布该 MVP。
- `[Experiment]`：为验证假设或技术可行性而做的最小实现；允许根据证据替换或删除。
- `[Deferred]`：本轮明确不实现；出现真实证据后再重新立项。
- `[Assumption]`：尚未验证的判断，不是事实或已证实的用户需求。

范围标签与证据标签彼此独立；一项能力可以同时是 `[Required]` 和 `[Assumption]`，前者不表示后者已经得到证明。

本文中的样本数、通过信号和失败信号是计划中的验证判据，不是已经取得的数据。本轮不补充市场研究；证据不足处统一写为“尚未验证”。

## 1. Summary

本 PRD 定义 Agentic Work OS 的证据门控最小版本：候选黄金路径从 Project / Task 出发，在 trusted-local 的独立 working copy 中调用本地 Codex 完成一个真实代码修复，并在同一控制面查看输出、Diff、Verification、sealed Change Package、人工 Review 和可恢复历史。

Validation Prototype / Concierge Validation 与 Milestone 0 并行，分别形成 Product Validation Gate 与 Technical Gate；两者都通过后，才允许进入产品 MVP WWA 与实施计划。Project-native、Task-first、Task 中心聚合、单 Agent 代码修复价值以及 Windows 本地执行链路均尚未验证。第一版仍使用固定、持久化的 `prepare → agent → test → review → complete` 状态机，不建设通用 Workflow Engine，也不增加 Delivery Node。

## 2. Contacts

| 姓名 | 角色 | 说明 |
|---|---|---|
| 尚未指定 | 产品决策负责人 | 负责 Validation Prototype / Concierge Validation，分别确认 Project-native、Task-first、Task 聚合和 A3 场景证据，并签署 Product Validation Decision Record；姓名不是当前验证启动阻塞项。 |
| 尚未指定 | 工程负责人 | 负责 Milestone 0、执行安全、Change Package / Artifact 可靠性证据和 Technical Gate；尚未验证团队容量。 |
| 尚未招募 | 第一批验证用户 | 已经使用 Coding Agent 的个人开发者；只参与真实任务验证，不代表需求已被证明。 |

## 3. Background

### 3.1 证据边界

当前输入能说明项目发起者遇到过跨 Project、Issue、Git、Coding Agent、测试和结果回写的割裂，也能说明拟议黄金路径在设计上自洽。它不能证明目标用户普遍有同样强度的问题，也没有提供已运行的 Codex / Windows Runner / Workspace PoC。

### 3.2 Problem

| 类型 | 问题陈述 | 当前证据与边界 |
|---|---|---|
| 当前已知的问题 | 在项目发起者的现有工作流中，任务意图、Agent Session、执行目录、输出、Diff、测试结果和最终决定分散在多个工具中，需要人工关联。 | 这是内部工作观察，不是目标用户研究结论。 |
| 当前已知的问题 | 本项目尚无用户行为数据、重复使用数据或 Windows 本地执行 PoC。 | 已在关键假设文档中明确。 |
| 我们推断的问题 | 当用户离开终端后再回来时，分散记录可能使其难以准确判断“做了什么、是否完成、是否值得接受”。 | `[Assumption A1-P/A3]` 尚未验证。 |
| 我们推断的问题 | 将意图、执行和证据关联到 Project，可能比孤立 CLI Session 更容易恢复和验收。 | `[Assumption A1-P]` 尚未验证。 |
| 尚未验证的用户需求 | 在相同 Project / Run 归档能力下，个人开发者是否愿意先创建 Task，再启动 Coding Agent。 | `[Assumption A1-T]` 尚未验证；必须与 CLI-first + 自动归档分开比较。 |
| 尚未验证的用户需求 | 用户是否需要修改、复用或创建不同流程。 | `[Assumption A4]` 尚未验证；多阶段不等于需要 Workflow Engine。 |
| 尚未验证的用户需求 | 单 Agent 代码修复是否足够高频、足够痛，并能带来第二次真实使用。 | `[Assumption A3]` 尚未验证。 |

### 3.3 Why Now

当前已经有一条足够窄、可证伪的黄金路径，也已经识别出会导致范围或架构返工的关键假设。现在适合并行执行有边界的 Validation Prototype / Concierge Validation 与 Milestone 0 技术 Spike；在 Product Validation Gate 与 Technical Gate 同时通过前，不进入产品 MVP WWA，不冻结 Task 中心生产 Schema/API，也不扩建 Project UI、Workflow、多人协作或远程执行能力。

### 3.4 Core Job

> 将一个真实代码修改任务交给 Coding Agent，并能够稍后回来准确知道它做了什么、是否完成、是否值得接受。

Job 场景化表达：

> 当我有一个边界清楚、可以用 Diff 和一次 VerificationInvocation 提供验收证据的代码问题时，我希望从项目任务上下文启动本地 Coding Agent，让它在 trusted-local 的独立 working-copy Workspace 中工作；这样即使我暂时离开，也能回来依据目标、输出、Diff、Verification、sealed Change Package 和人工决定继续处理，而不必重新拼接上下文。

`[Assumption A1-P/A3]` 该 Job 对第一用户有足够频率和独立价值，尚未验证。

## 4. Objective

### 4.1 候选 MVP 核心目标

若 Product Validation Gate 保留 Project-native、Task-first 和 Task 聚合，且 Technical Gate 同时通过，则产品 MVP 验证以下候选路径：

> 用户能否从一个 Project / Task 上下文出发，将真实代码修复任务交给本地 Codex，在 trusted-local 的独立 working copy 中执行，并在同一个控制面观察运行、查看结果、执行 Verification、审核 sealed Change Package，并保留可恢复的执行历史。

对用户的候选收益是减少重新定位上下文和核对结果的成本；对项目的收益是以最小代价判断是否值得继续建设 Agentic Work OS。两项收益均 `[Assumption]` 尚未验证。本段描述候选边界，不构成对 Project-native、Task-first、Task 聚合或产品价值的验证结论；任一门槛得到 `Modify / Remove` 决策时，必须先修订受影响范围，再进入 WWA。

### 4.2 Key Results / Success Criteria

以下为本轮的验收和学习标准，不以页面数、功能数、Workflow 节点数或代码量衡量成功。

| ID | 成功标准 | 验证方法 |
|---|---|---|
| KR-01 | `[Experiment]` Milestone 0 的 mock CLI、真实 Codex、Change Package replay 与 Artifact 故障注入预定义用例全部通过；若关键能力不能可靠闭合，则 Technical Gate 不通过。 | 保存原始 I/O、进程 containment 结果、终态记录、Workspace drift、Change Package replay、Artifact reconciliation 结果和 Adapter capability matrix。 |
| KR-02 | `[Required]` 至少一个非演示仓库的真实代码问题从 Task 启动，并在 sealed Change Package 已持久化后到达可作 Accept / Reject 决定的 Review。 | 以真实 Task、Run、Diff、Verification Artifact、Change Package Artifact 和 ReviewDecision 为证据。 |
| KR-03 | `[Required]` 每个 Run 都能唯一关联其 Task 和 attempt；其产生的 Event、Artifact 与可选 ReviewDecision 均可追溯到该 Run。每个进入 Agent 阶段的 Run 恰好关联一个 Workspace。Prepare 失败时允许没有 Workspace，但必须有明确失败 Event。 | 查询持久化记录并从 Task 反向打开完整 Run 历史。 |
| KR-04 | `[Required]` 在 trusted-local 前提下，每个 Run 使用独立 working copy；系统能检测源仓库与已登记 Workspace 的非预期 drift，并在存在 drift 时禁止 Review Accept 和 Delivery。 | 记录执行前后基线、规范化路径、源仓库与已登记 Workspace 状态以及 drift 判定。该验收不声称提供 Sandbox 或宿主机隔离。 |
| KR-05 | `[Required]` 每个成功的 Cancel 都终止 Runner-owned process containment boundary 内的受控进程，只产生一个 `cancelled` 业务终态，且不再进入 Test 或 Review；不能确认安全停止时必须为 `interrupted` 并阻塞新 Run，直至资源 reconciliation。 | 覆盖正常取消、重复取消、退出与取消竞态、Runner 崩溃、late write、终态唯一性和 resource reconciliation。 |
| KR-06 | `[Required]` 用户只依据同一控制面中的目标 / DoD、Agent 输出、最终 Diff、Verification 结果和 sealed Change Package，即可记录 Accept / Reject。 | 任一 ReviewDecision 都必须引用同一 Run 中可读、hash 匹配的 Change Package Artifact ID 与 hash；Accept 还要求不存在未解决 drift，Reject 不受该 drift gate 阻止。无需打开外部终端补齐关键事实。 |
| KR-07 | `[Required]` 应用重新打开后，用户仍能回答上一次执行了什么、停在哪里、改了什么、Verification 结果、Change Package、人工决定、资源 reconciliation 和下一步。 | 关闭并重开应用后进行 Artifact / Run reconciliation 与任务恢复走查；不要求恢复已丢失的在途 Session。 |
| KR-08 | `[Experiment]` 在 3 名第一用户、共 5 个真实代码问题的验证中，一次无提醒、非预分配的自发复用只允许继续小规模验证；至少两名独立用户自发复用，且能指出 Project 连续性、Task 契约、恢复、控制或证据验收中的具体收益，才允许有限的产品化投资。 | 记录第二次任务的来源、选择入口、实际使用的控制面能力与复用原因；“表示感兴趣”、研究安排或只因 Codex 本身完成任务均不计入。该门槛是建议的决策规则，尚未验证为充分，也不得称为市场验证完成。 |

### 4.3 失败与停止规则

- 如果 A1-P 未支持 Project-native 价值，当前 Project-native 产品边界 No-Go；先修订 PRD，重新评估 CLI Session / Run companion，不用 Task-first 结果替代。
- 如果 A1-P 成立但 A1-T 未支持 Task-first 的额外净收益，保留已有 Project-native 证据，改评 CLI-first 自动关联，不强行建设 Task-first 主入口。
- 如果 A2 失败，在生产 Schema、API、导航和状态机扩散前停止冻结 Task 聚合，并将候选中心对象改为更中性的 WorkItem、ExecutionRequest、ChangeSet 或 Run-first。
- 如果 A3 失败，只从同一用户群的真实相邻任务中重新收窄场景；不通过增加功能掩盖无重复价值。
- 如果 A5 的 Milestone 0 失败，不扩建 Project UI 或 Workflow；先替换 Adapter、Runner 或 Workspace 策略，必要时收缩能力承诺。
- 如果 sealed Change Package 无法在原 Workspace 消失后重放，或 Artifact / Run reconciliation 无法维持证据一致性，Technical Gate 不通过，不得开放 Review Accept 或把 Task 标为 `done`。

## 5. Market Segment(s)

### 5.1 第一用户

`[Assumption]` `[Required]` 第一版只为已经使用 Codex、Claude Code 等 Coding Agent 的个人开发者设计。该用户：

- 在本机维护 Git 仓库，并已有可工作的 Codex 登录态；
- 能描述一个代码修改目标、Definition of Done 和一个 single VerificationInvocation；
- 愿意在 trusted-local 前提下让 Agent 在独立 working-copy Workspace 中执行；
- 需要查看进度、必要时 Cancel，并在完成后亲自决定是否接受；
- 重视本地数据和现有 CLI 能力，不要求团队部署。

该分群尚未经过真实用户验证。

### 5.2 候选第二用户

`[Assumption]` `[Deferred]` 技术负责人是候选第二用户，但其委派、交接、多人审核、权限和通知需求尚未验证。本 MVP 不同时为团队治理设计能力。

### 5.3 非目标用户

`[Deferred]` 本轮不服务以下场景：完整替代 Jira / Linear 的团队、多人 Agent 协作、远程执行平台、多租户企业治理、无代码 Workflow 用户或普通聊天机器人用户。

### 5.4 首版约束

- `[Required]` 单用户、本机、Windows 优先、单仓库代码修复。
- `[Required]` 一次 Run 只使用一个 Runtime、一个 Workspace 和一个 VerificationInvocation。
- `[Assumption]` 一个 VerificationInvocation 足以为首版人工 Review 提供最低验证证据，尚未验证；它只提供证据，不证明全部 DoD。
- `[Assumption]` 一个 Project 对应一个主要仓库足以支持第一版，尚未验证。
- `[Deferred]` 团队身份、RBAC、通知、移动端和远程共享。

## 6. Value Proposition(s)

以下均为候选价值，不是已证实的竞争优势。

| 候选价值 | 对 Core Job 的作用 | 证据状态 |
|---|---|---|
| Project-native 连续性 | 将目标、Run、Workspace、输出、Diff、Verification 和决定放回同一项目上下文，减少回来后重新拼接事实的成本。 | `[Assumption A1-P]` 尚未验证。 |
| Task-first 可执行契约 | 在启动前固定目标、DoD、仓库和 VerificationInvocation，使执行与验收使用同一份输入。 | `[Assumption A1-T/A2]` 尚未验证 Task-first 的额外净收益。 |
| 本地、可干预执行 | 复用现有 Codex 登录态，在 trusted-local 的独立 working copy 中运行，持续输出并允许 Cancel。Workspace 不是 Sandbox。 | `[Assumption A5]` 尚未通过 PoC。 |
| 可审核交付 | 用最终 Diff、Verification 结果、sealed Change Package 和 ReviewDecision 回答“是否值得接受”，而不把 Agent 退出当作任务完成。 | `[Assumption A3]` 尚未验证是否比现有 CLI + Git 更有独立价值。 |
| 可恢复历史 | 应用重新打开后仍可理解已结束或中断的 Run、交付物与资源 reconciliation。 | `[Assumption A1-P/A6]` 尚未验证历史恢复的实际使用频率。 |

本轮不声称比 IDE、终端、tmux、Issue 工具或其他 Agent 控制台更好；该比较需要真实使用证据。

## 7. Solution

### 7.1 方案原则

1. `[Required]` 只实现一条贯穿路径，不分别做完整 Project、Workflow 和 Agent 三个产品面。
2. `[Required]` `Run` 是首版唯一的一等执行记录，同时代表本次 AgentRun；不另建 WorkflowRun、NodeRun 和独立 AgentRun 三套模型。
3. `[Required]` 流程是代码内固定、可持久化、可恢复判断的状态机，不是通用 Workflow Definition。
4. `[Required]` 每次 Agent 执行必须绑定确定的 Task 输入快照、完整 VerificationInvocation 和独立 working-copy Workspace。
5. `[Required]` Agent 退出不等于工作被接受；最终决定属于 Human Review。
6. `[Required]` Review 只针对一个 sealed、content-addressed、replayable Change Package；Package seal 是 `test → review` 的内部持久化屏障，不增加业务阶段或 Delivery Node。
7. `[Required]` Task `done` 记录 Accept 当时“被引用的可重放交付物已通过完整性门槛”，不表示已经 commit、merge、push 或发布。Accept 后的当前可交付性由独立的 `delivery_integrity` 计算投影表示。
8. `[Required]` 执行采用 trusted-local 模型：Workspace 只提供代码 working-copy isolation，不是 Sandbox，也不承诺宿主机文件、网络、凭据或进程隔离。
9. `[Deferred]` 一切不能直接帮助黄金路径闭环或验证五项关键假设的能力。

### 7.2 Golden Path

```text
创建 Task
→ 设置仓库 / 目标 / DoD / VerificationInvocation
→ Start Run
→ Prepare Workspace 并记录 drift baseline
→ 启动 Codex Local
→ 查看 Agent 输出
→ 必要时补充输入（能力实验）或 Cancel
→ 收集 Diff
→ 在 test 阶段执行一个 VerificationInvocation
→ 在 test 阶段内部 seal Change Package
→ Human Review：Accept / Reject
→ Run Completed
→ 之后从 Task 查看完整历史
```

| 步骤 | 用户与系统行为 | 必须持久化的结果 | 验收 |
|---|---|---|---|
| 1. 创建 Project / Task | `[Required]` 在联合 Gate 保留该入口的前提下，用户创建或选择 Project，创建 Task，并填写标题、修改目标、DoD、仓库 / 基准引用和一个完整 VerificationInvocation。 | Project、Task 及更新时间。 | 缺少目标、DoD、可访问仓库或有效 VerificationInvocation 时不能 Start Run。 |
| 2. Start Run | `[Required]` 系统从 Task 创建新的 Run，并冻结本次输入。 | `attempt_no`、目标、DoD、仓库、基准引用、完整 VerificationInvocation、Runtime 和环境继承策略快照。 | 同一 Task 同时最多一个非终态 Run；同 Task 或同 repository identity 存在未完成 resource reconciliation 的旧 Run 时禁止启动；再次尝试必须创建新 Run，不覆盖旧记录。 |
| 3. Prepare | `[Required]` 校验仓库与 Codex 能力，创建该 Run 独占的 working-copy Workspace，记录规范化路径、基准 commit，以及源仓库和已登记 Workspace 的 drift baseline。 | Workspace、baseline、`workspace.prepared` Event。 | Workspace working copy 未准备成功或 baseline 未记录时不得启动 Codex；这里不建立 Sandbox。 |
| 4. Agent | `[Required]` Local Runner 以 Workspace 为明确 `cwd` 启动真实 Codex，将目标和 DoD 作为 prompt 输入。Codex 继承当前用户可用的宿主机权限与登录态。 | Agent 启停 Event、运行中的 staging log、退出信息；`[Experiment]` 原生 Session 可用时保存映射。 | Codex 实际 cwd 必须等于记录的 Workspace；cwd 不是宿主机 containment，且不得从易变的人类文案伪造结构化状态。 |
| 5. 观察与控制 | `[Required]` 用户持续看到 stdout / stderr；可在运行中 Cancel。`[Experiment]` 若 Adapter 证明支持，可发送补充输入。 | 输出追加到 Agent Log staging spool；输入和 Cancel 产生 Event。 | 不等进程退出才显示输出；不支持输入时明确显示 unavailable，不伪装支持。 |
| 6. Diff | `[Required]` Agent 正常结束后收集初始 Diff；VerificationInvocation 完成后再次收集最终 Diff。 | staging Diff 和文件变更清单。 | 包含修改、删除和未跟踪文件；最终交付不依赖仍然存活的临时 Workspace。 |
| 7. Test / Verification | `[Required]` 在同一 Workspace 执行 Run 快照中的一个 VerificationInvocation；业务 `phase` 仍命名为 `test`。 | invocation contract、cwd、环境策略、开始 / 结束时间、stdout / stderr、退出码、termination reason 和 `passed / failed / error`。 | `failed / error` 在证据成功 seal 且资源安全时仍进入 Review；用户 Cancel 或无法确认进程停止时不得进入 Review。结果只提供证据，不证明全部 DoD。 |
| 8. Seal（test 阶段内部步骤） | `[Required]` 停止 producer、排空输出，seal Agent Log、Verification Result 和最终 Diff，再构建唯一 sealed、content-addressed、replayable Change Package；随后重做 drift detection。 | 四类 sealed Artifact、各自 ID / hash、Change Package manifest、`change_package.sealed` 与 drift Event。 | 这是 `test → review` 的内部退出屏障，不是新阶段或 Delivery Node。任一 Required Artifact 不可读、hash 不匹配、Package 无法重放或出现 drift 时不得进入可 Accept 的 Review。 |
| 9. Review | `[Required]` 用户在一个页面查看目标 / DoD、最终 Diff、Verification、Agent 输出、Change Package 与警告，选择 Accept 或 Reject，可附说明。 | 最多一个不可变 ReviewDecision，必须保存 `change_package_artifact_id` 与 `change_package_sha256`。 | Package 必须属于同一 Run、可读、hash 匹配且 Review 开始后不可替换。存在未解决 drift 时仍可查看证据和 Reject，但必须禁用 Accept 与 Delivery。 |
| 10. Complete | `[Required]` 写入 ReviewDecision 后，Run 进入 `complete / completed`。Accept 仅在 Package 与 drift gate 再次通过、`delivery_integrity` 初始计算为 `healthy` 时使 Task 进入 `done`；Reject 使 Task 在资源安全后回到 `ready`。 | ReviewDecision、唯一 `run.terminal` Event、Task 状态投影。 | `completed` 表示本次固定协调流程结束。Task `done` 只记录 Accept 当时的交付完整性门槛已通过，不表示 commit、merge、push 或发布；之后必须结合当前 `delivery_integrity` 判断是否仍可交付。Reject 不伪装成系统故障。 |
| 11. History | `[Required]` 用户重新打开应用，从 Task 查看所有 Run、证据、Change Package、决定、资源状态和 accepted Package 的当前 `delivery_integrity`。 | Task、Run、Event、sealed Artifact、ReviewDecision、resource reconciliation state 和可重算的交付完整性投影。 | 无需重新打开外部终端即可解释上一次 Run；首版不承诺恢复已经丢失的在途 Session，也不依赖保留原 Workspace 才能取得已接受交付物。 |

异常路径：

- Prepare、Adapter、Runner、Workspace、Change Package seal 或持久化故障使 Run 进入 `failed` 或在失去进程事实时进入 `interrupted`，保留已经安全 seal 的证据。
- 系统失去对在途进程的可靠控制时进入 `interrupted`；这只表示业务执行中止，不表示进程已停止或 Workspace 已安全释放。
- Agent 正常退出才进入 Test；Cancel 后不得进入后续业务阶段。
- Drift detection 发现源仓库或已登记 Workspace 异常时，禁止 Accept、Accepted Delivery 和 Task `done`；用户仍可查看证据并 Reject。
- Required Artifact 或 Change Package 无法完成最小提交协议时不得进入 Review。
- Reject 后的修复使用新的 Run / attempt，不复用或改写旧 Run；只有资源状态安全时才允许启动。

### 7.3 固定、持久化状态机

首版快乐路径固定为：

```text
prepare → agent → test → review → complete
```

`[Experiment]` 固定状态机是当前最小、可逆的实现默认。`[Assumption A4]` 用户是否需要第一版可配置 Workflow、固定流程是否不足，尚未验证。第一版不提供改序、节点配置、YAML / DAG 或 Workflow UI；只有真实用户需要改序、复用或创建第二条流程时，才重新评估 WorkflowDefinition。

Run 将阶段与控制状态分开持久化：

- `phase`: `prepare | agent | test | review | complete`
- `state`: `running | waiting_review | cancelling | completed | failed | cancelled | interrupted`
- `resource_state`: `not_acquired | active | reconciliation_required | reconciling | safe | blocked`

规则：

- Workspace working copy 准备成功且 drift baseline 已记录后，才能从 `prepare` 进入 `agent`。
- Agent 正常退出后进入 `test`；执行底座故障进入 `failed`。
- VerificationInvocation 的 `passed`、`failed` 或 `error` 都可以进入封存屏障；只有 Agent Log、Verification Result、最终 Diff 和唯一 Change Package 全部 sealed、可读、hash 匹配，drift check 完成且 `resource_state = safe` 后，才能原子进入 `review / waiting_review`。
- Change Package seal 属于 `test` 阶段内部步骤；固定 FSM 不新增 Delivery 阶段、Delivery Node 或通用 Workflow。
- ReviewDecision 必须引用被审核 Change Package 的 Artifact ID 与 hash。Accept 前再次校验引用、实际 bytes 与 drift gate；校验失败时禁止 Accept。
- Accept 时，ReviewDecision、`complete / completed`、Task `done`、`review.decided` 和唯一 `run.terminal` Event 在同一数据库事务提交。Reject 引用同一 Package，使 Run `completed`，并在资源安全后使 Task 回到 `ready`；后续工作创建新 Run。
- `failed`、`cancelled`、`interrupted` 为业务终态，并保留发生时的 `phase`；`interrupted` 不代表资源已经安全。
- 阶段 / 状态更新与对应 Event 必须原子提交。
- `run.terminal` 每个 Run 最多一条，写入后 `phase / state` 永久不变。终态后禁止新业务阶段、ReviewDecision、Agent / Verification 启动、Agent 输出和新运行 Artifact；只允许 7.3 所列 resource reconciliation Event。
- 重试总是创建新 Run，但创建资格与业务终态分离：同 Task 或同 repository identity 存在 `active / reconciliation_required / reconciling / blocked` 资源状态时禁止新 Run。

Task 只使用最小投影：

```text
ready → running → review → done
```

Task `done` 记录 Human Accept 提交时已绑定一个完整、可读、hash 匹配且可重放的 Change Package；不表示已经 commit、merge、push 或发布。它是历史生命周期事实，accepted Package 后续缺失或损坏时仍保持 `done`，但当前可交付性必须同时满足 `delivery_integrity = healthy`。Run 失败、取消、中断或被 Reject 后，只有当 `resource_state = safe` 时 Task 才能回到 `ready` 并释放同 Task / 同 repository identity 的调度锁；旧 Run 永久保留。

#### Accepted Change Package 的 `delivery_integrity` 计算投影

`delivery_integrity` 是只针对 `decision = accept` 的当前读模型，不是新实体、业务状态、Event，也不是 Run、Task、ReviewDecision 或 Artifact 的可变字段。未 Review 或 Reject 时不生成该投影，不增加第四个枚举值。其计算顺序固定为：

1. `missing`：ReviewDecision 缺少 Package 引用；引用的 Artifact row 不存在；或 content-addressed 对象不存在 / 不可读取。
2. `corrupt`：row 与对象存在，但 Artifact 不是同一 Run 的 sealed `change_package`；ReviewDecision hash、Artifact row hash、实际 bytes hash 或 size 不一致；manifest / replay payload 无法解析或内部完整性不成立；或执行 replay 检查时无法重建记录的 `result_tree_hash`。
3. `healthy`：上述存在性、引用、bytes、manifest 与当前已执行的 replay 完整性检查全部通过。

投影在 Review Accept 提交前计算一次，且必须为 `healthy`；应用启动、打开 Task / History、以及 Delivery / replay 前重新计算。可以缓存 `checked_at` 和 `reason_codes` 供诊断，但缓存不是权威历史，具体持久化方式不在本轮冻结为生产 Schema。

accepted Package 后续变为 `missing` 或 `corrupt` 时，必须阻止 Delivery / replay，并显示 `Task done + delivery_integrity missing/corrupt`，不得继续表现为当前健康可交付；恢复完全相同、hash 匹配且可验证的 bytes 后，投影可以重新成为 `healthy`。任何重新计算都不得改写 ReviewDecision、Run `phase / state`、`run.terminal`、Task `done` 或 Artifact row / hash，也不得追加新的业务 Event。

`delivery_integrity` 只说明 accepted Change Package 当前是否可用，不代替 `resource_state`、drift gate、Verification 结果或 DoD 判断。

#### Resource reconciliation

- `resource_state` 与业务 `state` 正交。`safe` 至少表示：Runner-owned process containment boundary 已确认没有存活进程；stdout / stderr 已 drain 并停止写入；Workspace lease 已进入确定的 retained 或 released 状态；源仓库与已登记 Workspace 的 drift check 已完成。
- Workspace `retained` 可以继续保留目录；“资源安全”不等于自动删除 Workspace。
- 无法确认进程停止或 Workspace 不再被写入时，必须将 `interrupted` 与 `reconciliation_required` 一起提交，不得自动释放调度锁。
- 启动时或终态后可将资源状态推进为 `reconciling`、`safe` 或 `blocked`。只有可验证事实才能将其改为 `safe`；用户确认本身不能代替进程与 Workspace 检查。
- `run.terminal` 不要求是最后一个 Event。终态后仅允许追加 `resource.reconciliation.started`、`resource.reconciliation.succeeded`、`resource.reconciliation.blocked`；这些 Event 只能更新 `resource_state` 与调度锁，并必须与对应资源状态更新在同一数据库事务提交。
- 终态后的 reconciliation 不允许进入新业务阶段、改写终态、创建 ReviewDecision、启动 Agent / VerificationInvocation、追加 Agent 输出或创建新的运行 Artifact / Change Package。到达已封存 Run 的 late stdout / stderr 必须丢弃并记录为资源异常事实，不能改写 sealed Artifact。

#### Cancel 的唯一终态语义

1. `[Required]` Cancel 只对 `prepare`、`agent` 或 `test` 中的非终态 Run 开放；Review 阶段使用 Reject。
2. 第一个有效请求以条件更新把 Run 改为 `cancelling`，并追加 `cancel.requested`；重复请求幂等返回当前状态。
3. 一旦进入 `cancelling`，并发的正常退出不得把 Run 改写成 `completed` 或 `failed`。
4. Runner 必须终止其已证明纳入 process containment boundary 的根进程及全部相关后代、停止阶段推进并排空已读取输出。
5. 确认 containment boundary 内全部进程终止、输出 drain 完成且资源状态安全后，原子写入 `cancelled`、`safe` 和唯一 `run.terminal` Event。
6. 如果不能确认受控进程停止或 Workspace 安全，不得宣称 `cancelled`；原子写入 `interrupted`、`reconciliation_required` 和唯一 `run.terminal`，同时判定对应 Milestone 0 能力未通过。
7. 数据层必须保证每个 Run 最多一个终态 Event。

### 7.4 能力需求与验收

以下能力描述的是联合 Gate 后的候选 MVP。Project-native、Task-first、Task 聚合各自门槛未形成支持性决策前，不得据此冻结产品 UI、生产 Schema、API、导航或 Task 生命周期；若证据要求 `Modify / Remove`，必须先修订本节再进入 WWA。

| ID | 能力 | 标签 | Why / What | Acceptance |
|---|---|---|---|---|
| MVP-01 | Project | `[Required]` | 在 Project-native Evidence Gate 通过后提供最小项目上下文；只需创建、选择和查看名称、主要仓库与默认基准引用。 | 能从 Project 进入其 Task；不包含看板、成员、版本或完整生命周期管理。`[Assumption A1-P]` 尚未验证。 |
| MVP-02 | Task | `[Required]` | 在 Task-first 与 Task Aggregation Evidence Gate 通过后，保存目标、DoD 和 VerificationInvocation，作为 Run 的启动入口。 | 可创建、编辑、查看；Start Run 后冻结完整输入快照。`[Assumption A1-T/A2]` 尚未验证。 |
| MVP-03 | Run / 固定协调器 | `[Required]` | 可靠推进唯一黄金路径并持久化业务状态与正交资源状态。 | 支持本文固定阶段、状态、Change Package 内部 seal、唯一终态、resource reconciliation 和新 attempt；没有 WorkflowDefinition、NodeRun 或 Delivery Node。 |
| MVP-04 | 真实 Codex Adapter | `[Required]` | 复用真实本地 Coding Agent，而不是 mock 产品演示。 | 能传入 cwd / prompt、输出退出信息、Cancel；能力必须由 Milestone 0 证明。`[Assumption A5]` 尚未验证。 |
| MVP-05 | Windows Local Runner | `[Required]` | 拥有本地进程、流、stdin、process containment boundary 和资源 reconciliation。 | 能启动、观察并可靠结束已纳入 owned boundary 的进程；Web 页面关闭不直接终止存活进程；无法确认停止时进入 `interrupted / reconciliation_required`，且阻止同 Task / 同仓库新 Run。具体机制由 PoC 决定。 |
| MVP-06 | Workspace Provider | `[Required]` | 提供 trusted-local 的独立代码 working copy、基准 revision、Diff 和 drift detection。 | 每个 Run 独占一个 Workspace；记录规范化路径、源仓库与已登记 Workspace baseline / final 状态。它不是 Sandbox，不承诺宿主机文件、网络、凭据或进程隔离；异常 drift 阻止 Accept / Delivery。 |
| MVP-07 | Agent 输出流 | `[Required]` | 让用户知道正在发生什么，并为历史提供原始证据。 | stdout / stderr 按各自顺序持续展示并写入 Run-owned staging spool；producer 停止且 drain 完成后按 Artifact 协议 seal 为不可变 Agent Log，不等待进程退出才开始展示。 |
| EXP-01 | 运行中补充输入 | `[Experiment]` | 验证真实 Codex 接口能否在 Run 中继续交互。 | 只有 Adapter 明确支持时开放；保存输入 Event；不支持时显示 unavailable，用户可 Cancel 后创建新 Run。 |
| EXP-02 | 原生 Session 映射 | `[Experiment]` | 保留 Runtime 已有身份，不自行发明 Session。 | 仅 Codex 返回稳定 Session ID 时创建 Session；不实现 Resume。 |
| MVP-08 | Cancel | `[Required]` | 用户必须能停止失控或不再需要的执行。 | 满足 7.3 的 owned process boundary、幂等、竞态、drain、唯一业务终态和 resource reconciliation 规则。 |
| MVP-09 | Diff / Drift | `[Required]` | 让用户看见实际代码变化，并检测已登记代码位置的非预期变化。 | seal 统一 Diff 和文件清单，覆盖修改、删除和未跟踪文件；对源仓库与已登记 Workspace 做 drift detection。检测是发现而非安全预防，异常时禁止 Accept / Delivery。 |
| MVP-10 | Single VerificationInvocation | `[Required]` | 为人工 Review 提供一次可重复的验证调用。 | 按 7.7 的冻结合同在同一 Workspace 执行一次 invocation，保存完整结构化结果；结果只提供证据，不证明 DoD，也不扩展为 CI、多 Test Step 或 Script Workflow。 |
| MVP-11 | Human Review Gate | `[Required]` | Agent 完成不自动等于用户接受；决定必须绑定不可变交付物。 | Required Artifact 齐备后允许一次 Accept / Reject；ReviewDecision 必须引用同一 Run 的 Change Package ID / hash。未解决 drift 只阻止 Accept / Delivery，不阻止 Reject；决定不可变，重做创建新 Run。 |
| MVP-12 | Event | `[Required]` | 保存可解释的执行事实、终态和资源对账事实。 | Append-only；`(run_id, sequence)` 唯一；至少覆盖 Run、阶段、Workspace、drift、Agent、Cancel、Verification、Change Package、Review、Artifact、终态和 reconciliation。终态后只允许 resource reconciliation Event 白名单。 |
| MVP-13 | Artifact / Change Package | `[Required]` | 让日志、Diff、Verification 与已接受变更在重开应用或 Workspace 消失后仍可查看和重放。 | 至少 seal `agent_log`、`diff`、`verification_result`、`change_package`；记录类型、content-addressed 位置、哈希、大小、来源和 `sealed_at`。每个进入 Review 的 Run 恰好一个 replayable Change Package。 |
| MVP-14 | 历史查看 | `[Required]` | 支持“稍后回来”的 Core Job。 | 从 Task 可查看全部 Run、业务终态、resource state、关键 Event、sealed Artifact、Change Package、ReviewDecision 和 accepted Package 当前 `delivery_integrity`；不建设完整 Timeline 产品。 |

### 7.5 最小 UX

`[Required]` 只需要以下表面：

1. Project 选择 / 创建；
2. Task List、Task 创建 / 编辑、Task Detail，以及 VerificationInvocation 输入；
3. Run Detail：当前阶段、resource state、Agent 输出、Cancel、可用时的补充输入，并明确显示 trusted-local / 非 Sandbox 边界；
4. 结果区：最终 Diff、Verification 结果、sealed Change Package、Accept / Reject，以及 Accept 后的当前 `delivery_integrity`；drift、Package 完整性或资源安全门槛未通过时显示原因并禁用 Accept，`delivery_integrity` 为 `missing / corrupt` 时禁用 Delivery / replay；
5. Task 下的 Run History。

`[Deferred]` Kanban、Jira 式 Project Manager、Workflow Canvas 和专门的完整 Event Timeline。

### 7.6 Domain Model

```text
Project 1 ── * Task
Task    1 ── * Run
Run     0..1 ── Workspace
Run     1 ── * Event
Run     0 ── * Artifact
Run     0 ── 1 Session
Run     0 ── 1 ReviewDecision
ReviewDecision 1 ── 1 Artifact(type = change_package)
```

| 对象 | 首版最小字段与约束 |
|---|---|
| Project | `id`, `name`, `default_repository_path`, `default_base_ref`, `created_at`, `updated_at`。`[Assumption]` 一个 Project 对应一个主要仓库，尚未验证。 |
| Task | `id`, `project_id`, `title`, `objective`, `definition_of_done`, `repository_path`, `base_ref`, `verification_invocation`, `status`, timestamps。仓库与基准可从 Project 默认值带入，但必须在 Start Run 前明确。`[Assumption A1-T/A2]` Task-first 与 Task 聚合尚未验证。 |
| Run | `id`, `task_id`, `attempt_no`, `repository_identity`, `runtime_kind`, `phase`, `state`, `resource_state`, `resource_reconciled_at`, `resource_reason_code`, `input_snapshot`, `started_at`, `ended_at`, `terminal_reason_code`。同一 Task 的 `attempt_no` 唯一；业务终态与资源安全状态正交。 |
| Session | `id`, `run_id`, `runtime_kind`, `native_session_id`, timestamps。`[Experiment]` 仅 Runtime 原生提供稳定 ID 时创建；不支持 Resume。 |
| Workspace | `id`, `run_id`, `provider_kind`, `canonical_path`, `source_repository_path`, `base_revision`, `state`, `drift_baseline`, `drift_result`, timestamps。Prepare 失败时可不存在；进入 Agent 前必须恰好一个，且一个 Run 最多一个。`state` 区分 active、retained、released 或 reconciliation-blocked；retained 不表示仍有进程写入。 |
| Event | `id`, `run_id`, `sequence`, `type`, `phase`, `source`, `payload`, `occurred_at`。Append-only，`(run_id, sequence)` 唯一。 |
| Artifact | `id`, `run_id`, `type`, `content_location`, `media_type`, `sha256`, `size`, `metadata`, `created_at`, `sealed_at`。持久化 row 只表示已 sealed、不可变的 content-addressed 对象；内容必须位于稳定本地存储，不只引用临时 Workspace。`type` 至少包括 `agent_log \| diff \| verification_result \| change_package`。 |
| ReviewDecision | `id`, `run_id`, `decision`, `change_package_artifact_id`, `change_package_sha256`, `note`, `decided_by`, `decided_at`。每个 Run 最多一条，`decision = accept \| reject`；两个 Package 引用字段必填，且必须指向同一 Run 的可读、hash 匹配 `change_package` Artifact。 |

`[Assumption A2]` 这些关系是为 Walking Skeleton 采用的可逆模型，不是已验证的最终领域模型。Schema 扩散前，必须用真实实例走查失败重试、取消再跑、无 Task 探索、跨仓库变更和 Workspace 丢失；若多个代表性实例无法自然表达，应先改变聚合而不是增加大量例外字段。

`delivery_integrity` 故意不进入上述实体字段表：它由 immutable ReviewDecision、Artifact row 与当前对象 bytes 计算，可随外部丢失 / 恢复而变化；本 PRD 只定义其逻辑合同，不冻结缓存或生产 Schema。

### 7.7 Event 与 Artifact 规则

#### Execution Trust Contract 与 drift detection

- `[Required]` Agent 与 VerificationInvocation 采用 `trusted-local execution`，继承当前用户的宿主机权限、可用登录态和按合同冻结的环境策略。
- `[Required]` Workspace 只提供代码 working-copy isolation 与独立 Diff，不是 Sandbox；系统不承诺限制 Agent 或子进程访问宿主机文件、网络、凭据或其他进程。
- `[Required]` Prepare 时记录源仓库及系统已登记 Workspace 的 drift baseline；Agent / Verification 完成后、Change Package seal 前和 Review Accept 前重新检测。
- `[Required]` Drift detection 是定向发现机制，不是写入预防，也不能证明未登记的宿主位置没有变化。发现异常时保留证据并允许 Reject，但禁止 Accept、Accepted Delivery 和 Task `done`。

#### Artifact 最小提交协议

持久化的 Artifact row 只代表已经 sealed 的不可变对象。运行中的 stdout / stderr 和中间 Diff 先写入 Run-owned staging，不提前作为最终 Artifact 暴露。

每个 Artifact 必须按以下顺序提交：

```text
run-scoped temp / staging write
→ producer 停止并完成 drain
→ flush、关闭 handle
→ 计算 size 和 sha256
→ 同卷 atomic finalize 到由 sha256 派生的稳定路径
→ 单个数据库事务写 Artifact row、artifact.created Event，
  并在适用时推进 phase / state
```

提交不变量：

- `content_location` 指向 content-addressed 最终对象；Artifact row 插入后不可变，并记录 `sealed_at`。
- `artifact.created` 只表示 sealed 对象，payload 至少包含 Artifact ID、type、size 和 sha256。
- Required Artifact 的 row / Event 不得晚于依赖它的 phase / state；阶段不能先于证据提交。
- 最终对象已存在时，只有 size 与 hash 一致才允许幂等复用；禁止覆盖不一致对象。
- finalize 前崩溃只允许留下 temp 且数据库不推进；finalize 后、数据库事务前崩溃只允许留下 orphan content-addressed object 且数据库不推进；数据库事务后，row、Event 与 phase / state 必须一致可见。
- 关系数据库事务不被描述为覆盖文件系统；上述顺序与启动 reconciliation 共同提供最小一致性。

#### Change Package Artifact

- `[Required]` 每个进入 Review 的 Run 恰好有一个 `type = change_package` 的 sealed、content-addressed、replayable Artifact；它是现有 Artifact 类型，不是新的领域聚合、业务阶段或 Workflow Node。
- Change Package 的 hash 覆盖 manifest 与 replay payload。manifest 至少绑定：`base_revision`、replay format / version、修改 / 删除 / 未跟踪文件的完整可重放内容、`result_tree_hash`、最终 Diff Artifact ID / hash、Verification Result Artifact ID / hash。
- `replayable` 表示：删除原 Workspace 后，只使用 Change Package 与 `base_revision` 的 clean checkout，可以确定性重建相同的 `result_tree_hash`；不得依赖临时 Workspace。
- Change Package 在 `test` 阶段内部最后 seal。Review 开始后不得替换或重新封存；内容发生变化必须创建新 Run。
- ReviewDecision 的 `change_package_artifact_id` 与 `change_package_sha256` 必须指向同一 Run、同一 sealed Package，并与实际 bytes 匹配；Accept 与 Reject 都审核该不可变对象。

#### 启动时 Artifact / Run reconciliation

应用启动、调度新 Run 和开放 Review 前，必须执行以下最小 reconciliation：

1. 校验所有 Artifact row 对应对象的路径、size 和 sha256。
2. 将无 row 的 temp 或 finalized object 视为 orphan；不得据此推断阶段成功或自动暴露为证据。可以保留供幂等恢复，自动清理继续 Deferred。
3. 校验 `review / waiting_review` 的 Run 是否同时具有有效 Agent Log、最终 Diff、Verification Result 和唯一 Change Package。
4. 校验 ReviewDecision 引用的 Package ID / hash 是否与 Artifact row 及实际 bytes 一致；对 Accept 后的 Task 重新计算 accepted Package 的 `delivery_integrity`。
5. 缺失、不可读或 hash mismatch 时，禁止进入 Review、Review Accept 和 Delivery；不得悄悄替换 Artifact、改写 ReviewDecision 或伪造成功。
6. 非终态 Run 的 staging 恢复或失败收敛必须发生在写业务终态前；无法确定时进入 `interrupted / reconciliation_required`，并与资源 reconciliation 联动。
7. 已终态 Run 只允许追加 resource reconciliation Event，不允许新业务阶段、Agent 输出或新运行 Artifact。若 accepted Package 后续缺失或损坏，保留原 ReviewDecision、Run 终态和 Task `done`，将独立计算投影更新为 `delivery_integrity = missing` 或 `corrupt`，阻止 Delivery / replay，并显示完整性原因；界面不得把该组合表现为当前健康可交付。这不增加新的业务状态或 Event。

#### Single VerificationInvocation contract

`test_command` 不再作为裸字符串存在。Task 保存一个、Run 在 Start 时冻结一个完整的 VerificationInvocation：

```text
VerificationInvocation
  execution:
    argv mode  = interpreter + argv[]
    或
    shell mode = explicit shell + command
  cwd: assigned Workspace canonical path
  env: frozen inheritance policy + explicit overrides
  timeout_ms: finite timeout
  cancel: LocalRunner process-containment cancel semantics
  output: separately ordered stdout / stderr capture
  result: status + exit_code / null + termination_reason
```

合同规则：

- argv mode 与 shell mode 互斥；argv mode 不隐式经过 shell。
- cwd 固定为分配的 Workspace canonical path，执行时不可覆盖；环境继承策略与 overrides 在 Start Run 时冻结。
- 每个 Run 只执行一次 VerificationInvocation。它可以调用仓库已有的聚合脚本，但不扩展为多步骤 Workflow、CI 或多个 Test Node。
- 正常结束时，`exit_code = 0` 映射为 `passed`，非零映射为 `failed`；启动失败、输出捕获故障或已确认停止后的 timeout 映射为 `error`。
- timeout 或用户 Cancel 必须复用 LocalRunner 的 owned process boundary 语义。若不能确认进程停止，Run 进入 `interrupted / reconciliation_required`，不得进入 Review。
- `passed / failed / error` 在 Result、Diff、Agent Log 和 Change Package 成功 seal 且资源安全时都进入 Human Review。
- VerificationInvocation 只提供可重复证据；`passed` 不表示全部 Definition of Done 已满足。

#### Event 规则

- `[Required]` 生命周期或资源状态更新与对应 Event 在同一数据库事务内提交。
- `[Required]` Event 保存阶段、控制和资源里程碑，不建设逐输出块的完整 Timeline 产品。断线重连从最后一个 Event sequence 恢复关键状态，并从当前 staging 或 sealed Agent Log 继续读取允许展示的内容。
- `[Required]` `run.terminal` 每个 Run 最多一次，但不要求是最后一条 Event。终态后只允许 `resource.reconciliation.started`、`resource.reconciliation.succeeded`、`resource.reconciliation.blocked`；禁止新业务阶段、ReviewDecision、Agent / Verification 执行、Agent 输出和 Artifact。
- `[Required]` MVP 默认不自动删除已结束 Run 的 Workspace；已接受交付物不能依赖 Workspace 保留。自动清理和保留策略 `[Deferred]`。
- `[Deferred]` Completion Receipt 聚合、证据评分、全文检索、知识提炼和 Event Sourcing。

建议的最小里程碑 Event：

```text
run.created
phase.entered
workspace.prepared
agent.started
agent.input_submitted        # 仅能力可用时
agent.exited
cancel.requested
test.started
test.completed
workspace.drift_detected     # 仅发现异常时
change_package.sealed
review.requested
review.decided
artifact.created
run.terminal                # 每个 Run 最多一次
resource.reconciliation.started    # 允许在 run.terminal 后追加
resource.reconciliation.succeeded  # 允许在 run.terminal 后追加
resource.reconciliation.blocked    # 允许在 run.terminal 后追加
```

### 7.8 技术边界

以下是实现边界，不是不可更改的技术栈承诺：

- `[Required]` `FixedRunCoordinator` 只理解五个固定阶段和本文终态，不解释 YAML / DAG。
- `[Required]` `CodexAdapter` 暴露能力清单，并负责 cwd、prompt、输出帧、退出信息、可选 input 和 cancel 的 Runtime 映射。
- `[Required]` `LocalRunner` 负责 Windows 进程启动、流、stdin、Runner-owned process containment boundary、Cancel、drain、终态竞态和 resource reconciliation；具体机制由 Milestone 0 决定。
- `[Required]` `WorkspaceProvider` 负责 trusted-local working-copy prepare、规范化路径、基准 revision、diff 和已登记位置的 drift detection；具体采用 Worktree 或其他策略由 Milestone 0 决定。它不提供 Sandbox。
- `[Required]` 关系数据库保存当前状态与 Append-only Event；本地 Artifact Store 按 7.7 的最小提交协议保存 sealed Agent Log、Diff、Verification Result 和 Change Package。
- `[Experiment]` REST + SSE 可作为最简单的命令 / 输出传输默认；若补充输入需要双向连接，再由 PoC 决定是否增加 WebSocket。
- `[Assumption]` TypeScript / Node 可以可靠建立并控制目标 Windows process containment boundary，尚未验证；若失败可引入最小 Windows 原生辅助程序，而不是扩建通用 Runner 平台。
- `[Deferred]` 独立 Remote Runner、Runner 集群、Docker / Kubernetes Sandbox 和分布式 Worker。

### 7.9 Validation Prototype / Concierge Validation

Validation Prototype / Concierge Validation 是 `[Experiment]` 产品证据阶段，不是新的产品 Release，也不向 MVP 增加能力。它与 Milestone 0 并行执行，但不得提前冻结产品化 Project / Task UI、生产 Schema、API、导航或 Task 生命周期。

#### 验证活动

1. 使用低保真材料、现有 CLI、表单和人工编排比较：
   - A = 直接 CLI；
   - B = CLI-first + 自动 Project / Run 归档；
   - C = Task-first + 与 B 相同的归档。
   该比较不建设三套产品入口。
2. 使用 9 个最近真实工作实例和至少 6 条状态轨迹走查候选领域关系；验证材料可以使用临时或中性结构，不预先冻结 Task 中心生产模型。
3. 以 3 名候选第一用户、共 5 个真实代码任务执行礼宾验证，记录恢复上下文、Cancel、证据查看和 Review 中实际使用的控制面机制。
4. 记录复用是否无提醒、非预分配，并区分控制面的具体收益与 Codex 本身完成代码修改的收益。

#### 三个独立证据门槛

| 门槛 | 独立问题 | 所需证据 | 未通过时的决策 |
|---|---|---|---|
| Project-native Evidence Gate | B 相对 A 是否具有可由真实行为指出的独立收益？ | A/B 观察记录、任务事实、参与者归因和独立 Decision Record。 | B 不优于 A 时，不产品化当前 Project-native 边界；先按证据修订 PRD。 |
| Task-first Evidence Gate | 在 B 已提供相同归档能力后，C 是否仍有额外净收益？ | B/C 观察记录、用户主动选择及独立 Decision Record；不得复用 Project-native 的结果代替。 | 受益用户未主动选择 C 时，不采用强制 Task-first 入口；先按证据修订 PRD。 |
| Task Aggregation Evidence Gate | Task 是否能稳定聚合目标、DoD、多次 Run、Workspace、Event、Artifact 和最终决定？ | 9 个真实实例、至少 6 条状态轨迹、异常归属记录及独立 Decision Record。 | 两个以上代表性实例依赖巨型 Task、特殊外键或模糊归属时，不冻结 Task 中心生产模型。 |

三个门槛必须分别形成 `Keep | Modify | Remove` 决策，不得由同一个结论相互替代。任一结论为 `Modify` 或 `Remove` 时，必须先修订受影响的 PRD 边界并重新评审；不能通过增加 MVP 功能绕过反证。

#### Product Validation Gate

Product Validation Gate 只有在以下条件全部满足时才通过：

1. Project-native、Task-first、Task 聚合三个门槛分别形成证据和独立 Decision Record；
2. 任一 `Modify / Remove` 决策已经反映到 PRD，并重新评审受影响边界；
3. 礼宾验证能够指出实际使用的控制面价值，而不只是 Codex 本身完成了代码修改；
4. 至少两个独立用户在无提醒、非预分配下自发复用，且能指出控制面带来的具体收益。

一次合格的自发复用只允许继续小规模验证。两个独立用户的合格复用只允许进入有限产品化投资，不代表市场验证完成；该阈值本身也尚未验证为充分。

#### 证据产物与责任

产品决策负责人负责形成：

- A/B/C 对照观察记录；
- 9 个实例与至少 6 条状态轨迹的领域模型走查记录；
- 3 名用户 / 5 个真实任务的礼宾验证记录；
- 自发复用与控制面具体收益记录；
- Project-native、Task-first、Task 聚合各自独立的 Decision Record；
- Product Validation Gate 的最终 Decision Record。

以上均为计划中的验证活动，当前尚未验证。

### 7.10 Milestone 0 — Execution Feasibility

Milestone 0 是 `[Experiment]` 技术 Spike，不是产品 UI 里程碑。它与 7.9 的 Validation Prototype / Concierge Validation 并行，负责形成 Technical Gate 证据。

#### Part A：mock CLI

构造一个可控进程，依次验证：

1. 指定并回显准确 cwd，包括空格和中文路径；
2. stdout / stderr 持续流，以及各流内部顺序和单调 sequence；
3. stdin 输入与可观察确认；
4. 根进程创建 child / grandchild，并记录其是否进入 Runner-owned process containment boundary；
5. 正常退出、非零退出和挂起；
6. 执行中 Cancel、重复 Cancel、退出与 Cancel 竞态；
7. owned boundary 内进程终止、输出 drain、唯一业务终态与 late-write 停止；
8. Cancel 后不出现 Test 或 Review 阶段事件；
9. Runner 崩溃或失去进程事实时形成 `interrupted / reconciliation_required`，并在 reconciliation 前拒绝同 Task / 同 repository identity 的新 Run；
10. `run.terminal` 后只允许 resource reconciliation Event，不能追加业务阶段、Agent 输出或运行 Artifact。

#### Part B：real Codex

在一次性 Git 仓库和 trusted-local working-copy Workspace 中依次验证：

1. 在明确展示 trusted-local / 非 Sandbox 边界后，复用现有登录态，以明确 cwd 启动 Codex；
2. 传入可识别的目标 / DoD prompt；
3. 获取原始输出和可靠退出信息；
4. `[Experiment]` 验证补充输入；不支持时明确记录 capability unavailable；
5. `[Experiment]` Runtime 原生提供 Session ID 时建立 Run / Session 映射；不存在时不伪造；
6. Cancel 并确认全部相关进程已纳入 Runner-owned process containment boundary 且停止；
7. 在 Workspace 中产生、保存并显示 Diff；
8. 对源仓库及已登记 Workspace 记录 drift baseline / final 状态；用受控 marker 证明 cwd 不是 containment，并验证异常 drift 能被发现且阻止 Accept / Delivery；
9. 明确记录 Workspace 只提供 working-copy isolation，不能据此宣称宿主机文件、网络、凭据或进程隔离；
10. 保存原始 I/O、退出信息、失败信息和 Adapter capability matrix。

#### Part C：Verification、Delivery 与 Durability

在最小本地原型中依次验证：

1. VerificationInvocation 的 argv mode、显式 shell mode、固定 cwd、冻结 env、正常 / 非零退出、timeout、Cancel、stdout / stderr 和 exit mapping；
2. 对 Artifact 的 temp、flush / close、hash、atomic finalize、DB row / Event / phase 提交边界逐点注入崩溃，并在重启后 reconciliation；
3. 在 `test` 阶段内部 seal Agent Log、最终 Diff、Verification Result 和唯一 Change Package，不增加 Delivery Node；
4. ReviewDecision 引用 Change Package ID / hash；Package 或 drift gate 异常时 Accept 不可用；
5. Accept 后删除原 Workspace，只用 Package 和 `base_revision` 的 clean checkout 重建相同 `result_tree_hash`，并重跑同一 VerificationInvocation；
6. 启动 reconciliation 能发现 temp、orphan、dangling row、缺失对象和 hash mismatch，且不会把不完整证据推进到 Review 或 terminal success。

#### Milestone 0 通过门槛

- `[Required]` cwd、streaming、退出信息、Runner-owned process containment boundary Cancel、唯一业务终态、resource reconciliation、Workspace Diff / drift detection、VerificationInvocation、Change Package replay 和 Artifact recovery 均能稳定闭合。
- `[Required]` 不依赖解析易变的人类终端文案来判断终态或伪造结构化能力。
- `[Required]` 真实 Codex 任一相关进程无法纳入并验证 owned boundary，出现 survivor / late write / 错误终态，Change Package 无法重放，或 Artifact reconciliation 允许缺失 / 可变 / hash mismatch 证据进入 Review，Technical Gate 即不通过。
- `[Required]` 任一关键项失败时，先替换 Codex 控制接口、Runner 实现、Workspace 策略或最小持久化协议；不以新增 Deferred 能力掩盖失败。
- `[Required]` Technical Gate 未通过前，不进入产品 MVP WWA，不扩建 Project UI、Workflow、Session Resume 或治理产品能力。

### 7.11 Assumption Register

| ID | Load-bearing Assumption | 当前状态 | 本轮验证 | 为假时的默认动作 |
|---|---|---|---|---|
| A1-P | `[Assumption A1 — Project-native]` CLI-first 自动 Project / Run 归档相对直接 CLI 有独立价值。 | 低信心；尚未验证。 | 比较 B 对 A；单独记录行为、归因和 `Keep \| Modify \| Remove` Decision Record。 | B 不优于 A 时，不产品化当前 Project-native 边界；先修订 PRD。 |
| A1-T | `[Assumption A1 — Task-first]` Task-first 相对具有相同归档能力的 CLI-first 仍有额外净收益。 | 低信心；尚未验证。 | 比较 C 对 B；不得用 B 对 A 的结果代替，并单独形成 Decision Record。 | 受益用户未主动选择 C 时，不采用强制 Task-first 入口；先修订 PRD。 |
| A2 | `[Assumption]` Task 是正确的中心领域对象。 | 低信心；尚未验证。 | 用 9 个最近真实实例和至少 6 条状态轨迹走查 Task、Run、Session、Workspace、Event、Artifact；与 A1-P、A1-T 分别形成 Decision Record。 | 两个以上代表性实例依赖巨型 Task、特殊外键或模糊归属时，不冻结 Task 中心生产模型；先修订 PRD。 |
| A3 | `[Assumption]` 单 Agent 代码问题修复足以验证控制面的独立、可重复价值。 | 低信心；尚未验证。 | 3 名候选第一用户、共 5 个真实问题；记录实际使用的控制能力、自发复用及其具体收益。 | 一次合格复用只允许继续小规模验证；少于两个独立用户自发复用并指出控制面具体收益时，不进入有限产品化投资。 |
| A4 | `[Assumption]` Workflow 需要成为第一版一等、可配置能力，固定流程不足。 | 低信心；尚未验证。本 PRD 暂用相反的最小默认：固定 FSM。 | 记录真实任务是否改序、跳过阶段、复用或要求第二条流程；没有行为证据时不做 WorkflowDefinition。 | 固定 FSM 保持内部实现；YAML / DAG、通用节点和 Workflow UI 继续 Deferred。 |
| A5 | `[Assumption]` Codex Adapter + Windows Local Runner + Workspace Provider 能可靠闭合执行链路。 | 低信心；尚未通过 PoC。 | 执行 7.10 的 mock CLI、real Codex、Change Package replay 与 Artifact recovery Spike。 | 更换 Runtime 控制接口、引入最小原生进程辅助、更换 Workspace 策略或修正最小持久化协议；必要时收缩能力承诺。 |

### 7.12 Deferred Capability List

以下能力均为 `[Deferred]`，不得因数据模型预留或 UI 占位而回流 MVP：

- `[Deferred]` 通用 Workflow Definition；
- `[Deferred]` YAML / DAG Workflow Runtime；
- `[Deferred]` Workflow Canvas；
- `[Deferred]` 完整 Kanban / Jira 式 Project Manager；
- `[Deferred]` 多 Agent；
- `[Deferred]` Agent Router；
- `[Deferred]` Claude / Hermes / OpenCode 多 Runtime；
- `[Deferred]` 独立 Remote Runner；
- `[Deferred]` Session Resume；
- `[Deferred]` 自动 Commit、Merge Back、Push、发布与冲突解决；
- `[Deferred]` 分布式 Worker；
- `[Deferred]` Docker / Kubernetes Sandbox；
- `[Deferred]` 通用 Approval Engine；
- `[Deferred]` 完整 Event Timeline 产品；
- `[Deferred]` Completion Receipt 平台；
- `[Deferred]` Memory Plane；
- `[Deferred]` Collaboration Plane；
- `[Deferred]` Jira / GitLab / n8n 集成；
- `[Deferred]` 通用重试引擎和完整 CI Pipeline。

## 8. Release

发布日期不在本 PRD 中承诺。顺序由证据门槛决定，而不是由日历决定；在团队容量和 PoC 结果未知时，工期尚未验证。

阶段关系如下：

```text
Validation Prototype / Concierge Validation ─→ Product Validation Gate ─┐
                                                                         ├─ Product + Technical Gate
Milestone 0 — Execution Feasibility ─────────→ Technical Gate ──────────┘
                                                                                 ↓
                                                                  产品 MVP WWA → 实施计划 → MVP
```

`Product + Technical Gate` 是合取门槛：Product Validation Gate 与 Technical Gate 必须同时通过。任一单独通过都不授权产品 MVP WWA、实施计划或生产 Schema/API 冻结。

| 阶段 | 标签 | 范围 | 退出门槛 |
|---|---|---|---|
| Validation Prototype / Concierge Validation | `[Experiment]` | A/B/C 低保真对照、9 个实例与至少 6 条状态轨迹、3 名用户 / 5 个真实任务的礼宾验证。使用现有 CLI、表单和人工编排；不建设产品化 Project / Task UI 或生产 Schema。 | 7.9 的三个独立门槛分别形成 Decision Record；A3 与 KR-08 达到 Product Validation Gate 要求，或按反证先修订 PRD。 |
| Milestone 0 — Execution Feasibility | `[Experiment]` | 7.10 的 mock CLI、真实 Codex、trusted-local Workspace / drift、VerificationInvocation、Change Package replay、Artifact durability 和 resource reconciliation。只允许诊断界面或测试 Harness。 | 7.10 的关键能力全部通过，形成 capability matrix 与 Technical Gate Decision Record；否则产品 MVP WWA No-Go。 |
| Product + Technical Gate | `[Required]` | 决策检查点，不实现产品能力。 | Product Validation Gate 与 Technical Gate 同时通过，且任何 `Modify / Remove` 决策已经反映到 PRD；否则产品 MVP WWA 和实施计划 No-Go。 |
| MVP — Single Golden Path | `[Required]` | 只实现联合 Gate 后确认的一个第一用户、一个真实 Codex Adapter、Windows trusted-local 执行、一种 working-copy Workspace 策略、Project / Task / Run、固定 FSM、输出、Cancel、Diff、一个 VerificationInvocation、sealed Change Package、一个 Review Gate、Event、Artifact 和历史。 | **进入条件：** Product + Technical Gate 已通过。**构建完成：** 门控后 PRD 的 KR-02 至 KR-07 和全部 Required 能力通过。构建完成或有限产品化投资均不得称为市场验证完成。 |
| Post-MVP — Generalization | `[Deferred]` | 只有行为证据出现后才考虑第二 Runtime、可配置 Workflow、Session Resume、更多 Workspace Provider、重试、更丰富 Evidence / Timeline 或技术负责人场景。 | 必须有第二条真实流程、第二 Runtime、恢复需求或更多治理证据；不能只因架构愿景进入。 |
| Future — Full Agentic Work OS | `[Deferred]` | 完整 Project / Workflow / Agent 平面，多 Agent / Router，Remote / Distributed Runner，容器化 Sandbox，Memory / Collaboration Plane，通用治理和外部系统集成。 | 不在本 PRD 决策范围。 |

### 8.1 Product Validation Gate

Product Validation Gate 的候选通过条件以 7.9 为准，并必须同时满足：

1. Project-native、Task-first、Task 聚合三个门槛分别获得证据和独立 Decision Record；
2. 任一 `Modify / Remove` 结论已经反映到 PRD，并重新评审受影响边界；
3. 礼宾任务能指出实际使用的控制面价值，而不只是 Codex 完成代码修改；
4. 至少两个独立用户无提醒、非预分配地自发复用，并能指出控制面的具体收益。

一次合格复用只允许继续小规模验证。满足第 4 条只允许有限产品化投资；该门槛尚未验证为充分，且不得表述为市场验证完成。

### 8.2 Technical Gate

Technical Gate 只有在 7.10 的预定义技术证据全部通过时成立，至少包括：

- 真实 Codex 的 cwd、streaming、退出和诚实 capability matrix；
- Runner-owned process containment boundary、Cancel、drain、唯一业务终态与 resource reconciliation；
- trusted-local working-copy Workspace、源仓库 / 已登记 Workspace drift detection，以及异常时阻止 Accept / Delivery；
- 完整 VerificationInvocation contract；
- sealed Change Package 在原 Workspace 删除后的确定性 replay；
- Artifact 最小提交协议、故障注入和启动 reconciliation。

任一 survivor、late write、错误终态、无法归属的真实进程、不可重放 Package，或以缺失、可变、不可读、hash 不匹配的 Required Artifact **首次推进**到 Review / terminal success，均使 Technical Gate 不通过。合法 Accept 后才发生的 Package 缺失 / 损坏必须保留历史 terminal；若 reconciliation 未将其投影为 `delivery_integrity = missing / corrupt`、仍显示 healthy 或仍允许 Delivery / replay，同样使 Technical Gate 不通过。所有技术结果当前尚未验证。

### 8.3 Go / No-Go Gate

- **当前 GO：** Validation Prototype / Concierge Validation、Milestone 0，以及其中明确列出的最小诊断 / 可靠性 Spike。
- **当前 NO-GO：** 产品 MVP WWA、完整实施计划、Project / Task 产品化 UI、Task 中心生产 Schema/API 冻结。
- **转为 GO：** Product Validation Gate 与 Technical Gate 同时通过，并形成 Product + Technical Gate Decision Record；任一 Gate 单独通过均不授权进入 WWA。

### 8.4 Release 纪律

- Validation Prototype / Concierge Validation 与 Milestone 0 可以立即并行开始；产品 MVP WWA 和实施计划必须等待 Product + Technical Gate。
- 一次自发复用只允许继续小规模验证；至少两个独立用户自发复用并指出控制面具体收益，才允许有限产品化投资。
- Product Validation Gate 通过、Technical Gate 通过、有限产品化投资和 MVP 构建完成均不得表述为市场验证完成。
- Post-MVP 与 Future 不是承诺清单，只是用于防止愿景回流 MVP 的边界。
- 任何新增能力必须回答：没有它，当前真实代码修复黄金路径是否无法闭环或无法验证关键假设？如果答案是否定的，则保持 Deferred。

## Open Decisions Before Implementation

以下八项会改变 MVP 入口、核心 Schema 或执行安全；其余问题采用本文中的最简单、可逆默认方案。所有条目均尚未验证。

1. **Codex 控制接口：** Milestone 0 证明可用的是结构化 CLI、App Server、PTY 还是其他接口？必须明确真实的 streaming、input、Session 和 cancel 能力，不能靠易变文案伪装。
2. **Windows Runner 控制边界：** Node / TypeScript 是否能可靠建立并取消 Runner-owned process containment boundary？若页面、Server、Runner 或 Codex 断开，哪些情况仍可控制，哪些必须记为 `interrupted / reconciliation_required`？默认先使用最小本地 Runner 模块，只有 PoC 证明必要时才拆独立 Daemon 或引入原生辅助。
3. **Workspace 策略：** Git Worktree、临时 clone 或其他最小 Provider 中，哪一种能在代表性真实仓库上提供 working-copy isolation、Diff、drift detection 和取消后的资源对账？这不改变 trusted-local / 非 Sandbox 的承诺。
4. **Change Package 编码：** 哪一种最小 manifest + payload 格式能覆盖修改、删除和未跟踪文件，并在删除原 Workspace 后从 `base_revision` 重建相同 `result_tree_hash`？格式选择不得引入自动 Merge、Push 或发布。
5. **Project-native：** A1-P 的 A/B 对照后，Project-native 归档是否有独立价值，还是应收缩为 Session / Run companion？必须形成独立 Decision Record。
6. **Task-first：** 在 Project-native 结果之外，A1-T 的 B/C 对照是否支持强制 Task-first 入口，还是应使用 CLI-first 自动关联？不得用 A1-P 的结果替代。
7. **中心聚合：** A2 的真实实例走查后，中心对象继续使用 Task，还是在生产 Schema / API 扩散前改为 WorkItem、ExecutionRequest、ChangeSet 或 Run-first？必须形成独立 Decision Record。
8. **首场景：** A3 的礼宾验证后，是否继续单 Agent 代码修复黄金场景，还是从同一用户群已经发生的相邻任务中重新收窄？不得通过增加功能掩盖失败。

## Red Team Revision Summary

以下只记录本轮接受并写入 PRD 的修订，不表示任何用户、产品或技术假设已经验证：

1. 增加与 Milestone 0 并行的 Validation Prototype / Concierge Validation，并让两条证据线汇入 Product + Technical Gate。
2. 将 Project-native、Task-first 和 Task 聚合拆成三个独立 Evidence Gate、Assumption ID 与 Decision Record。
3. 将 sealed、content-addressed、replayable Change Package 定义为现有 Artifact 类型，用于闭合 Accepted Change Delivery。
4. 要求每个 ReviewDecision 引用被审核 Change Package 的 Artifact ID 与 sha256，且引用、row 与实际 bytes 必须一致。
5. 将 Task `done` 明确定义为“Accept 当时被引用的可重放交付物已通过完整性门槛”，不表示已经 commit、merge、push 或发布；之后的当前可交付性由独立 `delivery_integrity` 投影表示。
6. 保留固定 `prepare → agent → test → review → complete` FSM；Change Package seal 是 `test → review` 的内部屏障，不增加通用 Workflow、Delivery 阶段或 Delivery Node。
7. 将 Workspace 承诺修订为 trusted-local working-copy isolation；明确 Workspace 不是 Sandbox，也不承诺宿主机文件、网络、凭据或进程隔离。
8. 增加源仓库与已登记 Workspace 的 drift baseline / detection；存在异常时禁止 Review Accept、Accepted Delivery 和 Task `done`。
9. 将业务 `interrupted` 与正交的 resource reconciliation 分离；资源未确认安全前，禁止同 Task / 同 repository identity 启动新 Run。
10. 允许 Run 终态后追加 resource reconciliation Event 白名单，同时禁止新业务阶段、Agent 输出、Verification 执行、ReviewDecision 和运行 Artifact。
11. 定义 Artifact 的 staging → drain → flush / close → hash → atomic finalize → DB row / Event / phase 最小提交协议。
12. 定义启动时 Artifact / Run reconciliation，包括 temp、orphan、dangling、hash mismatch、Review / Decision 引用和非终态 Run 收敛。
13. 将裸 `test_command` 替换为 single VerificationInvocation contract，明确 argv / shell、cwd、env、timeout、cancel、output 与 exit mapping，并声明它只提供证据、不证明全部 DoD。
14. 将 KR-08 降级为分级学习信号：一次合格自发复用只允许继续小规模验证；至少两个独立用户合格复用且指出控制面具体收益，才允许有限产品化投资，不得称为市场验证完成。
15. 更新 Go / No-Go：产品 MVP WWA 和实施计划必须同时依赖 Product Validation Gate 与 Technical Gate，任一单独通过都不授权进入。
16. 增加 accepted Change Package 的独立 `delivery_integrity = healthy / missing / corrupt` 计算投影；后续缺失或损坏阻止 Delivery / replay，但不改写历史 ReviewDecision、Run 终态或 Task `done`。

本轮没有生成 WWA，没有恢复任何 Deferred 能力，也没有把任何假设写成已验证事实。
