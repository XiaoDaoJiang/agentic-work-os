# FMVP-02 — 真实 Codex 接入

日期：2026-10-16。基线：`feat/fmvp-01-task-mock-run@f6aba2d`。当前状态：IN_PROGRESS，诊断入口已有实现，产品真实执行仍关闭。

## 实施顺序

- [x] 收口 FMVP-01 的服务端、类型、构建与浏览器验收，更新入口和启动说明。本地提交 `6927c79`。
- [x] 核对 Codex CLI 与现有 Runner 合同，以一次性 Git 仓库实现真实接入诊断。
- [x] 复用 ProcessKit、RuntimeReceipt 与 Windows 进程事实，完成七条可控 fixture 检查。控制 stdin EOF 不等于所有物理 owner/helper crash 已验收。
- [x] 将实际结果与 G1 条件逐项对照。条件未满足时，产品真实执行入口保持关闭并说明缺口。
- [x] 回归 mock 行为，记录真实运行证据和仍未开放能力。
- [ ] 补齐真实 Codex 的取消/timeout、物理 owner/helper crash 与重启锁、working-copy/drift 及退出竞态后，完成产品运行接线和 G1。

## 接入选择

当前产品只执行确定性 mock。现有 Rust 主程序仅提供 doctor；Stage B 合同只支持 root-only transport，不支持 Cancel。

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

## 尚未开放的能力

`GET /api/capabilities` 与 session 返回 `codex_profile.available=false` 及原因；真实启动、Verification、Accept/Delivery 仍被服务端拒绝。

诊断中的 `unknown/held` 是事实标签并伴随持久化 nonterminal receipt，尚不是产品调度器的持久化资源锁。实际 helper crash、启动 reconciliation、阻止重启后冲突执行、working-copy baseline/drift 与真实 Codex 退出竞态仍需接入并验收。未运行完整旧 Gate 矩阵或其他平台回归；不宣布 G1、G2、原 Technical Gate PASS。
