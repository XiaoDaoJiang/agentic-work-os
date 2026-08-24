# Agentic Work OS：PM Skills 需求收敛工作区

本目录用于把 Agentic Work OS 已完成的 Idea、竞品研究和架构探索，快速转化为可以进入开发的 MVP 需求。

## 使用顺序

1. 所有技能首先读取 [`00-project-context.md`](./00-project-context.md)。
2. 按 [`01-pm-skills-runbook.md`](./01-pm-skills-runbook.md) 顺序执行：
   - `identify-assumptions-new`
   - `create-prd`
   - `strategy-red-team`
   - `wwas`
3. 将各阶段输出写入本目录，并保留修订历史。
4. 当 `40-wwa-backlog.md` 满足“进入开发门槛”后，停止继续扩展需求，转入 implementation plan 与 coding。

## 预期文件

```text
docs/pm/
├── README.md
├── 00-project-context.md       # 当前已知事实、方向、边界和研究结论
├── 01-pm-skills-runbook.md     # 可直接复制给 Agent 的技能执行提示
├── 10-key-assumptions.md       # identify-assumptions-new 输出
├── 20-mvp-prd.md               # create-prd 输出
├── 30-prd-red-team.md          # strategy-red-team 输出
└── 40-wwa-backlog.md           # wwas 输出，进入开发的需求清单
```

## 工作原则

- **先收敛，后完善。** 当前目标不是得到最完整的产品规划，而是得到足以指导第一条垂直切片开发的需求基线。
- **事实、决策、假设分开。** 研究结论不等于已经验证的用户需求；建议方案也不等于不可改变的架构决策。
- **不因技能流程重新开始研究。** 只有当某项未知会阻塞 MVP 范围或核心架构时，才增加定向验证。
- **Task 必须可执行。** 最终需求要能够被人或 Coding Agent 理解、实现并通过可观察证据验收。
- **完成定义依赖证据。** “Agent 表示已经完成”不是验收依据；应有运行状态、Diff、测试结果、Artifact 或人工批准。
