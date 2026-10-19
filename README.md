# Agentic Work OS

项目原生的人机协同工作控制面：组织目标、调用本地 Coding Agent、审核交付物，并保留可恢复的工作历史。

## 当前阶段：FMVP-04 已通过限定 Windows profile 验收

本地实现栈已完成 FMVP-01 至 FMVP-04，目标基线为 `mvp/founder-foundation`。2026-10-19 在 Windows x64 / Node 24.16.0 完成当前执行身份的G1/G2与真实浏览器验收。真实 Codex 与单次 Verification 仅在本机 G1 记录匹配时开放；审核与交付还要求匹配G2，默认仍为mock。这不是原 Product / Technical Gate PASS，也不表示已合并到基线或 main。

已支持 Task 创建/编辑、独立 Run 输入快照、模拟日志、成功/失败/取消、本地持久化和重开恢复。进行中的 mock 在服务重启后标为 interrupted，不自动续跑或补写成功。

真实路径支持独立 Git 工作副本、Codex 输出持久化、取消与未知资源持锁。明确选择“本次执行验证”后，Agent 成功且安全退出才运行冻结的命令，展示 stdout/stderr、退出结果和验证前后 Diff。G2匹配时将同次证据与Change Package封存，人工接受后才使对应Task变为done。接受与下载均强制受控漂移/重放检查；删除Workspace后仍可交付，原source须保有frozen base。done不表示merge、push或发布。未选择验证仍为“Agent 已退出 · 尚未验证”。

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
$env:WORKOS_G1_EVIDENCE = (Resolve-Path verification-output/fmvp-04/workos-g1-Fl2n6T/g1.json).Path
$env:WORKOS_G2_EVIDENCE = (Resolve-Path verification-output/fmvp-04/g2-a678b37-20261019/g2.json).Path
npm start
```

以上manifest是本机忽略目录内的验收产物，新克隆不会自带。页面仍默认mock，保存Task后选择Codex，并明确选择本次验证。要求干净的普通Git根仓库，不支持submodule；Agent最长三分钟，验证使用所选超时。验证路径按frozen base捕获Agent提交和未提交变更；未验证路径仍对HEAD变化报漂移。捕获限普通文件和8MiB，不支持attributes/filter等内容转换。证据仅适用于所记录执行代码、CLI、helper、PowerShell与环境，不匹配即关闭对应真实能力。验收与限制见[FMVP-04记录](docs/mvp/04-fmvp-04-implementation.md)。

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

测试使用临时数据目录。未提供G1/G2时真实UI用例会跳过，不计为真实验收。实际profile测试会调用Codex，应串行执行：02/03只设置G1并移除G2，04同时设置两份当前证据。

```powershell
Remove-Item Env:WORKOS_G2_EVIDENCE -ErrorAction SilentlyContinue
node tools/test-e2e.mjs tests/e2e/fmvp-02.spec.mjs tests/e2e/fmvp-03.spec.mjs
$env:WORKOS_G2_EVIDENCE = (Resolve-Path verification-output/fmvp-04/g2-a678b37-20261019/g2.json).Path
node tools/test-e2e.mjs tests/e2e/fmvp-04.spec.mjs
```

Playwright 1.52在Node 24的ESM loader会挂起；现有入口仅为纯.mjs测试关闭该转换器，应用TypeScript构建不受影响。详细证据见各切片实施记录，当前汇总见[FMVP-04](docs/mvp/04-fmvp-04-implementation.md)。

## 下一项

[FMVP-05](docs/pm/70-mvp-wwa-backlog.md)整合重开后的冻结目标、资源事实、异常与下一步，并完成UI统一回归。之后通过应用处理发起者已提供的Power Tool真实任务；当前尚未取得Founder闭环，不用演示fixture替代。

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
