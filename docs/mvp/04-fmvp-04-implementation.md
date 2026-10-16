# FMVP-04 封存交付物与 Human Review

日期 2026-10-16。状态 IN_PROGRESS。从 `88caed5` 建立 `codex/fmvp-04-review`。本切片让用户审核同一 Run 的不可变、可重放 Change Package，并保留接受或拒绝的历史事实。G2 未验收前，生产 Accept/Delivery 继续关闭。

## 实施清单

- [x] Ground。核对既有 Artifact/Change Package/replay 与应用 Run/Schema/资源锁；两份独立只读调查与综合已完成，未计为执行验收。
- [x] Sketch。两个独立结构候选，按证据一致性、故障恢复、接口体积、兼容性、用户路径交叉评估。
- [x] Agree。采用 B，吸收 A 的单文件 capture envelope；主协调者完整阅读两份方案，与独立评审结论一致。不新增人工审批关卡。
- [ ] Implement。一个 owner，行为测试在先，复用候选并接入 API/UI。
- [ ] Verify。删除 Workspace 后重放、写入/登记故障、损坏/缺失、重复决定、等待 Review 重启与浏览器检查。
- [ ] Local delivery。精确代码与运行证据，更新入口，原有改动保留。

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

## 采用的结构

方案评审位于 `verification-output/fmvp-04/design/`。五个维度各 0–2 分，A 为 6/10、B 为 9/10，主协调者复核同意。分数只评价方案，不评价未写的代码。B 的资格冻结与较少 Task 状态更明确；仅吸收 A 的单文件捕获输出，减少 metadata/payload 两份文件的配对状态。

- 新 verified Run 使用 `running/test → waiting_review/review → completed/complete`。待审占全局唯一业务槽，安全 OS 资源锁独立释放。只有 Accept/Reject 可以把待审变为 completed。旧 succeeded/failed/cancelled/interrupted 不重开。
- Task 使用 ready/review/done。输入编辑不修改旧 Run，当前输入 revision 变化后不沿用旧 done。新 Run 创建时清除当前 done；仅 preparation 失败且没有创建 Run 时保留原投影。审核接受只使同 revision 的 Task done；审核旧 revision 保留接受历史，当前 Task 回 ready。Reject 回 ready，未知资源由独立锁继续阻止启动。
- 当前 G1/G2 的资格与身份在服务端冻结到新 Run；G2 关闭时保留 FMVP-03 路径，不生产新封存/重放或决定。一次性诊断可以跑新链取得证据。新增受控阶段启动前重验身份；当前 gate 失效后待审只读，已提交决定的幂等重放只返回历史。
- capture-after 的同次 metadata/payload 写一个有限大小的私有 wx envelope。保留 raw bytes 限额，wire 限额包含 base64 开销。数据库与 UI 仅保存元数据，Package 直接使用同次 bytes。
- RealExecutor 继续作为唯一协调 owner。新增受控检查 worker 复用同一 native boundary，使用独立操作 ID、receipt 和服务自有 cwd。新增 clone/replay/drift Git 全在该边界中；本切片不声称已改变旧 preparation Git 的实现范围。
- 复查只追加资源检查事实，不能追加封存业务输出、捕获或 Artifact。Accept/Delivery 强制新检查，GET 只校验对象 bytes/hash 并显示上次检查时间。所有决定在单操作槽内串行，在途 Accept 时 Reject 返回 busy。
- 原子决定事务包括 Decision、Run、Task 和 Event；对象最终同步复核到提交之间不 await。trusted-local 外部写入无法与 SQLite 跨资源原子化，后续损坏单独显示，不改历史。
- replay 复用已有候选并加固路径、普通文件、Windows alias/mode 与文件目录转换。只在服务自有 checkout 写入；原 Workspace 可删除，原 source 仍须保有 frozen base。不新增 base bundle 或任意目录 apply 接口。

## 实施顺序与可观察结果

1. 先写迁移、资格关闭、Task 投影、复查不追加证据与审核事务的失败测试，再实现状态与 Store。核对旧行、外键和触发器，不只跑 foreign_key_check。
2. 接同次 payload、四类封存与受控 replay；先测路径和数据边界，再测 Workspace 删除后的真实重放。
3. 接受保护的 Review/Delivery API 和 UI；审核展示冻结目标、Diff、Verification，技术细节按需展开；历史接受和当前损坏分开。
4. 实际执行故障点、重复决定、待审重启、owner-loss 和真实浏览器；代码冻结后取得当前身份 G1/G2，未通过保持服务端关闭。
