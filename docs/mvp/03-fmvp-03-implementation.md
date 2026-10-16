# FMVP-03 单一 Verification 与结果查看

日期为 2026-10-16。状态为 DONE，限定当前 Windows 本机 profile。本轮从 `85b3529` 建立 `codex/fmvp-03-verification`，沿用 FMVP-02 的本机执行基线。用户可查看一次受控验证及其对应代码版本，范围以 WWA FMVP-03 为准；未合并或发布。

## 实施清单

- [x] Ground。核对应用 Run、资源锁、原生 helper 与既有 Verification/tree 合同。
- [x] Sketch。比较两个结构方案并做只读交叉评估。
- [x] Agree。既定范围内直接选定最小方案。
- [x] Implement。先写行为测试，再由一个 owner 修改共享执行、Schema、API 和 UI。
- [x] Verify。实际命令、资源异常、版本漂移、浏览器与必要 G1 回归。
- [x] Local delivery。审查差异，记录命令和证据，更新入口。
- Scrap。仅在实现持续暴露结构不成立时重新设计。

## 吞吐检查

- [x] 前置步骤。已读合同和候选，验证选择与用户所见 Task 版本必须显式冻结。
- [x] 独立工作。两个设计候选只写各自本地证据文件；只读评估与最终运行验证分开。
- [x] 共享状态。Run、SQLite、全局锁和原生执行由单个实现 owner 顺序修改；真实 CLI 验收串行。
- [x] 最小安全拆分。实现由一个 owner 负责，协调者负责选型、独立复核、浏览器与本地交付。

## Grounding

现有 `RealExecutor.start` 在 Git preflight 前持久化准备锁，冻结 Task 与 RealSnapshot，clone 独立工作副本，再用既有 Rust diagnostic-runner 启动 Codex。helper 管理 Windows Job、收据、取消和双流 drain；应用只在这些事实同时确认后释放全局锁。当前成功终态停在 agent，Verification 草稿从未获准执行。

Store 负责事务、不可变 Run 输入、追加日志和资源锁。API 负责本地来源与 session 校验。G1 manifest 绑定执行源码、dist、CLI、helper 与本机环境；执行改动会使旧记录失效。当前 UI 以 Task、Run、日志和历史为中心。

既有 `verification-invocation.mjs` 验证互斥 argv/shell、assigned workspace、env 策略、有限 timeout 和流输出合同。`git-result-tree.mjs` 使用独立临时 index 收集增改删与 result tree；接入前仍须检查 Git 子进程、过滤器、文件模式和工作树版本一致性，不把候选直接视为产品能力。

设计约束包括每 Run 最多一次 coordinator-owned Verification，Agent 成功且安全退出后才可转入 test，锁不得在阶段之间释放。旧 Task 的草稿和历史 Run 不得被静默执行。验证前后及后续读取的版本关联必须能解释漂移。Accept、Delivery 与 Task done 仍由后续 G2 控制。

## Arena 检查表

- [x] Frame。产物为局部模块/类型/执行流程设计；仅当前切片。
- [x] Fan out。两个继承同一模型的独立候选，分别保存到本地忽略目录。
- [x] Cross-judge。只读按资源连续性、证据一致性、兼容性、复用与可验收性评分。
- [x] Pick。协调者读完两个方案并选择 A。
- [x] Graft。吸收 B 的结构化命令结果、阶段事实与独立流输出。
- [x] Verify。实际实现与运行验证后更新结论。

本轮不重开全面 PRD、竞品研究或框架选型。不发布、不合并，不改写历史 Gate。

## 选型记录

| 方案 | 所有权与代价 | 结论 |
|---|---|---|
| A | RealExecutor 内顺序协调整个 Run，内部原生命令方法复用现有 helper | 采用，保留现有入口与单一协调者 |
| B | 新 RunCoordinator 替换 RealExecutor，提取 NativeCommandRunner 类 | 不新增这两个公共类，吸收其命令结果与业务终态分离的约束 |

两个设计者和只读交叉评估者均继承同一模型，不宣称跨模型验证。交叉评估五项各 0 至 2 分，A 为 9，B 为 8；这是静态设计判断，不是性能或可靠性测量。协调者读完两个方案，同意 A 的较小接口。候选和评估保存在本地忽略目录 `verification-output/fmvp-03/design/`。

本次验证选择默认 false。明确选择时还须绑定用户所见 Task revision，并纳入幂等语义，防止确认后草稿变更而执行另一条命令。Invocation 使用既有 `verification_invocation_v0` 合同，保留 `env.overrides`、output 和 cancel 的完整语义；不把引用字段误当真实执行参数。

active 覆盖整条 Run，允许阶段间暂时无 child。取消意图跨阶段有效。每个原生命令有独立 receipt/nonce/runtime，返回资源事实，由唯一协调者决定是否继续；Store 的唯一终结事务才可解锁。capture worker 也放在现有 helper 边界中。GET 读取不可变捕获结果，当前 Workspace 显示未重验。

## 验收目标

| 用户可观察行为 | 必需证据 |
|---|---|
| 不选择验证时，原草稿继续仅保存 | 旧 Task/Run 与默认请求兼容测试 |
| 明确选择后，Agent 成功退出才执行一次验证 | 实际程序写入计数和 stdout/stderr，持久化冻结 Invocation |
| 验证有非零、超时、取消或捕获失败 | 真实命令与故障注入分别记录，禁止伪报通过 |
| 阶段转换和 owner 丢失不能放开资源锁 | 资源锁及重启检查，Cancel 后没有 test 越级 |
| 查看新增、修改、删除与不支持文件类型 | 临时仓库比对，初始/最终 Diff 和同次版本标识 |
| 验证期间产生修改时说明版本不一致 | 前后版本不等测试，旧 passed 不代表最终结果已验证 |
| 重开页面仍能查看验证和版本证据 | 真实浏览器与服务重启检查，无 Accept/Delivery |
| 新执行代码对用户开放前有当前证据 | G1 回归及新验证命令/捕获边界验收，旧 manifest 不复用 |

## 实现边界

沿用现有任务、Run 详情和历史布局，增加默认未选中的“本次执行验证”。选择绑定已保存的 Task revision、命令和超时；未保存的表单编辑不参与执行。验证结果、前后 Diff 和分流输出归属于同一 Run，细节按需展开。长期的 Workflow、多 Agent 与知识复用目标不扩展本切片。

首版使用本机 Windows PowerShell，冻结其绝对路径、hash、参数、环境变量名称白名单与超时。环境值不写入快照。每 Run 最多一次业务验证，不自动修复或重试。Agent 自身输出不能代替验证退出事实。

捕获 worker 与验证复用同一原生 helper 的进程边界。捕获基于独立临时 Git index，Diff 与文件摘要来自同一 tree；包含普通文件的修改、删除、未忽略的新文件及二进制 Diff。单次内容或输出上限 8 MiB、路径上限 10,000，捕获超时 60 秒。不支持 symlink、submodule、嵌套仓库、Git attributes/filter/include 内容转换等情况，遇到这些情况明确失败。Git 忽略的未跟踪文件不包含，已跟踪文件仍包含。

读取历史只返回已保存证据，不重新运行 Git。验证前后捕获一致仅说明这两个捕获版本一致；随后外部修改 Workspace 不改写历史结论，页面明确标记当前 Workspace 未重新检查。FMVP-04 仍需封存、重放并把 Human Review 绑定到同一版本。本切片不生成 Accepted Delivery，也不把 Task 标为 done。

## 独立复核

两名继承同一模型的只读审查者分别检查执行/持久化和捕获/授权/UI；没有同时修改实现。审查发现终结事务再次失败可能成为无人处理的 Promise，以及 Windows 暂存执行位可能被临时 index 忽略。前者改为保留持久锁并捕获兜底写入失败；后者明确拒绝实际 index 与捕获 tree 的模式差异，并检查捕获期间的模式漂移。两位审查者已静态复核各自修复；运行结果另记，不用审查替代测试。

同时修正 Agent 失败被误标 test、恢复日志错误声称验证未开放、解码尾文本未写入结构化流，以及捕获发布前缺少源仓库复查。数据库失败用故障注入验证，不声称实际填满磁盘。没有新增进程所有权框架或自动解锁入口。

## 实际验证记录

原始日志保存在本地忽略目录 `verification-output/fmvp-03/`，不提交 CLI 原始输出、个人路径或环境值。

| 检查 | 已执行结果 | 本地记录 |
|---|---|---|
| `npm test` | exit 0，34/34，无跳过 | `unit-final.txt` |
| `npm run typecheck` | exit 0 | `typecheck-final.txt` |
| `npm run build` | exit 0 | `build-final.txt` |
| `node --test experiments/milestone-0/test/git-result-tree.test.mjs experiments/milestone-0/test/change-package-replay.test.mjs experiments/milestone-0/test/delivery-integrity-change-package.test.mjs` | 修正 fixture 后 exit 0，7/7，无跳过；只验证共享函数兼容，不作为 G2 | `candidate-recheck.txt` |
| 无 manifest + 系统 Chrome，`node tools/test-e2e.mjs tests/e2e/fmvp-01.spec.mjs` | exit 0，2/2，默认 mock 路径 | `ui-mock-final.txt` |
| `node tools/verify-g1.mjs <已确认的 codex.exe>` | exit 0，18/18；另含 HTTP Agent-only、重复 start/cancel 和真实验证链 | `g1-final-console.txt`、`workos-g1-p0Vnjl/g1.json` |
| G1 中的原生 Verification 矩阵 | 8/8：正常双流、非零、超时、取消、漂移、捕获失败、阶段间取消、owner 丢失 | `workos-g1-p0Vnjl/verification-native/` |
| 有效 manifest + 系统 Chrome，`node tools/test-e2e.mjs tests/e2e/fmvp-02.spec.mjs tests/e2e/fmvp-03.spec.mjs` | 最终 exit 0，2/2，无跳过；约 1.8 分钟 | `ui-real-recheck.txt`、`ui-final-passed/` |

最初的两条新行为测试先因缺少验证幂等约束和捕获入口失败，再进入实现；该轮只保留实现者的执行报告，没有独立原始日志，不作为最终验收依据。早期原生矩阵 8/8 在 `native-first/`，其中 Agent 命令替换为一次性 Node fixture，验证、捕获、helper 与 coordinator 使用生产实现；它不冒充真实 Codex。

候选回归首轮为 6/7，失败内容是重放文件预期 LF、实际 CRLF。一次性对照确认原基线与新实现都保存相同 CRLF 字节，来源是 fixture clone 继承本机 `core.autocrlf=true`。仅在测试 Git 命令中固定 `core.autocrlf=false` 后 7/7 通过，保留原字节断言，不改全局配置。失败记录为 `candidate-final.txt`，对照为 `crlf-diagnosis.txt`。这次候选回归不改写历史 Gate。

真实 Chrome 首轮为 1/2。FMVP-03 的真实执行、双流、前后 Diff 和重启读取通过；FMVP-02 在默认 5 秒的 Run ID 可见断言处超时，截图仍为操作中，临时数据库仅到 prepare / before_spawn，没有 Agent started。测试收尾随后终止服务，不能把该轮视为执行验收通过。修正测试为点击前等待真实 POST 响应（60 秒），断言成功状态和 real Run，再执行原 UI 与业务断言；同时修正 checkbox 被全局 input 样式撑成独占一行的问题。服务执行源码与 dist 未改变。失败截图、未完成的 trace 和控制台保存在 `ui-first-failed/`，不删除失败记录或把不完整 trace 当精确耗时证据。

最终真实 Chrome 回归分别用时 58.5 秒和 48.0 秒，覆盖实际文件字节、关闭页面重开、服务重启后证据一致、真实工具启动后的取消、owner 丢失持锁、验证默认未选、四个阶段、两条输出流、前后 Diff 和历史版本提示。验证后另写入 Workspace 文件，GET 仍返回原捕获证据且明确未重验；源仓库保持 clean，Task 保持 ready，Accept/Delivery 关闭，无 pageerror。最终验证结果和持锁页面截图已人工查看。

执行代码提交为 `9be643f`，后续 `77b0e6` 只修 UI checkbox 和浏览器测试等待。最后仅重建 Web 并重跑相关浏览器测试，独立确认 G1 仍匹配；没有把新的 UI 提交伪称成另一次执行矩阵。没有引入新依赖。原有项目旗帜与研究文件的工作区改动保留，未混入本切片提交。

**已开放**：匹配当前本机 G1 时，真实 Codex、逐次显式选择的单次验证、前后捕获 Diff 与历史结果查看；默认 mock。**仍关闭**：Human Review、Accept/Delivery、自动提交/推送/合并与其他平台真实执行。下一切片为 FMVP-04，需完成可重放封存与 G2 后才开放接受和交付。

## 本地使用与重新验收

本轮执行代码固定为 `9be643f7c14000e37263819b58c15ba516c9420a`。最终 G1 绑定 Windows x64、OS release `10.0.19045`、Node `v24.16.0`、Codex `0.162.0-alpha.17.2`、模型 `gpt-6.1-sol`，以及实际源码、dist、CLI、helper 和 PowerShell hash。18 项包括原有 15 项和新增验证边界、捕获一致性及真实验证流水线；原生短 fixture 与实际 Codex HTTP 分别记账，不把全部检查称为真实用户任务。

已独立确认当前应用可读取新记录，旧 FMVP-02 记录无法激活本次代码。在已构建的本机工作区启用：

```powershell
$env:WORKOS_G1_EVIDENCE = (Resolve-Path verification-output/fmvp-03/workos-g1-p0Vnjl/g1.json).Path
npm start
```

默认 `npm run dev` 使用 mock。显式配置当前匹配的 `WORKOS_G1_EVIDENCE` 后，页面仍默认 mock；保存 Task，切换 Codex，再勾选“本次执行验证”。选择框展示已保存命令、版本和超时，服务会拒绝过期选择。真实执行要求干净普通 Git 根仓库，Agent 最长三分钟，验证使用本次冻结的超时。

更换执行源码、dist、CLI、helper、PowerShell 或相关运行环境会使 G1 记录失配。重新验收：

```powershell
npm run build
cargo build --locked --manifest-path experiments/milestone-0/native-runner/Cargo.toml --bin diagnostic-runner
node tools/verify-g1.mjs '本机已确认的原生 codex.exe 绝对路径'
```

命令会真实调用 Codex 并在一次性仓库执行故障注入，以新输出的 manifest 为准。模型保持 `gpt-6.1-sol`；无需修改全局模型、provider、PATH 或登录态。回退 mock-only 时停止服务，删除当前 shell 的 `WORKOS_G1_EVIDENCE` 环境变量后重新启动；资源未知造成的持久锁不会因此释放。

此切片未运行其他平台或完整历史 Product / Technical Gate；本地 fixture 不算 Founder 真实任务使用。Review、Accept/Delivery、自动 commit/push/merge、其他平台真实执行和自动解锁仍关闭。
