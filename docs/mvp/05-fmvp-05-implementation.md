# FMVP-05 历史恢复与异常解释

2026-10-19，状态DONE，限定已验收Windows profile。分支 `codex/fmvp-05-recovery` 从已验收04的本地提交 `251bded` 派生；未合并到基线或main。

## 当前验收汇总

| 项目 | 实际结果与证据 |
|---|---|
| 最终UI、mock、会话回归 | `153fc90` 下18项通过、退出0；`verification-output/fmvp-05/owner-initial-read-20261019/green.log` |
| 类型、构建、执行身份 | 同目录typecheck/build与identity前后日志通过，执行身份保持完整dd833330 |
| 真实执行、取消与owner-loss UI | `4860de9` 下02单项通过、1.5分钟、退出0，见 `real-execution-ui-4860de9-20261019.txt`；正常、取消与owner-loss重开读取、未知持锁阻塞均通过 |
| 真实Verification UI | `13eafae` 下03单项通过；同轮02失败，整轮退出1，见 `real-execution-ui-13eafae-20261019.txt`。后续只改首读错误表达与观察预算，没有改03行为或执行源码 |
| 真实Review、重启、交付与损坏UI | `4860de9` 下04单项通过、3.0分钟、退出0，见 `real-review-ui-4860de9-20261019.txt`。包括待审重启、删Workspace后接受、源离线409、恢复后同hash下载、对象缺失/损坏与恢复 |
| 审查及实际视觉检查 | `review/final-fixes.md`、`review/read-budget.md`；root已查看本轮375px长内容、owner-loss恢复、真实待审与接受后损坏截图 |

上述18项中的注入读取、键盘与窄屏用例属于UI工程证据。真实02/03/04属于一次性fixture运行，不计Founder真实任务、外部复用或原Product/Technical Gate。当前G1/G2仍使用04已验证且身份匹配的原始manifest，没有改写旧结果。

## 范围与选择

让重开任一Run时可以直接回答冻结目标、阶段、变更、验证、决定、完整性、资源和下一步。沿用当前组件与API，不新增执行框架或修改业务历史。当前全局锁优先于本次历史safe；读取失败或尚未读取不能推断当前安全。未知锁不按PID消失、刷新或重启释放。

局部设计依据为 `verification-output/fmvp-05/design-options.md`，两个候选由同一模型顺序提出，主协调者回读源码与真实截图后选择A。App拥有当前资源读取，RunDetail拥有历史facts与证据，ReviewPanel继续拥有同包审核与完整性。当前没有第二个presentation复用点，不新增映射层或全局状态库。

沿用已有克制配色与列表/详情层级。选中Run时收起可编辑Task表单，把冻结目标与审核结果放在中心；压缩页面装饰和重复文案。技术快照与日志按需展开。保持既有操作名、键盘可达及窄屏可读，不新增Workflow、Resume、强制解锁或自动重试。

## 吞吐检查

- [x] 前置步骤。04当前G1/G2与真实审核/下载通过后才开始05；当前执行身份为dd833330，默认真实能力仍由匹配证据控制。
- [x] 独立工作。局部只读设计已完成；实现集中于同一UI，执行与浏览器由主协调者串行验证。
- [x] 共享状态。现有三个读取所有者保留；一个实现owner修改web与相关E2E，根协调者维护本文件、90与入口状态。
- [x] 最小拆分。单owner避免并发改同一main.tsx；先UI可观察测试，再实现，再冻结并独立审查和真实回归。

## 实施与验收

- [x] 先写加载/断线恢复、历史safe与当前锁、冻结目标与历史导航的UI行为测试，明确注入分类，不冒充真实执行。
- [x] 补齐Run各状态的八项事实、具体下一步及Review读取失败/恢复，不把旧healthy作为当前确认。
- [x] 调整表单与详情层级，键盘路径及375px长内容无页面溢出；保留真实工作区和决策语义。
- [x] 运行typecheck、build、相关mock/UI测试；确认执行身份未变。
- [x] 主协调者执行真实02/03及04，覆盖正常、取消、owner-loss、待审重启、已接受对象缺失/损坏，查看本轮截图。
- [x] 对照五条WWA、更新文档；最终提交与验收版本见本页汇总。

## 实际进展

第一单元提交 `9e75e6bafc131e8e27249fd597f584c82e727ac5`。先写UI读取与交互测试取得red，再实现冻结目标单处展示、历史资源事实读取、当前锁/连接优先、加载提示和详情层级。实现owner报告两项UI注入用例通过（4.9秒）、01与会话六项回归通过（25.6秒）及类型检查通过。截图/错误上下文位于 `verification-output/fmvp-05/owner-red-1`、`owner-green-1`、`owner-regression-1`；历史stdout落盘情况尚在核对，主协调者的统一复验尚未开始。这些是浏览器读取/交互证据，没有真实CLI或Founder任务。

第二至第四单元为 `1727df9`、`95820e7`、`6a2fc0c`，补齐Review读取失效/恢复、深链加载、迟到facts隔离、决定对应下一步、键盘和长内容。主协调者回读后指出known lock不能一并禁止可读同包的Reject；该分支先red、修后green，Accept/Download仍因锁禁用。读取失效改为保留上次状态并明确当前未知；成功读取不清除用户动作的拒绝提示。原owner-loss提示定位与真实02/04八事实断言已增强，尚未执行真实CLI。

第四单元的01、05、会话合计11项实际回归通过（43.9秒），原始日志为 `verification-output/fmvp-05/owner-final/regression.log`；typecheck、build及前后identity日志同目录，执行身份保持完整dd833330。root已读取这些日志。旧red1/2/3和green1/2的stdout仅存在当时实际工具输出，没有补造；对应截图/错误上下文保留。当前最后补待审完整性直接显示，仍未冻结或运行最终真实02/03/04，不得标为05完成。

Power Tool真实任务留待06，不由本切片的注入/演示用例代替。

6fdc4de冻结后主协调者实际运行增强版02/03，两项通过、session6595退出0，日志为 `real-execution-ui-6fdc-20261019.txt`。独立只读审查随后指出两项P2：成功后的GET悬挂会无限沿用旧无锁/healthy；拒绝后delivery_integrity按合同为null，页面缺少完整性答案。主协调者采纳并要求先复现再作前端最小修复，同时补实际Tab路径及长目标/DoD/错误窄屏覆盖。报告与裁决位于 `verification-output/fmvp-05/review/`，两席同模型，不计运行验收。当前04尚未按05修订运行，不能以这两项实际通过代替05收口。

审查修复提交 `13eafaec5386d4b1cd3d0802e5cc2609cbd37e18` 只改前端与05测试。先复现两项P2，再给所有GET沿用十秒deadline；合法长POST不加该signal。Reject复用封存完整性并明确未产生已接受交付物。定向7项通过，最终01/05/session共17项通过（3.1分钟、退出0），typecheck/build通过，前后执行身份仍完整dd833330。原始日志位于 `verification-output/fmvp-05/owner-review-fixes-20261019/`，早先组合测试超过Playwright默认30秒的失败也保留，随后按四种操作拆分而未改业务deadline或断言。

只读复审 `review/final-fixes.md` 未发现新增阻断；复审时未提交的两文件hash与13eafae文件一致，root已实际核对。root查看375px长目标/DoD/错误截图，页面可换行、无整页横向溢出；这是UI注入证据。实际完整Tab链、每次操作仅一次写请求和挂起恢复均在17项内；不把fixture接受当作Founder人工决定。最终真实02/03已开始，04待串行运行，05仍IN_PROGRESS。

13eafae的真实回归session42490实际退出1：03通过，02在owner-loss重启后的历史资源事实断言失败，normal与cancel段已通过并生成截图。日志为 `real-execution-ui-13eafae-20261019.txt`，失败位置02:112，期望未记录资源事实而界面仍加载。teardown另有默认30秒超时且最终trace.zip截断，不能把不完整trace当完整网络证据。当前复用该次持久化fixture做只读恢复诊断，尚未确定原因，未调大断言或宣称通过；04未开始。

13eafae的04实际session3492退出1：等待Review重启、删除Workspace后Accept201（实际POST17.3秒）、源仓库离线Delivery409均已走过；失败位于:46刷新后的delivery-integrity默认五秒观察。root在teardown前保存live trace/network，`real-review-live-trace-13eafae/read-timing-summary.json`显示Review成功GET4.525秒，失败后5ms快照已有正确完整性。同次还有成功GET6.855/8.758秒，均低于现有十秒请求上限。独立复核为 `review/read-budget.md`；session与详情并行，不能相加解释本次延迟。

据此仅校准02 owner-loss首次历史事实、04离线恢复刷新后完整性两项断言的有限观察预算为22秒（全局→详情两次十秒读取及观察余量）；产品GET deadline、挂起变未知的回归、真实操作超时和成功内容断言均不放宽。这不是02原根因证明，原02截断trace与04失败继续保留。若校准后仍失败继续诊断，不再凭猜测加时。首读错误文案单独先red再修正，不能冒称解决原真实失败。

最终真实02在4860de9实际1/1通过（session26940退出0，1.5分钟），最终真实04在同提交实际1/1通过（session57965退出0，3.0分钟），没有继续放宽22秒预算。原失败不改写；02原失败的具体请求原因仍未确定，本次成功不反推因果。05五项WWA已具备对应证据，当前标DONE；06真实PowerTool任务仍未执行，其他平台与原联合Gate不作完成结论。
