# FMVP-06 — Founder 真实任务使用与最小修正

> 更新：2026-10-19
> 状态：DONE，限定已验收 Windows 本机 profile。Founder 选题，助理通过真实界面代操作。
> 结果：真实任务已到可审核封存候选；尚无人类接受决定，Task 未标 done，未回写原仓、merge、push 或发布。

## 当前结果

发起者指定 `E:/Projects/power-tool`，要求在获取 Android 安装包 MD5 前拒绝文件名缺少有效 `.apk` 后缀的 URL。拒绝样例为 `https://gyenno.oss-cn-beijing.aliyuncs.com/pub/apk/ruiyun/%E7%9D%BF%E4%BA%91_2.10.7apk`。版本号中的点不能冒充后缀。原始输入与额外验收约束分开记录，未继续竞品研究或扩大到通用 Workflow。

| 项目 | 已核对事实 |
|---|---|
| 最终产品修正 | `7ae2ba7c7346d401558bd754f8c6c832921c7d1d`；本地分支 `codex/fmvp-06-founder-use` |
| 当前执行身份 | `14f013bbc52bd26f5350c8f45b4dc221395f617bffac1f91e81e604f92359b01` |
| 实际 Task | `task_d523c6f3-55ce-4845-b8e9-06127913ab55`，v1 |
| 实际 Run | `run_8c59a84c-8743-47a4-82e3-e377d257878b`，real / waiting_review |
| Change Package | `package_cec99a5e-00c6-464e-ab70-5ab416a26741` |
| Package SHA256 | `c4ea35f36aad722c57f72f13d305610d4880119ad22de61ae1c092ab2dadd6d7` |
| Frozen base | `6952c425622d6b167a1ceebe79c63c8bfa83e4f4`，是兼容输入基线，不是原仓 HEAD |
| Result tree / 重放 tree | `2cfd6febea4f0e5d87fec05021a389cfda0dec72`，实际一致 |
| 最终 Verification | `python -B -m unittest discover -s py-tool/ruiyun/version_tool/tests -p test_apk_url_md5.py -v`；4 tests / OK，exit0，version_match=match |
| 冻结预算 | Agent600000ms；本次 Verification60000ms；capture60s、检查120s未扩大 |
| 浏览器重开 | 实际关闭页面后重开，同 Run / 同 Package，显示命令通过、版本一致、接受按钮可用；decision仍null |

封包仅含 `py-tool/ruiyun/version_tool/util.py`、`ui.py` 和 `tests/test_apk_url_md5.py`。共享校验在 HTTP 前检查解码后的路径文件名，保留合法编码/大小写/query/fragment的流式 MD5。界面捕获错误文字并恢复字段，不悬空引用except变量；SQL入口在写历史前复用校验。没有运行真实 HTTP、APK 下载、数据库或业务历史写入。

## 实际输入与来源边界

原仓 HEAD 为 `12269ff7329f7cc2183a804ee5349128d7f78520`。已提交树有227个普通blob和一个160000 gitlink `ruiyun-migrate-data`，指向 `bdd0332303bef0629739862de2f4864bebbd520c`。首次全仓模块诊断因unsupported Git file mode失败，应用预检也实际以SUBMODULE_UNSUPPORTED拒绝。未启用子模块支持、初始化外部模块或截取业务子目录来冒充全仓。

输入在独立兼容副本保留全部227个原普通文件的path/mode/blob。唯一适配提交把gitlink索引条目改为 `.workos-source-provenance.json` 中的原始path/mode/oid记录，基线6952的唯一父提交仍为原12269ff。Task/Run/Package均诚实绑定6952；业务Package不包含来源适配或gitlink删除，不自动合回原仓。

兼容输入位于 `C:/Users/GYENNO/AppData/Local/Temp/workos-founder-power-tool-KMntPv/compatible-KAUvnM/source`。它与 `.workos/founder-20261019-power-tool-budget` 本地数据须保留到审核、交付结束。删除Workspace后的重放仍要求source保有frozen base，不承诺自动恢复被系统清理的Temp输入。

原仓未应用候选。最终目标文件按换行规范化后仍与起始基线相同，HEAD未变。首次最终status读取曾不一致，后续两次读取恢复与起始快照相同；未定位该瞬时差异，未据此删除、恢复或重置任何原仓内容。原始读数都保留，见下表。

## 真实尝试与失败记录

这些是同一项Founder选题的修补，跨三个本地数据实例；不是四项真实任务或独立复用。

| 次数 | Run / 结果 | 分类与证据 |
|---|---|---|
| 1 | `run_5e1c825e-54ed-4ef3-8e6b-bd83e0d89e21`；Agent180s timeout | safe、双drain；没有最终验证或封包。`attempt1-run/facts/evidence.json` |
| 2 | `run_d24377a0-e1a9-4c7f-9af8-86f5a0f0e895`；Agent exit0，capture-before60s timeout | 开发5项自测不冒充最终验证。captures为空、没有封包。`attempt2-run/facts/evidence.json` |
| 3 | `run_abc6cfc2-3b1f-403a-bf31-090f4dce5bb4`；Agent180s timeout | 创建测试目录失误后尚未完成修复。safe、双drain，没有最终验证。`attempt3-run/facts/evidence.json` |
| 4 | 当前8c59 Run；等待审核 | 原始干净6952基线重新执行，开发先红后绿；最终协调器4项验证通过、同版本封包与重放通过 |

没有修改旧Run快照、时间预算、失败状态或计数。每次新尝试均显式通过UI发起；没有Session Resume或未知资源自动重试。

保存包含停止进程步骤的重启脚本被自动审批以blocked by policy拒绝，未给更具体原因；未执行停止动作，也未换语法绕过。改用独立实例继续，原52127/55266服务保留失败历史并关闭过期真实能力。重复失败页已关闭，持久化历史未删除。当前实例为 `http://127.0.0.1:57095`，PID245664，数据目录 `.workos/founder-20261019-power-tool-budget`。

## 围绕实际摩擦的最小产品修正

1. 属性兼容提交 `8771ab4`。允许被完整捕获且不改变实际字节的普通tracked属性文件，仍拒绝遗漏属性、转换、filter与不支持模式。先red16项中6失败，再capture/replay等23项、普通属性文件2项、server41项实际通过。没有新增通用导入器。
2. 捕获性能提交 `614b994`。逐blob Git调用改为一次受限cat-file --batch，读取实际对象库字节；保留原SHA256、模式、HEAD/index与末尾检查。没有改用Node自算OID或增加capture预算。SHA1/SHA256/空树及异常batch检查、相关29项与server41项实际通过。独立只读审查无阻断。
3. 超时解释提交 `91d3f77`。只在当前已读事实明确timeout时区分Agent与验证前捕获；读取失败不沿用旧解释。定向UI先red后green，真实失败页面也已查看。第一次类型检查错误及其修正记录保留。
4. Agent预算提交 `7ae2ba7`。从两次真实Agent180s超时调整为有限10分钟，单一纯合同值供快照、UI和04理论管线预算使用。start边界测试先red，修正测试本身多余Task字段后green；Agent与Verification独立冻结，后续Task编辑不改旧Run。不增加设置、Schema或新的权限入口。

源模块性能对比在同一228文件输入上交替5轮，每侧5次。中位数30.246秒→2.978秒，范围27.519–32.185秒与2.590–3.149秒，10次无错误且tree/manifest/entries/diff一致。机器高负载已记录。该数字只描述源模块；当前真实Run的capture与重放另由实际受控阶段成功事实证明，不能用模块数字代替native验收。

## 当前验证证据

以下路径均相对仓库根的本机忽略目录 `verification-output/`，新克隆不会自带原始产物。未把历史失败删掉或改为通过。

| 类别 | 实际结果与路径 |
|---|---|
| 当前G1 | 18项，exit0；`fmvp-04/workos-g1-Pj3rSt/g1.json`；`fmvp-06/g1-7ae2ba7-20261019.txt` |
| 当前G2 | 18项，exit0；`fmvp-06/g2-7ae2ba7-20261019/g2.json`；`fmvp-06/g2-7ae2ba7-20261019.txt` |
| 当前server / UI | 42项 / 19项，均exit0；`fmvp-06/agent-budget/server.log`、`ui-regression.log` |
| 类型 / 构建 | 均exit0；`fmvp-06/agent-budget/typecheck.log`、`build.log` |
| 属性 / 性能 | `fmvp-06/compat-capture/`、`capture-perf/summary.md`与逐次退出文件；模块诊断 `full-repo-smoke*.log/json`不算真实Run |
| 输入来源 / 原仓检查 | `source-preparation.json`、`compatible-source-preparation.json`、`source-preflight.json`、`target-baseline-comparison.json`、`original-status-final*.json`、`original-status-delta.json`，均在fmvp-06 |
| 实际封包检查 | `fmvp-06/review-proof-positive.log`，same Run/ref/hash/base/预算/前后tree/replay/恰3文件严格断言exit0；负向失败Run导出断言实际拒绝 |
| 原始审核候选 | `fmvp-06/review-output/run_8c59a84c-8743-47a4-82e3-e377d257878b/`；package.json、changes.patch、4项verification-output.txt及原始快照 |
| 实际重开 | `fmvp-06/actual-ui-reopen.json`、`actual-waiting-review.png`、`review-after-reopen.json`，同包SHA、decision=null |
| 只读复审 | `fmvp-06/review/capture.md`、`source-adaptation.md`、`capture-perf.md`、`agent-budget.md`、`power-tool.md`；不是独立模型互证或人类接受 |

旧877/91两个执行身份的G1/G2原记录保留为历史。01–05的真实02/03/04浏览器记录仍是此前相应身份的证据；本轮没有声称它们全部重跑。当前UI19、最新G1/G2及此次真实UI到审核另列证据。

## 使用记录与边界

Founder提供仓库、业务目标和拒绝样例；助理补充并录入验收约束，代操作真实控制面。最终输入为目标110字符、DoD7项合计923字符、仓库92字符、验证命令93字符，见 `input-cost.json`。不是人工打字时间。三次Task创建、同任务四次显式尝试，跨实例需要两次额外重录；没有合并或伪造统一历史。

实际使用了创建/保存Task、显式Codex与验证选择、日志/失败事实、冻结输入、历史读取、多次显式尝试、版本证据、封包审核及关闭页面后重开。Founder流程中未执行Cancel、Accept、Reject、Accepted Delivery下载或源应用；工程fixture对这些能力的测试单列，不冒充Founder操作。源适配、G1/G2、构建与诊断依赖外部终端；尚不是完全自助导入体验。

没有第二项独立任务、用户满意度、继续使用意愿或外部参与者证据。当前结果只支持本次Founder选题到可审核候选，不补足旧Product Gate人数、复用或PMF，不改变原Product/Technical Gate结论。

业务候选有CRLF→LF换行规范化，原始sealed Diff诚实包含；`semantic-diff.txt`只是忽略换行噪声的阅读辅助，未修改Package。真实Tk窗口、完整事件/线程恢复链、真实APK/网络及线上数据库均未测。既有慢请求A覆盖新地址B的MD5竞态未在本任务修复，不能宣称任意并发编辑下URL与MD5强绑定。

本轮未执行10分钟自然超时等待、属性捕获中途并发漂移专项、其他平台验收或外部试用。默认mock；真实运行须当前本机G1匹配，Accept/Delivery须G1/G2同时匹配。trusted-local Workspace不是Sandbox，loopback请求保护、原生权限和未知资源持锁继续有效。
