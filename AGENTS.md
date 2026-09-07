# Agentic Work OS — Founder MVP 工作约定

## 当前入口

本分支进入 Founder MVP 有限开发；不是宣布原 Product Validation Gate 或 Technical Gate PASS。

开始工作依次读取：
1. `docs/mvp/README.md`。
2. `docs/mvp/00-founder-mvp-scope.md`：当前开工与能力开放规则。
3. `docs/pm/70-mvp-wwa-backlog.md`：六个开发切片，默认从 FMVP-01 开始。
4. 需要历史依据时读取 `docs/research/2026-09-07-pre-mvp-handoff.md`；不要每轮重复研究全部历史材料。

## 规则优先级

`docs/mvp/00-founder-mvp-scope.md` 是本次用户授权的范围修订。它仅在 Founder MVP 的开工时点、局部 Schema/UI 实现许可及验证任务排序上，覆盖 `docs/pm/01`、`20`、`30`、`40`、`50` 和转段前 `60` 中冲突的全面开工禁令。

未冲突的安全、不可变证据、Cancel、Review、交付、跨平台接口与 Deferred 边界继续有效。旧协议样本数、实验次数、历史 FAIL/PASS 和最终 Gate 记录不得改写。分支内授权不表示 main 已更新或任何 PR 已合并。

## 开发方式

- 允许现在实现最小应用、可迁移本地 Schema、WWA 和本切片实施计划，不再等待完整外部人数或全部平台矩阵才写 UI。
- 首版单用户、本地应用、一个 Codex Adapter、全局一个活动 Run；资源状态未知时禁止启动新 Run。
- 默认先做 FMVP-01 的明确 mock 模式；不得后台调用真实 CLI。模拟记录不能计入真实任务、产品复用或技术 Gate 证据。
- 一次只推进一个可验收切片；先写能观察结果的测试，再实现，再报告真实执行结果。不要新开全面 PRD/Red Team/框架选型。
- 优先复用 `experiments/milestone-0/` 中已有合同与候选；继承实验代码不等于允许直接启用。生产接线必须有相关测试，禁止无必要地另写一套进程所有权、取消或 Artifact 框架。
- 产品代码放独立的 `apps/` / 必要的 `packages/`；这是待创建布局，不代表目录已存在。不要改写历史证据去适配新实现。
- UI 风格和实现库属于局部可逆选择，不得制造新审批关卡。新依赖按实际环境验证并提交 lockfile；不要照抄历史文档中不存在的 npm scripts。

## 不可绕过的能力边界

- 真实运行默认关闭，只有当前 platform/profile/adapter 的执行验收完成才能对用户开放；一次性 fixture 中的诊断验证仍允许。
- 未确认受控进程停止与输出 drain，不得宣称安全取消；进程事实未知则 interrupted、持锁、禁止自动重试。
- Review 必须绑定同一 Run 的 sealed Change Package；缺失、损坏、hash 不符或 unresolved drift 时不得 Accept/Delivery。
- `done` 仅表示已有被接受的可重放交付物，不表示 merge/push/release；历史决定不因后续损坏被改写。
- Workspace 不是 Sandbox；保持 trusted-local 提示，保留 Agent 原生权限限制，不启用危险的默认全权限绕过。
- 本地服务仅监听 loopback；执行型入口必须校验本地访问/请求来源，不能因为 localhost 就省略请求保护。
- 不提交密钥、登录态、真实环境变量值、个人数据或未去敏日志。

## Git 与报告

不直接写 main，不自动 merge，不删除或重置研究/实验分支。不要把 PR #49 的红色增量直接并入本分支。后续实现从当前 MVP 基线分支切小功能分支，PR 明确目标为 `mvp/founder-foundation`；合并到该分支不代表交付到 main。

报告必须区分：已写文件、已运行测试、未运行测试、已开放能力、仍关闭能力。应用功能或原 Gate 没有证据就不得标为完成。
