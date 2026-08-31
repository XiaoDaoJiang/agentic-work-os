# Agentic Work OS：PM Skills 与双 Gate 运行手册

> 目标：只执行足以形成可验证 MVP 边界的需求与验证工作，不重复完整产品探索，也不在证据门槛前进入产品化开发。
>
> 当前固定流程：`identify-assumptions-new → create-prd → strategy-red-team → revise PRD → (Product Validation ∥ Milestone 0) → Product + Technical Gate → wwas → implementation plan → coding`
>
> 当前状态：前四步已经形成文档基线；`wwas` 被 Product Validation Gate 与 Technical Gate 共同阻断。

---

## 0. 通用前置提示

每次开始一个阶段前，都先向 Agent 提供下面的约束：

```text
请先完整阅读：
- docs/pm/00-project-context.md
- docs/pm/20-mvp-prd.md
- docs/pm/30-prd-red-team.md
- docs/pm/40-validation-protocol.md
- docs/pm/50-milestone-0-experiment-plan.md
- docs/pm/60-gate-execution-index.md

这是 Agentic Work OS 当前需求、反证、验证协议与门控状态的统一上下文。请严格区分：
1. 已形成的文档决策；
2. 仍待验证的产品假设；
3. 尚未通过的技术能力；
4. 协议中的预注册判据；
5. 已取得并可引用的原始证据。

不要虚构参与者、真实任务、测试运行、PASS / FAIL、用户行为或市场数据。
在 Product Validation Gate 与 Technical Gate 都最终 PASS，且必要 PRD 修订完成并重新评审之前：
- 不运行 wwas；
- 不生成产品 MVP Backlog 或完整实施计划；
- 不实现 Project / Task 产品化 UI；
- 不冻结生产 Schema / API；
- 不恢复 Deferred 能力。

所有输出使用中文，保存到指定 Markdown 文件。
```

---

## 1. 识别关键假设（已完成的需求收敛阶段）

### 使用技能

```text
identify-assumptions-new
```

### 建议提示

```text
基于 docs/pm/00-project-context.md，对 Agentic Work OS 进行一次“进入开发前”的关键假设识别。

不要重新做完整市场发现，也不要泛泛列出几十项风险。重点识别：
- 用户价值是否成立；
- 第一条黄金场景是否足够有价值；
- MVP 三大 Plane 的范围是否过重；
- Task、Workflow、Agent Run 的核心模型是否存在致命错误；
- 本地 Runner、Agent Adapter、Workspace 等技术假设是否可能导致返工。

要求：
1. 最多输出 12 个关键假设；
2. 从 Value、Usability、Viability、Feasibility、Strategy、Team 等维度覆盖，但不要为了凑分类增加无关项；
3. 对每个假设标注：影响、当前信心、已有证据、缺失证据；
4. 给出最便宜的验证方式；
5. 将每项分为：
   - 进入开发前必须验证；
   - 可以接受风险直接构建；
   - 可在实现中通过 PoC 决定；
   - 延后处理；
6. 最后只选出 Top 5 load-bearing assumptions；
7. 明确哪些假设一旦为假，会改变 MVP 边界或核心架构。

保存到：docs/pm/10-key-assumptions.md
```

### 本阶段完成标准

- Top 5 假设明确；
- 每项都有最低成本验证方法；
- 没有因为风险分析重新打开无限研究；
- 可以明确哪些未知直接交给技术 PoC。

---

## 2. 创建 MVP PRD（已完成的需求收敛阶段）

### 使用技能

```text
create-prd
```

### 建议提示

```text
请读取：
- docs/pm/00-project-context.md
- docs/pm/10-key-assumptions.md

为 Agentic Work OS 编写一份“第一条垂直切片”的 MVP PRD。

本 PRD 不是完整 Agent OS 蓝图，只定义下面的黄金路径：
从 Project / Task 发起一次本地 Coding Agent 执行，经过最小 Workflow、测试和人工审核，最终保存可验证 Artifact 并更新 Task 状态。

PRD 必须包含：
1. Summary；
2. Problem 与当前替代方式；
3. 第一用户与使用场景；
4. Product Thesis；
5. MVP Objective 和可衡量成功标准；
6. Golden Path；
7. In Scope；
8. Explicit Non-goals；
9. 核心领域对象及关系；
10. 功能需求，按 Must / Should / Later 分类；
11. 人工控制与失败处理；
12. Artifact / Completion Evidence；
13. 关键 UX 页面或交互；
14. 已知约束；
15. Top Assumptions 与 Open Questions；
16. Release Slice 与里程碑验收。

约束：
- 不添加定价、GTM、多人组织、插件市场等非 MVP 内容；
- 不把 TypeScript、SQLite 等候选技术写成用户需求；
- 功能需求应保持实现中立，但足以指导架构；
- 不需要写成长篇愿景报告；以清晰、可执行为优先；
- 对尚未验证的内容明确标记 Hypothesis；
- 把完整 Agent Memory、A2A、Kubernetes、多 Agent Team 放到 Later / Non-goals。

保存到：docs/pm/20-mvp-prd.md
```

### 本阶段完成标准

PRD 能回答：

- 第一版究竟解决哪个问题；
- 谁会在什么情况下使用；
- 用户从哪里开始、看到什么、如何干预、如何结束；
- 哪些功能明确不做；
- 什么证据意味着 MVP 成功。

---

## 3. 对 PRD 进行 Red Team（已完成的需求收敛阶段）

### 使用技能

```text
strategy-red-team
```

### 建议提示

```text
请读取：
- docs/pm/00-project-context.md
- docs/pm/10-key-assumptions.md
- docs/pm/20-mvp-prd.md

对 MVP PRD 做一次严格但有限的 Red Team。

目标不是生成通用风险列表，而是发现会让数周开发白做的 load-bearing assumptions。

要求：
1. 抽取 PRD 的核心断言；
2. 最多保留 5 个真正的 kill-assumptions；
3. 对每项先 Steelman，再攻击最强版本；
4. 使用“Fails if ...”写成可证伪条件；
5. 给出：
   - 已有支持证据；
   - 本周可取得的证据；
   - Kill criterion；
   - Cheapest test；
   - 若失败应如何修改 MVP；
6. 重点检查：
   - 是否把产品愿景误当成 MVP；
   - Project Plane 是否真的必要；
   - Workflow 是否过早；
   - Task 是否是正确中心对象；
   - 本地 Agent 控制是否足以形成独立价值；
   - Completion Evidence 是否被过度设计；
7. 明确指出 PRD 中合理且不应继续动摇的部分；
8. 最后给出结论：Proceed / Proceed with Changes / Run PoC First / Stop。

保存到：docs/pm/30-prd-red-team.md
```

### 本阶段完成标准

- 只保留 3～5 个会真正改变计划的问题；
- 每个问题都有行动，不停留在担忧；
- Red Team 之后只进行一次受控 PRD 修订。

---

## 4. 修订并冻结验证基线（已完成）

这一阶段不是新的 Skill，而是一次受控修订。当前 PRD 的准确状态是：

```text
Frozen for Validation Prototype / Milestone 0
Not frozen for Product MVP WWA
```

当前基线只有在以下情况发生时才重新打开：

- Product Validation 的 `Modify / Remove` 决策要求修改入口、聚合或黄金场景；
- Milestone 0 证明核心技术合同不可行，需要收缩能力或替换机制；
- Gate 审查发现文档间存在无法消除的矛盾。

普通实现细节变化不重新打开 PRD，也不能提前解除 WWA 阻断。

---

## 5. 执行 Product Validation Gate

### 依据

- [`40-validation-protocol.md`](./40-validation-protocol.md)
- [`60-gate-execution-index.md`](./60-gate-execution-index.md)

### 建议执行分支

```text
validation/concierge-execution
```

### 必须形成的决策产物

1. Project-native Decision Record；
2. Task-first Decision Record；
3. Task Aggregation Decision Record；
4. Product Validation Gate Decision Record。

### 执行纪律

- A↔B 与 B↔C 必须分别比较，不能用一个总偏好替代；
- 9 个真实实例与轨迹走查不能只挑快乐路径；
- 3 名用户 / 5 个真实问题只是活动完成口径，不自动表示 Gate 通过；
- 自发复用必须按协议审计，提醒、预分配、同一任务继续或纯 Codex 效果不得计入；
- `Modify / Remove` 先回写 PRD 并重新评审；
- 未取得证据时只记录 `NOT_RECORDED`、`CONTINUE_VALIDATION` 或协议允许的诚实状态，不生成支持性结论。

### 当前禁止

- 产品化 A/B/C 三套入口；
- Project / Task UI；
- Task 中心生产 Schema / API；
- 产品 MVP WWA。

---

## 6. 执行 Technical Gate

### 依据

- [`50-milestone-0-experiment-plan.md`](./50-milestone-0-experiment-plan.md)
- [`60-gate-execution-index.md`](./60-gate-execution-index.md)

### 建议执行分支

```text
spike/milestone-0-harness
```

### 必须形成的独立结论

1. Runner-owned process containment / Cancel；
2. Real Codex Adapter capability；
3. Change Package seal / replay；
4. Artifact durability / fault injection / reconciliation；
5. RI、VI、RR 及其他计划要求的跨切合同结论；
6. Technical Gate Decision Record。

### 执行纪律

- 只建设 disposable fixture、诊断 Harness 和证据采集；
- 每个 Spike 独立给出 `PASS / FAIL / INCONCLUSIVE`；
- 关键 case 未运行、证据缺失或无法解释时必须为 `INCONCLUSIVE`；
- 任一硬失败不能被其他 Spike 的成功抵消；
- 不把实验合同冻结为生产 Schema、API 或完整 Runner 架构；
- 不通过新增 Sandbox、Remote Runner、Session Resume、通用 Workflow 或产品 UI 绕过失败。

---

## 7. 双 Gate 后拆分 WWA

### 当前状态

```text
BLOCKED
```

`wwas` 只有在以下条件全部满足后才允许执行：

- Product Validation Gate 的最终 verdict 为 `PASS`；
- Technical Gate 的最终 verdict 为 `PASS`；
- Product Validation 中所有 `Modify / Remove` 后果已写入 PRD；
- 受影响边界已重新评审，并有可引用的评审记录；
- Product + Technical Gate 联合 Decision Record 已形成 Final 记录；
- [`60-gate-execution-index.md`](./60-gate-execution-index.md) 将 WWA 状态更新为 `UNLOCKED`。

### 使用技能

```text
wwas
```

### 解锁后的建议提示

```text
请读取：
- docs/pm/00-project-context.md
- docs/pm/20-mvp-prd.md
- docs/pm/30-prd-red-team.md
- docs/pm/40-validation-protocol.md
- docs/pm/50-milestone-0-experiment-plan.md
- docs/pm/60-gate-execution-index.md
- 两个最终 Gate Decision Record 及其证据引用

先验证 Product Validation Gate = PASS、Technical Gate = PASS，且所有 Modify / Remove 后果已反映到 PRD 并重新评审。任一条件不满足时停止，不生成 WWA。

把门控后仍被保留的产品 MVP 拆成可以交给 Coding Agent 实现的 WWA Backlog。

每个 Work Item 必须包含：
- ID；
- Title；
- Why；
- What；
- Acceptance Criteria；
- Dependencies；
- Out of Scope；
- Verification Evidence；
- 建议的测试类型。

拆解规则：
1. 只拆门控后 PRD 的 Required 黄金路径，不恢复 Deferred 能力；
2. Milestone 0 已经是技术证据阶段，不要把已完成 Spike 伪装成待开发产品功能；
3. 一个 Item 尽量可由一个 Coding Agent 在 0.5～2 个工作日内完成；
4. 优先纵向能力切片，不按前端、后端、数据库做纯技术层拆分；
5. Acceptance Criteria 必须可观察、可验证，并引用已证明的技术合同；
6. 第一批 Item 不依赖完整平台先建好；
7. 最后给出推荐的端到端实现顺序，并标记第一项 Walking Skeleton。

保存到：docs/pm/70-mvp-wwa-backlog.md
```

### 本阶段完成标准

- 每项都能直接交给 Coding Agent；
- 至少有一条端到端 Walking Skeleton；
- 每项都有可验证 Acceptance Criteria 和完成证据；
- 技术实现遵守已通过的 Milestone 0 合同；
- 没有把被移除、被修改掉或 Deferred 的能力重新带回 MVP。

---

## 8. 进入 Implementation Plan 与 Coding 的门槛

满足以下条件后，才停止需求与验证流程：

- [ ] Product Validation Gate 最终 `PASS`；
- [ ] Technical Gate 最终 `PASS`；
- [ ] 三个产品子决策均为 Final，并可追溯到证据；
- [ ] 所有 `Modify / Remove` 后果已反映到 PRD；
- [ ] 受影响边界已重新评审；
- [ ] Product + Technical Gate 联合 Decision Record 已形成 Final 记录；
- [ ] `docs/pm/70-mvp-wwa-backlog.md` 已生成；
- [ ] WWA Backlog 已按纵向切片拆解；
- [ ] 第一条 Walking Skeleton 已明确；
- [ ] 每项有可验证 Acceptance Criteria；
- [ ] 没有恢复 Deferred 能力。

然后转入：

```text
Validated MVP WWA
  ↓
Implementation Plan
  ↓
Walking Skeleton
  ↓
Coding
  ↓
Tests + Evidence
  ↓
Review
```

---

## 9. 推荐提交节奏

```text
chore(pm): add agentic work os project context

docs(pm): identify load-bearing product assumptions

docs(pm): add executable task mvp prd

docs(pm): red-team mvp prd

docs(pm): freeze validation and milestone 0 baseline

docs(pm): align execution flow with product and technical gates

docs(validation): add product validation execution evidence

test(m0): add milestone 0 experiment evidence

docs(pm): record product validation gate decision

docs(pm): record technical gate decision

docs(pm): record joint product and technical gate decision

docs(pm): revise mvp prd from gate decisions

docs(pm): decompose validated mvp into wwa backlog
```

验证执行可按证据批次提交，但原始敏感证据、参与者身份映射、凭据和生产数据不得提交到公开仓库。每次提交都必须保持“判据、原始证据、解释与结论”之间可追溯。

---

## 10. 给 Codex 或其他不支持 Slash Command 的 Agent

如果运行环境没有 pm-skills 的 `/command`，直接使用本文件对应阶段的完整提示，并明确要求 Agent 加载相应 Skill：

```text
请加载 pm-skills 中的 [skill-name] Skill，读取指定上下文文件，并严格按照下面的阶段提示执行。
```

Skill 是方法，本文是项目特定输入和门控边界。不要让 Agent 只凭 Skill 模板生成通用内容，也不要让 Agent 在 Gate 未解锁时自行进入 `wwas`。
