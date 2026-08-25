# Agentic Work OS MVP PRD Red Team

> 审查对象：[20-mvp-prd.md](./20-mvp-prd.md)  
> 上下文：[00-project-context.md](./00-project-context.md)、[10-key-assumptions.md](./10-key-assumptions.md)  
> 日期：2026-08-24  
> 范围：只攻击会使 Milestone 0、MVP 黄金路径、领域模型或执行安全发生重大返工的承重判断；不扩展 MVP，不恢复 Deferred 能力。

## Executive Decision

**Stop and validate first**

当前可以继续执行 **Milestone 0 技术 Spike**，也可以并行执行一个不产品化的 **Validation Prototype / Concierge Validation**；但在下述证据和 PRD 修订完成前，**不得进入产品 MVP 的 WWA、核心 Schema/API 冻结或 Project/Task UI 实施**。

原因不是 MVP 还缺更多功能，而是五个承重判断仍未闭合：Accepted Change 尚未形成可使用交付；产品验证活动没有独立阶段；Workspace 被赋予了无 Sandbox 时无法兑现的安全含义；Windows 进程所有权与唯一终态尚未通过 PoC；本地 Artifact Store 与数据库之间没有故障一致性协议。

推荐的阶段关系是：

```text
Validation Prototype / Concierge Validation ─┐
                                              ├─ Product + Technical Gate → WWA → MVP
Milestone 0 — Execution Feasibility ─────────┘
```

这不是新增 Release 或产品能力，而是把 PRD 已经要求的 A1、A2、A3 验证活动放到不会先冻结产品形态的位置。

### Load-bearing claims extracted

以下是 PRD 中所有会改变产品边界、核心模型、黄金路径或执行安全的承重主张。Top 5 将关联、且应由同一门槛处理的主张合并，避免把同一根因拆成泛化风险清单。

| ID | Load-bearing claim | Red Team 结论 |
|---|---|---|
| LB-01 | 第一用户的 “稍后回来恢复上下文并验收” Core Job 足够高频、足够痛。 | 尚未验证；短任务若始终被用户盯着，黄金场景没有真正测试该 Job。 |
| LB-02 | Project-native 归档相对孤立 CLI Session 有独立价值。 | 尚未验证；必须先比较 `CLI` 与 `CLI-first + 自动归档`。 |
| LB-03 | Task-first 相对 `CLI-first + 自动 Project / Run 归档` 有额外净收益。 | 尚未验证；不应因 Project-native 可能成立而顺带冻结 Task-first。 |
| LB-04 | Task 能稳定聚合目标、DoD、多次 Run、Workspace、Event、Artifact 和最终决定。 | 尚未验证；错误会同时改动外键、API、导航和生命周期。 |
| LB-05 | 单 Agent 代码修复能验证控制面的独立、可重复价值，而不只是 Codex 本身的价值。 | 尚未验证。 |
| LB-06 | 固定、持久化的 `prepare → agent → test → review → complete` FSM 足以表达首版真实运行，不需要通用 Workflow Engine。 | 基本成立；但当前 FSM 缺交付语义，且 `interrupted` 的资源语义不安全。 |
| LB-07 | 一个 Run 可同时承担首版协调执行与 Agent 执行记录。 | 在单 Runtime、固定流程下成立；无需预建 WorkflowRun / NodeRun / AgentRun。 |
| LB-08 | 首个 Codex Adapter 能诚实提供 cwd、流式输出、退出和 Cancel，输入与 Session 可降级。 | 尚未验证；Milestone 0 的 capability matrix 是正确门槛。 |
| LB-09 | 独立 Workspace 能保证 Agent 修改只发生在该目录。 | 作为宿主机安全承诺不成立；Workspace 不是 Sandbox。 |
| LB-10 | Windows Runner 能终止完整受控进程树，并在 Cancel / Exit / 崩溃竞态下形成唯一真实终态。 | 尚未验证；数据库唯一终态与 OS 进程确已停止是两个不同不变量。 |
| LB-11 | Human Accept 后可直接令 Run `completed`、Task `done`。 | 已被 PRD 自身反驳：没有 Commit、Patch、Apply、Merge Back 或其他可恢复交付契约。 |
| LB-12 | DB 当前状态 / Event 与本地 Artifact Store 能提供一致、可恢复的历史。 | 方向合理，但跨介质提交、封存和启动恢复协议缺失。 |
| LB-13 | 单一 Test Command 足以为首版 Review 提供最低验证证据。 | 作为窄场景约束可保留；必须改成定义清楚的单一 verification invocation，不能宣称其证明 DoD。 |
| LB-14 | Diff、Test、日志和一次 Human Review 足以验收，不需要通用 Approval、Receipt 或完整 Timeline。 | 在 Review 绑定不可变交付物后成立。 |
| LB-15 | A1、A2、A3 可在 Milestone 0 / MVP 两阶段中及时完成，不会先构建再验证。 | 当前存在明确阶段缺口；若把 A3 交给 MVP 退出时的 KR-08，会形成循环。 |
| LB-16 | 3 名用户、5 个任务中一次真实重复使用足以成为继续投资信号。 | 只足以成为继续小规模验证的弱信号，不能单独宣告产品验证通过。 |
| LB-17 | 已经使用 Coding Agent 的个人开发者是足够聚焦且成立的第一用户分群。 | 尚未验证；可以作为同一轮礼宾验证的招募假设，但不能写成已冻结分群。 |
| LB-18 | 首版不恢复已丢失的在途 Session，只保留可解释历史，仍能满足 Core Job。 | 作为范围收敛基本成立；但不能把仍存活且失去控制的进程误当作已安全中断。 |

## Top Kill-Assumptions

### 1. Human Accept 已经形成真正可使用的交付

- **Claim**  
  ReviewDecision 写入后，Run 可以进入 `completed`，Task 可以进入 `done`；当前 Diff、Test 和日志已经闭合真实代码修复。
- **Why it currently seems reasonable**  
  PRD 正确地区分了“Agent 退出”和“人类接受”，也要求 Review 前保存最终 Diff 与 Test。默认不自动清理 Workspace，短期内似乎仍能找到改动。
- **Fails if**  
  被接受的代码仍只存在于临时 Workspace 或展示型 Diff 中，用户无法在源仓库或新的 clean checkout 中确定性取得与所审内容完全相同的变更；或者 Review 后 Workspace 继续变化，使被接受的 bytes 与交付的 bytes 不一致。
- **Impact if wrong**  
  黄金路径实际止于“认可了一个临时工作区里的变化”，没有完成真实代码交付。`done`、历史恢复和 ReviewDecision 的语义失真；以后补交付会同时重做状态机、Artifact、Task 生命周期和验收页面。
- **Evidence already available**  
  PRD 明确规定 Accept 后直接 `Task = done`，但必需 Artifact 只有 `agent_log`、`diff`、`test_result`，没有 Commit、可重放 Change Package、Patch Export、Apply 或 Merge Back。该缺口可由文档本身确认，不需要假设外部事实。
- **Evidence to get before implementation**  
  冻结一种最小交付契约：Review 面对哪个不可变 ChangeSet；它绑定哪个 `base_revision` 和内容哈希；Workspace 消失后如何取得并应用；`done` 表示“已有可应用的已接受交付物”还是“已进入源分支”。尚未验证哪种实现最合适。
- **Kill criterion**  
  Accept 后删除原 Workspace；若不能只依赖持久化结果，在 `base_revision` 的 clean checkout 上重建与 Review 时相同的最终 tree，或必须靠用户回忆重新操作，则当前 `Accept → done` 语义被杀死。若没有明确区分“已接受”与“已应用”，Task 不得进入 `done`。
- **Cheapest test**  
  在一次性仓库中人工完成一组包含修改、删除和未跟踪文件的变更，封存候选交付物，执行 Review / Accept，删除 Workspace，再在 fresh checkout 中重放、比较 tree hash 并重跑同一验证命令。无需先开发产品 UI。
- **Decision recommendation**  
  **Modify**。最小方案不是自动 Merge Back，而是在 Review 前封存一个 content-addressed、可重放的 Change Package，并让 ReviewDecision 引用其 ID / hash。若 `done` 定义为“已接受且可应用的交付物可用”，手工应用可以留在产品外；若 `done` 必须表示已进入源分支，则必须等 publish / apply 成功后才能写入。

### 2. 现有两阶段 Release 足以在产品化前冻结入口、Task 聚合与黄金场景

- **Claim**  
  不增加独立验证阶段，也能在 Milestone 0 与 MVP 之间完成 A1、A2、A3；Project / Task-first、Task 中心聚合和代码修复黄金场景可以据此进入 WWA，KR-08 的一次重复使用足以支持继续投资。
- **Why it currently seems reasonable**  
  PRD 已经诚实标注这些判断“尚未验证”，也写出了 A/B/C 对照、9 个真实实例、6 条状态轨迹、3 名用户 / 5 个任务和失败动作，并明确区分“构建完成”与“产品验证通过”。
- **Fails if**  
  这些验证活动没有具名阶段、负责人、产物和进入 WWA 的前置关系，团队因而直接从 Milestone 0 进入 Project / Task UI 与核心 Schema；或者 A3 被解释为只能等产品 MVP 构建后由 KR-08 验证。还会失败于：Project-native 的收益可由 CLI-first 自动归档取得、Task-first 增量为负，或代表性工作不能自然归属于一个 Task。
- **Impact if wrong**  
  入口、导航、CRUD、外键、生命周期和首个成功时刻会在证据出现前一起固化；A1、A2 或 A3 的反证将造成产品面与核心数据模型的数周级返工。
- **Evidence already available**  
  只有内部问题陈述、自洽模型和验证计划；没有用户行为、重复使用或领域基数结果。`10-key-assumptions.md` 要求完整 MVP 开发前验证 A1/A2/A3，但 PRD Release 表只有 Milestone 0 与 MVP。KR-08 也没有证明重复选择来自 Project-native、Task-first 或控制能力，而不是 Codex 本身或研究安排。
- **Evidence to get before implementation**  
  建立具名的 `Validation Prototype / Concierge Validation`，承载：A=`直接 CLI`、B=`CLI-first + 自动归档`、C=`Task-first + 同样归档`；9 个最近真实实例与至少 6 条状态轨迹；用现有 CLI、表单和人工编排完成 3 名用户 / 5 个真实任务，并记录恢复、Cancel、证据与 Review 中实际被使用的价值机制。
- **Kill criterion**  
  B 不优于 A，则不产品化 Project 面；B 有价值但受益用户没有主动选择 C，则不采用强制 Task-first；两个以上代表性实例必须靠巨型 Task、特殊外键或模糊归属才能表达，则不冻结 Task 聚合；完成首次任务的 3 名参与者中少于 2 名在无提醒、非预分配的情况下再次选择该控制面，只能继续验证，不能宣告“产品验证通过”。
- **Cheapest test**  
  直接执行关键假设文档已经定义的低保真对照、Event Storming 和礼宾验证，不建设三套入口，也不建设产品化 Project / Task UI。
- **Decision recommendation**  
  **Modify**。在 Release 中显式增加 Validation Prototype / Concierge Validation，并与 Milestone 0 并行汇入同一个 Product + Technical Gate。Project / Task-first 产品化和 Task 中心 Schema 在证据出来前保持证据门控。KR-08 的一次自发复用只作为继续验证的弱信号；至少两个独立用户自发复用且能指出控制面带来的具体收益，才支持下一轮有限投资，仍不代表普遍市场验证。这里的“两名”是本轮建议的决策阈值，不是已经验证为充分的事实。

### 3. 无 Sandbox 时，独立 Workspace 仍能成为写入安全边界

- **Claim**  
  指定 cwd、独占 Workspace 和执行前后核对，足以兑现 KR-04 的“Agent 修改只发生在该 Run 的 Workspace”。
- **Why it currently seems reasonable**  
  Git Worktree 或临时 clone 能隔离常规 working copy；Runner 可以把 cwd 固定到记录的规范化路径；源仓库状态与 Workspace Diff 都可以前后比较。
- **Fails if**  
  Agent、测试命令或其子进程通过绝对路径、`..`、junction / symlink、用户级配置、网络或继承的本机权限访问 Workspace 之外。没有 OS containment 时，前后核对只能检测已知位置，不能证明整个宿主机没有被修改。
- **Impact if wrong**  
  KR-04 不可验收，用户会把“代码工作副本隔离”误解为“宿主机安全隔离”；源仓库、其他工作区、凭据或宿主资源可能受到影响。以后若真要提供安全隔离，将改变 ExecutionBackend、Secret 和权限边界。
- **Evidence already available**  
  项目上下文已明确 `WorkspaceLease ≠ SandboxLease`，而 Sandbox 在 MVP 中 Deferred；执行还要复用当前用户的 Codex 登录态。当前没有 containment PoC，因此宿主机写入限制尚未验证，且按现有边界不能被宣称为保证。
- **Evidence to get before implementation**  
  一页明确的 Execution Trust Contract：`trusted-local execution`；Codex 与 Test 继承当前用户权限和登录态；Workspace 只提供代码 working-copy 隔离；系统对源仓库和已登记 Workspace 做执行前后 drift detection；产品不承诺宿主文件系统、网络、凭据或进程安全隔离。
- **Kill criterion**  
  在一次性目录中，受控 mock 能写入 sibling / source marker，即足以杀死“cwd 强制限制全部写入”的主张。若 PRD 仍使用“只发生在 Workspace”或“安全隔离”而没有可强制的 containment，MVP 文档 No-Go；若产品价值必须依赖宿主机隔离，则当前无 Sandbox 的 MVP 边界本身不成立。
- **Cheapest test**  
  在临时父目录下让 mock 从 assigned cwd 写入 sibling 和 source marker，验证写入可发生；随后只验证产品能否检测指定源仓库和已登记工作区的 drift，并在发现异常时阻止 Accept / Delivery。
- **Decision recommendation**  
  **Modify**。将 KR-04 改成 trusted-local 前提下的 Workspace 代码隔离与定向检测，不承诺宿主机安全隔离；Sandbox 继续 Deferred。

### 4. Windows Runner 能同时保证受控进程全部停止与唯一真实终态

- **Claim**  
  Node / TypeScript Local Runner 可以取消完整 Codex 进程树、排空输出，并在 Cancel、自然退出、Runner / Server 崩溃的竞态下只产生一个与 OS 事实一致的终态。
- **Why it currently seems reasonable**  
  PRD 已设计条件更新进入 `cancelling`、重复 Cancel 幂等、正常退出不得覆盖取消、确认进程树停止后才写 `cancelled`，并把无法确认的情况降为 `interrupted`。必要时还允许最小 Windows 原生辅助程序；整体方向是正确的。
- **Fails if**  
  真实 Codex 的任一相关进程没有进入 Runner 所拥有、且可由 PoC 证明的 process containment boundary；取消期间仍能派生、脱离或继续写文件；Runner 崩溃后无法 reconciliation；输出或 Artifact 在 terminal 后继续到达。当前还存在一个直接状态矛盾：`interrupted` 是终态且 Task 回 `ready`，可能在孤儿进程仍存活时允许新 attempt。
- **Impact if wrong**  
  UI 可能显示 `cancelled`，但旧进程仍在改代码；Test / Review 可能越过取消继续推进；旧 Run 与新 attempt 并发执行。解决方式可能迫使 Runner 引入原生 helper、持久进程边界或不同恢复模型，属于核心执行架构返工。
- **Evidence already available**  
  已有完整的逻辑规则和 Milestone 0 测试计划，但没有真实 PID / handle、进程归属、竞态或 Codex Cancel PoC 结果。所有相关结论均尚未验证。
- **Evidence to get before implementation**  
  明确 Runner-owned process containment boundary（具体机制由 PoC 决定）、每个 PID / handle 的归属、停止确认方式、stdout / stderr drain barrier、terminal CAS 与数据库唯一约束；覆盖快速派生、根先退出、重复 Cancel、自然退出竞态、Runner 崩溃、late write 和真实 Codex。
- **Kill criterion**  
  预定义矩阵中出现任一 survivor、terminal 后 marker 继续变化、Cancel 后进入 Test / Review、零个或多个 `run.terminal`，或无法证明真实 Codex 的相关进程全部处于 owned boundary，Milestone 0 即不通过。不能确认停止的 `interrupted` Run 在完成 reconciliation 前不得解锁同 Task / 同源仓库的新 Run。
- **Cheapest test**  
  用 hostile mock parent 持续并随机派生 child / grandchild，在不同时间触发 Cancel 与自然退出，并用 PID / handle、持续写入 marker 和 DB 查询多轮验证；随后在一次性仓库对真实 Codex 做同等 Cancel 检查。
- **Decision recommendation**  
  **Defer pending evidence**。MVP Runner 实现冻结必须等待 Milestone 0；同时把“完整进程树”改为可证明的 Runner-owned process containment boundary，并把 `interrupted` 定义为需要 reconciliation 的阻塞结果，而不是自动使 Task `ready` 的安全终态。

### 5. SQLite 状态 / Event 与本地 Artifact Store 会自然保持原子和可恢复

- **Claim**  
  DB 中的状态与 append-only Event 事务，加上稳定路径、大小和哈希，已经足以保证 Review、终态和重启历史引用同一份完整证据。
- **Why it currently seems reasonable**  
  MVP 是单机、单用户；SQLite 与本地同卷文件系统可以组成很小的提交协议。PRD 也正确要求最终 Diff / Test 持久化后才能 Review，并默认不自动删除 Workspace。
- **Fails if**  
  进程在临时文件写入、flush、hash、rename、Artifact row / Event 提交、phase 推进或日志 drain 之间崩溃，造成 orphan file、dangling row、部分文件、错误 hash、Review 引用可变日志，或缺少证据却已经 terminal。数据库事务不能天然覆盖文件系统。
- **Impact if wrong**  
  KR-06 / KR-07 失效；用户可能基于不完整证据 Accept，重开应用后无法解释 Run，Review 对象和最终交付对象也可能不同。后补恢复会改变 Artifact 生命周期、状态推进和启动流程。
- **Evidence already available**  
  PRD 只规定了 DB 内“状态更新与 Event 同事务”和 Artifact 最终字段，没有跨介质提交顺序、Artifact open / sealed 语义、崩溃窗口表或启动 reconciliation。尚未验证。
- **Evidence to get before implementation**  
  明确最小协议及不变量，例如：同卷 temp write → flush / hash → atomic finalize → DB 中写 Artifact row / Event 并推进状态；启动时处理 orphan、dangling 和 hash mismatch；流式 Agent Log 在 drain 后 seal；只有所有 Required Artifact 可读且 hash 匹配时才能 `review.requested`。
- **Kill criterion**  
  任一故障注入后，Run 能进入 Review / terminal 但 Required Artifact 缺失、仍可变或 hash 不匹配；或重启后无法确定性阻止、降级或修复该状态，则当前可靠历史承诺失败。
- **Cheapest test**  
  只实现一个最小 Artifact writer + SQLite 原型，在 temp write、finalize、row insert、Event / phase commit 前后逐点强杀，重开后验证：`Review 可见 iff 三个 Required Artifact 均 readable 且 hash-match`。
- **Decision recommendation**  
  **Modify**。在 WWA 前写清 commit / seal / reconcile 协议，并把故障注入列为实现验收；不需要 Event Sourcing、分布式事务、远程 Artifact Store 或新的产品 UI。

## What Holds Up

以下设计经最强攻击后仍然合理：

1. **固定 `prepare → agent → test → review → complete` FSM 应保留，不建设通用 Workflow Engine。** 当前只有一条真实候选路径，没有第二条必须改序或复用的流程证据。缺失的 Delivery 与 Reconciliation 是固定协调器必须补齐的状态语义，不构成引入 YAML / DAG 的理由。
2. **一个 Run 作为首版唯一一等执行记录成立。** 单 Runtime、单 Workspace、一次 attempt 不可变，Reject 后创建新 Run，足以保持历史可解释；无需预先拆 WorkflowRun、NodeRun 和 AgentRun。
3. **Agent 退出不等于用户接受，Test 失败不等于协调器故障。** 测试 `failed / error` 仍进入 Human Review，ReviewDecision 独立于 Agent 退出，这两个语义应保留。
4. **单一 Test Command 可以保留为黄金路径资格约束。** 更准确的名称应是 single verification invocation：它可以调用仓库已有的聚合脚本，但必须冻结 interpreter / argv 或 shell、cwd、环境策略、timeout、Cancel、输出和退出码语义。它只提供证据，不证明 DoD。若 5 个代表性任务中有 2 个以上必须依赖未记录的手工 setup 或交互式多阶段验证，应先收窄黄金场景，而不是加入 CI 或通用 Script Workflow。
5. **薄 Event / Artifact / Human Review 方向成立。** Append-only 里程碑 Event、稳定 Artifact 和一次 Review 足以支持第一版；需要补的是交付绑定和故障协议，不是通用 Approval、Completion Receipt 或完整 Timeline。
6. **不恢复已丢失的在途 Session 可以接受。** 但“无法恢复 Session”不能被用来掩盖仍存活且失去控制的进程；后者必须先 reconciliation。
7. **Deferred 边界成立。** Kanban、Workflow Canvas、多 Runtime、Remote Runner、Sandbox、Session Resume、通用 Approval、完整 Timeline、Memory、Collaboration 和团队治理都没有被本次攻击证明应进入 MVP。

## Mandatory PRD Revisions

以下内容必须在进入产品 MVP WWA 前修改；它们闭合现有承诺，不是新增平台范围：

1. **新增 Validation Prototype / Concierge Validation 阶段。** 写明它与 Milestone 0 可并行、两者共同构成进入 WWA 的 Gate；明确 A/B/C、领域模型演练、礼宾任务的负责人、证据产物、判据和 Decision Record。Milestone 0 可立即进行，产品 MVP WWA 不可提前。
2. **将 Project-native、Task-first、Task 聚合拆成独立决策。** A1 必须分别判断 B 对 A、C 对 B；A2 通过前不得冻结 Task 中心的生产 Schema、API、导航和状态机。验证原型可以使用临时或中性模型。
3. **闭合 Accepted Change Delivery。** Review 前封存不可变 Change Package 并绑定 `base_revision` / hash；选择并写清 `done` 的含义。默认推荐“已接受且可重放交付物可用”，自动 Merge Back 保持 Deferred。固定 FSM 需要反映 Delivery 成功或诚实的未交付状态。
4. **重写 Workspace 与执行信任边界。** 全文将“Agent 修改只发生在 Workspace”改为 trusted-local execution、代码 working-copy 隔离、源仓库与已登记 Workspace 的前后检测，以及明确的宿主机安全非承诺。不得用 drift detection 冒充 prevention。
5. **冻结 Windows Runner 的所有权、Cancel 与 Reconciliation 不变量。** 用可由 PoC 证明的 Runner-owned process containment boundary 替代模糊的“所有后代”；区分数据库唯一终态与物理进程停止；`interrupted` 未确认资源已停止前不得让 Task / repository 可启动新 Run；允许记录 terminal 后的 reconciliation 事实，或调整“terminal 后禁止任何 Event”的绝对规则。
6. **补本地 Artifact Store / DB 的提交和恢复协议。** 定义 temp、finalize、hash、DB row / Event / phase、日志 drain / seal 的顺序和启动对账；Review 只在 Required Artifact 可读且 hash 匹配后开放。
7. **修订 Test 与 KR-08 语义。** 把裸 `test_command` 定义为 single verification invocation contract；KR-08 的一次自发复用只允许触发“继续小规模验证”，不得单独写成“产品验证通过”或 Post-MVP 投资依据，并排除预安排、提醒或纯 Codex 效果造成的假重复。

## Deferred Concerns

以下问题真实存在，但不应阻塞已修订边界下的 Milestone 0 或 MVP，也不应借 Red Team 回流本轮范围：

- **宿主机安全隔离：** Docker / VM / Windows Sandbox、Secret broker、网络策略与细粒度权限；MVP 明确 trusted-local 后继续 Deferred。
- **自动 Merge Back：** 分支发布、rebase、冲突解决、保护分支和回滚；首版用可重放 Change Package 闭合交付即可。
- **通用 Workflow 与 CI：** Agent ↔ Test 自动修复循环、多 Test Step、服务编排、WorkflowDefinition / YAML / DAG；只有真实改序或第二条流程证据出现后再立项。
- **Session Resume 与持久 Runner：** 浏览器 / Server / Runner / 电脑重启后的原生 Session 接管；首版可以保留历史并诚实标记中断，但不能误报进程已停止。
- **Artifact 生命周期泛化：** 自动清理、配额、备份、加密、大文件和远程 Store；不影响先实现最小 sealed Artifact 与启动 reconciliation。
- **多仓库、团队与远程执行：** 多 Repo ChangeSet、技术负责人交接、RBAC、Remote Runner 和多人 Review；仍由真实使用证据决定。

## Go / No-Go Gate

### 当前结论

- **GO：** Milestone 0、最小 Artifact durability fault-injection Spike、Accepted Change replay Spike、Validation Prototype / Concierge Validation。
- **NO-GO：** 产品 MVP WWA、Project / Task 产品化 UI、Task 中心生产 Schema/API、完整实施计划。

### 进入 WWA 和实施计划前必须同时满足

1. **文档门槛：** Mandatory PRD Revisions 全部落入 `20-mvp-prd.md`；`done`、trusted-local、`interrupted`、Artifact seal / recovery 和 KR-08 的语义无冲突。
2. **A1 入口门槛：** A/B/C 对照已经分别回答 Project-native 是否成立、Task-first 是否有额外净收益，并形成 Keep / Modify / Remove 决策；不得用同一个结果替代两个判断。
3. **A2 模型门槛：** 9 个真实工作实例和至少 6 条状态轨迹已经支持 Task 聚合，或已在扩散前改用更中性的中心对象；两个以上代表性实例依赖特殊归属即不得冻结 Task 模型。
4. **A3 场景门槛：** 3 名用户 / 5 个真实任务的礼宾验证能指出实际使用的控制面价值；第二任务不是预分配或提醒产生。少于两个独立用户自发复用时，只能继续验证，不能进入“产品验证通过”。
5. **Execution 门槛：** Milestone 0 用 mock 与真实 Codex 证明 cwd、streaming、退出、Runner-owned process containment boundary 下的 Cancel、drain barrier、唯一 terminal 和 Workspace Diff；任一 survivor、late write、错误终态或无法归属的真实进程均为 No-Go。
6. **Safety 门槛：** PRD 与 UX 明示 trusted-local；Workspace drift test 能发现源仓库 / 已登记 Workspace 异常，且异常时不能 Accept / Deliver。该门槛不要求加入 Sandbox。
7. **Delivery 与 Durability 门槛：** 删除原 Workspace 后，已接受 Change Package 能在 clean checkout 重放为同一 tree；Artifact 故障注入后，不存在“Review / terminal 可见但 Required Artifact 缺失、可变或 hash 不匹配”的状态。

上述门槛通过后，可以进入 WWA 与实施计划；无需恢复任何 Deferred 能力。若 A1、A2 或 A3 失败，应先按既定失败动作修改入口、中心对象或黄金场景，再重新评审受影响部分，而不是用新增功能掩盖反证。
