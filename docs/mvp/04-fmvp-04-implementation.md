# FMVP-04 封存交付物与 Human Review

日期 2026-10-19。状态 DONE（限定已验收 Windows profile）。从 `88caed5` 建立 `codex/fmvp-04-review`。本切片让用户审核同一 Run 的不可变、可重放 Change Package，并保留接受或拒绝的历史事实。真实 Accept/Delivery 默认关闭，仅当前 G1/G2 同时匹配才开放；不代表原联合 Gate PASS 或 main 已合并。

## 实施清单

- [x] Ground。核对既有 Artifact/Change Package/replay 与应用 Run/Schema/资源锁；两份独立只读调查与综合已完成，未计为执行验收。
- [x] Sketch。两个独立结构候选，按证据一致性、故障恢复、接口体积、兼容性、用户路径交叉评估。
- [x] Agree。采用 B，吸收 A 的单文件 capture envelope；主协调者完整阅读两份方案，与独立评审结论一致。不新增人工审批关卡。
- [x] Implement。一个 owner，行为测试在先，复用候选并接入 API/UI。
- [x] Verify。删除 Workspace 后重放、写入/登记故障、损坏/缺失、重复决定、等待 Review 重启与浏览器检查。
- [x] Local delivery。精确代码与运行证据，更新入口，原有改动保留。

## 最终验收

运行代码固定身份为 `dd83333077dead4edb60e868704655878aa6942fa24052d7db1d545236bec206`。G1记录提交a678b37，G2记录f41cfea，后续仅前端和E2E修改至866dc6d；执行身份保持相同。主协调者在真实浏览器结束后再次实际核对两份manifest匹配。以下均为2026-10-19本机证据，未运行的平台不计通过。

| 检查 | 实际结果与本地证据（verification-output/fmvp-04/） |
|---|---|
| 当前真实G1 | 18/18，exit0；`g1-a678b37-20261019.txt`、`workos-g1-Fl2n6T/g1.json` |
| 当前完整G2 | 18/18，exit0，activation=passed；`g2-a678b37-20261019.txt`及同名目录g2.json |
| 服务端、迁移、不可变保护 | 41/41，exit0；`server-review-final-20261019.txt` |
| 原生重放/审核边界、ignored文件 | 9/9及2/2，exit0；`review-current-source-20261019.txt`、`ignored-tracked-final-20261019.txt` |
| 当前mock与会话浏览器 | 6/6，session10100 exit0；`mock-session-866d-20261019.txt`及同名目录；含01两项mock和4项会话/恢复。早期2/2记录另保留 |
| 会话与恢复UI | 上述4项含实际服务重启与明确重试；单独证据另见`restart-session-diagnosis-20261019/green.txt`；注入场景不计真实CLI |
| 真实执行/取消/owner-loss UI | 1/1，session71718 exit0；`execution-ui-866d-20261019.txt`及同名截图目录 |
| 真实Verification UI | 1/1；`real-ui-regression-9957-20261019.txt`中的03通过，02旧日志定位失败另行保留 |
| 真实审核/下载UI | 1/1，session50032 exit0；`review-ui-866d-20261019.txt`及waiting-review/accepted-delivery截图 |
| 类型与构建 | exit0；`save-latency-diagnosis/20261019-probe/`内日志及summary.md |

最后的04用例实际完成待审重启、冻结目标/Diff/验证输出读取、删除Workspace后接受同包、source暂不可用时下载拒绝、恢复source后下载hash一致、损坏后禁用下载且历史接受不变、恢复同字节后完整。原source分支与工作区保持未修改。主协调者已查看最终截图。剩余恢复解释、加载/连接状态、键盘/窄屏及整体UI统一由05继续；真实Founder任务由06继续，不能由本fixture替代。

## 吞吐检查

- [x] 前置步骤。已核对当前 G1、G2 条件、六个切片与当前工作区。
- [x] 独立工作。两个只读调查分别覆盖 Artifact 候选和现有应用，写入独立证据文件。
- [x] 共享状态。Run 终态、审核决定、Task 投影与 Event 事务由一个实现 owner 修改。
- [x] 最小拆分。调查和审查可独立，代码耦合部分串行；真实进程验收不并发。

## 不变条件

Review 绑定同一 Run 的唯一 sealed Package ID/hash。缺失、损坏、未知资源和未解决漂移禁止 Accept。拒绝也必须引用可读 Package，不能伪造对不存在交付物的决定。决定、终态、Task 投影与 Event 同事务；重复请求幂等。后续损坏只改变 delivery_integrity 展示，不改历史接受。done 不等于 merge、push 或 release。

旧 FMVP-03 终态与输入不能被重写成待审核。当前真实资源边界、Cancel/drain 和持锁继续有效；封存与重放中的 Git 进程不能游离于已验收受控边界之外。结果须能在原 Workspace 被删除后从 frozen base 重建。

Verification 的 failed/error 是审核证据，区别于 Run 的 failed/cancelled/interrupted 业务终态。按 PRD 20 §7.3、§7.7，前者在资源安全、最终版本可捕获、完整证据封存后可进入人工审核；不新增 exit 0 才能 Accept 的规则。版本不一致、未解决 drift、未知资源和完整性异常仍禁止 Accept。旧业务终态仍不可重开。

## 调查结论

现应用在验证结束后立即写不可变终态；capture worker 又去掉文件 bytes。新接线需要调整新 Run 的结束时机，保留同次捕获的 payload，然后复用既有封存与 replay。不能稍后读取可变 Workspace 来补旧结果。

复查或交付中的资源检查不得给已经封存的业务证据追加输出，也不得改写历史 phase/终态。等待审核重启不应重跑 Agent、Verification 或封存。普通 GET 可以检查对象 bytes/hash，但不启动 Git。

调查证据保存在本地 `verification-output/fmvp-04/ground/`。两个独立设计候选继承同一模型；这提供独立方案视角，不属于跨模型验证。

## 本轮执行记录

接线前运行 Artifact store、reconciliation、Package、seal 与 crash-worker 五份候选测试。29 项中 23 通过、6 失败。六个故障注入用例均因 Windows 使用 URL.pathname 作为 worker 文件路径，报 MODULE_NOT_FOUND，尚未到达崩溃点。这是测试入口问题，不能把它描述为已验证崩溃恢复，也不能由其他 23 项替代 G2。原始输出保留在 `verification-output/fmvp-04/candidate-baseline.txt`，修复后另存结果。

修复使用 fileURLToPath，并将 worker 自发 SIGKILL 改为指定故障点握手后由父进程强杀。Windows 差分实测前者仅报告 code=1/signal=null，后者报告 killSent=true/code=null/signal=SIGKILL。六个实际崩溃点重跑均通过，退出码 0；SQLite 回滚、对象与 orphan 原断言保留。证据为 `verification-output/fmvp-04/crash-test-fixed.txt`。这是候选的实际恢复测试，不代表应用 G2 已完成。

状态与 Store 第一单元提交 `4859f80`。实现 owner 实际运行 `npm test` 37/37、退出码 0，`npm run typecheck` 退出码 0；输出为 `verification-output/fmvp-04/store-unit.txt`。主协调者读取提交后要求补全带内容的 v4 证据迁移、终态 Event 白名单与资源操作 ID 约束。这一单元只完成持久化接缝，尚无 G2 或 Review UI 完成结论。

2026-10-19 主链接线提交为 `eea5feed96f93b815260afc7d572e7fadaedda66`。包含同次捕获、封存、受控重放、Review API/UI 和诊断工具。旧 v5 实际 schema 的升级测试先复现不支持 blocked 的 CHECK 失败，再通过 v6 前向迁移修复；原 v5 定义保留。迁移测试核对旧行、外键目标及不可变保护。当前服务端测试 41/41、类型检查与构建退出码均为 0，记录分别为 `server-unit-final-20261019.txt`、`typecheck-final-20261019.txt`、`build-final-20261019.txt`。

候选 Package/replay 与七个真实强杀点共 18/18 通过，证据为 `package-and-crash-20261019.txt`。独立 owner-loss 定向原生诊断确认 worker 停止、待审记录保留、Reject 后 blocked 且原锁不变，见 `owner-loss-fixed-20261019.txt/.json`。这些是局部诊断；完整当前 G1/G2 与浏览器仍待执行，不能据此开放能力。

同一固定提交的完整 G2 诊断随后完成，15 个现有场景全部通过，退出码 0。证据为 `g2-diagnostic-eea5feed-20261019.txt` 及同名目录中的 `g2.json`；该 manifest 的 activation 明确为 diagnostic_only，没有当前 G1，未激活产品能力。

两份独立只读审查发现现有用例未覆盖的两个问题。临时 index 从 frozen base 初始化，会遗漏 Agent 强制加入并提交的 ignored 文件；已接受结果的一次安全重放失败，会令界面禁用唯一重新检查下载入口。主协调者读取调用链后采纳，要求先复现、修复和补回归，再生成新版本验收。两席继承同一模型，不属于跨模型验证。报告与裁决位于 `verification-output/fmvp-04/review/`。现有 15 项诊断通过不能证明这两项边界正确。

默认未提供 G1/G2 的 mock 浏览器回归实际运行 2/2 通过，退出码 0，见 `mock-ui-20261019.txt` 和同名截图目录。覆盖创建输入、模拟日志、关闭页面、重启读取、运行中强杀恢复、失败与取消；主协调者已查看本轮成功截图。这只证明当前 mock 路径，不证明真实 Review、下载恢复或最终 UI 验收。

两项审查问题的复现命令先得到 0/3、退出码 1，红测试保留在 `review-red-20261019.txt`。修复提交为 `21fa5e85dca9424998a53c05451774cff382aacf`。捕获临时 index 从固定 Agent HEAD 开始，同时保留实际 index 已追踪文件；最终 Diff 仍相对 frozen base。重放把 Package upsert 路径传给同一受检查的临时 index 捕获，不改真实 index。完整性读取同包最近成功重放证明，最新失败原因仍单独显示；下载继续强制新受控检查。

当前修复后的服务端测试为 41/41、重放与审核边界 9/9、ignored 文件 committed/staged 专项 2/2，退出码均为 0；类型检查与构建也退出 0。主协调者已读取修复差异和测试断言。边界用例实际覆盖四类必需证据各自缺失/损坏、待审 source/Workspace 漂移与恢复、检查完成后 Gate 失效、Accept/Reject 竞争、首个 Artifact 插入后的 Cancel。对应日志为 `server-review-final-20261019.txt`、`review-current-source-20261019.txt`、`ignored-tracked-final-20261019.txt`、`typecheck-review-final-20261019.txt` 和 `build-review-final-20261019.txt`。新版 G2 扩展为18项，尚待完整运行；浏览器已补恢复用例，尚未执行。真实 G1 正按冻结提交验证，未取得结论前不开放能力。

同一冻结提交的真实 G1 已随后完成18项检查，session90098退出码0，`readExecutionProfile` 实际返回匹配。日志为 `g1-21fa5e8-20261019.txt`，manifest 为 `workos-g1-1dO8Sw/g1.json`。环境为 Windows x64 / 10.0.19045、Node v24.16.0、Git 2.51.2.windows.1、Rust 1.92.0、Codex CLI 0.162.0-alpha.17.2、模型 gpt-6.1-sol。精确可执行文件、helper、shell及源码hash保存在本地manifest。G2与真实审核浏览器仍未完成，不能把G1当作04完成或Accept/Delivery已开放。

该版本的完整G2运行随后在非零场景等待超时，session10487退出1。前5项诊断通过不构成完整G2通过，未产生可开放manifest。失败输出保留为 `g2-21fa5e8-20261019.txt`。只读检查原fixture数据库确认四阶段依次为agent exit0、capture-before exit0、verification exit7、capture-after exit0，均safe/drained。Run在01:47:19Z创建、01:47:45Z开始封存重放、01:48:20Z因测试finally关闭而成为cancelled_during_seal，锁已安全释放。诊断总等待60秒早于该多阶段链路的合法总预算，其中单次重放本已有120秒上限。下一修复仅调整测试的有界观察预算，不修改产品超时、业务断言或历史失败。验收工具属于执行身份的一部分，因此修复后必须重新匹配G1/G2，不能改写旧manifest套用。

修复提交为 `a678b37cf10eb8f982ab274a5e7bba4b51a8d12d`，仅5个诊断工具文件。共享fixture工具从既定阶段上限推导有限观察预算，含审核链路370秒、非审核230秒、单次检查150秒；setup的7次Git实际调用各设30秒上限。子测试套件也按顺序包含的pipeline/check计算父预算，不取消或缩减断言。新建原生nonzero fixture与预算自检2/2通过，31.55秒进入审核、55.08秒完成接受，所有边界safe/drained且锁释放；导入、自检、语法及diff检查均通过。证据为 `g2-nonzero-budget-20261019.txt/.json`、`budget-import-20261019.txt`、`budget-unit-final-20261019.txt` 和原失败的只读摘要 `g2-timeout-readonly-diagnosis-20261019.json`。当前新G1已按新身份开始，21fa5e8的通过保持历史记录，不外推为此提交通过。

新身份的完整G1随后实际通过，session7691退出0，日志为 `g1-a678b37-20261019.txt`，manifest为 `workos-g1-Fl2n6T/g1.json`，记录的code_sha为a678b37。主协调者实际调用 `readExecutionProfile` 确认匹配，source identity为 `dd83333077dead4edb60e868704655878aa6942fa24052d7db1d545236bec206`。当前18项G2已开始，真实审核浏览器仍待执行；不把G1通过替代04完成。

完整当前G2随后实际通过18项检查，session24772退出0。日志为 `g2-a678b37-20261019.txt`，manifest为 `g2-a678b37-20261019/g2.json`，activation为passed。G1记录a678b37，G2结束时HEAD为 `f41cfea22c6046ba7b5c68a9849f7afe234eca1a`；后者仅调整E2E04观测期限，执行身份未变。主协调者实际调用readExecutionProfile与readReviewProfile，确认两份manifest匹配当前源码、构建和本机工具。仅提供两份匹配manifest时开放该profile的真实审核/交付，不外推其他平台或旧联合Gate。

当前真实浏览器回归首轮02/03共1通过、1失败，session45944退出1。03的真实验证与重开证据通过；02在首次保存提示的5秒断言超时，失败截图已呈现保存后的Task，且trace归档未正常完成，原因仍在核对。输出保留在 `real-ui-regression-a678-20261019.txt` 与同名目录。不能将此轮写成执行/取消/owner-loss UI回归通过。04审核浏览器正在独立执行，尚无完成结论。

首次保存延迟的有界HTTP诊断确认同步能力哈希阻塞请求队列。同一临时服务中，合法Task独立保存7ms、capabilities2160ms、session2238ms；能力检查在途时，原43ms的tasks读取等待2156ms。均为本机该次诊断，不代表通用性能指标。证据为 `save-latency-diagnosis/20261019-probe/http-timeline.json`，原先空验证草稿的400诊断另保留。未启动Run，服务已关闭。修复限定前端初始化会话合并与能力/状态轮询拆分，不修改后端Gate或扩大保存提示断言期限；UI故障注入测试已先复现旧实现未初始化session，完整修复与原真实用例尚待验证。

前端修复提交为 `9957bedb6d5c469e32639290295c6e1cb85362cc`，仅main.tsx与session-readiness浏览器用例。UI故障注入先3项失败、后3/3通过，类型检查、构建与diff检查退出0；执行身份仍为dd833330。初始化共享在途session；能力30秒慢轮询，失败关闭可用状态；任务、运行和锁保持原快轮询。原后端校验和02/04五秒保存断言均保留。新真实02已完成保存与正常Codex执行，接着旧日志断言因终态日志折叠而失败，不能计为全用例通过；测试提交 `56aebbba3222b80d5c842ee6e17f59bf0f983e79` 仅在读取前通过summary展开日志，原turn.completed断言与时限不变。当前完整真实02/04验收仍待重跑。

9957bed的真实03再次通过，02仍因旧日志定位失败，完整该轮为1通过/1失败、session69727退出1。主协调者查看了 `real-ui-regression-9957-20261019` 中真实验证截图。04下一轮已完成真实Agent、Verification、封存、待审持久化和重启后的Diff/stdout/stderr展示，session13205仍退出1：接受请求被403拒绝，截图明确提示服务重启后需刷新并取得当前本地会话。原测试仅对同一个带hash地址执行goto，正在用无Run诊断确认是否保留旧文档会话；不移除来源/会话校验，也不把该失败写成审核成功。证据为 `review-ui-9957-20261019.txt` 及该轮waiting-review/失败截图。截图还观察到连接恢复后旧Failed to fetch仍显示，这属于05已列出的恢复体验缺口，不宣称最终UI完成。

## 采用的结构

方案评审位于 `verification-output/fmvp-04/design/`。五个维度各 0–2 分，A 为 6/10、B 为 9/10，主协调者复核同意。分数只评价方案，不评价未写的代码。B 的资格冻结与较少 Task 状态更明确；仅吸收 A 的单文件捕获输出，减少 metadata/payload 两份文件的配对状态。

- 新 verified Run 使用 `running/test → waiting_review/review → completed/complete`。待审占全局唯一业务槽，安全 OS 资源锁独立释放。只有 Accept/Reject 可以把待审变为 completed。旧 succeeded/failed/cancelled/interrupted 不重开。
- Task 使用 ready/review/done，并以 blocked 明确表达拒绝后资源仍未知。输入编辑不修改旧 Run，当前输入 revision 变化后不沿用旧 done。新 Run 创建时清除当前 done；仅 preparation 失败且没有创建 Run 时保留原投影。审核接受只使同 revision 的 Task done；审核旧 revision 保留接受历史，当前 Task 回 ready。Reject 仅在资源安全时回 ready，未知时 blocked 且独立锁继续阻止启动。已接受后的 Delivery 检查未知仍保留 done。
- 当前 G1/G2 的资格与身份在服务端冻结到新 Run；G2 关闭时保留 FMVP-03 路径，不生产新封存/重放或决定。一次性诊断可以跑新链取得证据。新增受控阶段启动前重验身份；当前 gate 失效后待审只读，已提交决定的幂等重放只返回历史。
- capture-after 的同次 metadata/payload 写一个有限大小的私有 wx envelope。保留 raw bytes 限额，wire 限额包含 base64 开销。数据库与 UI 仅保存元数据，Package 直接使用同次 bytes。
- RealExecutor 继续作为唯一协调 owner。新增受控检查 worker 复用同一 native boundary，使用独立操作 ID、receipt 和服务自有 cwd。新增 clone/replay/drift Git 全在该边界中；本切片不声称已改变旧 preparation Git 的实现范围。
- 复查只追加历史合同允许的 resource.reconciliation.started/succeeded/blocked 事件及资源事实，不能追加封存业务输出、捕获或 Artifact。Accept/Delivery 强制新检查，GET 只校验对象 bytes/hash 并显示上次检查时间。所有决定在单操作槽内串行，在途 Accept 时 Reject 返回 busy。
- 原子决定事务包括 Decision、Run、Task 和 Event；对象最终同步复核到提交之间不 await。trusted-local 外部写入无法与 SQLite 跨资源原子化，后续损坏单独显示，不改历史。
- replay 复用已有候选并加固路径、普通文件、Windows alias/mode 与文件目录转换。只在服务自有 checkout 写入；原 Workspace 可删除，原 source 仍须保有 frozen base。不新增 base bundle 或任意目录 apply 接口。

## 实施顺序与可观察结果

1. 先写迁移、资格关闭、Task 投影、复查不追加证据与审核事务的失败测试，再实现状态与 Store。核对旧行、外键和触发器，不只跑 foreign_key_check。
2. 接同次 payload、四类封存与受控 replay；先测路径和数据边界，再测 Workspace 删除后的真实重放。
3. 接受保护的 Review/Delivery API 和 UI；审核展示冻结目标、Diff、Verification，技术细节按需展开；历史接受和当前损坏分开。
4. 实际执行故障点、重复决定、待审重启、owner-loss 和真实浏览器；代码冻结后取得当前身份 G1/G2，未通过保持服务端关闭。

主协调者回读 PRD 20 §7.3 后纠正了候选综合中的一项选择。原方案令 Reject+unknown 直接 ready，虽然未释放资源锁，但不符合“资源安全后才回 ready”的保留合同。实现改为 blocked，并沿用原终态资源 Event 白名单；不修改历史协议或过去结果。决策日志保留原选择及此更正。
