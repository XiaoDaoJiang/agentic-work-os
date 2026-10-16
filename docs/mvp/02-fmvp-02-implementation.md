# FMVP-02 — 真实 Codex 接入

日期：2026-10-16。最初基线：`feat/fmvp-01-task-mock-run@f6aba2d`。本轮分支：`codex/fmvp-02-g1-execution`。当前状态：DONE，限定当前 Windows profile；G1、应用接线和真实浏览器验收完成，默认仍为 mock。未推送或合并，Verification / Accept / Delivery 仍关闭。

## 实施顺序

- [x] 收口 FMVP-01 的服务端、类型、构建与浏览器验收，更新入口和启动说明。本地提交 `6927c79`。
- [x] 核对 Codex CLI 与现有 Runner 合同，以一次性 Git 仓库实现真实接入诊断。
- [x] 复用 ProcessKit、RuntimeReceipt 与 Windows 进程事实，完成七条可控 fixture 检查。控制 stdin EOF 不等于所有物理 owner/helper crash 已验收。
- [x] 将实际结果与 G1 条件逐项对照。条件未满足时，产品真实执行入口保持关闭并说明缺口。
- [x] 回归 mock 行为，记录真实运行证据和仍未开放能力。
- [x] 补齐真实 Codex 的取消/timeout、物理 owner/helper crash 与重启锁、working-copy/drift 及退出竞态后，完成产品运行接线和 G1。

## 接入选择

最初接入时产品只执行确定性 mock。现有 Rust 主程序仅提供 doctor；Stage B 合同只支持 root-only transport，不支持 Cancel。

比较两个方案：扩展旧 Stage B 合同，或新增受限诊断入口并复用现有原生边界。选择后者，保留历史实验含义；不复制进程所有权和资源对账框架。应用仍使用 Node/TypeScript、React、SQLite，原生进程控制使用已有 Rust 候选。

Codex 在一次性仓库中运行，保留原生权限限制，不使用全权限绕过，不自动推送。不把诊断成功计为真实用户任务，也不把局部结果提升为完整 Technical Gate PASS。

## 工作拆分

- 前置步骤：先核对工作区并完成 FMVP-01 验收，再接真实执行。
- 独立工作：协调者运行 mock 与界面验收；接入 owner 负责独立的新模块及原生诊断。
- 共享状态：已有 API、Schema 和界面接线顺序修改；验收数据与工作仓库分离。
- 最小拆分：真实执行链路由单个 owner 负责，避免跨多个作者拆开进程、退出和取消不变量。

## 验证记录

环境：Windows x64，Node 24.16.0，npm 11.13.0，Rust 1.92.0，Git 2.51.2.windows.1。代码身份为 `6927c79` 加本轮未提交接入增量，不把基线 SHA 当作已包含新代码。

| 检查 | 实际结果 |
|---|---|
| `npm test` | 17/17 通过，包括原 mock 测试、Codex argv 与 API 能力关闭检查 |
| `npm run typecheck` | exit 0 |
| 系统 Chrome 下 `npm run test:e2e` | exit 0，2/2 通过，包含新的 capabilities 字段后的回归 |
| `cargo build --locked --manifest-path experiments/milestone-0/native-runner/Cargo.toml --bin diagnostic-runner` | exit 0 |
| `node tools/diagnostic-codex.mjs self-test` | 七条通过，见下表 |
| RuntimeReceipt、publication、reconciliation、failure ledger、Windows truth 五个 Rust 测试模块 | 合计 23/23 通过 |
| `cargo fmt --manifest-path experiments/milestone-0/native-runner/Cargo.toml -- --check` | exit 0 |
| 普通 clippy / strict clippy | 普通退出 0；`-D warnings` 被既有库中三条 lint 阻断，不称严格检查通过 |

七条 fixture 验证正常输出/退出、非零退出、两次 Cancel 输入、timeout、控制 stdin EOF、root 先退出但后代持流、owner 暂停读取输出。普通路径断言唯一 terminal；重复 Cancel 尚不是完整请求 ACK 或退出竞态验收。背压路径要求有界非零退出，不能依赖 owner 恢复读取才能清理。

两个继承同一模型的只读 reviewer 检查了诊断边界。同步 stdout 写曾可能阻塞 Tokio 与最终清理，已改为独立写线程、有界队列和有限 flush 等待，并用实际暂停读取 fixture 验证。两名 reviewer 均未将代码审查作为运行验收替代。

## 同模型 CLI 对照

模型始终为用户确认的 `gpt-6.1-sol`。不修改全局模型、provider 或登录态，不读取或提交凭证。

| 对照 | Codex 与产物 | 资源结论 |
|---|---|---|
| npm CLI 0.155.1，原用户配置 | HTTP 400，CLI 报该模型不支持当前账户，未创建 marker | unknown/held，保留 survivor 与 incomplete drain 事实 |
| 桌面内置 CLI 0.162.0-alpha.17.2，原用户配置 | exit 0，`turn.completed`，marker 内容正确 | 后代持流，unknown/held，诊断失败 |
| 桌面内置 CLI，完全忽略用户配置 | turn 完成，但写入被策略拒绝，marker 缺失 | safe 不代表任务成功，诊断失败 |
| 桌面内置 CLI，尝试 `mcp_servers={}` | marker 内容正确，仍出现原启动事件与持流 | 空表覆盖未解决问题，已撤去该参数 |
| 桌面内置 CLI，固定 Windows 诊断 profile | 同模型 exit 0、`turn.completed`，marker 精确内容匹配 | helper exit 0、safe/releasable、输出 drain 完成、failure ledger 为空；诊断命令 exit 0 |

桌面内置 CLI 已证明同一模型可实际完成任务，不能将旧 CLI 的错误上推成账户或模型全局不可用。程序路径与版本是后续 profile 证据的一部分。

最终 profile 显式设置模型，以 `--ignore-user-config` 隔离用户 MCP 配置，并显式恢复本机已有的 `windows.sandbox="elevated"` 与 `unified_exec=false` 行为。仍使用 `-a never` 和 `workspace-write`，不关闭规则、不使用全权限绕过。该参数组合已实际写出精确匹配的 marker，且确认输出收尾与边界空闲。

最终真实诊断证据目录后缀为 `agentic-codex-diagnostic-W6iiMM`；最终七条 self-test 为 `agentic-codex-diagnostic-kVi8pn`，均位于工具输出的系统临时目录。此前各组失败仍保留在各自目录。单次成功不等于真实 Codex Cancel/timeout、硬崩溃恢复或完整 G1 已通过。

## 运行诊断

先构建服务端和原生诊断程序：

```powershell
npm run build:server
cargo build --locked --manifest-path experiments/milestone-0/native-runner/Cargo.toml --bin diagnostic-runner
node tools/diagnostic-codex.mjs self-test
```

真实诊断必须显式指定模型：

```powershell
node tools/diagnostic-codex.mjs codex gpt-6.1-sol
```

工具从当前进程 PATH 解析原生 `codex.exe`，不执行 PowerShell/cmd shim。如存在多个版本，在当前终端把已验收的桌面 `app/resources` 目录前置到 PATH，不改全局 PATH。工具输出实际 exe、版本、临时证据目录及结果。每次创建独立 Git 仓库，不使用 Task 中填写的用户仓库。

本地原始结果在工具输出的临时目录中，去敏总览在忽略目录 `verification-output/fmvp-02/summary.json`。历史失败单独保留，后续成功不覆盖先前失败记录。

## 诊断阶段的能力记录

本节保留最初诊断接入时的状态，后续产品接线与验收进展见下文。

`GET /api/capabilities` 与 session 返回 `codex_profile.available=false` 及原因；真实启动、Verification、Accept/Delivery 仍被服务端拒绝。

诊断中的 `unknown/held` 是事实标签并伴随持久化 nonterminal receipt，尚不是产品调度器的持久化资源锁。实际 helper crash、启动 reconciliation、阻止重启后冲突执行、working-copy baseline/drift 与真实 Codex 退出竞态仍需接入并验收。未运行完整旧 Gate 矩阵或其他平台回归；不宣布 G1、G2、原 Technical Gate PASS。

## 2026-10-16 产品接线增量

本轮继续 FMVP-02，不展开竞品研究。工作台沿用现有 Task、运行历史和日志布局，真实结果只说明 Agent 阶段情况，不提前呈现 Verification、Review 或交付成功。

### how 与方案取舍

现有产品由 Node HTTP 服务校验本地请求，SQLite 保存 Task、冻结输入和追加日志，MockExecutor 负责确定性模拟。既有 Rust helper 已负责 Windows ProcessKit 边界、RuntimeReceipt、取消、timeout 和输出 drain。旧 Schema 的 CHECK 和触发器全部限定 mock，不能仅替换执行函数。

比较两种结构。方案 A 由现有应用协调业务状态，沿用 Rust helper 管理进程。方案 B 新建长期原生 daemon，应用只做 RPC。选择 A。B 需要新的 IPC、安装、重连和事件 replay，超出当前单用户单 Run 的需求。一个同模型只读设计代理核对了两个方案；这不是独立模型交叉验证。

数据形态以不可变 Run snapshot、独立业务终态和持久化 resource_lock 为中心。v2 migration 保留旧 mock 行和日志，恢复不可变触发器。v3 让同一把锁先归属 preparation request 与 Task，任何 Git 检查前即持久化占用；完整输入冻结后，在创建 Run 的同一事务中转移锁。准备阶段崩溃或 Git 过程异常时，锁保持，即使尚未生成 Run 也阻止新执行。已确认 Git 操作完成后的关闭或 Task 修订冲突可以释放准备锁。

只有 helper 成功退出、唯一 terminal、receipt 完整性和路径绑定、双流 drain 与 safe/releasable 同时成立，且后续 Git 观察过程没有未知资源，才释放 Run 锁。已确认的源仓库基线或工作副本 HEAD 漂移会使业务失败，资源事实单独保留。未知状态不自动重试，不按 PID 消失自动解锁。Git 检查使用有限超时，隔离继承的 Git 定位变量，并关闭 fsmonitor 与钩子。

### 本轮清单

- [x] Ground。读取范围、WWA、共同审美和现有应用/原生边界。
- [x] Sketch。比较应用协调与长期 daemon，选择复用现有 helper。
- [x] Agree。既定范围内直接推进，没有新增人工审批。
- [x] Implement。先观察资源恢复测试失败，再实现 v2/v3 Schema、真实执行协调、请求路由和最小 UI。
- [x] Verify。取得真实 Codex、物理 owner/helper crash、重启锁、drift、receipt 与 HTTP 接线证据。
- [x] Local delivery。检查差异与实际界面，完成本地交付记录。
- Scrap：不适用。本轮缺陷已在现有应用和 helper 边界内修正，无另建框架需求。

吞吐检查保持四项。前置检查为本地身份、Schema、能力验证和测试。独立工作流为只读审查与执行工具完善。共享状态中的 API、Schema、executor 与 UI 由一个代码 owner 顺序整合。最小安全拆分为一个实现 owner，避免多个作者并写进程状态。

真实能力默认关闭。只有本机 G1 manifest 的激活标记、所需 case、平台、Node/OS 和模型一致，且实际源码、加载的 dist、Codex 与 helper 的 SHA-256 匹配，服务才开放该 profile。每次真实 start 再校验。`WORKOS_G1_EVIDENCE` 只指向本地忽略目录中的实际验收记录，不是布尔绕过。诊断构造选项不由 main 暴露，只允许带显式标记的系统临时 fixture 根和其内仓库；诊断能力不计为 G1 已开放。

当前限制为干净的普通 Git 根仓库、独立 clone、单全局 Run、固定三分钟 Agent 超时。submodule 暂不支持。工作副本 HEAD 在执行中变化会报告 workspace_drift，当前切片尚不支持 Agent 自行 commit 后作为正常结果继续推进。工作树中的正常文件修改被保留。Verification、Accept、Delivery 和原 Gate 仍关闭。

### 本轮复核与回归

两名继承同一模型的只读审查者检查了应用接线和验收脚本。修正了真实 workspace drift 用例未经过实际 Run，以及取消与 timeout 未证明工具后代已启动的证据缺口。后续定向审查复核 preparation 锁的持久化、转移、迁移与恢复，没有新增发现。审查不替代运行验收。

本轮另外修正了跨模式幂等键冲突、准备期间 Task 编辑造成输入混合、关闭期间晚启动、实际源码与 dist 的验收身份绑定、已加载模块与后来文件之间的身份混用，以及 Git 准备和观察失败时的提前解锁。诊断收据同时核对 schema、严格字节数组、hash、运行身份、工作副本、原生边界与 helper revision。

独立串行执行 `npm test` 最终 28/28 通过，`npm run typecheck` exit 0。完整输出见本地忽略目录 `verification-output/fmvp-02/unit-final.txt`。较早一轮独立回归在模拟 helper 收尾处挂起，被明确终止并记录为未通过，见 `coordinator-interrupted-unit.json`；不将该轮计为通过。故障注入用例现有异常收尾，最终串行回归已完成。

### 真实验收轮次

原始记录保存在本地忽略目录 `verification-output/fmvp-02/`，不提交原始 CLI 日志或个人路径。

| 轮次与代码身份 | 实际结果 | 证据目录 |
|---|---|---|
| `dd7644a`，WindowsApps Codex 0.138.0-alpha.7 | normal 退出 1，模型不支持；资源 safe、输出已 drain，任务未成功 | `workos-g1-Dml2ls` |
| `dd7644a`，桌面 Codex 0.162.0-alpha.17.2 | normal 通过；非零故障注入未生效，CLI 实际退出 0，脚本拒绝通过 | `workos-g1-DQXJaV` |
| `2d3715f`，桌面 Codex 0.162.0-alpha.17.2 | 当时的 13 项矩阵和 HTTP 路径通过；追加审查发现前置 Git 尚未持锁，未作为最终开放依据 | `workos-g1-D9ONsD` |
| `2af70c782a80e93543594d900875caa2db46f9db`，桌面 Codex 0.162.0-alpha.17.2 | v3 修复后的 15 项检查通过；HTTP 正常输出、重复 start、工具启动后的重复 cancel 通过；命令 exit 0，生成本机激活记录 | `workos-g1-LPqVqy` |

上述真实调用均保持模型 `gpt-6.1-sol`。非零用例通过 exec 局部的无效 provider 配置取得 CLI 非零退出，验证启动失败的输出、退出和清理路径，不冒充 Agent 已执行任务后的业务失败。取消与 timeout 等待预置脚本写出工具父子 PID，再核对停止与 drain；退出竞态在 `turn.completed` 输出后、helper terminal 前发送取消。

原七条 native self-test 已实际通过，其持久化副本为 `native-self-test-BxvUaT`。该次 head 为 `c250285`，当时 profile 摘要增量尚未提交；本轮原生 helper 实现与二进制未变，不能把这份记录的 head 改写成最终应用 head。

15 项检查中的 normal、nonzero、cancel、timeout、exit-race、owner/helper crash、restart-lock、source/workspace drift 与 receipt-integrity 使用实际 Codex 或其受控进程。idempotency、request-protection、preparation-lock 和 post-run-git-failure 还引用应用测试与定向故障注入；最后再通过 HTTP 验证真实文件输出、重复 start 与重复 cancel。准备/观察故障测试不冒充实际 Git 超时或真实用户任务。

### 当前 profile 的本地启动

本轮最终记录为本地忽略文件 `verification-output/fmvp-02/workos-g1-LPqVqy/g1.json`，绑定 Windows x64、OS release `10.0.19045`、Node `v24.16.0`、Codex `0.162.0-alpha.17.2`、模型 `gpt-6.1-sol`，以及实际 Git/Rust 版本和执行文件 hash。记录中的代码 SHA 是执行验收时的精确提交；后续只改文档不会改变执行身份。更换执行源码、dist、CLI、helper 或相关环境后，匹配失败则真实能力关闭，需要重新验收。

在已完成构建的本机工作区中显式启用：

```powershell
$env:WORKOS_G1_EVIDENCE = (Resolve-Path verification-output/fmvp-02/workos-g1-LPqVqy/g1.json).Path
npm start
```

页面默认选择 mock；用户保存 Task 后再选择 Codex。未提供有效记录时仍可用 mock。回退到 mock-only：停止本地服务，`Remove-Item Env:WORKOS_G1_EVIDENCE -ErrorAction SilentlyContinue`，重新启动。不要复制验收文件到不同环境冒充通过。

重新验收使用本机已确认的 CLI 路径，不修改全局配置或登录态：

```powershell
npm run build
cargo build --locked --manifest-path experiments/milestone-0/native-runner/Cargo.toml --bin diagnostic-runner
node tools/verify-g1.mjs '本机已确认的原生 codex.exe 绝对路径'
```

该命令会真实调用 CLI、创建一次性仓库并执行故障注入。以命令输出的新 manifest 路径为准；失败记录保留，不沿用旧记录开放新代码。未知资源锁不会因切换到 mock、重启或记录过期而自动释放。

### 最终应用与浏览器验收

执行代码与 dist 固定在 `2af70c782a80e93543594d900875caa2db46f9db`；之后只修正 UI 测试的页面刷新与选项前提、更新文档，不修改已验收执行身份。

| 实际命令 / 范围 | 结果 |
|---|---|
| `npm test` | exit 0，28/28，无跳过；串行独立回归 |
| `npm run typecheck` | exit 0 |
| `node tools/verify-g1.mjs <已确认的 codex.exe>` | exit 0，15 项检查及 HTTP 最终路径通过；`workos-g1-LPqVqy/g1.json` |
| `node tools/build-web.mjs` | exit 0；使用最终 UI 源码构建 |
| 有效 manifest + 系统 Chrome，`node tools/test-e2e.mjs tests/e2e/fmvp-02.spec.mjs` | 最终 exit 0，1/1 实际通过，无跳过，约 1.2 分钟 |
| 无 manifest + 系统 Chrome，`node tools/test-e2e.mjs tests/e2e/fmvp-01.spec.mjs` | exit 0，2/2 通过，18.9 秒；确认默认 mock-only 路径 |

真实浏览器检查了精确文件内容、关闭页面后重开、服务重启后日志完全一致、已启动工具后的 UI 取消、owner 硬终止后的 interrupted/持锁提示、两种启动按钮均被禁用，以及源仓库 HEAD 和 clean 状态不变、无 pageerror。重启后明确刷新页面，不把保留中的 SPA 当成重新加载。

首轮真实 UI 测试在 owner-loss 后假定已切回 mock，未找到 mock 按钮而失败；执行方式实际保留为 real。修正测试的刷新与明确切换后重跑全流程，未放宽产品断言。失败截图和说明保存在 `ui-first-failed`；最终三张截图在 `ui-final-passed`，已人工查看正常退出和持锁布局，状态文字、任务与历史关系保持清楚。原始截图和日志只留本地忽略目录。

验收按六条 WWA Acceptance 对照：一次性仓库与精确 profile 已有 G1；snapshot 保存 cwd/base/argv/env 策略与模型；真实输出追加持久化；取消、超时、重复请求及退出竞态已查验；关闭页面与 owner-loss 分别验证持续运行和持锁阻塞；真实 CLI 的 session 事实留在原始 JSON 输出中，不另造 Resume/TUI 能力。

**已开放**：仅提供有效且匹配的本机记录时，当前 Windows profile 可启动 Codex、观察输出、请求取消；mock 持续可用。**仍关闭**：Verification、Diff、Review、Accept/Delivery、自动 commit/push/merge、其他平台真实执行。未运行其他平台或完整历史 Gate，未完成真实用户任务闭环；故障注入不计 Founder 使用或产品复用。

资源未知后保留锁和历史，本切片没有人工强制解锁或自动重试入口。当前代码任务的正常文件修改保留在独立 workspace，尚未封存为可重放交付物；不能把临时工作副本当成交付保证。下一切片按 FMVP-03 接入单一 Verification。
