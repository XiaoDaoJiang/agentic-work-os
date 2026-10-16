# FMVP-01 实施与验证

基线：`mvp/founder-foundation@16d738e853a1b0e6f91a76b8340a2bd4aec9ed18`。
范围仅为 Task + 确定性 mock Run；不是 G1/G2 或原 Gate 验收。

状态：DONE（2026-10-16，限定 Windows 本机 mock 能力）。原实现 `69a8de2`，UI 断言修正 `f6aba2d`，本轮另修复测试入口兼容性并更新文档。

## 短实施计划

1. 先写输入、快照、并发、日志与重启恢复的可观察测试，确认 RED。
2. Node HTTP + SQLite migration 实现 API、原子单活动约束与幂等请求。
3. 仅内存计时器推进固定 mock 步骤；日志落库；重启将遗留 running 改为 interrupted，不续跑、不补成功。
4. React 实现创建/编辑 Task、历史 Run、不可变快照、持续日志和取消。
5. 实际运行单测/API/进程重启测试、类型检查、构建、浏览器 E2E；修复真实失败。
6. 更新既有入口和 FMVP-01 状态，提交目标为 MVP 基线的 PR。

## 可逆局部选择

Node 内置 HTTP / SQLite，无额外 Web 框架或 ORM；显式 SQL migration。
React + TypeScript + esbuild，构建后由同一 loopback 服务提供静态页与 API，避免第二个开发服务的跨源边界。
不引入通用 Workflow、Agent、Artifact 或进程所有权框架，不改动 experiments。

依赖安装、构建和测试在开发/临时目录中进行，与产品保存但绝不执行的 Verification 草稿严格分开。

## 本轮实际验收

环境：Windows x64，Node 24.16.0，npm 11.13.0，Playwright 1.52.0，系统 Chrome。基础代码 `f6aba2d9948f9422c2d5b19dbca6dc02ba17fc64` 加本轮测试入口和文档变更；提交身份可从 Git 历史追溯。

| 命令 / 操作 | 实际结果 |
|---|---|
| `npm ci --no-audit --no-fund` | exit 0，安装锁定依赖 |
| `npm test` | exit 0，FMVP-01 16/16 服务端测试通过，无跳过 |
| `npm run typecheck` | exit 0，前后端类型检查通过 |
| `npm run build` | exit 0，服务端与前端生产构建通过 |
| 设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 为系统 Chrome，执行 `npm run test:e2e` | exit 0，2/2 浏览器测试通过 |
| browser-harness 实际界面操作 | 空字段错误、Task 创建、mock 日志与模拟成功已核对，并保存界面截图 |

原始 E2E 入口在本机挂起，无测试结果。对照执行仅关闭 Playwright 1.52 的 TS ESM loader 后可正常枚举两项测试；新增 `tools/test-e2e.mjs` 为纯 `.mjs` 测试关闭该 loader。没有关闭应用类型检查、删除断言或升级依赖。

## Acceptance 对照

- 输入校验覆盖必填、非法字段、超大 JSON 和路径形式；mock 不读取实际仓库或执行 Verification。
- Task/Run 独立稳定 ID、完整不可变输入快照和编辑隔离由存储/API 测试及 UI 验证覆盖。
- 原子单活动 Run、重复请求与幂等冲突、成功/失败/两类取消均有测试。
- 浏览器关闭后运行继续；服务重启后历史、日志和 ID 保留。运行中强制结束服务后恢复为 interrupted，不补写成功。
- loopback、Host、Origin、会话令牌与 Fetch Metadata 防护有 API 测试；真实执行和 Accept/Delivery 继续拒绝。
- mock 成功后 Task 保持 ready，没有真实交付 done。

本地原始报告位于忽略目录 `playwright-report/`、`test-results/`，人工截图位于 `verification-output/fmvp-01/manual-success.png`。这些可重新生成，不作为提交的用户数据。未运行 Linux/macOS 回归、完整原 Gate 矩阵或线上 CI；Windows 通过不外推其他环境。
