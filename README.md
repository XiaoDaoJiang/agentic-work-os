# Agentic Work OS

项目原生的人机协同工作控制面：组织目标、调用本地 Coding Agent、审核交付物，并保留可恢复的工作历史。

## 当前阶段：FMVP-01 已通过本机验收，FMVP-02 接入中

当前实现分支为 `feat/fmvp-01-task-mock-run`，目标基线为 `mvp/founder-foundation`。2026-10-16 在 Windows / Node 24.16.0 完成 Task + mock Run 验收。真实 Codex、Verification、Accept 和 Delivery 的产品入口仍关闭；这不是原 Product / Technical Gate PASS。

已支持 Task 创建/编辑、独立 Run 输入快照、模拟日志、成功/失败/取消、本地持久化和重开恢复。进行中的 mock 在服务重启后标为 interrupted，不自动续跑或补写成功。

## 启动

使用 Node 24 LTS。首次安装和启动：

```powershell
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:4317`。再次启动已构建的应用可使用 `npm start`。数据默认保存于仓库内 `.workos/`；关闭页面不清除历史。通过 `WORKOS_DATA_DIR` 指定其他本地目录，`WORKOS_PORT` 指定端口。同一数据目录只允许一个服务持有。

所有运行均明确标记 `mock`。仓库路径和 Verification 草稿只保存、不执行；模拟成功不会把 Task 标为真实交付 done。

## 验证

```powershell
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

也可使用已有 Chrome 执行界面验收：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

测试使用临时数据目录。当前 Playwright 1.52 的 Node 24 ESM loader 会挂起；测试入口仅为纯 `.mjs` 测试关闭该转换器，应用 TypeScript 构建不受影响。验收记录见 [FMVP-01](docs/mvp/01-fmvp-01-implementation.md)。

## 下一项

[FMVP-02](docs/mvp/02-fmvp-02-implementation.md) 先在一次性 Git 仓库接入真实 Codex，复用 Rust Runner 和运行归属候选。满足当前环境的 G1 条件后才开放用户真实任务；G2 继续控制审核接受与交付。

已用桌面内置 CLI 和 `gpt-6.1-sol` 跑通真实诊断，核对文件产物及安全退出；尚未开放 UI 中的真实执行。命令、版本差异、历史失败与剩余接线见上述记录。

| 入口 | 内容 |
|---|---|
| [MVP 开工入口](docs/mvp/README.md) | 当前顺序、第一切片计划和可直接交给 Codex 的提示 |
| [Founder MVP 范围与能力开放规则](docs/mvp/00-founder-mvp-scope.md) | 什么现在可以开发，真实执行和 Accept 何时才可开放 |
| [六个 WWA 开发切片](docs/pm/70-mvp-wwa-backlog.md) | Why / What / Acceptance、依赖与当前状态 |
| [Research 阶段交接快照](docs/research/2026-09-07-pre-mvp-handoff.md) | 决策、状态、进展、固定提交和原始来源 |
| [历史研究文档导航](docs/pm/README.md) | 原 PRD、实验协议与独立决策 |
| [Agent 工作约定](AGENTS.md) | 上下文优先级、执行安全、测试与 Git 规则 |

研究快照分支：`research/pre-mvp-handoff`。MVP 继承技术汇总 `d543dfa...` 的实验代码，保留在 `experiments/`，不自动升级为已验证生产能力；产品证据仍在原验证分支，以交接文件中的固定链接引用。

本机验收不代表其他平台通过，也不代表主线已合并、外部发布或完整真实任务闭环完成。
