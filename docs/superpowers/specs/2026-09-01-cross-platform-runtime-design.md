# Cross-platform Local Runtime Design

> 日期：2026-09-01  
> 状态：Approved design for Milestone 0 implementation  
> 决策依据：[`docs/pm/55-cross-platform-runtime-decision.md`](../../pm/55-cross-platform-runtime-decision.md)

## 1. 目标

在不改变 Project、Task、Run、Artifact 与 Product Gate 的前提下，将当前 Windows-specific 执行原型改造成一个可验证的跨平台运行时边界：

```text
Node control plane
      ↓ JSONL stdio
native runner
      ↓
Windows / Linux / macOS containment mechanism
```

第一个实现只服务 Milestone 0：运行 hostile fixture、验证进程树 Cancel、流式输出、drain、post-stop 与 capability honesty。它不是产品 Runner，也不启动真实 Codex。

## 2. 成功定义

本设计完成后，仓库应能：

1. 用平台无关 JSON Schema 表达 Runner capabilities、start request、control request 和 event frame；
2. 在 Node 端验证协议并拒绝未知/非法状态；
3. 使用跨平台 `repo-marker-v1` 为同一 Git common-dir 提供稳定实例 identity；
4. 构建一个小型 Rust binary，并通过 JSONL 与 Node Harness 通信；
5. 在 `ubuntu-24.04`、`windows-2025`、`macos-15` 使用同一测试入口；
6. 保存 capability、mechanism、原始 JSONL 与测试结果；
7. 对未验证或能力较弱的平台输出明确 `LIMITED / INCONCLUSIVE`，不伪造强保证。

## 3. 非目标

- 不实现产品 API、UI 或生产 Schema；
- 不接入真实 Codex；
- 不实现 Sandbox、容器、权限降级或网络隔离；
- 不支持 Remote Runner、常驻 daemon、自动升级；
- 不引入 PTY/ConPTY；
- 不承诺恶意进程在所有平台都无法逃逸；
- 不把 CI 结果等同于真实用户桌面版本认证。

## 4. 组件边界

### 4.1 Node Harness

位置：

```text
experiments/milestone-0/src/
```

新增模块：

```text
runner-contract.mjs
runner-client.mjs
repository-marker.mjs
```

职责：

- 构造与校验 JSONL 请求/事件；
- 启动 native runner binary；
- 将二进制 stdout/stderr frame 转交现有 boundary protocol；
- 管理 request ID、run ID 和 sequence；
- 将 helper 错误映射成 `interrupted / reconciliation_required` 事实；
- 绝不从字符串日志猜测成功。

Node Harness 不直接调用 Job Object、cgroup、`killpg`、inode 或 `FILE_ID_INFO`。

### 4.2 Native Runner

位置：

```text
experiments/milestone-0/native-runner/
├── Cargo.toml
├── Cargo.lock
└── src/main.rs
```

候选依赖：

```toml
processkit = "=3.3.4"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "io-std", "io-util", "time", "sync"] }
tokio-util = { version = "0.7", features = ["rt"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
base64 = "0.22"
```

职责严格限制为：

- host capability detection；
- spawn、cwd、argv、env；
- stdin bytes；
- stdout/stderr frames；
- timeout / Cancel；
- process-tree containment；
- process exit与 teardown evidence；
- JSONL protocol。

不读取 Project/Task 数据库，不写 Artifact Store，不运行 Git，不包含 Agent-specific prompt 逻辑。

### 4.3 CI Matrix

位置：

```text
.github/workflows/m0-cross-platform-runtime.yml
```

三个固定 job：

```text
ubuntu-24.04
windows-2025
macos-15
```

CI 分两层：

```text
contract
  ├── Node unit tests
  ├── Rust unit tests
  └── protocol compatibility

hostile-integration
  ├── build native runner
  ├── start hostile fixture through runner
  ├── execute XP matrix
  └── upload redacted evidence
```

首个 PR 可先启用 contract 层；hostile-integration 在 Runner start/cancel 实现后启用。未启用的 job 必须明确标记 `NOT_IMPLEMENTED`，不能使用 `continue-on-error` 隐藏失败。

## 5. JSONL 协议

协议版本：

```text
local-runner-jsonl-v0
```

### 5.1 Client → Runner

每行一个 JSON object。

启动：

```json
{
  "protocol": "local-runner-jsonl-v0",
  "kind": "start",
  "request_id": "req-1",
  "run_id": "run-1",
  "program": "/absolute/path/to/program",
  "argv": ["arg-1"],
  "cwd": "/absolute/workspace",
  "env": {
    "inheritance_policy": "none",
    "inherit_names": [],
    "overrides": {},
    "unset": []
  },
  "timeout_ms": 30000
}
```

输入：

```json
{
  "protocol": "local-runner-jsonl-v0",
  "kind": "input",
  "request_id": "req-2",
  "run_id": "run-1",
  "bytes_base64": "bm9uY2U="
}
```

Cancel：

```json
{
  "protocol": "local-runner-jsonl-v0",
  "kind": "cancel",
  "request_id": "req-3",
  "run_id": "run-1"
}
```

关闭 stdin：

```json
{
  "protocol": "local-runner-jsonl-v0",
  "kind": "finish_input",
  "request_id": "req-4",
  "run_id": "run-1"
}
```

### 5.2 Runner → Client

公共 envelope：

```json
{
  "protocol": "local-runner-jsonl-v0",
  "sequence": 1,
  "at": "2026-09-01T00:00:00.000Z",
  "run_id": "run-1",
  "kind": "runner.ready",
  "payload": {}
}
```

必须支持：

```text
runner.ready
capabilities.reported
boundary.created
process.started
input.accepted
cancel.requested
stdout.frame
stderr.frame
boundary.termination.started
boundary.termination.completed
stdout.drained
stderr.drained
process.exited
boundary.snapshot
run.completed
runner.error
```

`stdout.frame` / `stderr.frame`：

```json
{
  "stream_sequence": 1,
  "bytes_base64": "aGVsbG8K",
  "byte_length": 6
}
```

规则：

- 总 sequence 严格递增；
- 每个 stream sequence 严格递增；
- frame byte length 必须与 base64 解码结果一致；
- drain 后禁止新 stream frame；
- `run.completed` 只能出现一次；
- `cancelled_safe` 只有在 teardown 被确认、两流 drain 完成且 boundary snapshot 为零后才允许；
- 协议解析错误导致 client fail closed，并触发 reconciliation。

## 6. Capability 映射

Native runner 启动后先报告：

```json
{
  "platform": "linux",
  "architecture": "x86_64",
  "mechanism": "linux_cgroup_v2",
  "whole_tree_termination": true,
  "kill_on_owner_exit": true,
  "membership_observable": true,
  "soft_stop_scope": "whole_tree",
  "escape_resistance": "strong",
  "separate_stdout_stderr": true,
  "interactive_stdin": true,
  "timeout": true,
  "provider": {
    "name": "processkit",
    "version": "3.3.4"
  }
}
```

转换逻辑必须来自 native provider 的实际 `host_containment()` / process group 结果；Node 只验证 schema，不二次猜测。

未知 mechanism 不能映射到强 capability。

## 7. Repository Marker

模块 API：

```typescript
resolveGitCommonDir(inputPath, options): Promise<string>
readRepositoryMarker(commonDir): Promise<RepositoryIdentity | null>
ensureRepositoryMarker(inputPath, options): Promise<RepositoryIdentity>
```

文件：

```text
<common-dir>/agentic-work-os/repository-id
```

内容：

```text
550e8400-e29b-41d4-a716-446655440000\n
```

写入算法：

```text
resolve absolute common-dir
→ mkdir agentic-work-os
→ open repository-id with wx
→ write canonical UUID + newline
→ sync + close
→ read back and validate
```

并发 `EEXIST`：读取 winner。任何其他错误 fail closed。

测试必须使用 disposable Git repositories，覆盖 RID-01..RID-10；禁止对开发者真实仓库首次写 marker。

## 8. Rust Runner 实现阶段

### Stage A — doctor

只实现：

```text
native-runner doctor
```

输出一行 capability JSON，不 spawn 子进程。三个 CI OS 必须能编译、运行并通过 schema 校验。

### Stage B — run-to-completion

实现单个 `start` request：

- argv/cwd/env；
- stdin initial bytes；
- timeout；
- stdout/stderr event；
- structured exit；
- final boundary snapshot。

### Stage C — interactive control

增加持续读取 stdin JSONL：

- `input`；
- `finish_input`；
- `cancel`；
- Cancel 幂等；
- Cancel/自然退出竞态。

### Stage D — hostile matrix

用现有 hostile fixture 运行 XP-01..XP-10，并把结果写入 evidence manifest。

真实 Codex 只能在 Stage D 通过后进入 Spike 2。

## 9. 错误映射

| Native / protocol 情况 | Node/Harness 结果 |
|---|---|
| program 不存在 | start failure；业务失败，不存在 boundary safe 推断 |
| cwd 不存在 | start failure |
| timeout 且 teardown 已确认 | structured timeout；resource 可继续 reconciliation |
| Cancel 且 zero survivor + drain | `cancelled` candidate |
| Cancel 但 teardown 未确认 | `interrupted / reconciliation_required` |
| native runner 崩溃 | `interrupted / reconciliation_required` |
| JSONL sequence/shape 错误 | protocol hard failure；保持锁 |
| drain 后出现 frame | hard failure；不 seal 新 Artifact |
| capability 与运行证据冲突 | platform profile `FAIL` |

## 10. 测试策略

### Node tests

- schema 与状态顺序；
- base64 byte length；
- duplicate terminal；
- frame-after-drain；
- helper crash mapping；
- repository marker identity；
- concurrent marker creation；
- no path/remote fallback。

### Rust tests

- request/event serde；
- capability name mapping；
- outcome mapping；
- monotonic sequence；
- unknown protocol rejection。

### Integration tests

- Node client ↔ Rust doctor；
- Node client ↔ Rust run；
- hostile fixture XP matrix；
- post-stop observer；
- same test entry on three CI OS。

## 11. 证据与状态

本设计只允许以下表述：

```text
DESIGNED
IMPLEMENTED
CONTRACT_TESTED
PLATFORM_TESTED
INCONCLUSIVE
FAIL
```

禁止在缺少三个平台 CI 证据时写：

```text
CROSS_PLATFORM_PASS
TECHNICAL_GATE_PASS
```

CI artifact 只保存 disposable fixture 数据、版本、事件和哈希；不得保存 token、环境变量值或真实用户仓库内容。

## 12. 迁移路径

```text
现有 Windows Job Object prototype
       └── reference/windows-job-object

现有 repo-local-git-v0
       └── reference/windows-filesystem-identity

新默认候选
├── repository-marker.mjs
├── runner-contract.mjs
├── runner-client.mjs
└── native-runner/
```

第一轮不要求物理移动旧文件，避免破坏已有实验引用；先通过 README/ADR 标记为 reference。待新 candidate 通过后，再用单独重构提交移动目录。
