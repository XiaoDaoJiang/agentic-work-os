# Agentic Work OS — 开工许可、能力激活与原 Gate 索引

> 更新：2026-09-07  
> 新范围依据：[FMVP-ADR-001](../mvp/00-founder-mvp-scope.md)  
> 历史状态集中记录：[Research 交接快照](../research/2026-09-07-pre-mvp-handoff.md)  
> 本文件是本 MVP 分支的当前治理入口，不宣称 main 已更新。

## 1. 变更性质

旧规则要求完整 Product Validation Gate 与 Technical Gate 同时 Final PASS，才允许任何产品 WWA/UI/本地 Schema。本次经项目负责人授权，改为 Founder MVP 有限开工；真实能力仍逐项验收后开放。

这是开工/投入范围修订，不是实验放宽。旧 Gate 的证据、阈值与 verdict 保留，不能把新许可写成旧联合 Gate PASS。旧 `01/20/30/40/50` 中冲突的全面开工禁令仅在 Founder MVP 范围内被覆盖；其余条款继续有效。

## 2. 当前许可

| 层级 | 当前状态 | 允许什么 | 仍禁止什么 |
|---|---|---|---|
| G0 Founder 有限编码 | ALLOWED | WWA、当前切片计划、UI、本地可迁移模型、mock/只读能力 | 不伪造真实运行与交付 |
| G1 真实执行激活 | NOT_EVALUATED / DISABLED | 对照原合同完成 disposable fixture 诊断 | 未通过当前 profile 验收就对用户启动真实 Agent |
| G2 Accept / Accepted Delivery | NOT_EVALUATED / DISABLED | 实现并测试 Package / Artifact / Review | 缺证据、drift 或未知资源下 Accept |
| G3 外部试用/发布 | NOT_AUTHORIZED | 保留准备与研究记录 | 把本次开工许可当成外部发布批准 |

G1/G2 的具体判据以范围文档为准，不在此复制另一套。

## 3. 原研究 Gate 不变

转段时 Product Validation 是 Draft CONTINUE_VALIDATION / Final NOT_RECORDED；Technical Gate 为 NOT_EVALUATED；没有原联合 Gate Final PASS。详见固定快照和其原始引用。Founder 不得计为外部参与者，mock/工程故障注入不自动算产品真实轨迹。

继续研究时，完整 Product Gate、Technical Gate 与原联合 Gate 仍必须依据原协议形成各自 Final Decision Record；新 G0/G1/G2 与这些 verdict 分开记录。

原协议快照：
- [Product Validation Protocol](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/40-validation-protocol.md)
- [Milestone 0 Experiment Plan](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/50-milestone-0-experiment-plan.md)
- [转段前 Gate Execution Index 全文](https://github.com/XiaoDaoJiang/agentic-work-os/blob/d543dfa825dab14e2948abffb6367ad3ed3bbdea/docs/pm/60-gate-execution-index.md)

## 4. 分支与合入纪律

- `research/pre-mvp-handoff`：冻结的研究快照与技术基底；不是继续堆新产品代码的入口。
- `mvp/founder-foundation`：本次 Founder MVP 开工基线；后续实现从这里分小切片分支。
- `spike/milestone-0-harness` / #17 原增量：原实验继续，按最新 diff、证据和依赖审查后定向复用。
- `validation/concierge-execution`：原产品证据与外部验证继续；不自动合并原始或敏感数据到 MVP。

原 main、研究执行分支和开放 PR 不因本文件被删除、强推、关闭或自动合并。继承实验代码不代表原技术汇总 PR 已进入 main。

## 5. 下一项

直接执行 [FMVP-01](./70-mvp-wwa-backlog.md)：可持久化的 Task + mock Run 最小控制面。其开工不依赖外部 P01、14 天窗口、六类自然异常或其他平台的完整矩阵。

后续每个切片的实现 PR 记录本项真实验证与能力开关状态。只有对具体能力有证据时才更新该能力状态；任何未知、FAIL 或 INCONCLUSIVE 不得由另一项成功抵消。
