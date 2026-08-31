# Agentic Work OS — Milestone 0 Experiment Plan

> 状态：Frozen for Milestone 0 execution  
> 日期：2026-08-25  
> 上游依据：[MVP PRD](./20-mvp-prd.md)、[PRD Red Team](./30-prd-red-team.md)  
> 目标：形成 Execution Feasibility 的 Technical Gate 原始证据

## 0. Gate 规则与范围

Milestone 0 是技术 Spike 集，不是产品 UI 里程碑。四个 Spike 彼此独立、各自形成 `PASS / FAIL / INCONCLUSIVE` 结论：

1. Runner-owned process containment 与 Cancel；
2. 真实 Codex Adapter capability；
3. Change Package seal / replay；
4. Artifact durability / fault injection / reconciliation。

只有四个 Spike 全部 `PASS`，RI-01 至 RI-11、VI-01 至 VI-12、RR-01 至 RR-09 全部 `PASS`，每次真实 Codex / Verification 启动都有有效 trusted-local acknowledgement，且没有任何硬失败信号，Technical Gate 才能 `PASS`。未执行的关键用例、无法解释的结果或证据缺失一律为 `INCONCLUSIVE`，在 Gate 上按 No-Go 处理；一个 Spike 或跨切合同的成功不能抵消另一个失败。

本计划冻结测试合同、矩阵、证据和失败动作，不冻结生产 Schema、API、Runner 架构或 Change Package 编码。四个 Spike 可以共享 disposable fixture、诊断 Harness 和证据目录，但必须独立判定。

本轮明确不实现：

- Project / Task 产品化 UI；
- 通用 Workflow、WorkflowDefinition、YAML / DAG 或 Delivery Node；
- 多 Runtime；
- Sandbox 或宿主机安全隔离；
- Session Resume；
- 自动 Commit、Merge、Push、发布或冲突解决；
- Remote Runner、分布式 Worker或持久 Runner；
- 任何其他 Deferred 能力。

## 1. 共用 Harness 与证据纪律

### 1.1 Disposable fixture 边界

- 只在专用临时父目录内创建一次性 Git 仓库、working copy、Artifact Store 和 SQLite / JSONL 状态文件。
- 路径矩阵必须包含空格、中文、相对路径、路径别名以及普通 ASCII 路径。
- fixture 不包含真实凭据、生产数据或真实工作仓库；真实 Codex 只复用现有登录态，不把认证材料复制进证据。
- 每个测试运行使用唯一 `experiment_run_id`，不得覆盖失败运行。
- 故障注入、篡改和删除只针对已解析并记录的 fixture 绝对路径。

### 1.2 共用 evidence manifest

建议证据目录如下；这是实验组织方式，不是产品 Artifact Schema：

```text
evidence/milestone-0/<experiment_run_id>/
  manifest.json
  spike-1-runner/
  spike-2-codex-adapter/
  spike-3-change-package/
  spike-4-artifact-durability/
  cross-contracts/
    repository-identity/
    trusted-local/
    verification-invocation/
    resource-reconciliation/
  technical-gate-decision.md
```

`manifest.json` 至少记录：

- `experiment_run_id`、计划版本 / 哈希和 Harness revision；
- Windows edition / build、CPU architecture、filesystem、shell、Node 和其他 helper 版本；
- Codex 版本、控制接口和配置快照；
- fixture 路径、Git object format、测试矩阵版本；
- 每个原始证据文件的相对路径、size 和 SHA-256；
- 测试开始 / 结束时间、操作者、随机 seed 和重复次数；
- 未执行、重跑、手工干预、去敏和证据丢失说明。

四组跨切合同分别指定 `verdict_owner`，输出与 Spike 相同的 `PASS / FAIL / INCONCLUSIVE`、矩阵覆盖、失败 / 未运行 case 和证据引用；它们是 Technical Gate 的独立合取条件，但不增加产品能力或第五个 Spike。

原始 stdout / stderr、进程快照、数据库 dump、文件 bytes 和命令结果先保存，再生成汇总表。不要在原始证据中记录 token、Cookie、完整环境变量或其他秘密；只保存允许的变量名、测试用合成值和去敏清单。

### 1.3 重复与硬失败

- 确定性用例至少完整执行一次，并从全新 fixture 复跑一次。
- 竞态用例在第一次运行前冻结 seed 列表和重复数；初始默认每个竞态配置 50 次。任何一次 survivor、late write、错误终态或越过 Cancel 的阶段推进都是硬失败，不能以成功率平均掉。
- 在第一次进程测试前冻结 hostile fixture 的最大派生 / 写入延迟、停止后的 `post_stop_observation_ms` 和采样间隔；默认观察窗不得短于 fixture 声明的最大延迟加安全余量。所有“零 survivor / 零 late write”判定都必须完成该观察窗，R-03 的挂起用例必须由预注册的 Cancel 或 timeout 结束。
- 真实 Codex 的必需能力至少在 3 个全新 Workspace 重复；版本或控制接口变化后重跑 Spike 2 及其与 Spike 1 的 Cancel 交叉用例。
- 每个故障注入点必须从干净数据库和 Store 开始，重启 reconciliation 后再判定。

## 2. `repository_identity` 实验合同

### 2.1 目的与版本

`repository_identity` 只用于实验中的同一源仓库调度锁和 resource reconciliation。它不表示远端项目身份，也不冻结生产字段。

候选算法命名为 `repo-local-git-v0`：

1. 对用户选择的**源仓库**执行 `git rev-parse --path-format=absolute --git-common-dir`。
2. 打开最终解析后的 Git common-dir 目录 handle，跟随 junction / symlink / reparse point，读取 Windows `FILE_ID_INFO` 中的 Volume Serial Number 与 File ID。
3. 按 UTF-8 计算：

   ```text
   payload =
     "repo-local-git-v0\0windows-file-id\0"
     + volume_serial_hex
     + "\0"
     + file_id_hex

   repository_identity =
      "repo-local-git-v0:" + sha256(payload)
   ```

   规范编码不可由 helper 自行选择：Volume Serial Number 作为 unsigned 64-bit 值，以最高有效 nibble 在前、固定 16 位 lowercase hex 表示并保留前导零；File ID 按 Windows `FILE_ID_128.Identifier[0..15]` 的原始字节顺序，每字节固定 2 位 lowercase hex，合计 32 位；SHA-256 也输出 64 位 lowercase hex。分隔符是单个 NUL byte，不是两个字符 `\` 和 `0`。

   规范测试向量：

   ```text
   volume_serial = 0x0123456789abcdef
   file_id bytes = 00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f
   payload byte length = 83
   sha256 = 6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4
   repository_identity = repo-local-git-v0:6554ed851bd3da09da673cf87838c46ce5adadd72923d5202867c6d9ca37e5a4
   ```

4. 审计记录同时保存输入路径、Git top-level、common-dir、最终规范路径和原始文件身份；这些诊断字段不参与业务显示。
5. linked worktree 与主仓库必须得到同一 identity；同一远端 URL 的独立 clone 必须得到不同 identity。远端 URL、仓库目录名、branch 和当前 commit 不参与计算。
6. 若 Workspace Provider 使用临时 clone，Run 仍继承 Prepare 前从源仓库计算的 identity，不用临时 clone 的 common-dir 重算。
7. 文件身份无法取得、Git common-dir 不可访问或结果不稳定时，Gate-relevant Run fail closed；不得静默退化到字符串路径或远端 URL 猜测。

### 2.2 算法测试矩阵

| ID | 输入变化 | 预期 |
|---|---|---|
| RI-01 | 仓库根、子目录、相对路径、绝对路径、`..` | identity 相同。 |
| RI-02 | Windows 路径大小写、分隔符、短路径别名 | identity 相同。 |
| RI-03 | junction / symlink 指向同一仓库 | identity 相同；保留别名与最终路径证据。 |
| RI-04 | linked worktree 与主仓库 | identity 相同。 |
| RI-05 | 同一远端的两个独立 clone | identity 不同。 |
| RI-06 | 同卷 rename | File ID 未变时 identity 相同。 |
| RI-07 | 跨卷 copy 或重新 clone | identity 不同。 |
| RI-08 | 删除仓库后在同路径重建 | identity 不同；旧 Run 仍保留旧值。 |
| RI-09 | submodule / nested repository | 各自按自己的 common-dir 计算，不与父仓库混淆。 |
| RI-10 | common-dir 不可读或文件身份 API 失败 | 明确失败，不创建可运行 Run。 |
| RI-11 | 规范测试向量由每个候选 helper 计算 | byte length、SHA-256 和最终 identity 与 2.1 完全一致。 |

算法只有在 RI-01 至 RI-11 全部得到可重复结果时，才能作为 Milestone 0 的调度键；否则应比较最小原生 helper 或重新定义本地资源边界，然后重跑相关矩阵。

## 3. trusted-local 执行提示

真实 Codex 与 VerificationInvocation 启动前必须显示以下含义等价的阻断提示。可以使用 CLI 或签名 Markdown 表单，不建设产品 UI：

```text
[trusted-local execution / 非 Sandbox]

本实验将以当前 Windows 用户权限和现有 Codex 登录态运行真实 Codex，
并按测试合同运行 VerificationInvocation。

Workspace 只提供 Git working-copy isolation。它不能阻止 Agent、命令或
子进程访问 Workspace 外的文件、网络、凭据或其他进程。drift detection
只检查已登记的源仓库和 Workspace，不证明宿主机其他位置未被修改。

Source repository: <canonical source path>
Assigned Workspace: <canonical disposable path>
Experiment: <experiment_run_id>

只允许对上述 disposable fixture 继续。
输入 ACK-TRUSTED-LOCAL:<experiment_run_id> 启动；其他输入终止且不启动进程。
```

必须保存 `prompt_version`、完整渲染文本哈希、操作者、时间、源仓库 / Workspace 规范路径、响应和 Harness revision。确认只证明用户理解实验边界，不替代 process containment、drift detection 或 resource reconciliation。

自动重复批次可以复用一次 fixture-level acknowledgement，但必须在确认前显示完整矩阵、路径和批次哈希；矩阵、路径或真实 prompt 发生变化时必须重新确认。

## 4. VerificationInvocation 测试合同

### 4.1 输入合同

以下是实验合同，不是生产 Schema：

```yaml
verification_invocation_v0:
  execution:
    mode: argv
    program: <absolute-or-resolved executable>
    argv: [<arg1>, <arg2>]
    # 或：
    # mode: shell
    # shell_path: <explicit shell executable>
    # shell_argv_prefix: [<profile/command-mode flags>]
    # command: <single command string>
    # command_encoding: utf-8
  cwd_binding: assigned_workspace
  env:
    inheritance_policy: none | allowlist
    inherit_names: []
    overrides: {}
    unset: []
  timeout_ms: <finite positive integer>
  output:
    stdout: separate ordered frames
    stderr: separate ordered frames
  cancel: runner_owned_process_containment
```

规则：

- argv mode 与 shell mode 恰好选择一个；argv mode 不隐式通过 shell，也不展开元字符。
- shell mode 必须冻结 resolved shell path、shell version、`shell_argv_prefix`、command bytes / encoding 和最终实际 spawned argv。PowerShell 的 profile / `-Command` 语义或 cmd 的 `/d /s /c` 语义必须显式出现，不能依赖机器默认值。
- 原 Run 执行时，`cwd_binding` 解析为该 Run 的 assigned Workspace canonical path，调用者不能覆盖。
- 环境继承策略、变量名、合成测试值、override 和 unset 在 Start 时冻结；敏感值不进入原始证据。
- 每个 Run 只执行一次 VerificationInvocation；仓库已有聚合脚本可以作为一次调用，但不得展开为多 Test Node 或 Workflow。
- stdout / stderr 分别保持单调 sequence；不声称两条 OS stream 之间有全局确定顺序。

### 4.2 结果合同

```yaml
verification_result_v0:
  status: passed | failed | error
  exit_code: <integer-or-null>
  termination_reason: exited | spawn_error | timeout | capture_error
  started_at: <timestamp>
  ended_at: <timestamp>
  resolved_program: <canonical executable path>
  spawned_argv_ref: <immutable evidence ref>
  command_encoding: <utf-8-or-not-applicable>
  resolved_cwd: <canonical path>
  resolved_env_fingerprint: <hash>
  stdout_ref: <raw evidence ref>
  stderr_ref: <raw evidence ref>
```

- 正常退出的 `exit_code = 0` 映射为 `passed`，非零映射为 `failed`。
- 启动失败、输出捕获故障、或确认 containment 已停止后的 timeout 映射为 `error`。
- 用户 Cancel 且确认安全停止时，Run 进入 `cancelled / safe`，不进入 Review；无法确认停止时进入 `interrupted / reconciliation_required`。这两种业务结果不伪装成普通 verification `error`。
- `passed / failed / error` 都只提供证据；在四类 Required Artifact sealed、可读、hash 匹配、drift check 完成且资源安全时，才允许进入 Human Review。
- `passed` 不证明全部 DoD。

### 4.3 replay 绑定规则

原 Run 的 VerificationInvocation 和结果永久不变。Change Package replay 在新的 clean checkout 中执行“同一逻辑合同”时，仅允许把 `cwd_binding = assigned_workspace` 重新解析为 replay checkout 的 canonical path；execution、env policy、timeout 和 output / cancel 语义必须逐字节相同。证据同时保存原绑定和 replay 绑定，不能回写原 Run。

### 4.4 合同测试矩阵

| ID | 用例 | 预期 |
|---|---|---|
| VI-01 | argv 参数包含空格、`*`、`$()` 和重定向符号 | 作为字面参数传递，不经过 shell。 |
| VI-02 | 显式 PowerShell / cmd shell mode | 只由声明的 shell 解释；逐项保存并核对 resolved path / version、prefix、encoding、command bytes 和实际 spawned argv。 |
| VI-03 | 同时提供或都不提供两种 mode | 合同校验失败，进程不启动。 |
| VI-04 | 中文 / 空格 Workspace path | `resolved_cwd` 精确等于规范 Workspace。 |
| VI-05 | allowlist、override、unset | 解析环境与冻结策略一致，未允许变量不泄漏。 |
| VI-06 | exit 0、非零 exit | 分别映射 `passed`、`failed`。 |
| VI-07 | executable 不存在 / spawn error | `error`、`exit_code = null`，证据完整。 |
| VI-08 | finite timeout，确认进程停止 | `error / timeout`，无 survivor，可继续封存。 |
| VI-09 | timeout 或 Cancel，无法确认停止 | Run `interrupted / reconciliation_required`，不进入 Review。 |
| VI-10 | 交错 stdout / stderr | 两流分别保序、持续写入、drain 后停止。 |
| VI-11 | 重复执行请求 | 每个 Run 最多一次；重复请求被拒绝且不新增进程。 |
| VI-12 | replay checkout | 仅 cwd role 重新绑定，其余合同相同；保存两次结果。 |

若 5 个代表性真实问题中有两个以上必须依赖未记录的手工 setup、交互式多阶段验证或多条命令，先收窄黄金场景；不得借此建设 CI 或通用 Workflow。

## 5. resource reconciliation 测试合同

resource reconciliation 只回答进程、输出、Workspace lease、已登记 drift check 和调度锁是否安全。它与 Artifact reconciliation、drift gate 和 accepted Package 的 `delivery_integrity` 正交。

### 5.1 触发点

- Runner 崩溃、连接丢失或无法确认进程事实时；
- 应用 / Harness 启动时；
- 同 Task 或同 `repository_identity` 调度新 Run 前；
- `interrupted` 后尝试解除锁时；
- 开放 Review / Delivery 前的综合检查中。

### 5.2 输入与输出

输入至少包括 persisted Run state、boundary handle / ID、已知 PID 与创建时间、stdout / stderr reader 状态、Workspace lease、源仓库 / Workspace drift baseline 和当前事实。

输出只能推进 `resource_state`：

```text
active | reconciliation_required | blocked
  → reconciling
  → safe | blocked

safe
  -- only when a new contrary OS / output / Workspace fact appears -->
  reconciling
  → safe | blocked
```

`blocked` 在取得新的可验证事实后可以重新进入 `reconciling`。`safe` 不是不可撤销的历史事实，但只能由新出现的相反机器事实触发重入；普通重复检查不能无理由抖动状态。任何重入只修改资源投影和锁，不改写 Run 业务终态。

终态后只允许追加：

- `resource.reconciliation.started`
- `resource.reconciliation.succeeded`
- `resource.reconciliation.blocked`

Event 与 resource state / 调度锁更新必须在同一数据库事务中；不得改写业务 `phase / state`、`run.terminal` 或 ReviewDecision。

### 5.3 测试矩阵

| ID | 资源事实 | 预期 |
|---|---|---|
| RR-01 | Runner 崩溃且 boundary 中仍有活进程 | `interrupted / reconciliation_required`；同 Task / identity 锁保持。 |
| RR-02 | 进程已停止但输出 reader 未 drain | 不得标记 `safe`。 |
| RR-03 | 无活进程、drain 完成、lease 为 retained 或 released、drift check 已完成 | 可以标记 `safe` 并释放调度锁。 |
| RR-04 | 资源安全但 drift 异常 | `resource_state` 可为 safe；独立 drift gate 阻止 Accept / Delivery。不得把 drift 冒充进程不安全。 |
| RR-05 | boundary / lease 事实不足 | `blocked`，调度锁保持。 |
| RR-06 | 用户口头确认“已经停止”但 OS 事实不足 | 不得标记 `safe`。 |
| RR-07 | terminal 后 late stdout / stderr 或 marker 写入 | 立即判定 containment / drain 能力硬失败；丢弃输出，不 seal 新 Artifact；以 reconciliation Event 重新进入 `reconciling → blocked`，业务终态不变。 |
| RR-08 | accepted Package missing / corrupt，但资源事实安全 | 不改变 `resource_state`；只改变独立 `delivery_integrity` 并阻止 Delivery。 |
| RR-09 | 不相关 `repository_identity` 启动新 Run | 不被错误锁住。 |

`safe` 至少要求：owned boundary 无存活进程、已读取输出完成 drain 且停止写入、Workspace lease 状态确定、源仓库与已登记 Workspace 的 drift check 已完成。`retained` 目录可以继续存在；安全不等于删除。

## 6. Spike 1 — Runner-owned process containment 与 Cancel

### Objective

验证 Windows Local Runner 能建立可由 OS 事实证明的进程控制边界，在 Cancel、自然退出、快速派生和 Runner 崩溃竞态中实现进程停止、输出 drain、唯一业务终态与诚实 resource reconciliation。

### Hypothesis

最小 Node / TypeScript Runner 能拥有并终止真实根进程及被纳入 boundary 的相关进程；若平台 API 不足，最小 Windows 原生 helper 可以闭合该边界，而无需扩建通用 Runner 平台。

### Test fixture

一个 hostile mock parent 和最小状态 Harness。mock 必须可配置：

- 回显准确 cwd、argv 和 stdin nonce；
- 交错、分段和持续写 stdout / stderr；
- 正常退出、非零退出、挂起和忽略软停止；
- 创建 child / grandchild、快速循环派生、根先退出和延迟派生；
- 持续写 marker，并在收到停止信号前后制造受控 late write；
- 用固定 seed 改变派生和退出时序。

Harness 保存 `phase`、`state`、`resource_state`、Event sequence 和调度锁；另有独立观察进程检查 PID / handle 和 marker，避免 Runner 自证已经停止。

### Test matrix

| ID | 刺激 | 必须观察的结果 |
|---|---|---|
| R-01 | 空格 / 中文 cwd、交错输出、stdin nonce | cwd 精确；两流分别保序；stdin 有结构化确认。 |
| R-02 | parent → child → grandchild，根先退出 | 每个进程有 boundary 归属证据；根退出不丢失后代控制。 |
| R-03 | 正常退出、非零退出、挂起后按预注册 Cancel / timeout 终止 | OS / 结构化退出事实准确，不解析人类文案；挂起不会无限等待。 |
| R-04 | 启动前后、持续输出时、接近自然退出时 Cancel | 首次请求进入 `cancelling`；重复 Cancel 幂等。 |
| R-05 | Cancel 与自然退出 CAS 竞态 | 恰好一个业务终态和一条 `run.terminal`。 |
| R-06 | 快速 / 延迟派生与根进程脱离尝试 | boundary 内零 survivor；无法归属即失败。 |
| R-07 | Runner 强杀或失去 boundary 事实 | `interrupted / reconciliation_required`，不误报 cancelled。 |
| R-08 | Cancel 前后持续 marker / output | 完整经过 `post_stop_observation_ms` 后，marker、staging 不再变化。 |
| R-09 | Cancel 后检查阶段时间线 | 不出现 Test、Review、Verification 或新运行 Artifact。 |
| R-10 | terminal 后对账 | 只有 reconciliation Event 白名单，业务终态不变。 |
| R-11 | 对账前调度同 Task、同 identity、不同 identity | 前两者拒绝；不相关仓库允许。 |

### Raw evidence to preserve

- 完整 argv、cwd、Harness / OS / helper 版本；
- boundary ID、PID / PPID / handle、进程创建与退出时间、独立进程快照；
- Cancel 请求、CAS、kill、drain 和 terminal 的纳秒 / 高精度时间线；
- 原始 stdout / stderr bytes 与每流 sequence；
- marker bytes、size、hash 和多次观察时间；
- fixture 最大延迟、`post_stop_observation_ms`、采样间隔和每次完整观察序列；
- Run / Event / resource state 数据库 dump、唯一约束结果和调度锁查询；
- 随机 seed、重复编号和所有失败 fixture。

### Pass criteria

- 全部矩阵及预注册竞态重复完成整个停止后观察窗，且零 survivor、零 drain 后写入；
- 每个终态 Run 恰好一条 `run.terminal`，阶段 / 状态与 OS 事实一致；
- Cancel 后不进入 Test / Review，不产生 Verification 或新运行 Artifact；
- 只有 boundary 全部停止、drain 完成和资源事实安全时才写 `cancelled / safe`；
- 不能确认安全时稳定写 `interrupted / reconciliation_required` 并保持同 Task / identity 锁，随后按第 5 节对账。

### Fail criteria

任一 survivor、late write、零条或多条 terminal Event、错误终态、Cancel 后阶段推进、无法证明进程归属、资源不安全却解锁，均立即 `FAIL`。

### Decision if failed

Runner 方案 No-Go。比较替代 Codex 控制接口、最小 Windows Job / 原生 helper 或更窄的控制承诺；选择新机制后重跑 Spike 1 全矩阵和 Spike 2 的真实 Codex Cancel 交叉用例。不得用 UI 警告替代物理事实。

### Explicit non-goals

Sandbox、Remote Runner、持久 Runner、Session Resume、多 Runtime、产品 UI、通用 Workflow、任意宿主机进程治理。

## 7. Spike 2 — 真实 Codex Adapter capability

### Objective

对实际 Codex 版本和控制接口形成诚实、可复查的 capability matrix，证明必需的 cwd、prompt、streaming、退出事实和 Cancel；补充输入与原生 Session ID 可以明确降级。

### Hypothesis

至少一种现有 Codex 本地接口可以稳定提供必需能力，而不解析易变的人类终端文案；可选能力缺失不会阻塞黄金路径。

### Test fixture

- 带空格和中文路径的一次性 Git 源仓库与 trusted-local working-copy Workspace；
- 能产生确定文件改动的 nonce prompt、可控长运行 prompt 和非成功 prompt；
- 可由源仓库与 sibling marker 检查 drift 的 disposable 父目录；
- 最小 CodexAdapter + Spike 1 LocalRunner Harness；
- 记录当前真实 Codex 登录态“可用 / 不可用”，但不导出凭据。

每次真实启动都先执行第 3 节 trusted-local 提示。

### Test matrix

| ID | 能力 | 必须观察的结果 |
|---|---|---|
| C-01 | 版本 / 接口发现 | 保存版本、help、原始参数和选用理由。 |
| C-02 | cwd / prompt | nonce 被接收；实际 cwd 等于 Workspace；目标 / DoD 可识别。 |
| C-03 | streaming | 输出在进程退出前到达并保留原始 frame / stream 信息。 |
| C-04 | exit | 正常、失败、启动失败和取消原因可靠，不靠文案猜测。 |
| C-05 | supplemental input | 支持则保存输入与确认；不支持则明确 `unavailable`。 |
| C-06 | native Session ID | 只记录 Runtime 原生稳定 ID；没有则不创建、不伪造。 |
| C-07 | Cancel | 长运行中取消；全部 run-related 进程纳入 owned boundary 并停止。 |
| C-08 | Workspace Diff | 修改、删除、未跟踪文件可收集和显示。 |
| C-09 | cwd 非 containment | 受控 marker 证明 Workspace 不是 Sandbox；已登记 drift 可被发现。 |
| C-10 | drift gate | 源仓库 / Workspace 异常时证据与 Reject 可用，Accept / Delivery 禁用。 |
| C-11 | 重复稳定性 | 3 个全新 Workspace 中必需能力结果一致。 |

capability matrix 至少包含：`capability`、`required_or_optional`、`supported / unavailable / unstable`、`native_or_adapter_derived`、`evidence_ref`、`limitations`、`codex_version`、`interface_kind`。

### Raw evidence to preserve

- Codex version、help / capability discovery 原始输出、接口和完整非秘密参数；
- trusted-local acknowledgement；
- prompt nonce、目标 / DoD payload 哈希和 cwd 证明；
- 原始 stdout / stderr / structured frames、到达时间和退出信息；
- supplemental input 与 Session ID 的原生证据或 unavailable 证据；
- boundary / PID 归属、Cancel 时间线和独立 survivor 检查；
- Git status、最终 Diff、源仓库 / Workspace drift baseline 和 final；
- 完整 capability matrix 及每次重复结果。

### Pass criteria

- cwd、prompt、增量输出、可靠退出和 owned-boundary Cancel 五项必需能力在 3 个全新 Workspace 稳定成立；
- Diff 与定向 drift detection 可重复，异常时能够 fail closed；
- supplemental input 与 Session ID 只在原生证据支持时标为 available；
- 结构化状态不从易变人类文案伪造。

### Fail criteria

cwd 不可控、输出只能在退出后取得、退出事实不可靠、真实相关进程无法归属、Cancel 后继续运行、必须解析人类文案，或把 unavailable / unstable 能力宣称为支持，均为 `FAIL`。

### Decision if failed

比较结构化 CLI、App Server、PTY 或其他现有 Codex 控制接口，或收缩 Adapter 承诺。可选能力可明确降级；任何必需能力缺失都保持 Technical Gate No-Go。接口或版本变化后重跑本 Spike 和 Cancel 交叉用例。

### Explicit non-goals

第二 Runtime、Session Resume、自动 Agent 对话循环、产品 UI、Remote Runner、宿主机安全隔离、凭据管理平台。

## 8. Spike 3 — Change Package seal / replay

### Objective

证明 Review 引用的不可变 bytes 能在原 Workspace 删除后，仅依赖 Change Package 与 `base_revision`，在 clean checkout 确定性重建 Review 时相同的代码 tree，并重跑同一逻辑 VerificationInvocation。

### Hypothesis

一个最小、content-addressed 的 manifest + replay payload 足以覆盖修改、删除和未跟踪文件，并绑定最终 Diff 与 Verification Result；不需要自动 Merge / Push 或新的 Delivery 阶段。

### Test fixture

- 一次性 Git 仓库，包含文本、二进制、空格 / 中文路径和嵌套目录；
- 对 tracked 文件修改、删除，新增 untracked 文本 / 二进制文件，并包含 rename 等价的 delete + add；
- 确定性的 VerificationInvocation；
- Agent Log、最终 Diff、Verification Result 的 sealed fixture Artifact；
- 候选 manifest / payload encoder、decoder 和 replay harness；
- clean checkout 与独立 tree-hash 计算器。

`result_tree_hash` 初始候选使用不污染真实 index 的临时 Git index：从 `base_revision` 执行 `read-tree`，应用完整结果后 `add -A`，再以 `write-tree` 取得 tree OID；同时记录 Git object format。具体编码仍是实验结果，不冻结生产格式。

### Test matrix

| ID | 用例 | 必须观察的结果 |
|---|---|---|
| CP-01 | 修改、删除、未跟踪文本 / 二进制、空格 / 中文路径 | manifest / payload 完整覆盖，Package hash 覆盖全部 bytes。 |
| CP-02 | seal 顺序 | Agent Log、Diff、Verification 先 sealed；每个 Review Run 恰好一个 Package。 |
| CP-03 | manifest 绑定 | 包含 base revision、format / version、result tree、Diff 与 Verification ID / hash。 |
| CP-04 | Review 引用 | Package ID / hash 与同 Run row、实际 bytes 一致。 |
| CP-05 | 删除原 Workspace后 replay | 只用 Package 与 clean checkout 重建相同 tree。 |
| CP-06 | Verification replay | 只重新绑定 cwd role；其余合同相同并保存两次结果。 |
| CP-07 | 错误 base revision | 在应用前拒绝，不产生部分交付。 |
| CP-08 | 缺失 payload、manifest / bytes 篡改 | hash / schema /完整性校验失败并 fail closed。 |
| CP-09 | 重复 seal 与同内容幂等 | 同一 Run 不产生第二 Package；相同 bytes 可验证但不替换 Review 对象。 |
| CP-10 | Review 后尝试替换 / 重封 | 拒绝；内容变化只能创建新 Run。 |
| CP-11 | drift gate 异常 | 保留证据、允许 Reject；禁止 Accept / Delivery。 |

### Raw evidence to preserve

- base commit、Git object format、原始与 replay `result_tree_hash`；
- manifest 和 payload 原始 bytes、Package SHA-256、size、format version；
- 完整文件清单、操作类型、逐文件 size / hash；
- Agent Log、Diff、Verification Artifact ID / hash 和实际验证结果；
- ReviewDecision 的 Package ID / hash；
- Workspace 删除证据、clean checkout 创建记录、replay 命令 / I/O；
- 原 Run / replay 的 VerificationInvocation、cwd binding、env fingerprint 和结果；
- 所有篡改、错误 base 和拒绝日志。

### Pass criteria

- 删除原 Workspace 后，所有覆盖用例都得到相同 `result_tree_hash`；
- ReviewDecision 引用的 ID / hash 与 replay 使用的实际 Package bytes 完全一致；
- deterministic fixture 中，同一逻辑 VerificationInvocation 在 replay checkout 可执行并产生预期结果；
- 错误 base、缺失 / 篡改数据和 Review 后替换全部在部分应用或 Accept 前被拒绝；
- 无唯一、有效 Package 的 Run 不能进入可 Accept Review。

### Fail criteria

replay 依赖原 Workspace、遗漏任一变更类型、tree 不同、Review 引用与 bytes 不一致、Package 可在 Review 后替换、错误输入被部分应用，或异常仍允许 Accept / Delivery，均为 `FAIL`。

### Decision if failed

修改候选编码、tree 计算或收窄明确支持的 Git 场景，然后用全新 fixture 重跑全部矩阵。在成功前禁止 Review Accept 和 Task `done`；不得用自动 Merge / Push 补洞。

### Explicit non-goals

自动 Commit / Merge / Push / 发布、冲突解决、Delivery Node、生产 Package Schema 冻结、远端 Artifact Store、所有 Git 扩展特性泛化。

## 9. Spike 4 — Artifact durability / fault injection / reconciliation

### Objective

证明本地文件系统与 SQLite 的最小跨介质协议不会让不完整或可变证据**首次推进**到 Review 或 `complete / completed`；对已经合法 Accept 后才发生的对象丢失 / 损坏，则保留历史终态、确定性降级 `delivery_integrity` 并阻止 Delivery / replay。

### Hypothesis

以下最小协议与启动 reconciliation 足够，不需要分布式事务或 Event Sourcing：

```text
Run-owned staging write
→ producer stopped and output drained
→ flush and close
→ compute size and sha256
→ same-volume atomic finalize to content-addressed path
→ one DB transaction writes Artifact row + artifact.created Event
  + dependent phase/state transition
```

### Test fixture

- 最小 Artifact writer、同卷 temp / finalized Store 和 SQLite 状态 / Event 表；
- 四类 Required Artifact：Agent Log、最终 Diff、Verification Result、唯一 Change Package；
- 可在每条提交边界前后强杀进程的 crash injector；
- 启动 Artifact / Run reconciliation；
- 可删除、截断、替换和恢复 finalized object 的外部 fault tool；
- 一个进入 Review 的 Run、一个 Accept 后 `complete / completed` 的 Run，以及允许部分证据的 failed / cancelled / interrupted Run。

### Test matrix

| ID | 故障点 / 损坏 | 预期 |
|---|---|---|
| F-01 | staging 写入中，producer 未停止或未 drain | 可留 temp；无 sealed row / Event / phase。 |
| F-02 | flush、close、hash 前后且 finalize 前 | 只允许 temp；DB 不推进。 |
| F-03 | atomic finalize 后、DB 事务前 | finalized orphan；不暴露为证据，不推断阶段成功。 |
| F-04 | Artifact row / Event / phase 同一事务内各点强杀 | 全部回滚或全部提交，不出现部分数据库事实。 |
| F-05 | 相同 finalized object 重复提交 | 仅 size / hash 相同才幂等复用。 |
| F-06 | content-addressed 路径已有不同 bytes | 禁止覆盖，明确失败 / 阻塞。 |
| F-07 | Review 前出现 row 无对象、对象不可读、size / hash mismatch | 新进入 Review、Accept 和 Delivery 被阻止。 |
| F-08 | Review Run 四类 Required Artifact 缺一或 Package 不唯一 | 不得进入 `review / waiting_review`。 |
| F-09 | ReviewDecision Package ID / hash 不匹配 | 不得静默替换或追加新决定；Delivery 阻止。 |
| F-10 | 合法 Accept，Package 引用 / row / bytes / manifest / replay 检查完整 | 初始 `delivery_integrity = healthy`。 |
| F-11 | 未 Review 或 Reject；尝试写入其他枚举值 | 不生成投影；拒绝 `healthy / missing / corrupt` 以外的值，不增加第四状态。 |
| F-12 | Accept 后 Package row 或对象删除 / 不可读 | 按 missing 优先级得到 `delivery_integrity = missing` 和确定 reason code；历史决定 / 终态不变。 |
| F-13 | Accept 后 Package 篡改、引用不一致或 replay integrity 失败 | `delivery_integrity = corrupt` 和确定 reason code；Delivery / replay 阻止。 |
| F-14 | 恢复完全相同 bytes | 只有引用、size / hash、manifest 和 replay 完整性全部重验通过后才重算为 healthy；不改写历史。 |
| F-15 | 非终态 Run 重启且 staging / 资源事实不明 | 先收敛为 `interrupted / reconciliation_required`；锁保持。 |
| F-16 | terminal 后 late output | 丢弃，不 seal 新 Artifact；不改写终态；同时使 containment / drain Spike 硬失败。 |
| F-17 | failed / cancelled / interrupted 只有部分已安全 seal 证据 | 保留证据但不伪装 Review 或 completed。 |

Artifact reconciliation 在应用启动、调度新 Run、开放 Review 和 Delivery / replay 前运行，至少执行：路径 / size / hash 校验、temp / orphan 分类、Required Artifact 集合校验、ReviewDecision 引用校验和 `delivery_integrity` 重算。orphan 可以保留供诊断或幂等恢复，但不能自动升级为成功证据。

`delivery_integrity` 按 PRD 的 missing → corrupt → healthy 优先级判定。missing reason codes 至少区分 `DECISION_PACKAGE_REF_MISSING`、`ARTIFACT_ROW_MISSING`、`OBJECT_MISSING_OR_UNREADABLE`；corrupt reason codes 至少区分 `TYPE_OR_RUN_MISMATCH`、`UNSEALED`、`SIZE_MISMATCH`、`HASH_MISMATCH`、`MANIFEST_INVALID`、`REPLAY_TREE_MISMATCH`。reason code 是可重算诊断，不是新业务状态。

### Raw evidence to preserve

- fault point ID、强杀时刻、Harness / DB / filesystem 版本；
- crash 前后 temp / finalized 文件树、每个文件 size / hash / readable 状态；
- SQLite transaction、Artifact row、Event sequence、Run / Task / resource state dump；
- 四类 Artifact 原始 bytes和 manifest；
- ReviewDecision、`delivery_integrity` 值、`checked_at` 和 reason codes；
- 启动 reconciliation 原始日志、分类和阻断结果；
- exact-bytes 恢复前后证据，以及 late output 丢弃记录。

### Pass criteria

- 每个故障点都确定性落入允许状态，重复运行结果一致；
- 四类 Required Artifact 不完整时，Run 不能首次进入 Review 或 `complete / completed`；合法 completed Run 后续退化时，历史仍可见，但必须显示 `delivery_integrity = missing / corrupt` 且不能表现为健康可交付；
- orphan / dangling / mismatch 不被自动推进，所有异常在 Review / Delivery 前 fail closed；
- 初始 healthy、无 accepted decision 时无投影、missing、corrupt、exact-bytes 恢复和非法枚举拒绝全部符合唯一三值合同；
- accepted Package 后续异常只改变独立 `delivery_integrity` 和 Delivery 可用性，不改写 ReviewDecision、Run 终态或 `run.terminal`；
- failed、cancelled、interrupted 可以诚实保留部分已安全 seal 证据，但不会伪装成 Review-ready。

### Fail criteria

任一部分数据库提交、可变 Artifact 被引用、错误 hash 被接受、Required Artifact 不完整仍**首次推进**到 Review / completed、post-Accept 缺损仍显示 healthy 或允许 Delivery / replay、启动后不能确定性阻止异常、silent overwrite，或恢复流程改写历史决定 / 终态，均为 `FAIL`。

### Decision if failed

修改提交顺序、事务边界、同卷 finalize、Store 布局或 reconciliation 算法后，从所有故障点重跑。Technical Gate 保持 No-Go；不得通过增加远端 Store、分布式事务或产品 UI 绕过最小协议失败。

### Explicit non-goals

分布式事务、Event Sourcing、远端 Artifact Store、自动清理、配额、备份、加密、大文件生命周期、生产 Schema 冻结、产品历史 UI。

## 10. 执行顺序与交叉依赖

1. 先冻结 Harness revision、evidence manifest、trusted-local prompt、`repository_identity` 和 VerificationInvocation 实验合同。
2. Spike 1 的 hostile mock 与 Spike 4 的 fault injector 可以并行；两者不依赖真实 Codex。
3. Spike 2 必须复用 Spike 1 已证明的 boundary 观察方式，但仍独立判定真实 Codex 是否能被纳入。
4. Spike 3 可以先用人工 fixture Artifact；最终 PASS 必须引用 Spike 4 证明可持久化的 sealed bytes 和 reconciliation 结果。
5. 交叉依赖只要求相关证据存在，不能把两个 Spike 合并为一个 verdict。
6. 任一机制变化都重跑它直接影响的完整矩阵；不得只重跑先前失败的单一 case。

## 11. Technical Gate Decision Record 模板

```markdown
# Technical Gate Decision Record

- Decision ID:
- Date:
- Engineering owner:
- Evidence reviewers:
- Verdict: PASS / FAIL / INCONCLUSIVE
- PRD revision / hash:
- Experiment plan version / hash:
- Harness revision:
- OS / filesystem / Node / helper / Codex versions:
- Raw evidence root:
- Evidence manifest SHA-256:

## Independent Spike verdicts

| Spike | Verdict | Matrix coverage | Failed / not-run cases | Evidence refs |
|---|---|---:|---|---|
| Runner-owned process containment / Cancel | | | | |
| Real Codex Adapter capability | | | | |
| Change Package seal / replay | | | | |
| Artifact durability / fault injection / reconciliation | | | | |

## Required capability matrix

[List cwd, prompt, streaming, exit, Cancel and optional input / Session evidence.]

## Experimental contracts selected

- Process containment mechanism:
- Codex control interface:
- repository_identity version and evidence:
- Workspace strategy:
- trusted-local prompt version:
- VerificationInvocation contract version:
- Change Package format / version:
- Artifact commit / reconciliation protocol:

## Contract checks

| Cross-cutting contract | Verdict | Owner | Matrix coverage | Failed / not-run cases | Evidence refs |
|---|---|---|---:|---|---|
| repository_identity RI-01..RI-11 | | | | | |
| trusted-local acknowledgement for every real start | | | | | |
| VerificationInvocation VI-01..VI-12 | | | | | |
| resource reconciliation RR-01..RR-09 | | | | | |
| Artifact reconciliation F-01..F-17 | | | | | |
| delivery_integrity three-value projection F-10..F-14 | | | | | |

## Hard-fail scan

- Any survivor:
- Any drain-barrier late write:
- Any real Codex / Verification process started without a valid acknowledgement:
- Any RI / VI / RR contract matrix failure:
- Wrong, zero or duplicate terminal:
- Cancel followed by Test / Review:
- Any unowned real Codex process:
- Replay tree mismatch or dependency on old Workspace:
- New transition into Review / completed with invalid evidence, or post-Accept missing / corrupt still shown as healthy / deliverable:
- Historical ReviewDecision or Run terminal rewritten:

## Deviations and unresolved evidence

- Not-run cases:
- Inconclusive cases:
- Manual interventions:
- Environment limitations:

## Verdict rationale

- Why all four independent Spike verdicts and every cross-cutting contract verdict support this Gate verdict:
- Counterevidence:
- Residual risks within trusted-local scope:

## Decision if failed or inconclusive

- Interface / Runner / Workspace / Package / persistence contract to replace:
- Capability promise to narrow:
- Full matrices to rerun:
- Owner:

## Explicit non-goals confirmed

- No Project / Task product UI.
- No general Workflow.
- No multi Runtime.
- No Sandbox.
- No Session Resume.
- No automatic Merge / Push.
- No Remote Runner.
- No Deferred capability implemented.

## Gate consequence

- Technical Gate alone does not authorize product MVP WWA, implementation planning or production Schema/API freeze.
- Product Validation Gate must independently pass.

## Sign-off

- Engineering owner:
- Independent evidence reviewer:
- Product gate liaison:
```

Technical Gate 的硬规则：任一 survivor、drain 后 late write、错误 / 重复终态、无法归属的真实 Codex 进程、不可重放 Change Package、缺少有效 trusted-local acknowledgement 的真实启动、RI / VI / RR 失败，或以不完整 / 可变 / 不可读 / hash 不匹配证据首次推进到 Review / `complete / completed`，立即 `FAIL`。合法 Accept 后才发生的 Package 缺失 / 损坏本身不是历史终态失败；若系统未将其投影为 `missing / corrupt`、仍表现为 healthy 或仍允许 Delivery / replay，才是硬失败。任何关键 not-run 为 `INCONCLUSIVE`，同样不能进入产品 MVP WWA。
