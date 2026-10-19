# MVP 完整交付检查表

本轮目标为完成 Founder MVP 的全部功能与 UI。范围遵循 `00-founder-mvp-scope.md`、六个 WWA 和项目旗帜；不把局部通过替代完整目标，不扩展到多人、通用 Workflow 或多 Runtime。2026-10-16 从 `88caed5` 继续，前一轮已完成 FMVP-03，属于实际进展。

## 顺序与完成证据

| 单元 | 当前状态 | 必需证据 |
|---|---|---|
| FMVP-01 至 03 | 当前执行身份的mock、真实执行与Verification回归通过 | 04实施记录内列本轮G1与浏览器证据；最终UI变更后再执行相关回归 |
| FMVP-04 | DONE，限定当前Windows profile | [最终验收](04-fmvp-04-implementation.md)：G1/G2各18项、真实审核/恢复/下载UI通过 |
| FMVP-05 | DONE，限定当前Windows profile | [实际验收](05-fmvp-05-implementation.md)；18项UI、真实执行/取消/owner-loss/待审核重启/交付损坏通过 |
| UI 完整性 | 01至06已复核；当前19项UI及真实到审核、重开已观察 | 克制配色与列表/详情层级、任务/运行/审核/交付导航、加载/空/失败/持锁、完整键盘路径与375px长内容，含实际截图 |
| FMVP-06 | DONE，真实任务到waiting_review | [实际记录](06-fmvp-06-implementation.md)：4项冻结验证、同包重放和重开；没有人类Accept或下一独立任务 |
| 最终审计 | DONE，36项需求与证据映射无必需缺口 | `verification-output/mvp-completion/final-36-evidence-map.md`；只读复核，不冒充36次测试 |

## 工作清单

- [x] 读取 poteto-mode 原则、当前入口、范围和 WWA，确认完整目标。
- [x] 核对当前分支与未提交用户改动；小切片分支为 `codex/fmvp-04-review`。
- [x] Ground 与两个结构候选；选择最小可验证的 Artifact/Review 接线。
- [x] 单一 owner 先写行为测试，再实现 FMVP-04，独立审查与实际验收。
- [x] FMVP-05 整合恢复与异常解释，完成所需 UI。
- [x] 参考合适产品的视觉与交互层级，完成01至05页面和状态的统一复核；06继续观察实际摩擦。
- [x] 通过应用处理真实任务并记录 FMVP-06；Power Tool第四attempt到可审核封包，前三次超时及摩擦保留，默认mock与能力Gate继续有效。
- [x] 逐条完成审计，保留失败证据，完成本地交付；人类审核与原仓应用留待明确决定。

## 执行规则

每次只推进一个可验收切片。执行状态、SQLite、Artifact 与 Review 由单一实现 owner 整合。独立调查和只读审查可并行；真实 CLI 与浏览器实际执行串行，执行源码冻结后才记录 G1/G2。原生 helper、Artifact、Change Package 与 replay 优先复用已有候选。

决策日志位于本地忽略目录 `verification-output/mvp-completion/decisions.tsv`，阶段完成后把可公开结论写入对应实施记录。原 Product / Technical Gate 不变；不发布、推送或合并。Goal 只有在所有要求的当前证据都成立后才完成。

## Founder 真实任务输入

2026-10-19 发起者指定 `E:\Projects\power-tool`。目标是在获取安装包 MD5 时校验 URL 对应文件名是否具有有效安装包后缀，避免下载后无法选择打开程序。

明确拒绝样例为 `https://gyenno.oss-cn-beijing.aliyuncs.com/pub/apk/ruiyun/%E7%9D%BF%E4%BA%91_2.10.7apk`。即使该地址能够下载，解码后的 `睿云_2.10.7apk` 仍缺少 `.apk` 后缀；版本号中的点不能作为通过条件。正常 APK 地址的 MD5 路径需要保留，拒绝时应给出可理解的原因。

初始只读定位为 `py-tool/ruiyun/version_tool/util.py` 的 `get_file_md5_from_url` 和 Android MD5 UI 调用。原仓存在无关未提交文件，执行已采用隔离兼容基线。以上需求是执行前输入；实际四次尝试与当前可审核候选见[FMVP-06](06-fmvp-06-implementation.md)，未下载样例或取得人类审核决定。
