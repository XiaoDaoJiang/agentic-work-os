# Founder MVP — 开工入口

> 日期：2026-09-07  
> 授权：FOUNDER_MVP_DEVELOPMENT_ALLOWED  
> 实现状态：NOT_STARTED；本次只准备分支与前置文档  
> 首项：FMVP-01；不等待外部用户招募或完整技术 Gate

## 最少阅读

[范围修订](./00-founder-mvp-scope.md) → [六个 WWA](../pm/70-mvp-wwa-backlog.md)。历史事实只在需要时查 [Research 交接快照](../research/2026-09-07-pre-mvp-handoff.md)。

本分支已接受“允许有限开工、按能力验收后开放”的规则，不需要再生成一份是否可以开始的研究报告。旧 Product / Technical Gate 保持原结论。

## 当前能力状态

| 项目 | 状态 |
|---|---|
| 写产品 UI / 本地可迁移模型 / WWA / 切片实施计划 | ALLOWED |
| 产品实现 | NOT_STARTED |
| 对用户开放真实 Agent 执行 | DISABLED；等待所选 profile 的 G1 |
| 对用户开放真实 Accept / Accepted Delivery | DISABLED；等待 G2 |
| 外部发布 | NOT_AUTHORIZED；不是本次分支准备范围 |

G1/G2 是范围修订中的能力开放条件，不是新增的“任何代码都必须先等待”的阶段。

## 第一切片的可逆实现默认

这是新开发默认，不是历史研究已经验证的技术结论：本地 Web、TypeScript 应用层、React 界面、Node 服务、SQLite 本地持久化。优先采用简单单体和 npm workspace；不另建微服务、桌面壳或流程编辑器。Runner 仍通过平台无关接口连接已有候选。

若执行环境不兼容某个默认，只修改受影响选择并在实现 PR 说明；不要回到全面选型。已有 M0 测试曾使用 Node 22.16.0 / Rust 1.88.0，但这不是新 UI 依赖版本兼容性保证；新应用必须实际验证并锁定依赖。

建议的新增目录是 `apps/web`、`apps/server`，共享类型仅在实际需要时加入 `packages/`。这些目录尚未创建。不要把 `experiments/` 改名或搬空来伪装产品已经完成。

## FMVP-01 的实施顺序

1. 读取当前分支、AGENTS 与 WWA，确认没有未提交用户改动；从 MVP 基线切小功能分支。
2. 用最少测试固定 Task 与 mock Run 的可观察行为，以及完整输入快照、唯一 ID、持久化和重开恢复。
3. 实现最小本地 API 与 SQLite migration，不启动任何用户命令或真实 Agent。
4. 实现 Task 输入、Run 列表、详情和确定性 mock 日志；页面与数据都明确标记 `execution_mode=mock`。
5. 验证空输入拒绝、成功路径、模拟失败、重复启动、关闭/重启后的恢复；模拟结束不得设置真实交付 done。
6. 执行实际可用的测试、类型检查、构建与最小 E2E。记录确切命令、退出状态、未运行项；随后补充根 README 启动说明。

FMVP-01 不需要完整 A/B/C、P01、6 类真实异常或三平台进程矩阵，也不允许借此开放真实执行。

## 后续技术成果的复用

候选位置已存在：
- `experiments/milestone-0/src/runner-contract.mjs`、`runner-client.mjs`、`repository-marker.mjs`。
- `experiments/milestone-0/native-runner/`：ProcessBoundary / RuntimeReceipt / observer 实验。
- `experiments/milestone-0/src/change-package*.mjs`、`artifact-*.mjs`、`delivery-integrity.mjs`。

接入时先核对源文件、测试、版本和使用边界。研究分支后续修复只做经过 review 的定向合入；不得将整个不稳定实验分支盲目合并，也不要在新代码里复制第二份含义相同的状态机。

## 直接交给 Codex 的提示

```text
在当前 Agentic Work OS Founder MVP 基线上执行 FMVP-01。

先读取：
AGENTS.md
docs/mvp/README.md
docs/mvp/00-founder-mvp-scope.md
docs/pm/70-mvp-wwa-backlog.md

本轮目标是交付可操作、可持久化的 Task + mock Run 最小应用，
不是继续做 PM 研究，也不是启动真实 Codex。

先写本切片的短实施计划与可执行测试，然后实现：
Task 创建 → mock Run 列表/详情 → 模拟日志 → 本地持久化 → 重开恢复。
mock 必须在界面和数据中明确标识；不得调用真实 CLI、伪造真实 Artifact、
设置真实任务 done 或宣称产品 Gate PASS。

保持单用户、全局单活动 Run、loopback-only。
按 WWA 的 Acceptance 验证，报告确切测试命令与结果。
不要直接写 main，不自动 merge，不改写研究证据或历史 Gate。
不要为了未完成的外部招募再次停止 FMVP-01。
```
