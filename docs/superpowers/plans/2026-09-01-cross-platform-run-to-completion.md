# Cross-platform Runner Stage B — Run to Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Stage A Rust capability probe into a real cross-platform `run` operation that launches one argv-mode child through ProcessKit, accepts frozen initial stdin bytes, streams raw stdout/stderr as ordered JSONL frames, enforces a finite timeout, and emits a validated completion sequence on Windows, Linux, and macOS.

**Architecture:** The Node Harness remains the protocol authority and process supervisor for the Rust helper. The Rust binary reads a finite JSONL request batch from stdin before launch, constructs one ProcessKit command, and uses raw tee writers plus one serialized event writer to prevent interleaved/corrupt JSONL. Stage B intentionally stops at run-to-completion: no live control loop, no user Cancel, no Codex, and no hostile containment verdict.

**Tech Stack:** Node.js 22.16.0 built-ins, Rust 1.88.0, `processkit = 3.3.4`, Tokio 1.x, serde/serde_json, `node:test`, GitHub Actions on `ubuntu-24.04`, `windows-2025`, and `macos-15`.

**Spec:** `docs/superpowers/specs/2026-09-01-cross-platform-runtime-design.md`, Stage B; `docs/pm/55-cross-platform-runtime-decision.md`.

## Global Constraints

- `local-runner-jsonl-v0` remains the wire protocol version.
- Input is finite for Stage B: one `start`, zero or more queued `input`, then exactly one `finish_input`; EOF occurs before spawn.
- Only argv mode is allowed. No shell command string or implicit shell.
- `cwd` must be an absolute existing directory; `program` and every argv/env value must be NUL-free.
- Environment policy is frozen in the start request and supports only `none` or `allowlist` inheritance plus explicit overrides/unset names.
- `timeout_ms` is required and finite.
- stdout and stderr are raw-byte frames encoded as standard Base64; stream-local sequence numbers must increase from 1.
- One writer owns global event sequence assignment and JSONL output.
- `run.completed` may occur only after `process.exited`, `stdout.drained`, `stderr.drained`, and a final `boundary.snapshot`.
- Stage B does not implement `cancel`; receiving a cancel request is a protocol error before spawn.
- Stage B results are implementation evidence only. They do not prove hostile descendant containment, escape resistance, or the Technical Gate.

---

### Task 1: Freeze finite Stage B request-batch semantics

**Files:**
- Modify: `experiments/milestone-0/src/runner-contract.mjs`
- Create: `experiments/milestone-0/test/runner-stage-b-contract.test.mjs`

**Interfaces:**
- `validateStageBRequestBatch(requests)` returns `{ start, stdinBytes }`.
- The function accepts exactly one start request, optional input requests for the same Run, and exactly one finish-input request.

- [ ] **Step 1: Write failing contract tests** for legal empty/non-empty stdin batches, missing/duplicate start, missing/duplicate finish, mismatched Run IDs, cancel rejection, input after finish, invalid Base64, and total input-size limit.
- [ ] **Step 2: Run `node --test test/runner-stage-b-contract.test.mjs`** and confirm it fails because `validateStageBRequestBatch` is absent.
- [ ] **Step 3: Implement the smallest pure validator** using existing per-request validation, strict ordering, Base64 decoding, and a 1 MiB Stage B stdin ceiling.
- [ ] **Step 4: Re-run the focused suite** and require all cases to pass.
- [ ] **Step 5: Commit** as `test(m0): freeze Stage B request batch semantics`.

### Task 2: Implement Rust request parsing and deterministic event writing

**Files:**
- Modify: `experiments/milestone-0/native-runner/Cargo.toml`
- Modify: `experiments/milestone-0/native-runner/Cargo.lock`
- Create: `experiments/milestone-0/native-runner/src/protocol.rs`
- Create: `experiments/milestone-0/native-runner/src/event_writer.rs`
- Modify: `experiments/milestone-0/native-runner/src/lib.rs`

**Interfaces:**
- `protocol::parse_stage_b_batch(input: &str) -> Result<StageBRun, ProtocolError>`.
- `event_writer::EventWriter::emit(event, payload)` serializes one complete JSON line with global sequence and an RFC3339 UTC timestamp.
- `EventWriter` is cloneable and safe for stdout/stderr tee callbacks while preserving one global order.

- [ ] **Step 1: Write Rust unit tests first** for request ordering, Base64 validation, environment validation, 1 MiB ceiling, global event sequence, and JSONL atomicity.
- [ ] **Step 2: Run `cargo test --locked`** and confirm compilation/test failure because the new modules do not exist.
- [ ] **Step 3: Add direct Tokio and Base64 dependencies**, regenerate `Cargo.lock`, and implement the parser/writer without logging request content or environment values.
- [ ] **Step 4: Run `cargo test --locked`, `cargo fmt -- --check`, and `cargo clippy --all-targets -- -D warnings`**.
- [ ] **Step 5: Commit** as `feat(m0): add native runner Stage B protocol core`.

### Task 3: Execute one process through ProcessKit

**Files:**
- Create: `experiments/milestone-0/native-runner/src/run.rs`
- Modify: `experiments/milestone-0/native-runner/src/main.rs`
- Modify: `experiments/milestone-0/native-runner/src/lib.rs`

**Interfaces:**
- `run::execute_stage_b(run: StageBRun, writer: EventWriter) -> Result<(), RunnerError>`.
- CLI subcommand: `agentic-native-runner run` reads the finite JSONL batch from stdin and emits JSONL only on stdout.

- [ ] **Step 1: Write Rust tests first** for exit-code mapping, timeout mapping, environment policy application, stdin receipt count, and required event ordering using a cross-platform child command fixture.
- [ ] **Step 2: Confirm RED** with `cargo test --locked`.
- [ ] **Step 3: Implement ProcessKit launch** with cwd/argv/env, `Stdin::from_bytes`, finite timeout, raw stdout/stderr tee writers, PID capture, `drain()`, and final capability/boundary facts.
- [ ] **Step 4: Emit the exact completion sequence:** `runner.ready`, `capabilities.reported`, `boundary.created`, `process.started`, zero or more `input.accepted`, stream frames, `process.exited`, both drain events, final boundary snapshot, and `run.completed`.
- [ ] **Step 5: Run Rust tests, format, Clippy, and build**.
- [ ] **Step 6: Commit** as `feat(m0): execute Stage B runs through processkit`.

### Task 4: Add Node Harness client and end-to-end fixture

**Files:**
- Modify: `experiments/milestone-0/src/runner-client.mjs`
- Create: `experiments/milestone-0/fixtures/stage-b-child.mjs`
- Create: `experiments/milestone-0/test/runner-stage-b-integration.test.mjs`
- Modify: `experiments/milestone-0/src/cli.mjs`

**Interfaces:**
- `runNativeProcess(executable, requests, options)` returns `{ events, state, stdoutBytes, stderrBytes, exitCode }`.
- CLI command `runner-stage-b --executable <path> --request <jsonl-file>` prints a validated summary, not raw child content.

- [ ] **Step 1: Write failing Node integration tests** that build/run the Rust binary against a Node child fixture with spaces/Chinese cwd, argv nonce, initial stdin nonce, interleaved stdout/stderr, exit 0, exit nonzero, and timeout.
- [ ] **Step 2: Confirm RED** because the client method/CLI command is absent.
- [ ] **Step 3: Implement the Node client** using `spawn`, write the complete request batch, end stdin, parse each JSONL line, validate every event, reduce lifecycle state, and reconstruct both byte streams by Base64 decoding.
- [ ] **Step 4: Re-run focused Node tests and syntax checks**.
- [ ] **Step 5: Commit** as `test(m0): integrate Node harness with Stage B runner`.

### Task 5: Run the same Stage B path on three operating systems

**Files:**
- Modify: `.github/workflows/m0-cross-platform-runtime.yml`
- Modify: `experiments/milestone-0/test/workflow-structure.test.mjs`
- Modify: `experiments/milestone-0/README.md`

**Interfaces:**
- CI runs the same `runner-stage-b-integration.test.mjs` on all three pinned runner images after building Rust.
- Each job uploads a redacted `stage-b-summary.json` plus the existing doctor report.

- [ ] **Step 1: Extend workflow self-tests first** to require the Stage B integration command and artifact upload.
- [ ] **Step 2: Confirm RED locally** because the workflow lacks those steps.
- [ ] **Step 3: Add Stage B CI execution** on Ubuntu, Windows, and macOS, preserving `fail-fast: false`.
- [ ] **Step 4: Push and inspect every job**; classify any failure as shared contract, platform mechanism, filesystem/path, Rust build, or hosted-runner limitation.
- [ ] **Step 5: Record actual mechanisms and outcomes** without upgrading Stage B into a containment or Technical Gate verdict.
- [ ] **Step 6: Commit** as `ci(m0): validate Stage B run completion on three platforms`.

## Completion boundary

Stage B is complete only when the same real child-process test passes on all three pinned CI images and the uploaded summaries show valid event order, exact stdin/stdout/stderr bytes, correct exit/timeout facts, and honest platform capabilities. This still does not prove live Cancel, descendant containment, root-early exit, zero survivor, post-stop observation, or real Codex. Those remain Stage C, Stage D, and Spike 2 respectively.
