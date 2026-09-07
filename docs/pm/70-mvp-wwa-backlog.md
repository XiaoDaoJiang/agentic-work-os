# Founder MVP — 六个 WWA 开发切片

> 日期：2026-09-07  
> 开工依据：[FMVP-ADR-001](../mvp/00-founder-mvp-scope.md)  
> 方法：仓库内 `.agents/skills/wwas/SKILL.md` 的 Why / What / Acceptance  
> 状态：BACKLOG READY；实现未开始；不是原联合 Gate PASS

当前以六个可交付切片推进。切片可以在 mock 边界上独立编写测试/界面，但真实端到端能力存在明确依赖；不为了声称完全独立而隐藏依赖。

| ID | 切片 | 状态 | 依赖 / 开放条件 |
|---|---|---|---|
| FMVP-01 | 可持久化 Task + mock Run 控制面 | READY | 仅 G0；立即开始 |
| FMVP-02 | 首个 profile 的真实 Codex 执行、观察与取消 | PLANNED | 产品接线依赖 01；真实开放要求 G1 |
| FMVP-03 | 单一 Verification 与版本明确的结果查看 | PLANNED | 接入真实链路依赖 02；相关执行也受 G1 约束 |
| FMVP-04 | 不可变交付物与 Human Review | PLANNED | 依赖 03 产物；真实 Accept/Delivery 要求 G2 |
| FMVP-05 | 重开恢复、异常阻塞与历史解释 | PLANNED | 基础异常保护随 02/04 实现；本项整合 UX 和回归 |
| FMVP-06 | Founder 真实任务使用与摩擦修正 | PLANNED | 真实使用依赖已开放能力；不等待外部人数 |

## FMVP-01 — 可持久化 Task + mock Run 控制面

**Why**：先交付用户能打开、操作并在重开后继续查看的应用，打破只有实验代码而没有产品入口的状态。

**What**：最小仓库上下文、Task 创建/查看、mock Run 列表/详情、可持续显示的模拟日志及本地持久化。Project 可以由仓库生成最小记录。使用确定性 mock，不启动任意命令。

**Acceptance**：
- 可输入目标、DoD、仓库路径和 Verification 配置草稿；缺失字段给出明确错误。mock 不伪装完成真实仓库/Codex preflight。
- Task/Run 有稳定 ID；Run 保存不可变输入快照。以后编辑 Task 不改变已有 Run。
- 每次 mock 尝试产生新 Run，页面、数据库与日志清楚标记 `execution_mode=mock`；mock 结果不使真实交付 Task done。
- 全局最多一个活动 mock Run；重复启动不会创建竞争运行。mock 成功/失败/取消可观察，不冒充 OS 进程证据。
- 关闭页面、重启服务后仍可查看 Task、Run 和已保存日志；进行中的 mock 不被恢复逻辑误报为真实成功。
- 本地服务只监听 loopback；状态修改接口具备本地请求保护，不开放执行真实 shell 的入口。
- 实际运行持久化/快照/输入校验测试与一条 UI E2E，补充可复现启动/测试命令；未运行的检查明确写未运行。

**Non-goals**：真实 Codex、Worktree 执行、真实 Accept、外部参与者、Kanban、Workflow 编辑器。

## FMVP-02 — 首个 profile 的真实执行与 Cancel

**Why**：用已存在的 Runtime 实验成果完成真实执行，而不是产品 UI 完成后才发现无法控制 Agent。

**What**：将已有 Runner/RepositoryIdentity/Codex Adapter 边界接入应用，先针对当前执行机器的一套 profile 验证，再开放真实启动与观察。实现相关异常阻塞，不等 FMVP-05 才补安全行为。

**Acceptance**：
- 先在 disposable repository 完成并引用 G1 验收，记录精确 head、环境、实际机制与 Codex 版本；仅合格 profile 可真实运行，其他显示 unavailable/compatible 限制。
- 输入、cwd、base revision、环境继承策略明确；复用原生登录态但不持久化或提交 secrets。
- 输出实时展示并持久化，退出信息来自可靠接口，不解析人类文案伪造终态。
- Cancel/timeout、重复 Cancel 与自然退出竞态保持一个真实业务结果；未知进程状态进入 interrupted/持锁，不启动下一个 Run，不自动重试。
- 关闭浏览器不杀死仍存活 Runner；服务/owner 失联不误判成功。接线复用已有 reconciliation 和 receipt，不另造第二框架。
- 补充输入和 Session ID 仅在接口确实提供时显示；Resume、TUI 接管与 PTY 多路复用不在本项。

**Non-goals**：全部平台同时开放、后台常驻 daemon、第二 Agent、源码分支自动提交/推送。

## FMVP-03 — 单一 Verification 与结果查看

**Why**：让用户依据真实变更与可重复验证结果判断，而不是只相信 Agent 表示完成。

**What**：在固定 test 阶段调用 frozen VerificationInvocation，展示初始/最终 Diff、验证 stdout/stderr、退出与警告，复用已有 invocation 和 tree/manifest 候选。

**Acceptance**：
- argv/shell 互斥、cwd 固定、env 策略与 overrides 引用、finite timeout 和输出/退出语义已冻结；不把敏感 env 值写进公开 Artifact。
- 每个 Run 一个 coordinator-owned VerificationInvocation；Agent 开发过程中的自测单独作为开发事实，不冒充更多业务 Run。
- exit 0 / nonzero / capture error / confirmed timeout 分别诚实记录；failed/error 可形成供人审阅的证据，但不伪称 DoD 全部通过。
- Diff 包含支持范围内的修改、删除、未跟踪文件；不支持的模式明确阻断，不静默遗漏。
- Verification 结果、所验证版本与最终 Package 版本之间有明确关联；验证后代码发生变化时不得显示为同一份已通过结果。
- Cancel 后无 test/review 越级推进；异常和资源锁规则与 02 一致。

**Non-goals**：通用 CI、多节点 Workflow、自动修复循环、需要新增平台能力的文件格式泛化。

## FMVP-04 — Sealed Change Package + Human Review

**Why**：让“接受”对应可取得的实际交付物，Workspace 消失后仍有确定的结果。

**What**：复用 change-package-v0 与 Artifact 候选，完成 seal、重放检查和一次 Accept/Reject。Seal 是 test→review 的内部屏障，不新增 Workflow 阶段。

**Acceptance**：
- 真实开放前取得 G2 证据；必需 Artifact readable/sealed/hash-match，唯一 Package 绑定 base revision、result tree 与相关证据。
- 删除原 Workspace 后，clean checkout 可从 Package 重建相同 tree；新增/删除/修改在支持范围内无遗漏。
- staging/finalize/DB 提交边界崩溃、对象缺失/损坏和重启不产生缺证据却可 Accept 的状态。
- ReviewDecision 引用同一 Run 的 Package ID/hash，不可替换；重复提交幂等，一个 Run 最多一个决定。
- drift 或未知资源禁止 Accept/Delivery，但证据可读时可查看并 Reject。Package 不可读时不伪造审阅决定。
- 决定/Run 终态/Task 投影/对应 Event 同事务；done 仅为已接受可重放交付物，Reject 后新 attempt，不改旧 Run。
- UI 明示尚未 merge/push；不自动修改源分支。已接受后损坏显示独立 delivery_integrity 异常，不能重写历史决定。

**Non-goals**：自动 Merge Back、冲突解决、通用审批、多 Reviewer、Evidence 评分平台。

## FMVP-05 — 历史恢复与异常解释

**Why**：验证“稍后回来”这个 Core Job，并使真实失败不需要重新拼接多个终端事实。

**What**：整合已随 02/04 实现的持锁和恢复机制到 Run History、详情、异常原因与下一步提示；不是把安全实现拖到最后。

**Acceptance**：
- 重开后能回答目标、停在哪一步、变更、Verification、决定、交付完整性、资源状态和下一步。
- 未确认停止的旧执行持续阻塞新 Run；原始 PID 已消失不单独构成安全证明，复用已有 ownership/OS truth 合同。
- reconciliation 只更新被允许的资源事实与锁，不改写既定业务终态或 sealed 内容。
- 缺失/损坏 Package 不继续提供健康交付；历史已接受事实保留，页面显示具体异常。
- 正常完成、取消、owner-loss、等待 Review 重启和交付物损坏都有端到端或明确界面的回归用例。

**Non-goals**：Session Resume、自动修复全部故障、完整事件时间线、后台 daemon。

## FMVP-06 — Founder 真实使用与最小修正

**Why**：用真实工作决定接下来值得优化什么，而不是继续靠新一轮架构想象扩范围。

**What**：在已开放的 profile 上由发起者选择原本就要处理的真实任务，记录恢复/控制/Review 的使用和摩擦，并只修复阻碍下一次使用的问题。

**Acceptance**：
- 至少一个真实、非演示代码任务走到可审核交付；记录客观结果，失败同样保留。
- 记录实际用了哪些控制面能力、额外录入成本、外部终端依赖和是否处理下一项真实任务；没有复用就写没有，不编造满意度。
- mock、同任务修补、故障注入、外部参与者与 Founder 自用各自分类；不改写旧 Product Gate 计数。
- 将最影响使用的少量问题转成有验收的修正，不扩成多 Runtime/Workflow 平台。
- 自用可用结论不等于外部验证或 PMF；外部试用仍需范围许可。

**Non-goals**：为凑数安排第二次使用、假装完成 3 人/5 问题/2 人独立复用。

## 共同完成定义

每项实现 PR 写明修改范围、Acceptance 对照、实际命令/退出结果、code SHA、未运行项、能力是否仍关闭。只把确有代码与验证的项改为 DONE。当前六项都未完成。

先交付 FMVP-01；02 的实验收尾与 03/04 的局部测试可以并行，但不得以并行名义提前激活未验收能力。无需在本文件之前再增加一轮全面 PM 文档。
