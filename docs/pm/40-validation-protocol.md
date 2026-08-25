# Agentic Work OS — Validation Protocol

> 状态：Frozen for Validation Prototype / Concierge Validation execution  
> 日期：2026-08-25  
> 上游依据：[MVP PRD](./20-mvp-prd.md)、[PRD Red Team](./30-prd-red-team.md)  
> 决策范围：Project-native、Task-first、Task 聚合与单 Agent 代码问题场景的产品证据

## 0. 协议边界

本协议冻结的是验证问题、对照关系、样本口径、记录字段、反证规则和 Decision Record 格式，不冻结任何正向产品结论。

本轮允许：

- Markdown、表单、现有 Codex CLI、小型记录脚本和人工编排；
- 临时目录、匿名 ID 和中性数据结构；
- Validation Prototype / Concierge Validation 与 Milestone 0 并行进行。

本轮禁止：

- 生成产品 MVP WWA；
- 建设 A/B/C 三套正式产品入口；
- 实现 Project / Task 产品化 UI；
- 冻结 Task 中心生产 Schema、API、导航或生命周期；
- 用新增 Workflow、多 Runtime、Sandbox、Session Resume 或其他 Deferred 能力掩盖反证。

本协议中的样本数、通过信号和失败信号是预注册判据，不是已经取得的结果。小样本用于证伪、边界修订和是否继续投资的判断，不用于声称统计显著性或市场验证完成。

## 1. 独立问题与决策单元

本轮必须分别回答四个问题：

1. **Project-native：** B 相对 A 是否产生可观察、可归因的独立收益？
2. **Task-first：** 在 B 和 C 拥有相同归档能力时，C 相对 B 是否仍有额外净收益？
3. **Task 聚合：** Task 是否能自然聚合目标、DoD、多次 Run、Workspace、Event、Artifact 和最终决定？
4. **单 Agent 代码问题场景：** 真实用户是否实际使用并复用控制面价值，而不只是喜欢 Codex 的代码结果？

前三个问题必须各自产生独立的 `Keep / Modify / Remove` Decision Record。不得用 C 对 A、综合满意度或一个总偏好替代 B 对 A和 C 对 B；Task 聚合也不得由入口偏好推导。

分析单位是一个真实代码问题。对同一目标的失败、Reject、Cancel 和新 attempt 都属于同一个问题，不得被重复计为多个问题或多次复用。

## 2. 通用证据纪律

### 2.1 证据优先级

证据强度从高到低为：

1. 用户在真实问题中的主动选择和实际行为；
2. 原始运行、恢复、控制、证据查看和 Review 记录；
3. 用户对具体行为的事后归因；
4. 口头偏好、兴趣或功能愿望。

第 4 类不能单独支持任何 `Keep` 或 Product Validation Gate 通过。

### 2.2 公共记录信封

以下字段只属于验证记录，不构成生产 Schema：

| 字段 | 记录要求 |
|---|---|
| `evidence_id` | 全局唯一、不可复用。 |
| `protocol_version` | 本文版本或内容哈希。 |
| `activity_type` | `entry_comparison`、`domain_walkthrough`、`concierge` 或 `reuse_audit`。 |
| `participant_id` | 匿名 ID；身份映射与研究证据分开保存。 |
| `real_problem_id` | 一个真实代码问题的稳定研究 ID。 |
| `repository_or_context_ref` | 去敏后的仓库或上下文引用。 |
| `observed_at` | 带时区时间。 |
| `facilitator` | 主持人 ID。 |
| `raw_evidence_refs` | 原始表单、命令、I/O、Diff、Verification、录屏或观察笔记引用。 |
| `facilitator_actions` | 主持人每次提示、代操作、修正和救援。无则写 `none`。 |
| `prompted_or_natural` | 行为是自然发生、实验安排还是主持人提示。 |
| `confounders` | 顺序、问题难度、Codex 结果质量、工具故障和其他混杂因素。 |
| `participant_attribution` | 用户对控制面与 Codex 本身价值的分开归因。 |
| `decision_record_ref` | 被哪个 Decision Record 纳入、排除或降权。 |

### 2.3 保存与编码规则

- 先保存原始记录，再增加解释性标签；不得为符合候选模型而改写原始事实。
- 原始证据按参与者和问题隔离，保存采集时间、文件哈希和必要的去敏说明。
- 主持人提示过的行为必须标为 `prompted`；提示不能被事后解释成主动选择。
- 无法判断时写 `unknown`，不得补写支持性结论。
- 两名研究者有分歧时同时保留两种编码，再在 Decision Record 中裁决。
- A/B/C 的记录脚本可以相同，但 A 的研究用旁路记录不得在体验期间展示给用户，否则 A 会被污染成 B。

## 3. 活动一：A/B/C 入口对照

### 3.1 对照定义

| 入口 | 用户实际操作 | 用户可见归档 | 被判断的变量 |
|---|---|---|---|
| A — Direct CLI | 用户在选定 working copy 中直接启动现有 Codex CLI，并沿用自己的终端与 Git 工作方式。 | 不提供自动 Project / Run 归档。研究旁路仍保存最少原始证据，但不向用户展示。 | 直接 CLI 基线。 |
| B — CLI-first archive | 用户仍先直接启动 Codex CLI；最小脚本或人工流程随后把本次事实归入 Project / Run 档案。 | Project / Run 档案。 | 相对 A 的 Project-native 连续性。 |
| C — Task-first archive | 用户先填写最小 Task 卡，再由现有 Codex CLI 执行。 | 与 B 完全相同的 Project / Run 档案，另保留启动前 Task 卡。 | 相对 B 的 Task-first 增量。 |

B 与 C 的归档字段、结果呈现、Codex 版本、模型 / 配置、登录态、工作副本策略、主持人帮助和 Review 材料必须一致。C 唯一允许增加的变量是启动前 Task 契约。

B 的人工编排必须采用 Wizard-of-Oz 方式模拟自动归档，不要求用户额外录入、整理或触发归档。任何用户可见的人工采集、额外操作或 B/C 呈现差异都必须标记为 `comparison_confounded`。B/C 共用归档至少包含 Project / Run 引用、时间、cwd、目标 / prompt 快照、Agent 输出引用、Diff、VerificationInvocation / Result，以及存在时的 Change Package 与 Review 事实。

最小 Task 卡只包含：`objective`、`definition_of_done`、仓库 / 基准引用和一个完整 VerificationInvocation。它可以是 Markdown 或表单，不是产品 Task UI，也不定义生产 Schema。

### 3.2 输入

- 已确认真实、已去敏的代码问题事实包；
- 同一问题可执行的目标、DoD、仓库上下文和 Codex 输入；
- B/C 共用的归档合同版本；
- A/B/C 的 Markdown、表单或命令行材料；
- 在观察结果前冻结的入口顺序、分配理由和主持人脚本；
- 用于“离开后返回”的问题清单：目标、当前状态、改动、Verification、决定和下一步。

不要求、也不应把同一个代码问题真实执行三遍。可以用真实问题的启动 / 恢复演练、匹配问题和轮换顺序减少学习效应，但必须记录顺序、问题差异和不可比项。

活动一沿用活动三的同 3 名参与者。每名参与者至少产生一条 A ↔ B 和一条 B ↔ C 的可比低保真观察，不要求同一问题真实执行三遍；退出者的部分记录可以保留，但替补参与者必须自行完成两组比较，不能拼接两人的半组记录。

### 3.3 步骤

1. 冻结事实包、Codex 输入和 B/C 归档合同，并计算版本或内容哈希。
2. 按预注册顺序给参与者入口材料；3 名参与者的首次展示顺序应轮换，避免所有人先看到同一入口。预先建立覆盖矩阵，确保每人都有 A ↔ B 与 B ↔ C 两组匹配观察。
3. 记录从看到问题到成功启动的全过程，包括放弃、回退、询问和主持人介入。
4. 在自然注意力切换或预先标明的恢复演练后，请用户回答六个返回问题；记录答案、耗时和实际打开的证据。
5. 完成 Review 走查，记录用户是否能仅凭当前材料判断 Accept / Reject，以及是否回到外部终端补事实。
6. 分开询问并观察：B 对 A 的独立作用、C 对 B 的额外作用。不得提出“你是否喜欢完整方案”这类合并问题代替比较。
7. 当用户随后有真实入口选择机会时，记录其主动选择；口头偏好不能替代实际选择。
8. 分别写 Project-native 与 Task-first Decision Record，互相引用但不共享结论。

### 3.4 记录字段

| 字段 | 记录要求 |
|---|---|
| `variant`、`variant_order` | A、B 或 C，以及展示 / 使用顺序。 |
| `task_fact_snapshot_hash` | 本次真实问题事实包版本。 |
| `codex_payload_hash` | 对照使用的 Codex 输入版本。 |
| `archive_contract_version` | B/C 必须相同。 |
| `archive_contract_hash` | B/C 归档字段与填充规则的内容哈希。 |
| `archive_population_mode` | `script` 或 `wizard_of_oz`；不得要求用户额外录入。 |
| `archive_presentation_hash` | B/C 用户可见呈现必须相同。 |
| `comparison_pair_id` | 一组 A ↔ B 或 B ↔ C 匹配观察的 ID。 |
| `matching_basis` | 两个真实事实包如何匹配，或同一事实包如何用于低保真恢复观察。 |
| `comparison_usable` | 仅 parity 和混杂检查通过时为 true。 |
| `time_to_start_seconds` | 从材料可见到命令成功启动；无法启动则为空并写原因。 |
| `entry_abandoned_or_switched` | 是否放弃或切换入口，及发生时点。 |
| `facilitator_intervention_count` | 与干预日志逐条对应。 |
| `return_context` | 自然返回或安排的恢复演练；两者分开分析。 |
| `time_to_recover_seconds` | 开始恢复到回答完成。 |
| `facts_recovered_without_help` | 六个返回问题逐项记录，不只记总分。 |
| `evidence_opened` | 用户真实打开或引用的材料。 |
| `external_terminal_needed` | 是否需要外部终端补齐关键事实。 |
| `review_action` | Accept、Reject、无法决定及理由。 |
| `entry_selected_by_user` | 后续选择及选择发生的真实问题。 |
| `selection_reason` | 原话与行为证据分开保存。 |
| `project_continuity_benefit` | 仅编码 B 对 A 的证据。 |
| `task_contract_benefit` | 仅编码 C 对 B 的证据。 |
| `codex_only_benefit` | 代码生成质量带来的收益。 |
| `comparison_confounded` | 是 / 否；若是，记录原因并不得作为通过证据。 |

### 3.5 Project-native 独立判断：B 对 A

通过信号：

- 用户实际使用 B 的 Project / Run 档案恢复或审核，并取得 A 中没有的事实连续性；
- 用户能指出具体动作变化，例如少做上下文重建、避免看错 Run、依据归档证据完成 Review；
- 后续真实选择中，用户在不依赖 Task 卡的理由下主动选择带归档入口；
- 支持性行为不依赖 Codex 输出质量更高、主持人提醒或 B/C 工具不等价。

失败信号：

- B 不优于 A，用户仍只依赖终端历史、Git 或记忆；
- 档案没有被打开、内容不可信，或归档成本大于可观察收益；
- 所谓收益实际来自 C 的 Task 卡、主持人代查或 Codex 代码结果；
- 只有意向表达，没有行为证据。

失败动作：不产品化当前 Project-native 边界；根据证据评估更窄的 Session / Run companion，并先修订 PRD。

### 3.6 Task-first 独立判断：C 对 B

通过信号：

- 在 B/C 归档完全等价时，用户主动选择 C；
- 启动前契约在执行、Verification 或 Review 中被实际引用，并减少目标漂移、验收歧义或返工；
- 用户指出的净收益超过填写和维护 Task 卡的摩擦；
- 结论只来自 C 对 B，不复用 B 对 A 的 Project-native 结果。

失败信号：

- 受益用户仍选择 B，或只在主持人要求时填写 C；
- Task 卡被执行后补写、被忽略，或没有改变任何执行 / Review 行为；
- C 的额外步骤延迟启动，却没有额外净收益；
- 结论依赖 C 拥有比 B 更完整的归档或更多主持人帮助。

失败动作：不采用强制 Task-first；评估 CLI-first 自动关联，并保留已经独立成立的 Project-native 证据。

## 4. 活动二：9 个真实实例与领域模型走查

### 4.1 输入与取样

- 在走查结果出现前冻结 9 个最近、可取得原始事实的真实代码工作实例；
- 按时间倒序或另一条预注册、与候选模型无关的规则选择，不得只挑适合 Task 的快乐路径；
- 每个实例至少有目标 / 请求、尝试时间线、仓库事实和实际结果；未知信息保持未知；
- 中性对象卡：意图、工作项、尝试、运行、Session、Workspace、Event、Artifact、决定；
- 候选 Task 关系只作为待证伪映射，不作为记录事实的前提。

9 个实例应主动检查失败重试、Cancel 后再跑、无 Task 探索、跨仓库变更和 Workspace 丢失。若前 9 个真实实例没有覆盖某类情形，可以增加实例，但不得替换或删除不利的前 9 个。

### 4.2 状态轨迹覆盖

以下轨迹全部要做关系和不变量走查，其中至少 6 条必须由真实实例端到端映射；其余可用真实实例事实做明确标注的反事实分支，不能算作真实成功证据：

| ID | 状态轨迹 |
|---|---|
| TR-01 | Prepare → Agent → Verification passed → seal → Review Accept → completed；原 Workspace 丢失后 accepted Package 仍可解释。 |
| TR-02 | Verification failed / error →证据安全 seal → Review Accept 或 Reject；不得把测试结果误当协调器故障。 |
| TR-03 | Review Reject →旧 Run 不变→新 Run / attempt；不得复用或改写旧 Run。 |
| TR-04 | Cancel → containment 已确认停止→ `cancelled / safe` →新 Run；Cancel 后没有 Test / Review。 |
| TR-05 | 失去进程事实→ `interrupted / reconciliation_required` → `safe` 或 `blocked`；对账前同 Task / 同仓库保持锁定。 |
| TR-06 | Prepare 失败→无 Workspace→ `failed`；仍有明确失败事实。 |
| TR-07 | 无 Task 的探索性 Session / Run 如何被表达；不得强造巨型或空壳 Task。 |
| TR-08 | 跨仓库变更或越界修改如何归属和阻断；不得用特殊外键隐藏中心对象失配。 |
| TR-09 | Accept 后 Change Package 后续 missing / corrupt；只改变当前 `delivery_integrity` 计算投影，不改写 ReviewDecision 或 Run 终态。 |

### 4.3 步骤

1. 冻结 9 个实例清单、选择规则和原始证据索引。
2. 不使用候选 Task 字段，先重建每个实例的真实时间线和对象归属。
3. 再把中性事实映射到 Project、Task、Run、Session、Workspace、Event、Artifact 和 ReviewDecision。
4. 对每个关系询问：谁拥有目标 / DoD？一次新尝试是否新建 Run？Workspace、Event、Artifact 和决定能否唯一归属？
5. 走查对应状态轨迹和异常分支，检查业务终态、资源状态与交付完整性是否被错误混合。
6. 将实例标为 `natural_fit`、`strained_fit` 或 `model_break`。
7. 对后两类逐项标记是否需要巨型 Task、特殊外键、模糊归属、例外生命周期或跨聚合改写。
8. 至少由另一名评审者复核所有 `strained_fit / model_break`；保留分歧。
9. 汇总 Task Aggregation Decision Record；不得通过加入大量例外字段把失败改写成通过。

分类操作定义：

- `natural_fit`：`giant_task_required`、`special_fk_required`、`ambiguous_ownership`、`exception_lifecycle_required` 全部为 false，且历史不变量保持成立。
- `strained_fit`：至少一个异常标记为 true，但仍能在不改变事实所有权、基数或历史不变量的前提下表达。
- `model_break`：必须改变事实所有权 / 基数、改写历史，或混合业务终态、资源安全和交付完整性才能表达。

在本协议中，按预注册取样规则进入冻结前 9 个的每个实例都视为代表性实例，不允许看完映射结果后将不利实例降级为“不代表”。

### 4.4 记录字段

| 字段 | 记录要求 |
|---|---|
| `instance_id`、`source_date` | 实例 ID 和真实发生日期。 |
| `selection_rule_position` | 在预注册取样规则中的位置。 |
| `raw_timeline_ref` | 未映射候选模型的原始时间线。 |
| `repository_count` | 实际涉及仓库数及角色。 |
| `objective_and_dod_owner` | 事实中的拥有者；未知则写 unknown。 |
| `run_attempts` | 尝试数量和不可变边界。 |
| `workspace_ownership` | 无、唯一或多义。 |
| `session_ownership` | 是否存在稳定原生 Session，以及与 Run 的关系。 |
| `event_ownership`、`artifact_ownership` | 能否唯一归属。 |
| `review_decision_ownership` | 决定审核的不可变对象。 |
| `trajectory_evidence[]` | 每项包含 `trajectory_id`、`evidence_mode = actual_end_to_end / counterfactual`、`instance_id` 和 `raw_evidence_ref`。同一轨迹的多个实例不重复增加轨迹数。 |
| `fit_classification` | `natural_fit`、`strained_fit` 或 `model_break`。 |
| `giant_task_required` | 是否把多个独立目标 / 交付强塞进一个 Task。 |
| `special_fk_required` | 是否必须增加仅服务该实例的特殊关系。 |
| `ambiguous_ownership` | 同一事实是否合理地属于多个中心对象。 |
| `exception_lifecycle_required` | 是否必须绕过正常尝试 / 决定语义。 |
| `alternative_aggregate` | WorkItem、ExecutionRequest、ChangeSet、Run-first 或其他中性候选。 |
| `reviewer_disagreement` | 分歧与裁决。 |

### 4.5 通过与失败信号

通过信号：

- 9 个实例能自然表达对象归属、基数、重试和决定，且至少 6 个不同 `trajectory_id` 各有至少一个 `actual_end_to_end` 映射；
- 没有通过巨型 Task、特殊外键或模糊归属来保护候选模型；
- 业务终态、`resource_state` 与 `delivery_integrity` 能保持正交；
- 异常路径无需修改历史 Run 或 ReviewDecision。

失败信号：

- 冻结的前 9 个实例中，两个以上需要巨型 Task、特殊外键或模糊归属；
- 无 Task 探索、跨仓库、重试或 Workspace 丢失只能靠例外生命周期表达；
- 为保持 Task 中心而必须让一个 Artifact / ReviewDecision 同时属于多个 Task；
- 走查者只能通过预先假定生产字段才能解释真实事实。

失败动作：不得冻结 Task 中心生产模型；改评更中性的 WorkItem、ExecutionRequest、ChangeSet 或 Run-first，修订受影响 PRD 后再评审。

## 5. 活动三：3 名用户 / 5 个真实问题的 Concierge Validation

### 5.1 输入与样本口径

- 3 名已经使用 Coding Agent 的个人开发者；该画像只是招募假设；
- 每名用户首次只带入 1 个当前真实问题；该问题不能由研究方发明或拆分；
- 目标共 5 个真实问题。额外两个问题可以来自用户后续自然带入，也可以是已安排的真实研究任务，但只有前者可能构成合格复用；
- 真实仓库或经用户确认能代表原问题的安全副本、实际 DoD 和一个 VerificationInvocation；
- 现有 Codex CLI、Markdown / 表单、最小脚本和人工礼宾；不要求产品 UI；
- 在首个问题开始前预注册复用观察窗、联系规则和主持人脚本，期间不得为取得复用而改动。

若观察窗结束时没有取得 5 个真实问题，应如实记录活动未完成；不得用演示问题补足。若 5 个问题完成但后两个是预分配任务，活动数量可以完成，但它们不能支持自发复用门槛。

### 5.2 步骤

1. 确认问题真实来源、用户原本打算处理的时间和现有 CLI / Git 验收方式。
2. 记录 baseline：用户通常如何启动、离开后恢复、Cancel、查看 Diff / Verification 和决定是否接受。
3. 按已冻结的入口协议执行；在真实 Codex 启动前展示 trusted-local / 非 Sandbox 边界。
4. 主持人只做协议允许的归档、表单和故障救援；每次提示与代操作都进 assistance log。
5. 观察自然注意力切换。若安排恢复演练，明确标为 `research_scheduled`，只验证可用性，不证明自然频率。
6. 记录恢复、Cancel、证据查看和 Review 中每个控制机制是 `natural`、`facilitator_prompted` 还是 `not_triggered`。Cancel 没有真实需要时不得诱导制造。
7. Review 后分开询问：代码结果本身有什么价值；Project 连续性、Task 契约、恢复、控制或证据验收分别改变了什么行为。
8. 首次任务后进入无提醒观察窗。研究方不得私信、邮件、日历邀请、口头催促或以第二次使用为条件提供奖励。
9. 用户自行带来新问题时，先做复用资格审计，再开始下一次礼宾执行；审计失败的任务仍可作为真实任务记录，但不计复用。

### 5.3 记录字段

| 字段 | 记录要求 |
|---|---|
| `problem_source` | 谁在何时首次提出，是否属于原有工作。 |
| `real_problem_confirmed` | 用户确认和外部事实引用。 |
| `entry_variant`、`entry_choice_owner` | 使用入口及由谁选择。 |
| `objective`、`definition_of_done` | 原始输入和后续变化。 |
| `baseline_workflow` | 参与者原有 CLI / Git 工作方式。 |
| `left_and_returned` | 是否发生，以及时间间隔。 |
| `return_natural_or_scheduled` | 自然、研究安排或未发生。 |
| `context_recovered` | 六个返回问题逐项结果。 |
| `cancel_need_arose`、`cancel_use_mode` | 未发生、自然使用或提示使用。 |
| `evidence_items_opened` | Agent Log、Diff、Verification、Change Package 等实际查看项。 |
| `review_decision` | Accept、Reject 或无法决定，以及证据引用。 |
| `external_terminal_needed` | 是否缺少关键事实。 |
| `control_mechanisms_actually_used` | Project 连续性、Task 契约、恢复、Cancel、证据验收等。 |
| `specific_control_benefit` | 具体行为与原话，不写泛化总结。 |
| `codex_result_quality` | Codex 代码结果单独评估。 |
| `codex_only_explanation` | 去掉控制面后，用户是否仍会同样复用。 |
| `facilitator_actions` | 与时间线对应的完整帮助记录。 |
| `qualifying_reuse` | 由第 6 节判定，不由主持人主观填写。 |
| `reuse_exclusion_reason_codes` | 可多选。 |

### 5.4 通过与失败信号

活动完成信号：3 名用户、5 个真实问题均有可审计原始记录；这只表示活动完成，不表示 Gate 通过。

A3 支持信号：

- 用户在真实任务中实际使用恢复、控制或证据验收机制；
- 至少两名独立用户能把具体行为收益归因到控制面，而不是只评价 Codex 代码质量；
- 返回场景中，用户能依据保存证据回答发生了什么、改了什么、Verification、决定和下一步；
- 合格复用满足第 6 节全部条件。

失败信号：

- 用户始终盯着短任务，恢复价值没有被真实触发；
- 控制机制未被打开或只在主持人提示时使用；
- Review 仍必须依赖外部终端或用户记忆补齐关键事实；
- 用户的再次使用只来自提醒、预分配、研究安排或 Codex 本身效果；
- 少于两名独立用户产生合格复用。

一次合格复用只允许继续小规模验证。至少两名独立用户合格复用且指出控制面具体收益，只允许有限产品化投资，不代表市场验证完成。A3 失败时，只从同一用户群已经出现的相邻真实问题重新收窄场景，不增加功能掩盖失败。

## 6. 活动四：自发复用资格审计

### 6.1 输入

- 首次问题完成记录；
- 新问题首次出现的外部事实；
- 观察窗内全部研究方联系日志；
- 新问题的入口选择和实际控制机制使用记录；
- Codex 代码结果与控制面收益的分开归因。

### 6.2 判定式

```text
qualifying_reuse =
  user_initiated
  AND new_real_problem
  AND NOT preallocated
  AND NOT reminded
  AND NOT research_scheduled
  AND entry_or_control_surface_self_selected
  AND control_mechanism_actually_used
  AND specific_control_benefit_recorded
  AND NOT codex_only
  AND exclusion_reason_codes IS EMPTY
```

一个用户多次合格复用仍只算一名独立用户。同一问题的继续执行、Reject 后新 Run、Cancel 后重跑或拆出的子问题不算新复用。

### 6.3 步骤

1. 比较新问题的 `first_observed_at` 与首次任务、招募和预分配记录。
2. 审查研究方联系日志；任何针对第二次使用的直接提醒都触发排除。
3. 判断新问题是否有独立目标和 DoD，而不是同一任务的 attempt 或人为拆分。
4. 确认入口或控制面由用户自行选择，而非主持人代选。
5. 用原始行为确认至少一个控制机制被实际使用。
6. 询问反事实：“如果只有同一个 Codex CLI 和代码结果，没有该控制机制，你是否仍会以同样方式回来？”将回答与行为一并记录。
7. 两名评审者按判定式独立编码；任一必要事实不明时按不合格处理，但可标为 `insufficient_evidence`。

### 6.4 记录字段与排除码

必填字段：`reuse_initiator`、`new_problem_first_observed_at`、`new_real_problem`、`preallocated_at`、`observation_window_ref`、`reminder_contact_log_ref`、`entry_selected_by`、`control_mechanisms_used`、`specific_benefit_quote_or_behavior`、`codex_only_counterfactual`、`qualifying`、`reviewer_decisions[]`、`exclusion_reason_codes`。每条 `reviewer_decisions[]` 保存评审者、独立结论、理由码和时间；汇总结论只能在两条独立记录完成后生成。

排除码：

- `PREALLOCATED`
- `REMINDER`
- `RESEARCH_SCHEDULED`
- `FACILITATOR_INITIATED`
- `SAME_TASK_CONTINUATION`
- `ARTIFICIALLY_SPLIT_PROBLEM`
- `NON_REAL_TASK`
- `INTEREST_ONLY`
- `NO_CONTROL_MECHANISM`
- `CODEX_ONLY`
- `INSUFFICIENT_EVIDENCE`

### 6.5 通过与失败信号

通过信号：全部必要条件都有原始证据，且两名评审者一致判为合格。

失败信号：任一排除码成立、必要事实不可核实，或只有口头兴趣而没有新真实问题和控制面行为。

失败动作：该次记录保留但不计自发复用；不得追加提醒“补做”一次。观察窗结束后按实际独立用户数作 Gate 决策。

## 7. 独立 Decision Record 模板

### 7.1 Project-native Decision Record

```markdown
# Project-native Decision Record

- Decision ID:
- Date:
- Owner:
- Record status: Draft / Final
- Protocol version:
- Evidence cutoff at:
- Evidence snapshot hash:
- Assumption: A1-P
- Independent question: B 相对 A 是否具有可由真实行为指出的独立收益？
- Decision: Keep / Modify / Remove

## Evidence snapshot
- A evidence refs:
- B evidence refs:
- A/B comparison coverage matrix:
- Excluded evidence and reasons:
- Variant parity / confound check:

## Observed behavior
- Recovery behavior:
- Evidence actually opened:
- Review behavior:
- Later active choice:
- Participant attribution:

## Counterevidence and limitations
- Evidence against:
- Facilitator effects:
- Codex-only effects removed:
- Unknowns:

## Decision rationale
- Why this decision follows from B vs A:
- Failure signal disposition:

## Required consequence
- PRD sections to change:
- Re-review required and owner:
- Next validation, if any:

## Explicit non-implications
- This record does not decide Task-first.
- This record does not decide Task aggregation.
- This record does not claim market validation.

## Sign-off
- Product decision owner:
- Evidence reviewer:
```

### 7.2 Task-first Decision Record

```markdown
# Task-first Decision Record

- Decision ID:
- Date:
- Owner:
- Record status: Draft / Final
- Protocol version:
- Evidence cutoff at:
- Evidence snapshot hash:
- Assumption: A1-T
- Independent question: 在 B/C 归档相同后，C 相对 B 是否仍有额外净收益？
- Decision: Keep / Modify / Remove

## Evidence snapshot
- B evidence refs:
- C evidence refs:
- B/C comparison coverage matrix:
- B/C archive parity evidence:
- Excluded evidence and reasons:

## Observed incremental behavior
- Active C choices:
- Task card facts actually reused:
- Execution / Verification / Review behavior changed:
- Added friction:
- Net benefit attribution:

## Counterevidence and limitations
- Evidence against:
- Prompted behavior removed:
- Project-native result not reused as proof:
- Unknowns:

## Decision rationale
- Why this decision follows from C vs B:
- Failure signal disposition:

## Required consequence
- PRD sections to change:
- Re-review required and owner:
- CLI-first alternative, if applicable:

## Explicit non-implications
- This record does not decide Project-native.
- This record does not decide Task aggregation.
- This record does not claim market validation.

## Sign-off
- Product decision owner:
- Evidence reviewer:
```

### 7.3 Task Aggregation Decision Record

```markdown
# Task Aggregation Decision Record

- Decision ID:
- Date:
- Owner:
- Record status: Draft / Final
- Protocol version:
- Evidence cutoff at:
- Evidence snapshot hash:
- Assumption: A2
- Independent question: Task 是否能稳定聚合候选领域事实？
- Decision: Keep / Modify / Remove

## Evidence snapshot
- 9-instance frozen index:
- Distinct actual end-to-end trajectory evidence index:
- Additional instances:
- Excluded evidence and reasons:

## Fit results
- natural_fit count:
- strained_fit count:
- model_break count:
- Frozen first-9 instances requiring giant Task:
- Frozen first-9 instances requiring special FK:
- Frozen first-9 instances with ambiguous ownership:
- Exception lifecycle cases:

## Alternatives considered
- WorkItem:
- ExecutionRequest:
- ChangeSet:
- Run-first:
- Other:

## Counterevidence and limitations
- Reviewer disagreements:
- Uncovered trajectories:
- Unknowns:

## Decision rationale
- Why this decision follows from real instances:
- Two-or-more frozen first-9 exception rule disposition:

## Required consequence
- Task-aggregation evidence supports later freeze after joint gate: yes / no
- PRD sections to change:
- Re-review required and owner:

## Explicit non-implications
- This record does not decide Project-native.
- This record does not decide Task-first.
- This record alone does not authorize production Schema/API freeze.
- This record does not claim market validation.

## Sign-off
- Product decision owner:
- Domain reviewer:
```

## 8. Product Validation Gate Decision Record 模板

```markdown
# Product Validation Gate Decision Record

- Gate decision ID:
- Date:
- Owner:
- Record status: Draft / Final
- Protocol version / evidence snapshot hash:
- Evidence cutoff at:
- Verdict: PASS / CONTINUE_VALIDATION / FAIL_AND_REVISE

## Independent decision records
- Project-native DR ref and decision:
- Task-first DR ref and decision:
- Task Aggregation DR ref and decision:
- Independence check completed by:

## PRD revision check
- Modify / Remove decisions present:
- Required PRD changes:
- Changes completed:
- Affected boundaries re-reviewed:
- Review refs:

## Concierge completion
- Participants completed: / 3
- Real problems completed: / 5
- Problems excluded as non-real:
- Control mechanisms actually used:
- Evidence of control-plane value beyond Codex:

## Reuse qualification
- Qualifying independent users: / 3
- Qualifying reuse evidence refs:
- Excluded reuse refs and reason codes:
- Reminder / preallocation audit complete:

## Gate checklist
- A/B and B/C comparable-observation coverage met: yes / no
- Six distinct actual end-to-end trajectories verified: yes / no
- Concierge 3 participants / 5 real problems completed: yes / no
- Three independent DRs are final: yes / no
- Modify / Remove consequences are reflected and re-reviewed: yes / no / not applicable
- Concierge shows specific control-plane value: yes / no
- At least two independent users have qualifying reuse: yes / no

## Decision rationale
- Supporting evidence:
- Counterevidence:
- Known limitations:
- Why the verdict follows from the checklist:

## Authorized next action
- Continue validation / revise PRD / limited productization consideration:

## Explicit non-authorizations
- This Product Gate alone does not authorize product MVP WWA or implementation planning.
- It does not authorize production Schema/API freeze.
- It does not authorize Project / Task product UI.
- It does not claim market validation.
- Technical Gate must independently pass before WWA.

## Sign-off
- Product decision owner:
- Evidence reviewer:
- PRD revision reviewer, if applicable:
```

三个子决策不必全部为 `Keep`。`Modify / Remove` 可以进入 Product Gate，但必须先真实修改受影响 PRD 并重新评审。若任何必要检查未完成，Verdict 只能是 `CONTINUE_VALIDATION` 或 `FAIL_AND_REVISE`。

## 9. 执行顺序与停止规则

1. 先冻结协议版本、样本选择规则、入口轮换、观察窗和联系规则。
2. A/B/C 低保真对照、领域模型走查和礼宾首任务可以并行准备。
3. 先完成三个独立 Decision Record，再形成 Product Validation Gate Decision Record。
4. 任一 `Modify / Remove` 先进入 PRD 修订和受影响边界重评，不能由 Gate 主持人口头豁免。
5. Product Validation Gate 即使通过，也必须等待独立 Technical Gate；两者同时通过才允许进入产品 MVP WWA。
6. 一次合格复用只允许继续小规模验证；两名独立用户合格复用只允许有限产品化投资。任何阶段都不得写成市场验证完成。
