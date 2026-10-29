# AI SDK / Codex App Server 迁移

> 授权：2026-10-30，用户确认迁移 AI SDK 实现。
> 基线：`c718283`；分支：`codex/ai-sdk-app-server`。
> 状态：实施与验证中，尚未取得新 profile 的 G1/G2。

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

driver 默认退出码为 1，只有明确成功 turn、无协议警告且关闭流程结束才设为 0。已复现 Provider 在 turn/start 返回后子进程崩溃可能留下悬空流、Node 默认自然退出 0；Provider 也会警告后丢弃损坏消息。这两类情况均拒绝进入成功 Verification。真实取消/超时继续由 Runner 停止整个受控边界，未知资源继续持锁。

## 验证顺序

1. 先写观察型测试：真实 SDK/Provider 对 fake JSON-RPC 子进程的成功、失败、RPC 错误、崩溃和拒绝审批；旧 profile 拒绝、依赖字节漂移拒绝、冻结 driver 输入。
2. 真实 Codex disposable fixture：实际改单文件，确认事件、退出与双流 drain。
3. 冻结执行代码，运行新 G1/G2、服务端/类型/构建及受影响 UI 回归；只依据实际产物开放能力。
4. 记录未运行项与现有待审核候选边界；不自动接受或重跑旧 Power Tool 任务。

## 当前实际结果

- 预检 RED：12 项中 8 通过、4 失败；协议 RED：5 项失败。
- 首次接线回归：18 项中 16 通过、2 失败（崩溃假成功、审批 fixture 缺少前序 item）。修复后协议集成 5/5 通过。
- 后续协议集成 13/13 通过，覆盖 EOF 后清理后代、超过管道容量的退出输出、忽略 EOF、损坏协议、无效配置、实际权限错误与分页中的活动 MCP。
- 前置检查 14/14 通过；Node 身份伪造测试先取得 2 项 RED，再验证修复。
- 真实配置检查：10 个配置 MCP 全部 disabled、工具为 0；仅 ephemeral thread，无模型调用，见本机 `config-check.json`。
- 首次真实改单文件成功但 `SURVIVOR_OBSERVED`，资源 unknown/held；保留失败证据。EOF 关闭修复后重跑：marker 匹配、driver/helper 均 exit 0、资源 safe/releasable；见 `native-smoke-eof.log`。两个诊断均发生在冻结代码前，不冒充最终 Gate。
- Server 编译和类型检查通过；普通浏览器回归 19 通过、3 个真实 Gate 用例跳过。首次默认浏览器缺失导致 22 项未能启动；随后显式使用本机 Chromium 1248 重跑。
- 完整回归和 G1/G2 待执行。
- npm 全量 audit 发现既有 Playwright 开发依赖 2 项 high（浏览器下载证书校验）；不把初次安装显示的 0 当作最终审计结果，不执行强制升级。
- `npm audit --omit=dev` 实际结果为 0 项漏洞。

原始诊断保存在本机忽略目录 `verification-output/ai-sdk-migration/`。原六切片验收与旧 G1/G2 保留为历史，不因本次替换自动变为新 profile 证据。
