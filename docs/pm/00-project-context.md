# Agentic Work OS：项目上下文包

> 用途：作为 `pm-skills` 需求阶段的统一输入。所有 Assumption、PRD、Red Team 和 WWA 输出都应以本文为上下文，不要从零重新解释项目。
>
> 状态：需求收敛前的工作基线，不是最终 PRD。
>
> 更新时间：2026-08-24

---

## 1. 项目一句话定义

**Agentic Work OS 是一个项目原生的人机协同工作控制面：它用 Project 和 Task 保存意图与状态，用 Workflow 组织确定性流程，用可插拔 Agent Runtime 执行需要推理和适应的工作，并把执行事件、产物、审批和经验重新沉淀回项目。**

面向产品表达，可以简化为：

> 让项目成为上下文，让流程成为骨架，让 Agent 成为执行者，让每一次工作都沉淀为下一次工作的能力。

当前项目名仍为工作名称，未来可以使用：

- Agentic Work OS
- Agentic Project OS
- Project-Native Agentic Work Control Plane

命名不是本轮 MVP 的阻塞项。

---

## 2. 发起背景

项目来自开发者日常工作的真实割裂：

- Project、Issue、需求、版本和生命周期存在于 Jira、表格、GitLab、文档等不同系统；
- n8n、Dagu、脚本和 CI 可以执行流程，但不理解项目意图、任务责任和完成标准；
- Codex、Claude Code、Hermes、OpenCode 等 Agent 可以执行复杂工作，但 Session、Workspace、产物和项目状态彼此割裂；
- 人需要在多个界面之间反复复制上下文、观察执行、补充输入、核对结果和手工更新状态；
- Agent 与 Workflow 完成的工作没有稳定沉淀成可复用的项目知识、Skill、Workflow 或经验。

核心问题不是缺少另一个聊天 Agent，而是缺少一个统一的工作控制面来回答：

```text
为什么做？
做什么？
当前处于什么状态？
由谁或哪个 Agent 执行？
按什么流程执行？
执行发生在哪里？
现在正在等待什么？
产生了什么可验证结果？
哪些经验可供下一次复用？
```

---

## 3. 目标用户与第一使用者

### 第一使用者

拥有以下特征的个人开发者或技术负责人：

- 同时使用本地 Coding Agent、脚本、Git、Issue、CI/CD 和项目管理工具；
- 希望让 Agent 参与真实代码修改、测试、审查、文档和发布工作；
- 仍然需要观察、暂停、补充输入、审批和接管；
- 重视本地环境、已有订阅、已有 CLI 登录状态和自托管数据；
- 不希望为了使用 Agent 再部署一组沉重的企业平台。

### 当前明确不优先的用户

- 大型企业的多租户管理者；
- 只需要聊天机器人的普通消费者；
- 需要完整替代 Jira、Asana 或 Linear 的成熟 PM 团队；
- 只需要 n8n 类 SaaS 集成自动化的运营用户。

---

## 4. 产品核心主张

### 4.1 Project-native

每一次 Workflow Run、Agent Run、Approval 和 Artifact 都应归属于 Project 或 Task，而不是形成孤立会话。

### 4.2 Task-executable

Task 不只是待办记录，而是人与执行系统之间的工作契约，至少应包含：

- 目标与预期结果；
- 项目和仓库上下文；
- 执行者或 Runtime；
- 可使用的 Workflow；
- 权限和限制；
- Definition of Done；
- 期望 Artifact 和验证证据。

### 4.3 Agent-agnostic

系统不绑定单一 Agent。Agent 的长期身份、能力和任务历史，应与实际 Runtime 解耦。今天可以由 Codex 执行，未来可以切换到 Claude Code、Hermes、OpenCode、Pi 或外部 Agent Service。

### 4.4 Human-governed

用户必须能够：

- 查看当前状态和执行原因；
- 查看实时输出、事件、Diff 和 Artifact；
- 补充输入；
- 批准或拒绝高风险动作；
- 暂停、取消、重试或接管执行。

### 4.5 Event-driven and auditable

Project、Workflow、Agent 和外部系统之间通过结构化事件衔接。MVP 不必采用完整 Event Sourcing，但应使用：

```text
关系数据库保存当前状态
+
Append-only Event 表保存执行事实
+
Artifact 索引保存结果证据
```

### 4.6 Capability-compounding

每一次完成工作，都应有机会沉淀至少一种可复用资产：

- Context；
- Decision；
- Script；
- Workflow；
- Skill；
- Prompt；
- Template；
- Failure Pattern；
- Human Feedback；
- Verified Artifact。

这项能力是长期差异化方向，但不要求在第一版实现完整的自动知识提炼。

---

## 5. 产品的核心平面

### 5.1 Project Plane：意图与状态

回答：为什么做、做什么、现在在哪里。

核心对象：

```text
Project
Task / WorkItem
LifecycleState
Goal
Actor
ExternalReference
Decision
```

Project Panel 不需要成为所有外部数据的原始存储。它更像“工作投影与控制层”：外部系统提供事实，Workflow 将事实转换为领域命令，Project Plane 将其组织成可观察、可干预的生命周期。

### 5.2 Workflow Plane：确定性编排

回答：什么时候做、按什么顺序做、如何重试和审批。

核心能力：

```text
Trigger
DAG / Graph
Script Node
HTTP / MCP Node
Agent Node
Condition
Human Approval
Wait / Resume
Retry / Timeout
Task Transition
External Runtime Adapter
```

原则：

> Workflow 决定边界、顺序和治理；Agent 决定边界内的具体行动。

长期可接入 n8n、Dagu、Windmill、Temporal 或其他 Runtime，但它们不应拥有 Project Domain。

### 5.3 Agent Execution Plane：自适应执行

回答：由哪个 Agent、在哪个环境、以什么权限可靠执行。

系统不重新实现 Claude Code、Codex 或 Hermes 的 Agent Loop，而是在其上构建控制面：

```text
Agent Registry
Runtime Profile
Runner / Daemon
Session Manager
Agent Driver / Adapter
Workspace Provider
Sandbox Provider
Capability Grant
Approval Gateway
Event Normalization
Artifact Collector
Completion Receipt
```

### 5.4 Collaboration 与 Memory：横切能力

长期方向包括：

- Agent 作为团队身份，而不只是进程；
- Channel、Comment、Progress、Blocker、Review 等协作事件；
- Current Truth、Decision、Episode、Procedure、Feedback 和 Evidence；
- Context Compiler 根据任务动态组装上下文；
- 事件、知识和 Artifact 可搜索、可追溯、可验证。

MVP 只需要最小 Event Timeline 和 Artifact，不需要完整团队协作或知识图谱。

---

## 6. 核心领域边界

必须明确区分：

```text
AgentMember ≠ RuntimeProfile ≠ RunnerNode ≠ Session ≠ Run ≠ Workspace ≠ Sandbox
```

- **AgentMember**：长期团队身份和角色，如 `backend-developer-agent`。
- **RuntimeProfile**：具体执行配置，如 `codex-local-high`。
- **RunnerNode**：真正运行进程的机器或 Daemon。
- **Session**：外部 Agent Harness 的原生上下文，如 Codex thread。
- **Run / Attempt**：一次业务执行及其重试。
- **WorkspaceLease**：某次执行占用的代码空间，如 Git Worktree。
- **SandboxLease**：可选的安全执行环境。

第一版可以简化实体数量，但数据和接口不应把这些概念永久压成一个 `Agent` 字段。

---

## 7. 当前最重要的黄金场景

### 场景：从一张任务卡驱动本地 Coding Agent 修复代码问题

```text
用户创建 Project 和 Task
        ↓
填写目标、仓库、基础分支和完成标准
        ↓
点击“交给 Agent”
        ↓
系统创建 Workflow Run / Agent Run
        ↓
为任务准备独立 Workspace
        ↓
启动本机 Codex（首个候选 Runtime）
        ↓
实时展示输出和运行状态
        ↓
收集文件变更 / Diff / Commit
        ↓
执行测试命令
        ↓
等待人工审核
        ↓
保存日志、Diff、测试结果和批准记录
        ↓
Task 自动进入 Review
```

这个场景要同时验证：

| 平面 | 验证内容 |
|---|---|
| Project | Project、Task、Lifecycle、Definition of Done |
| Workflow | 事件触发、Agent Node、Script Node、Approval、状态回写 |
| Agent | 指定 cwd 启动、日志流、输入、取消、退出状态 |
| Execution | Workspace、进程树、Session、Artifact |
| Control | Timeline、当前等待项、失败重试、人工接管 |

---

## 8. 当前建议的 MVP 范围

### 8.1 Project Plane

- 创建和查看 Project；
- 创建、编辑和查看 Task；
- 4～6 个 Task 生命周期状态；
- 简单看板或列表；
- Task Detail；
- Activity / Event Timeline。

### 8.2 Workflow Plane

- Workflow 先采用 YAML / JSON 定义，不做完整拖拽编辑器；
- 顺序与依赖执行；
- Agent Node；
- Script Node；
- Human Approval Node；
- Task Transition Node；
- 超时、取消和从失败节点重试；
- Run History 和 Node Log。

### 8.3 Agent Plane

- Agent Profile / Runtime Profile；
- 一个真实 Adapter，优先验证 Codex；
- 指定工作目录启动；
- 实时日志；
- 发送补充输入；
- 取消进程树；
- 持久化原生 Session ID（如果 Runtime 提供）；
- 收集退出状态、Diff 和 Artifact。

### 8.4 基础设施

当前工作假设，不代表最终锁定：

```text
TypeScript 全栈
React + TypeScript
Node.js Server
SQLite
REST + SSE
必要时 Terminal WebSocket
本地文件 Artifact Store
模块化单体
Local Runner Daemon 或独立 Runner 模块
Git Worktree Provider
```

技术栈应由 PoC 结果校正，而不是在 PRD 中写成不可改变的用户需求。

---

## 9. 第一阶段明确不做

- 完整 Jira / Linear 替代品；
- 通用 BPMN；
- 完整 n8n 克隆或嵌入；
- 通用拖拽 Workflow 编辑器；
- 多租户、复杂 RBAC 和企业组织结构；
- 多 Agent 自主群聊或 Swarm；
- Agent 信誉和绩效系统；
- 插件市场；
- Kubernetes Runner Pool；
- MicroVM 多租户沙箱；
- A2A 联邦 Agent；
- 自动 Agent 路由；
- 完整 Memory Provider 平台；
- 向量数据库和通用知识图谱；
- 手机端；
- 同时适配所有 Agent；
- 自研模型或自研通用 Agent Loop。

任何新增功能都应回答：它是否是黄金场景闭环的必要条件？

---

## 10. 对开源项目研究形成的关键认识

以下内容是架构参考，不代表要直接依赖对应项目。

### Multica

最接近“Agent 团队工作与执行控制面”。重点参考：

- Project / Issue / Task / Run；
- Local / Remote Daemon；
- Runtime Adapter；
- Session Resume；
- Leader + Child Issue；
- Agent 作为长期成员。

### Buzz

更像 Agent-native Collaboration Event Bus。重点参考：

- Agent Identity 与 Runtime 分离；
- Event Log；
- 人和 Agent 共享协作表面；
- 可重放、可搜索、可审计的事件；
- Channel Actor 和异步 Job Event。

### OpenHands

更像 Coding Agent Server + Sandbox Control Center。重点参考：

- Agent Server；
- ACP Agent 子进程；
- Conversation 与 Workspace；
- Local / Docker / VM / Cloud Backend；
- Secret 注入和 Sandbox 抽象。

### AutoGPT Platform

更像 Agent-aware Block Graph Workflow。重点参考：

- Typed Block Contract；
- Graph / Node Execution；
- Trigger；
- Parent / Child Graph；
- Human Review；
- Execution Event。

### Orca 与类似本地控制台

重点参考：

- 本地 Agent CLI；
- 多 Worktree；
- Terminal / Diff UX；
- SSH 和多客户端控制。

### DSH、Pi、AgentScope 等

它们回答的是不同层级的问题：

- DSH：插件化 Agent Application Microkernel；
- Pi：极简可嵌入 Agent Kernel；
- AgentScope / ADK / Agno：生产级 Agent / Workflow Runtime；
- 它们不应直接拥有本项目的 Project、Task 和 Lifecycle 领域模型。

### 综合结论

```text
Project / Task / Team     参考 Multica
Collaboration / Event     参考 Buzz
Workflow Graph            参考 AutoGPT / n8n / Dagu
Agent Server / Sandbox    参考 OpenHands / OpenSandbox
Local CLI / Worktree UX   参考 Orca
Agent Kernel / Plugin     研究 DSH / Pi
```

---

## 11. Memory 与项目知识的长期方向

项目知识不应等同于“聊天历史 + 向量搜索”。长期模型建议分为：

```text
Current State   → Project / Task / Workflow / Agent Run 当前事实
Project Wiki    → Architecture / Decision / Incident / Release / Lessons
Experience      → Episode / Feedback / Failure Pattern
Evidence        → Git / Issue / Docs / Logs / Agent Trace / Artifact
```

核心原则：

- 原始 Evidence 不可变；
- 知识对象有 Scope、Validity、Authority 和 Source；
- 旧不等于失效，新不等于可信；
- Retrieval 只是候选召回，Context Compiler 决定 Agent 最终看到什么；
- Agent 可以提出知识，但不能未经验证改写项目事实；
- 第一版只保留 Event、Artifact 和少量 Context，不建设完整 Memory Plane。

---

## 12. 已形成的强共识

以下内容可以视为当前较稳定的产品方向：

1. 项目核心不是“更强的 Agent”，而是可靠、安全、可观察地管理异构 Agent 参与真实工作。
2. 不重新实现 Codex、Claude Code、Hermes 等 Harness 的推理与 Tool Loop。
3. Project、Workflow 和 Agent 不应是三个互不相干的应用，必须共享 Task、Run、Event 和 Artifact。
4. Task 应成为 Project 意图与执行系统之间的主要契约。
5. 人工审批、接管和证据验收是核心价值，不是附加功能。
6. 第一版应做贯穿三大平面的垂直切片，而不是分别把三个模块做完整。
7. 第一版应先实现“可视化运行”，而不是“可视化编辑”。
8. 外部系统提供事实，Workflow 转化为领域命令，Project Plane 维护工作语义和生命周期。
9. AgentDriver、ExecutionBackend、WorkspaceProvider 和 CoordinationProvider 应保持可拆分。
10. MVP 必须诚实表达不同 Agent Adapter 的能力等级，不把 PTY 伪装成完整结构化协议。

---

## 13. 仍需通过技能流程判断的关键假设

以下不是事实，也不是最终决策：

### 用户价值假设

- 个人开发者真正需要的是 Project-native 控制面，而不只是更好的 Agent Terminal；
- 用户愿意从 Task 启动和管理 Agent，而不是直接打开 Agent CLI；
- 统一 Timeline、Artifact 和 Approval 能显著减少协调成本；
- “工作经验复利”会成为持续使用的重要原因，而非遥远愿景。

### 产品范围假设

- Project + Workflow + Agent 三个 Plane 都必须出现在第一个 MVP；
- 最小 Workflow Runtime 比简单的 Task 状态机更有必要；
- 看板是 MVP 必要界面，而不是 Task List + Run Detail 即可；
- Approval 必须位于第一个黄金场景中。

### 技术假设

- TypeScript 全栈足以可靠处理 Windows 本机进程与 Agent CLI；
- Generic PTY / ConPTY 能快速支持第一个 Agent；
- Local Runner 应从第一版就与 Web Server 生命周期分离；
- Git Worktree 是默认 Workspace Provider；
- Codex 是首个最合适的 Runtime；
- 自研最小 Workflow Runtime 的成本低于直接集成外部 Runtime；
- SQLite + Append-only Event 表足以支撑第一阶段恢复和审计。

### 商业和长期定位假设

- 该产品应优先定位个人开发者，而不是小团队；
- Local-first 是长期定位，而不是 MVP 的临时实现方式；
- 产品未来可以在 Agent Control Plane、Project OS 和 Workflow OS 交集形成独立类别。

技能流程应识别并排序这些假设，而不是默认它们全部成立。

---

## 14. 当前开放决策

这些问题允许在 Red Team 或技术 PoC 后修改：

1. 第一个 MVP 是否包含看板，还是只做 Task List + Task Detail？
2. Workflow 是最小 DAG、固定状态机，还是先用硬编码黄金流程？
3. Web Server 与 Runner Daemon 是否第一版即拆进程？
4. 首个 Agent Driver 选择 Codex App Server、结构化 CLI 还是 PTY？
5. Workspace 第一版使用直接目录还是 Git Worktree？
6. 第一版是否要求 Session Resume？
7. Artifact 是否只保存引用，还是复制到本地 Artifact Store？
8. Approval 是独立领域对象，还是先作为 Workflow Node 状态？
9. Completion Receipt 在 MVP 中做到何种结构化程度？
10. 项目是否需要自带最小 Project Panel，还是优先接入外部 Jira / GitLab 投影？

---

## 15. MVP 成功的最低标准

当以下流程能够稳定完成，第一里程碑成立：

1. 用户创建 Project 和 Task；
2. Task 绑定一个执行流程和一个本地 Agent Runtime；
3. 用户从 Task 页面启动执行；
4. 系统创建并关联 Workflow Run、Node Run 和 Agent Run；
5. UI 实时显示 Agent 输出和节点状态；
6. 用户可以补充输入和取消 Agent；
7. Script Node 能运行测试命令并保存结果；
8. Human Approval 能暂停并恢复执行；
9. Diff、日志、测试结果和批准记录成为 Task Artifact / Evidence；
10. Workflow 根据结果更新 Task 生命周期；
11. Timeline 能还原一次执行的主要因果过程；
12. 应用重启后仍能查看 Task、Run、Event 和 Artifact 历史。

真正的验收问题是：

> 用户能否从一张任务卡出发，在一个界面里完成一次可观察、可干预、可追溯的人机协同工作？

---

## 16. PM Skills 使用约束

执行任何 PM Skill 时必须遵守：

1. 本文中的“强共识”作为当前工作约束，但仍允许 Red Team 用证据挑战。
2. “关键假设”和“开放决策”不得被写成已验证事实。
3. 不要因为模板完整而增加市场、定价、GTM、多租户等非 MVP 内容。
4. 不要重新扩展竞品列表，除非某个待决策点确实缺少事实依据。
5. 输出必须围绕第一条黄金场景收敛。
6. 每项需求都应说明 Why、What、Acceptance，并能由 Coding Agent 理解。
7. 技术实现建议与产品需求分开记录。
8. 所有无法判断的内容应进入 Open Questions，不得虚构用户研究或数据。
9. PRD 完成后只允许经过一次 Red Team 修订，然后进入 WWA 拆解。
10. 当 WWA Backlog 达到进入开发门槛后，停止需求扩张。

---

## 17. 研究素材索引

本上下文来自以下已有研究主题的综合，而非一次临时头脑风暴：

- Agent 执行层架构：Runtime Adapter、Runner、Session、Workspace、Sandbox、ACP、A2A、Agent Team、Completion Receipt；
- 项目面板定位：Project Control Plane、外部数据投影、Workflow 领域命令、Artifact 和 Approval；
- 项目知识复用：Current State、Wiki、Episode、Procedure、Evidence、Context Compiler；
- GitHub 开源项目探索：Multica、Buzz、AutoGPT、OpenHands、Orca、DSH、Pi、AgentScope、OpenSandbox 等；
- 产品定义与构建路线：Project-native、Task-executable、Human-governed、垂直切片、Executable Task。

如 Skill 需要更深证据，应优先回到这些主题的研究文档，而不是无边界扩展搜索。
