# FMVP-03 单一 Verification 与结果查看

日期为 2026-10-16。状态为 IN_PROGRESS。本轮从 `85b3529` 建立 `codex/fmvp-03-verification`，沿用 FMVP-02 的本机执行基线。目标是让用户看到一次受控验证及其对应代码版本，范围以 WWA FMVP-03 为准。

## 实施清单

- [x] Ground。核对应用 Run、资源锁、原生 helper 与既有 Verification/tree 合同。
- [x] Sketch。比较两个结构方案并做只读交叉评估。
- [x] Agree。既定范围内直接选定最小方案。
- [ ] Implement。先写行为测试，再由一个 owner 修改共享执行、Schema、API 和 UI。
- [ ] Verify。实际命令、资源异常、版本漂移、浏览器与必要 G1 回归。
- [ ] Local delivery。审查差异，记录命令和证据，更新入口。
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
- [ ] Verify。实际实现与运行验证后更新结论。

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
