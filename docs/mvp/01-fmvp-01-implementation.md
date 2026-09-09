# FMVP-01 实施与验证

基线：`mvp/founder-foundation@16d738e853a1b0e6f91a76b8340a2bd4aec9ed18`。
范围仅为 Task + 确定性 mock Run；不是 G1/G2 或原 Gate 验收。

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
