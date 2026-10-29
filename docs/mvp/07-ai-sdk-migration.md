# AI SDK / Codex App Server 迁移

> 授权：2026-10-30，用户确认迁移 AI SDK 实现。
> 基线：`c718283`；分支：`codex/ai-sdk-app-server`。
> 实现提交：`461aaa6`；最终退出保护：`3931a6e`。
> 状态：迁移实现完成；最终代码 G1/G2 与三个真实浏览器用例均已通过。

## 设计与范围

用固定版本 AI SDK 与社区 Codex Provider 替换一次性 `codex exec` 接入。每个 Run 由现有 Rust Runner 启动 Node driver，driver 使用 `streamText` 和 `codexAppServer` 完成一个临时 thread/turn，再关闭 Provider。Node driver、App Server 与工具后代均须在既有受控边界内；Turn 完成及 Provider.close 返回不能替代物理停止与输出 drain。

依赖固定为 `ai@7.0.157`、`ai-sdk-provider-codex-cli@2.3.0`、`zod@4.6.7`，原 Codex 可执行文件仍显式绑定。新 profile 为 `windows-processkit-codex-app-server`。Task/Run、全局资源锁、独立工作副本、单次冻结 Verification、版本捕获、封包、重放与人工 Review 继续复用。不增加持续会话、自动重试、多人或其他 Runtime。

## 配置与故障边界

Provider 2.3.0 缺少所需启动参数和正常关闭能力，仓库 postinstall 对固定发行字节作有 SHA256 校验的局部补丁：

- 启动时设置 never / workspace-write / Windows elevated、OpenAI provider、空 notify，并关闭 apps、hooks、plugins 和 unified_exec。
- 创建 thread 前按 cwd 读取有效配置，检查上述策略，并将所有有效 MCP 名称逐项覆盖为 `enabled=false`。空 `mcp_servers={}` 是合并语义，不能用于清空继承配置。
- 检查 thread 返回的实际权限、cwd，以及分页 MCP 状态全部 disabled、工具为空；不满足就不创建 turn。
- 关闭时先发送 stdin EOF、持续消费双流并等待 close；超时终止并返回失败。Provider 的关闭池必须传播失败，不能吞掉错误。

非预期包字节拒绝安装补丁。依赖实际 JS/JSON/WASM、lockfile、Node 可执行文件路径与哈希一起进入执行身份。升级 Provider/Codex 后必须重新审查补丁并验收，不沿用旧 Gate。

App Server 不支持 exec 专属的 `--ignore-user-config`。此实现仍使用原生登录和 CODEX_HOME，不能宣称完全忽略用户配置；参数发送测试与真实配置生效检查分别记录。不读取、复制或提交登录凭据，不开启全权限绕过。

历史 Run 的输入、profile 与 sealed Package 不迁移或改写。旧 G1/G2 不能激活新执行栈；此前 Power Tool 的待审核候选在新身份下保持历史只读，不自动重绑 Review 身份、重跑任务或应用到原仓库。

driver 默认退出码为 1，只有明确成功 turn、无协议警告且关闭流程结束才设为 0。已复现 Provider 在 turn/start 返回后子进程崩溃可能留下悬空流、Node 默认自然退出 0；Provider 也会警告后丢弃损坏消息。这两类情况均拒绝进入成功 Verification。真实取消/超时继续由 Runner 停止整个受控边界，未知资源继续持锁。

## 验证顺序

1. 先写观察型测试：真实 SDK/Provider 对 fake JSON-RPC 子进程的成功、失败、RPC 错误、崩溃和拒绝审批；旧 profile 拒绝、依赖字节漂移拒绝、冻结 driver 输入。
2. 真实 Codex disposable fixture：实际改单文件，确认事件、退出与双流 drain。
3. 冻结执行代码，运行新 G1/G2、服务端/类型/构建及受影响 UI 回归；只依据实际产物开放能力。
4. 记录未运行项与现有待审核候选边界；不自动接受或重跑旧 Power Tool 任务。

## 当前实际结果

- 预检 RED：12 项中 8 通过、4 失败；协议 RED：5 项失败。
- 首次接线回归：18 项中 16 通过、2 失败（崩溃假成功、审批 fixture 缺少前序 item）。修复后协议集成 5/5 通过。
- 最终协议集成 14/14 通过，覆盖 EOF 后清理后代、超过管道容量的退出输出、忽略 EOF、损坏协议、无效配置、实际权限错误、分页中的活动 MCP，以及输出背压下 completed 后非零退出。迟到警告的极窄竞态由静态审核发现，未取得有效 RED；不把辅助测试中的时序失败当成复现。
- 前置检查 14/14 通过；Node 身份伪造测试先取得 2 项 RED，再验证修复。
- 真实配置检查：10 个配置 MCP 全部 disabled、工具为 0；仅 ephemeral thread，无模型调用，见本机 `config-check.json`。
- 首次真实改单文件成功但 `SURVIVOR_OBSERVED`，资源 unknown/held；保留失败证据。EOF 关闭修复后重跑：marker 匹配、driver/helper 均 exit 0、资源 safe/releasable；见 `native-smoke-eof.log`。两个诊断均发生在冻结代码前，不冒充最终 Gate。
- Server 编译和类型检查通过；普通浏览器回归 19 通过、3 个真实 Gate 用例跳过。首次默认浏览器缺失导致 22 项未能启动；随后显式使用本机 Chromium 1248 重跑。
- `461aaa6` 完整服务端 58/58、G1 18/18 通过，清单为 `verification-output/fmvp-04/workos-g1-Pb74qp/g1.json`。新增退出保护后旧身份失效，最终版本必须重新验收。
- `3931a6e` 服务端 59/59；G1 18/18、G2 18/18，均 exit 0。实际调用 `readExecutionProfile` / `readReviewProfile` 再次确认两个清单与当前代码、依赖、Node、Codex 和 Helper 匹配。
- 真实 UI 的运行/重开/取消/owner-loss 与冻结 Verification 两项通过。交付 UI 首次在接受后默认 5 秒观察超时，但 HTTP 成功且接受决定已落库；实测刷新 6973ms，观察预算对齐已有 22 秒读取预算。第二次在源仓临时离线时出现读取超时与交付失败两条 alert，修正测试定位为明确的交付失败提示，保留读取失败后的禁用与恢复断言。两次失败证据保留，应用代码和 Gate 判据未改动。
- 最终真实 UI 3/3 通过、0 跳过：`ui-g1.log` 为 2/2，`ui-g2-verified.log` 为 1/1（159.3 秒）。覆盖同一封包接受、删除 Workspace 后下载、源仓离线/恢复、交付物缺失/损坏与历史决定不变。截图保存在 `ui-g2-verified/`。加上普通 UI 19 项，共 22 项在对应能力配置下通过。
- npm 全量 audit 发现既有 Playwright 开发依赖 2 项 high（浏览器下载证书校验）；不把初次安装显示的 0 当作最终审计结果，不执行强制升级。
- `npm audit --omit=dev` 实际结果为 0 项漏洞。

原始诊断保存在本机忽略目录 `verification-output/ai-sdk-migration/`。原六切片验收与旧 G1/G2 保留为历史，不因本次替换自动变为新 profile 证据。

## 当前本机清单与启动

- G1：`verification-output/fmvp-04/workos-g1-WyREl3/g1.json`
- G2：`verification-output/ai-sdk-migration/g2-3931a6e/g2.json`
- 环境：Windows x64 / Node 24.16.0 / Codex 0.165.0-alpha.1.2 / `gpt-6.1-sol`。

在仓库根目录、原有本地服务正常停止且资源已确认安全后启动：

```powershell
npm run build
$env:WORKOS_G1_EVIDENCE = (Resolve-Path 'verification-output/fmvp-04/workos-g1-WyREl3/g1.json').Path
$env:WORKOS_G2_EVIDENCE = (Resolve-Path 'verification-output/ai-sdk-migration/g2-3931a6e/g2.json').Path
npm start
```

未提供清单或身份发生变化时，真实 Agent、Accept / Delivery 保持关闭。其他平台、持续会话、计费归属和外部发布未验收。本机原始证据不提交；其他安装必须重新生成自己的清单。

完整依赖与执行文件的同步指纹检查存在可见开销：本机单次 G1 读取约 1.1 秒，G2 约 2.1 秒，审核刷新可能需要数秒。此次未增加指纹缓存，后续优化必须保留实际字节漂移时关闭能力的保证。
