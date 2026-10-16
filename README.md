# Agentic Work OS

项目原生的人机协同工作控制面：组织目标、调用本地 Coding Agent、审核交付物，并保留可恢复的工作历史。

## 当前阶段：FMVP-03 已通过当前 Windows profile 验收

当前实现分支为 `codex/fmvp-03-verification`，目标基线为 `mvp/founder-foundation`。2026-10-16 在 Windows x64 / Node 24.16.0 完成 FMVP-01 至 FMVP-03 验收。真实 Codex 与单次 Verification 仅在本机 G1 记录匹配时开放，默认仍为 mock；Accept 和 Delivery 仍关闭。这不是原 Product / Technical Gate PASS，也不表示已合并到基线或 main。

已支持 Task 创建/编辑、独立 Run 输入快照、模拟日志、成功/失败/取消、本地持久化和重开恢复。进行中的 mock 在服务重启后标为 interrupted，不自动续跑或补写成功。

真实路径支持独立 Git 工作副本、Codex 输出持久化、取消与未知资源持锁。明确选择“本次执行验证”后，Agent 成功且安全退出才运行冻结的命令，展示 stdout/stderr、退出结果和验证前后 Diff。版本变化时不把最终版本显示成已验证；未选择验证则仍为“Agent 已退出 · 尚未验证”。Task 不会因此变为 done。

## 启动

使用 Node 24 LTS。首次安装和启动：

```powershell
npm ci
npm run dev
```

浏览器打开 `http://127.0.0.1:4317`。再次启动已构建的应用可使用 `npm start`。数据默认保存于仓库内 `.workos/`；关闭页面不清除历史。通过 `WORKOS_DATA_DIR` 指定其他本地目录，`WORKOS_PORT` 指定端口。同一数据目录只允许一个服务持有。

默认运行明确标记 `mock`，不读取用户仓库。保存 Verification 草稿不会执行；真实 Run 中另行明确选择才运行。模拟成功不会把 Task 标为真实交付 done。

本机已验收 profile 可显式启用真实执行：

```powershell
$env:WORKOS_G1_EVIDENCE = (Resolve-Path verification-output/fmvp-03/workos-g1-p0Vnjl/g1.json).Path
npm start
```

页面仍默认 mock，保存 Task 后可选择 Codex，并选择本次是否执行已保存的验证命令。要求干净的普通 Git 根仓库，不支持 submodule；Agent 最长执行三分钟，验证使用所选超时，当前不支持 Agent 自行 commit。捕获限普通文件和 8 MiB，不支持 attributes/filter 等内容转换。证据只适用于本机当前执行代码、CLI、helper、PowerShell 与环境；缺失或不匹配时关闭真实能力。重新验收、回退与限制见 [FMVP-03 记录](docs/mvp/03-fmvp-03-implementation.md)。

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

测试使用临时数据目录。真实 UI 测试需要有效的 `WORKOS_G1_EVIDENCE`，会真实调用 Codex；未提供时跳过，不计为真实验收通过。当前 Playwright 1.52 的 Node 24 ESM loader 会挂起；测试入口仅为纯 `.mjs` 测试关闭该转换器，应用 TypeScript 构建不受影响。验收记录见 [FMVP-01](docs/mvp/01-fmvp-01-implementation.md)、[FMVP-02](docs/mvp/02-fmvp-02-implementation.md)和 [FMVP-03](docs/mvp/03-fmvp-03-implementation.md)。

## 下一项

[FMVP-04](docs/pm/70-mvp-wwa-backlog.md) 接入 Sealed Change Package 与 Human Review。已有验证结果是历史捕获证据，当前 Workspace 未重新检查，尚无可重放的封存交付物。G2 继续控制审核接受与交付；下一切片读取其 WWA，并复用现有 Artifact 与重放候选。

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
