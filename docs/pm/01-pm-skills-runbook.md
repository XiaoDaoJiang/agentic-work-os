# Agentic Work OS：PM Skills 极速进入开发运行手册

> 目标：只执行足以冻结第一版 MVP 的技能，不重复完整产品探索。
>
> 固定流程：`identify-assumptions-new → create-prd → strategy-red-team → revise PRD → wwas → coding`

---

## 0. 通用前置提示

每次开始一个技能前，都先向 Agent 提供下面的约束：

```text
请先完整阅读：
- docs/pm/00-project-context.md

这是 Agentic Work OS 当前研究成果的统一上下文。请严格区分：
1. 已形成的强共识；
2. 仍待验证的关键假设；
3. 尚未决定的开放决策；
4. 技术实现建议。

本轮目标是快速冻结可开发的 MVP，而不是扩大产品探索。
不要虚构用户研究、市场数据或已验证需求。
除非某项未知会阻塞 MVP 范围或核心架构，否则不要新增竞品研究。
所有输出使用中文，保存到指定 Markdown 文件。
```

---

## 1. 识别关键假设

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

## 2. 创建 MVP PRD

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

## 3. 对 PRD 进行 Red Team

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
- Red Team 之后只进行一次 PRD 修订。

---

## 4. 修订并冻结 PRD

这一阶段不是新的 Skill，而是一次受控修订。

### 建议提示

```text
请读取：
- docs/pm/20-mvp-prd.md
- docs/pm/30-prd-red-team.md

根据 Red Team 结果修订 MVP PRD。

规则：
1. 只修改经过 Red Team 证明需要调整的部分；
2. 不增加新的产品范围；
3. 无法立即验证的技术问题转成 PoC / Spike；
4. 保留明确的 Open Questions 和 Decision Deadline；
5. 在文档顶部增加：Status: Frozen for WWA decomposition；
6. 在末尾增加 Change Log，记录本次修订。

覆盖保存：docs/pm/20-mvp-prd.md
```

### 冻结标准

只有出现以下情况才允许再次打开 PRD：

- PoC 证明核心技术路线不可行；
- 首批真实使用证明黄金场景没有价值；
- WWA 拆解发现需求存在不可消除的矛盾。

普通实现细节变化不重新打开 PRD。

---

## 5. 拆分为 WWA 可执行需求

### 使用技能

```text
wwas
```

### 建议提示

```text
请读取：
- docs/pm/00-project-context.md
- docs/pm/20-mvp-prd.md
- docs/pm/30-prd-red-team.md

把冻结后的 MVP 拆成可以交给 Coding Agent 实现的 WWA Backlog。

每个 Work Item 必须包含：
- ID；
- Title；
- Why；
- What；
- Acceptance Criteria；
- Dependencies；
- Out of Scope；
- Verification Evidence；
- 建议的测试类型；
- 若仍有未知，标记为 Spike 而不是伪装成 Feature。

拆解规则：
1. 一个 Item 尽量可由一个 Coding Agent 在 0.5～2 个工作日内完成；
2. 每项交付一个独立、可观察的增量；
3. 不按前端、后端、数据库做纯技术层切片，优先做纵向能力切片；
4. Acceptance Criteria 必须可观察、可验证；
5. 不写死没有必要的类名、表名或内部框架；
6. 明确哪些 Item 是技术 Spike；
7. 为每项指定至少一种完成证据，例如：
   - UI 行为；
   - API 响应；
   - Event 记录；
   - Run 状态；
   - Diff / Artifact；
   - 自动化测试；
   - 人工审批记录；
8. 按下面的优先级组织：
   - Milestone 0：关键技术 PoC；
   - Milestone 1：Task → Agent Run 最小闭环；
   - Milestone 2：Workflow + Test + Approval；
   - Milestone 3：Artifact + Timeline + 状态回写；
   - Later：明确延后的能力。
9. 最后输出一条推荐的端到端实现顺序，并标记第一项可以立即编码的 Work Item。

保存到：docs/pm/40-wwa-backlog.md
```

### 本阶段完成标准

- 每项都能直接交给 Coding Agent；
- 第一批 Item 不依赖完整平台先建好；
- 至少有一条端到端 Walking Skeleton；
- 技术未知被拆成 Spike；
- 可明确开始第一个 implementation plan。

---

## 6. 进入开发门槛

满足以下条件后，停止需求技能流程：

- [ ] 黄金路径只有一条，且描述清楚；
- [ ] MVP 的 In Scope 与 Non-goals 已冻结；
- [ ] Top 5 假设已有处理方式；
- [ ] Red Team 结论允许继续；
- [ ] WWA Backlog 已按纵向切片拆解；
- [ ] 第一个 Walking Skeleton Work Item 已明确；
- [ ] 每项有可验证 Acceptance Criteria；
- [ ] 核心技术未知已变成有限 PoC；
- [ ] 不再存在“必须先继续研究整个市场”之类阻塞项。

然后转入：

```text
WWA
  ↓
Implementation Plan
  ↓
Technical Spike / Walking Skeleton
  ↓
Coding
  ↓
Tests + Evidence
  ↓
Review
```

---

## 7. 推荐提交节奏

```text
chore(pm): add agentic work os project context

docs(pm): identify load-bearing product assumptions

docs(pm): add executable task mvp prd

docs(pm): red-team mvp prd

docs(pm): freeze revised mvp prd

docs(pm): decompose mvp into wwa backlog
```

每完成一步就提交，不要等整个需求流程结束后一次提交。这样可以比较不同技能对需求的真实影响。

---

## 8. 给 Codex 或其他不支持 Slash Command 的 Agent

如果运行环境没有 pm-skills 的 `/command`，直接使用本文件对应阶段的完整提示，并明确要求 Agent 加载相应 Skill：

```text
请加载 pm-skills 中的 [skill-name] Skill，读取指定上下文文件，并严格按照下面的阶段提示执行。
```

Skill 是方法，本文是项目特定输入和边界。不要让 Agent 只凭 Skill 模板生成通用内容。
