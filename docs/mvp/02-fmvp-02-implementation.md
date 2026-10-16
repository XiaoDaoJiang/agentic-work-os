# FMVP-02 — 真实 Codex 接入

日期：2026-10-16。基线：`feat/fmvp-01-task-mock-run@f6aba2d`。

## 实施顺序

- [ ] 收口 FMVP-01 的服务端、类型、构建与浏览器验收，更新入口和启动说明。
- [ ] 核对 Codex CLI 与现有 Runner 合同，先以一次性 Git 仓库实现真实接入诊断。
- [ ] 复用 ProcessKit、RuntimeReceipt 与 Windows 进程事实；验证输出、退出、取消、超时和 owner-loss。
- [ ] 将实际结果与 G1 条件逐项对照。条件未满足时，产品真实执行入口保持关闭并说明缺口。
- [ ] 回归 mock 行为，记录真实运行证据和仍未开放能力。

## 接入选择

当前产品只执行确定性 mock。现有 Rust 主程序仅提供 doctor；Stage B 合同只支持 root-only transport，不支持 Cancel。

比较两个方案：扩展旧 Stage B 合同，或新增受限诊断入口并复用现有原生边界。选择后者，保留历史实验含义；不复制进程所有权和资源对账框架。应用仍使用 Node/TypeScript、React、SQLite，原生进程控制使用已有 Rust 候选。

Codex 在一次性仓库中运行，保留原生权限限制，不使用全权限绕过，不自动推送。不把诊断成功计为真实用户任务，也不把局部结果提升为完整 Technical Gate PASS。

## 工作拆分

- 前置步骤：先核对工作区并完成 FMVP-01 验收，再接真实执行。
- 独立工作：协调者运行 mock 与界面验收；接入 owner 负责独立的新模块及原生诊断。
- 共享状态：已有 API、Schema 和界面接线顺序修改；验收数据与工作仓库分离。
- 最小拆分：真实执行链路由单个 owner 负责，避免跨多个作者拆开进程、退出和取消不变量。

## 验证记录

待实际执行后填写。真实运行、Verification、Accept/Delivery 在 G1/G2 满足前继续关闭。
