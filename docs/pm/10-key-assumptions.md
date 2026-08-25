# Agentic Work OS：进入开发前关键假设

> 状态：进入完整 MVP 开发前，待完成关键验证与 Milestone 0 PoC  
> 日期：2026-08-24  
> 范围：只判断会导致 MVP 边界错误、核心模型错误或数周返工的假设，不重新开展完整市场发现。

## 1. 结论先行

**当前不应按上下文中的“建议 MVP 范围”直接展开完整开发。** 可以立即进行有边界的用户验证和技术 PoC，但在 Top 5 假设取得证据前，不应先建设通用 Workflow Runtime、完整 Project 管理面、独立 Runner Daemon 或重型 Evidence / Approval / Timeline 模型。

当前材料能证明的是：产品定义内部自洽、黄金路径覆盖了拟验证的能力、已有架构研究提供了可参考的实现边界。当前材料**不能证明**：目标用户有足够强的采用动机、Task-first 优于 CLI-first、代码修复场景会带来重复使用，或本地执行链路已经技术可行。

本轮最终保留的 Top 5 是：

1. Project-native 连续性有独立价值，并且 Task-first 相对 CLI-first 还有额外净收益；
2. Task 是正确的中心领域对象；
3. 第一条代码问题修复黄金场景足以验证独立且可重复的产品价值；
4. Workflow 必须成为第一版一等、可配置能力，固定黄金流程不足以交付同等价值；
5. Codex Adapter、Windows 本地 Runner 与 Workspace 能组成可靠的首个执行闭环。

其中 1～4 会改变 MVP 边界或核心模型，必须在大规模编码前验证；第 5 项必须作为 Milestone 0 技术 PoC，而不能等 UI 和领域功能完成后再验证。A9 虽未进入 Top 5，仍是需要与 A1 同轮完成的次级分群门槛，不能在冻结第一用户时遗漏。

## 2. 方法与证据边界

本分析读取并使用：

- [00-project-context.md](./00-project-context.md)；
- [01-pm-skills-runbook.md](./01-pm-skills-runbook.md) 的“识别关键假设”章节；
- `identify-assumptions-new` Skill 的产品经理、设计师、工程师三视角，以及 Value、Usability、Viability、Feasibility、Ethics、Go-to-Market、Strategy & Objectives、Team 八类风险框架。

### 证据声明

- 本次读取的输入材料未提供用户访谈、行为数据、采用数据或已运行的技术 PoC。
- 文档中的“发起背景”“强共识”“黄金场景”和开源项目研究综合，均属于**内部问题陈述、设计证据或架构参考**，不是已经验证的用户需求。
- 下文的样本数、通过信号和失败信号是建议的实验判据，不是已经取得的数据。
- 本轮没有新增竞品研究，也没有对市场规模、定价或渠道做无边界扩展。

### 评级口径

- **影响：致命**——假设为假会推翻产品主张、首个场景或核心聚合模型；**高**——会删除或重构一个主要平面、执行边界或治理能力。
- **信心：低**——只有内部主张；**中低**——逻辑自洽或有成熟技术原语可参考，但没有本项目直接证据；本轮没有任何假设达到“高信心”。
- **处置分类**严格使用四类：进入开发前必须验证、可以接受风险直接构建、可在实现中通过 PoC 决定、延后处理。

## 3. 候选关键假设总览

“三大 Plane 是否都必须进入第一版”在本轮被拆为三个可独立判断的命题：Project 的最小价值由 A1 验证，Agent Execution 的可行性由 A5 验证，Workflow 是否必须成为一等能力由 A4 验证。**一条运行路径可以在内部贯穿三个 Plane，但这不等于第一版必须建设三个完整、独立或都对用户可见的产品面。**

| ID | 可证伪假设 | 主要风险维度 | 影响 | 当前信心 | 处置 | 一旦为假 |
|---|---|---|---|---|---|---|
| A1 | Project-native 连续性有独立价值，且 Task-first 相对 CLI-first 还有额外净收益 | Value / Usability / Strategy | 致命 | 低 | 进入开发前必须验证 | **改变 MVP 边界** |
| A2 | Task 能稳定承载意图、DoD、生命周期，并聚合多次 Run 与 Evidence | Strategy / Usability / Feasibility | 致命 | 低 | 进入开发前必须验证 | **改变核心架构** |
| A3 | 单 Agent 代码问题修复足以验证独立、可重复的产品价值 | Value / Strategy | 致命 | 低 | 进入开发前必须验证 | **改变 MVP 边界** |
| A4 | 固定黄金流程不足以交付同等价值，Workflow 必须成为第一版一等、可配置能力 | Value / Strategy / Feasibility | 致命 | 低 | 进入开发前必须验证 | **同时改变 MVP 边界与核心架构** |
| A5 | Codex Adapter、Windows 本地 Runner 与 Workspace 能可靠完成首个执行闭环 | Feasibility / Ethics | 致命 | 低 | 可在实现中通过 PoC 决定 | **同时改变 MVP 边界与核心架构** |
| A6 | MVP 只需保存中断历史，不需要在应用或 Runner 重启后重新接管在途 Agent | Usability / Feasibility / Strategy | 高 | 中低 | 可在实现中通过 PoC 决定 | **改变 Runner、Session 与恢复架构** |
| A7 | Git Worktree 适合作为目标用户真实仓库的默认 Workspace Provider | Feasibility / Usability / Ethics | 高 | 低 | 可在实现中通过 PoC 决定 | 改变默认 Workspace 策略，通常不改领域核心 |
| A8 | 最小 Evidence、单一 Review Gate 和关键里程碑足以建立信任，无需重型 Receipt、Approval、Timeline | Value / Usability / Ethics | 高 | 中低 | 可以接受风险直接构建 | 改变治理产品边界，必要时扩展数据模型 |
| A9 | “个人开发者”和“技术负责人”具有足够相似的首要 Job，可由同一 Local-first MVP 服务 | Viability / Go-to-Market / Usability | 高 | 低 | 进入开发前必须验证 | **改变首发用户与 MVP 边界** |

Team 风险未单列：输入材料没有团队规模、能力结构或维护预算，无法负责任地判断“团队能否长期支持多 Runtime”。它应在 PRD 或实施规划中作为资源约束补充，不能为了覆盖八类框架而虚构结论。

## 4. 逐项假设与最低成本验证

### A1. Project-native 连续性有价值，且 Task-first 还有额外净收益 `Top 5`

**可证伪假设（两层比较，必须分别判定）**

1. **Project-native 价值：** 即使用户仍从 CLI 启动，把 Run、状态和证据自动归入 Project 也会比孤立 Session 更容易恢复和验收，并值得重复使用；
2. **Task-first 增量：** 在 Project-native 价值成立的前提下，从 Task 发起和管理 Agent 所增加的录入与界面切换，小于它节省的上下文准备、干预和收尾成本。

- **影响：致命。** 它决定 Project Plane、Task-first 主入口和独立产品是否成立。
- **当前信心：低。**
- **已有证据：** 项目背景记录了跨工具复制上下文、观察执行、核对结果和回写状态的割裂；黄金路径给出了理论上的统一体验。这些是内部问题陈述和方案逻辑，不是目标用户行为证据。
- **缺失证据：** 痛点发生频率和损失程度；用户现有的 terminal、IDE、tmux、Issue 或脚本方案是否已足够；创建和维护 Task 的额外成本；用户下一次真实选择。
- **最便宜验证：** 找 6 名符合画像的人（个人开发者与技术负责人各 3 名），各复盘最近 3 次真实 Coding Agent 任务并展示实际遗留物；随后对比 A=`直接 CLI、无项目归档`、B=`CLI-first + 自动 Project / Run 归档`、C=`Task-first + 同样归档` 三种低保真流程。B 对 A 验证 Project-native 价值，C 对 B 验证 Task-first 增量；后台都调用同一个 CLI。
- **失败信号：** 若 B 相对 A 没有改善恢复或验收，Project-native 命题失败；若 B 有价值但用户在下一项任务选择 B 而非 C，则只有 Task-first 命题失败。两种失败不得混为一个结论。
- **处置：进入开发前必须验证。**
- **若为假：** 若 Project-native 命题失败，将 MVP 收缩为 CLI Session / Run companion 或结果报告工具，不建设独立 Project 管理面；若 Project-native 成立但 Task-first 失败，则保留 Project 归档与恢复，改为 CLI-first 自动导入 / 关联，取消强制 Task 启动、完整 Task CRUD 和看板。两条路径都会改变 MVP 边界，但收缩程度不同。

### A2. Task 是正确的中心领域对象 `Top 5`

**可证伪假设**  
真实工作的目标、完成标准和生命周期可以稳定归属于一个 Task；同一 Task 可以拥有多个 Run / Attempt，并关联 Session、Workspace、Diff、测试结果和人工决定，而不会频繁出现无 Task 的探索运行、一个 Run 跨多个 Task、一个变更跨多个仓库或 Task 与 Issue / PR 多对多冲突。

- **影响：致命。** 它决定数据库聚合、API、导航、事件归属和状态回写。
- **当前信心：低。**
- **已有证据：** `Task-executable` 定义和 Task / Run / Event / Artifact 关系在内部模型上自洽；“Task 是主要契约”是当前强共识。参考项目只能证明这种模型可存在，不能证明它匹配目标用户。
- **缺失证据：** 探索、重试、定时工作、父子任务、外部 Issue、跨仓库改动和 Session 恢复的真实基数关系；用户恢复工作时首先寻找的对象；“完成”属于 Task、Run 还是 ChangeSet。
- **最便宜验证：** 从 3 名目标用户各取 3 个最近真实工作实例，做一次轻量 Event Storming，并用至少 6 条状态轨迹走查成功、失败重试、取消再跑、换 Runtime、Session 恢复和 Workspace 丢失。只允许使用 Task、Run / Attempt、Session、Workspace、Event、Artifact 建模。
- **失败信号：** 两个以上代表性实例必须依赖“巨型 Task”、大量特殊字段或多重归属才能表达，或无法清楚回答“当前是谁的第几次尝试、为何处于此状态”。
- **处置：进入开发前必须验证。**
- **若为假：** 在核心 Schema / API 落地前改用更中性的 WorkItem / Objective、ChangeSet 或 ExecutionRequest；Task 变为一种类型或投影，操作层可能改为 Run-first。否则所有外键和生命周期都会返工。

### A3. 代码问题修复黄金场景足以验证独立且可重复的价值 `Top 5`

**可证伪假设**  
“Task → 本地 Codex → 独立 Workspace → 补充输入 / 取消 → Diff → 测试 →人工 Review”是第一用户足够高频、足够痛且需要治理的工作；它能验证控制面的独特价值，而不只是证明另一个 Agent 终端也能跑一次任务。

- **影响：致命。** 错选场景会让团队围绕错误的价值信号构建三大 Plane。
- **当前信心：低。**
- **已有证据：** 场景来自既有开发者工作归纳，能同时产生可观察的 Diff、测试和人工验收，并覆盖拟验证的产品能力；没有真实完成、复用或替代方案比较记录。
- **缺失证据：** 场景频率、持续时间、失败与接管率；用户是否真实使用测试、审批、历史和恢复；价值来自控制面还是 Codex 本身；第二次使用行为。
- **最便宜验证：** 用现有 Codex CLI、表单、脚本和人工编排，为 3 名目标用户礼宾式完成共 5 个真实代码问题，不先造 Workflow Runtime。记录是否到达可审核 Patch、哪些控制能力被实际使用，以及用户是否愿意提交第二项真实任务。
- **失败信号：** 用户全程盯终端且不需要恢复或治理；Diff + CLI 已足够完成验收；或任务完成后没有重复使用意愿。
- **处置：进入开发前必须验证。**
- **若为假：** 只从同一批用户已经发生的任务中选择更需要治理的相邻场景，例如依赖升级、回归修复或带发布约束的变更；重新收窄 Golden Path，不通过增加更多 Agent、Workflow 节点或竞品研究掩盖场景无价值。

### A4. Workflow 必须成为第一版一等、可配置能力 `Top 5`

**可证伪假设**  
对于唯一黄金路径，Task / Run 加一个可恢复的固定协调器或状态机不足以交付价值；用户确实需要定义、绑定、修改或复用 Agent → Script → Approval → Task Transition 的流程，因此第一版必须拥有 WorkflowDefinition、NodeRun、版本和 YAML / JSON 解释执行。

- **影响：致命。** 这是最容易造成数周过度建设的范围与架构假设。
- **当前信心：低。**
- **已有证据：** 黄金路径确有顺序、暂停、重试和状态回写；三 Plane 垂直切片是内部强共识。同时，项目只有一条流程，且“最小 DAG、固定状态机还是硬编码流程”被明确列为开放决策。
- **缺失证据：** 第二条必须改变顺序或复用的真实 Workflow；用户编辑或选择 Workflow 的需求；固定流程与解释器在恢复正确性和实现成本上的比较。
- **最便宜验证：** 先在 A3 礼宾测试中使用固定配方，观察用户是否真实改变顺序、跳过阶段或复用第二条流程；只有出现这种行为证据时，再 time-box 比较固定持久化 FSM 与只支持 Agent / Script / Approval / Transition 的小解释器，评估崩溃恢复、重试幂等和增加第二条流程的改动量。
- **失败信号：** 真实任务不需要改变或复用顺序，固定 FSM 能覆盖全部首版验收，Workflow UI 不影响用户决策。
- **处置：进入开发前必须验证。**
- **若为假：** MVP 仍可贯穿 Project 与 Agent，但 Workflow 只作为内部固定执行配方；删除 WorkflowDefinition、YAML / DAG、通用节点模型和独立 Workflow UI，仅保留 Run、阶段状态、Event 和未来扩展接缝。

### A5. 本地执行底座可以可靠闭合黄金路径 `Top 5`

**可证伪假设**  
在目标 Windows 本机环境中，至少一种 Codex 控制接口与 Node / TypeScript 本地 Runner、Workspace Provider 组合后，能稳定支持指定 cwd、输出流、补充输入、取消完整进程树、唯一终态、Run / Session 关联、隔离变更和 Diff 收集；实现不需要解析易变的人类终端文案来伪造结构化事件。

- **影响：致命。** 它决定首个 Runtime、AgentDriver 合同、Runner 边界和交互承诺。
- **当前信心：低。**
- **已有证据：** 项目明确不重写 Agent Loop，并为 Adapter、Runner、Session、Workspace 预留了边界；开源架构研究提供了模式参考。本次读取的输入材料未提供真实命令、事件帧、进程树或 Windows 行为 PoC。
- **缺失证据：** Codex 可用控制接口和能力等级；登录态、交互提示、退出码与 Session ID；ConPTY / 子进程树行为；空格、中文和长路径；断连、取消、失败和清理语义。
- **最便宜验证：** 将其设为 Milestone 0：先用可控 mock CLI 验证 child / grandchild、stdout / stderr、输入、超时、取消和唯一终态；再在一次性 Git 仓库中用真实 Codex 验证启动、流式输出、补充输入、取消、退出、Diff 与 Run / Session 关联。保存原始 I/O 和明确的 Adapter capability matrix。
- **失败信号：** 必须依赖脆弱的终端文案解析；无法可靠终止后代进程；终态可重复或丢失；Workspace 发生串写或数据损失；关键能力无法诚实降级。
- **处置：可在实现中通过 PoC 决定。** 这是 PoC 开发，不是产品功能开发；未通过不得扩展 UI 和三 Plane。
- **若为假：** 若 Adapter 失败，更换首个 Runtime 或改用官方结构化接口，并可能把 MVP 降为启动 / 观察 / 手工接管；若进程控制失败，引入 Windows 原生辅助进程或独立 Runner；若隔离失败，更换 Workspace 策略。任何关键边界无法替换时才收缩平台承诺。它会同时改变 MVP 边界和核心执行架构。

### A6. 首版不需要恢复在途 Agent，只需保留可解释历史

**可证伪假设**  
浏览器页面关闭只造成 UI 连接断开，不应终止仍然存活的 Runner；但 Web Server / Runner 崩溃或电脑重启造成执行进程丢失后，将 Run 标记为 `interrupted` / `lost` 并保留 Event、日志和 Artifact 已经可以接受。首版不需要跨进程重新连接原生 Session、继续补充输入或恢复等待中的 Approval。

- **影响：高。** 它决定是否必须从第一版引入持久 Runner、IPC 重连、heartbeat、lease 和 reconciliation。
- **当前信心：中低。**
- **已有证据：** 最低标准只明确“重启后仍能查看历史”，Session ID 也是“如果 Runtime 提供”；但 Human-governed 又强调暂停、补充和接管，二者之间尚无冻结语义。
- **缺失证据：** 用户对五类中断的容忍度；Codex Session 是否可重连；本地 Runner 与 Server 同生命周期时的真实失败行为。
- **最便宜验证：** 分别写清 UI 断连、Server 崩溃、Runner 崩溃、电脑重启、Codex 自身退出五个故事，让目标用户选择可接受终态；再在 A5 PoC 中先验证 UI 重连到存活运行，再强杀各进程验证历史归档和原生 Session 可重连能力。
- **失败信号：** 用户要求应用重启后继续控制运行，或无法接受丢失等待中的输入 / Approval。
- **处置：可在实现中通过 PoC 决定。**
- **若为假：** 独立持久 Runner、Session / Run 映射、重连协议、lease / heartbeat / reconciliation 必须进入首版，核心执行架构随之改变。

### A7. Git Worktree 是安全、低摩擦的默认 Workspace Provider

**可证伪假设**  
对目标用户的真实仓库，Git Worktree 能提供并发和变更隔离，同时不会因脏工作区、未跟踪文件、已有 Worktree、分支占用、submodule / LFS、路径和权限问题让“交给 Agent”高频失败或产生数据损失。

- **影响：高。** 它决定首版的安全边界、并发承诺和启动摩擦。
- **当前信心：低。**
- **已有证据：** 黄金路径要求独立 Workspace；Git Worktree 只是候选，`direct directory vs worktree` 仍是开放决策；WorkspaceProvider / Lease 边界已有内部共识。
- **缺失证据：** 真实仓库矩阵、创建耗时、磁盘占用、清理幂等、临时分支心智负担和失败恢复。
- **最便宜验证：** 对 3 个代表性仓库的临时副本做 clean、dirty、untracked、已有 Worktree、路径含空格 / 中文，以及实际存在时的 submodule / LFS 矩阵；验证 create → Agent 写入 → Diff → cleanup 的幂等和可恢复性。
- **失败信号：** 常见仓库状态无法无损创建或清理，或用户必须先理解和手工维护临时分支 / Worktree。
- **处置：可在实现中通过 PoC 决定。**
- **若为假：** 默认改为 direct directory + 每 Workspace 单运行、临时 clone 或用户提供目录；保留 WorkspaceProvider 抽象即可，通常不必改变 Task / Run 核心模型。

### A8. Completion Evidence、Approval 和 Timeline 可以保持“薄”

**可证伪假设**  
首版只需保存原始 Event 和 Artifact，并展示一份紧凑的完成摘要——目标 / DoD、终态、Diff / Commit、测试命令与结果、失败或跳过项、发生过的人工决定、未决风险——再加一个最终 Review Gate 和关键里程碑；无需完整 CompletionReceipt 聚合、通用审批引擎或逐事件 Timeline 产品。

- **影响：高。** 过度设计会扩大 Schema、状态恢复和 UI；设计过薄则会削弱信任和诊断。
- **当前信心：中低。**
- **已有证据：** 黄金路径天然产生日志、Diff、测试和批准记录；可观察、可干预、可追溯是内部强共识。没有证据表明个人开发者需要多人会签、Policy DSL、证据评分或完整事件流 UI。
- **缺失证据：** 用户做出接受 / 拒绝决定所需的最小字段；哪些动作必须批准；恢复任务时真正查询的时间点；自动摘要的可信度。
- **最便宜验证：** 用同一批已完成运行制作三种静态结果页：原始日志、Diff + 测试摘要、结构化 Evidence + Approval + Timeline；让用户判断是否可合并、为何失败、下一步是什么。比较判断正确性、查找时间和实际下钻行为；再用真实动作卡分拣“自动 / 通知 / 先批准 / 禁止”。
- **失败信号：** 原始 Diff / Test 已足够，则删除独立 Evidence 产品层；反之若用户无法在薄摘要中正确验收或需要可恢复审批，则将相关对象提前升级。
- **处置：可以接受风险直接构建。** 默认只构建 append-only Event、Artifact 引用、关键里程碑、最小摘要和一次人工 Review；专门 Timeline、通用 Approval 与复杂 Receipt 不属于本项的直接构建边界，暂不纳入 MVP。
- **若为假：** 若价值不足，UI 收缩为 Run Summary；若强审计和可恢复审批是刚需，则 Approval / CompletionReceipt 成为一等对象，并提前引入稳定 ID、版本、幂等决定和 provenance。它会扩展核心数据模型，但不一定改变黄金场景。

### A9. 个人开发者与技术负责人可以作为同一第一用户

**可证伪假设**  
两类用户的首要 Job、安装意愿、异步委派方式、审批需求和成功标准足够相似，可以共享同一 Local-first MVP，而不会同时优化“个人效率工具”和“团队治理平台”。

- **影响：高。** 错误分群会悄然引入交接、多人审核、权限、通知和部署范围。
- **当前信心：低。**
- **已有证据：** 只有项目上下文中的合并画像；没有分群访谈、行为或安装数据。
- **缺失证据：** 两类用户的任务规模、协作者数量、验收人、运行环境所有权、控制诉求和采用阻力。
- **最便宜验证：** 与 A1 同轮，在同一组 6 人中覆盖个人开发者与技术负责人各 3 名，复盘最近一次真实 Agent 代码任务，比较触发点、等待点、验收人、遗留证据和是否愿意在本机安装 Runner。
- **失败信号：** 技术负责人首先需要委派、交接和团队审核，而个人开发者首先要求零配置和不中断现有 CLI；两者的首个成功时刻明显不同。
- **处置：进入开发前必须验证。** 它不要求重新研究整个市场，只要求从两个已声明候选中选一个。
- **若为假：** 首版只选一类。若选个人开发者，去掉团队治理语言和多人能力；若选技术负责人，黄金场景必须包含真实交接 / 审核，部署与权限边界也需重写。

## 5. 最终 Top 5 Load-bearing Assumptions

按“为假时破坏程度 × 当前不确定性 × 验证成本”排序，只保留下列五项作为最高优先级的 load-bearing decision gates。A9 仍属于进入开发前必须确认的首发分群问题，但与 A1 使用同一组参与者和材料完成，不增加独立研究阶段。

| 排名 | 假设 | 最低成本门槛 | 假设为假时的默认动作 |
|---|---|---|---|
| 1 | **A1：Project-native 连续性有独立价值，且 Task-first 还有额外净收益** | A / B / C 三流程对照，分别观察 Project 归档价值与第二个真实任务的入口选择 | Project 价值失败则改 Session / Run companion；仅 Task-first 失败则保留 Project、改为 CLI-first 自动关联 |
| 2 | **A2：Task 是正确的中心领域对象** | 9 个真实工作实例的 Event Storming + 6 条执行轨迹；不能依赖大量例外才能成立 | 在 Schema / API 前改为 WorkItem / Objective、ChangeSet 或 Run-first 模型 |
| 3 | **A3：代码问题修复黄金场景能产生独立、可重复价值** | 3 名目标用户、5 个真实问题的礼宾测试；观察可审核结果、实际使用的治理能力和再次提交行为 | 更换为同一用户群中更需要治理的相邻场景，重新收窄 Golden Path |
| 4 | **A4：Workflow 必须成为第一版一等、可配置能力** | 先观察固定配方是否被真实改序 / 复用；出现第二条流程后才比较 FSM 与四节点解释器 | Workflow 降为内部固定配方，删除 YAML / DAG、WorkflowDefinition 和独立 UI |
| 5 | **A5：本地执行底座能可靠闭合黄金路径** | mock CLI 进程树测试 + 真实 Codex 一次性仓库 Spike；覆盖输入、取消、断连、终态、Session 关联和隔离 Diff | 换 Runtime / 结构化接口、引入原生或独立 Runner，或收缩为启动 / 观察 / 手工接管 |

## 6. 进入开发前的最小验证包

为了避免把本轮重新扩展成市场发现，只执行四个有边界的验证包：

1. **最近真实任务复盘：** 6 名符合画像的人（个人开发者与技术负责人各 3 名），验证 A1、A9；不讨论泛化愿景，只看最近真实行为和遗留物。
2. **Task-vs-CLI 礼宾测试：** 3 名用户、5 个真实代码问题，后台继续使用现有 CLI，验证 A1、A3，并顺带观察 A8。
3. **领域模型桌面演练：** 9 个真实工作实例和 6 条状态轨迹，验证 A2；在结果出来前不冻结核心 Schema。
4. **Milestone 0 技术 Spike：** 先验证 A5，再验证 A6、A7；未通过前不扩展 Project、Workflow 和治理 UI。

### 可逆实验基线（不是 MVP 决策）

为取得验证证据或完成 PoC，可以优先使用最窄、可逆的 Walking Skeleton：一个 Project / Task 入口、一个真实 Codex Adapter、一条固定 Agent → Test → Review 配方、最小 Event / Artifact 与单一 Review Gate；无需先实现通用 Workflow Runtime、完整看板、独立 Runner Daemon、Session Resume、复杂 Approval、专门 Timeline 或 Completion Evidence 平台。

这只是降低实验成本的实现基线，不代表 MVP 范围或核心 Schema 已冻结。后续应根据用户证据和 PoC 结果删除、替换或纳入相应能力。
