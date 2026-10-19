# MVP 完整交付检查表

本轮目标为完成 Founder MVP 的全部功能与 UI。范围遵循 `00-founder-mvp-scope.md`、六个 WWA 和项目旗帜；不把局部通过替代完整目标，不扩展到多人、通用 Workflow 或多 Runtime。2026-10-16 从 `88caed5` 继续，前一轮已完成 FMVP-03，属于实际进展。

## 顺序与完成证据

| 单元 | 当前状态 | 必需证据 |
|---|---|---|
| FMVP-01 至 03 | 已完成当前 Windows profile；后续修改须回归 | 原实施记录，当前 G1 身份匹配，mock 与真实执行浏览器回归 |
| FMVP-04 | 进行中 | sealed 日志/Diff/Verification/唯一 Package、删除 Workspace 后重放、原子 Review、故障恢复、G2 与真实 UI |
| FMVP-05 | 待实现 | 正常/取消/owner-loss/待审核重启/交付损坏的历史解释与端到端回归 |
| UI 完整性 | 随切片实现，最终统一复核 | 合适参考项目的有限视觉借鉴、任务/运行/审核/交付导航、加载/空/失败/持锁状态、键盘操作和实际截图 |
| FMVP-06 | 真实任务已提供，待能力开放后执行 | Power Tool 安装包 URL 后缀校验，见下文；客观交付与摩擦记录，不编造复用或满意度 |
| 最终审计 | 待以上单元完成 | 逐条 WWA、能力 Gate、迁移、浏览器、启动文档、原有改动保留与本地交付 |

## 工作清单

- [x] 读取 poteto-mode 原则、当前入口、范围和 WWA，确认完整目标。
- [x] 核对当前分支与未提交用户改动；小切片分支为 `codex/fmvp-04-review`。
- [x] Ground 与两个结构候选；选择最小可验证的 Artifact/Review 接线。
- [ ] 单一 owner 先写行为测试，再实现 FMVP-04，独立审查与实际验收。
- [ ] FMVP-05 整合恢复与异常解释，完成所需 UI。
- [ ] 参考合适产品的视觉与交互层级，完成所有 MVP 页面和状态的统一复核。
- [ ] 通过应用处理真实任务并记录 FMVP-06；发起者已提供 Power Tool 修复任务，待当前 G1/G2 验收后执行。
- [ ] 逐条完成审计，保留失败证据，完成本地交付。

## 执行规则

每次只推进一个可验收切片。执行状态、SQLite、Artifact 与 Review 由单一实现 owner 整合。独立调查和只读审查可并行；真实 CLI 与浏览器实际执行串行，执行源码冻结后才记录 G1/G2。原生 helper、Artifact、Change Package 与 replay 优先复用已有候选。

决策日志位于本地忽略目录 `verification-output/mvp-completion/decisions.tsv`，阶段完成后把可公开结论写入对应实施记录。原 Product / Technical Gate 不变；不发布、推送或合并。Goal 只有在所有要求的当前证据都成立后才完成。

## Founder 真实任务输入

2026-10-19 发起者指定 `E:\Projects\power-tool`。目标是在获取安装包 MD5 时校验 URL 对应文件名是否具有有效安装包后缀，避免下载后无法选择打开程序。

明确拒绝样例为 `https://gyenno.oss-cn-beijing.aliyuncs.com/pub/apk/ruiyun/%E7%9D%BF%E4%BA%91_2.10.7apk`。即使该地址能够下载，解码后的 `睿云_2.10.7apk` 仍缺少 `.apk` 后缀；版本号中的点不能作为通过条件。正常 APK 地址的 MD5 路径需要保留，拒绝时应给出可理解的原因。

初步只读定位为 `py-tool/ruiyun/version_tool/util.py` 的 `get_file_md5_from_url` 和 Android MD5 UI 调用。仓库存在无关未提交文件，实际执行须保全原工作区并采用隔离基线。此处仅记录真实需求，不代表已修改、下载样例、完成应用运行或取得人类审核决定。
