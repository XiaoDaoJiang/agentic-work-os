# Cross-platform Runner Stage B Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the common cross-platform execution transport—argv/cwd/env, finite initial stdin, separately ordered stdout/stderr, finite timeout, exit facts and deterministic JSONL—before adding process-tree containment or real Codex.

**Architecture:** Keep the validated Stage A ProcessKit `doctor` unchanged. Add a separate Rust binary target inside the same package. Stage B deliberately launches one root process through Rust `std::process`, reports `containment_applied=false`, and validates only common-denominator transport semantics. Stage C will replace the root-only launcher with the selected ProcessKit containment mechanism and add live Cancel/descendant tests; Stage B must not imply that work is complete.

**Tech Stack:** Node.js 22.16.0, Rust 1.88.0 standard library, existing direct `serde`/`serde_json` dependencies, `node:test`, GitHub Actions on `ubuntu-24.04`, `windows-2025`, and `macos-15`.

**Spec:** `docs/superpowers/specs/2026-09-01-cross-platform-runtime-design.md`; `docs/pm/55-cross-platform-runtime-decision.md`.

## Global Constraints

- Wire protocol remains `local-runner-jsonl-v0`.
- Input is finite in Stage B: exactly one `start`, zero or more `input`, then exactly one `finish_input`; EOF occurs before spawn.
- `cancel` is rejected in Stage B.
- Only argv mode is allowed; no shell command string or implicit shell.
- Environment inheritance is `none` or explicit `allowlist`, followed by overrides and unset names.
- Total queued stdin is limited to 1 MiB.
- stdout and stderr bytes are Base64-encoded in separate stream-local sequences.
- One Rust event writer owns global JSONL sequence assignment.
- Timeout kills only the root process in Stage B; result payload must say `containment_applied=false` and `observation_scope=root_only`.
- No real Codex, hostile child tree, Product UI, production Schema/API, or Technical Gate verdict.

---

### Task 1: Red — executable Stage B matrix

**Files:**
- Create: `experiments/milestone-0/fixtures/stage-b-child.mjs`
- Create: `experiments/milestone-0/src/stage-b-client.mjs`
- Create: `experiments/milestone-0/test/stage-b-runner.integration.test.mjs`
- Create: `.github/workflows/m0-cross-platform-stage-b.yml`

**Interfaces:**
- `runStageB({ executable, requests })` returns validated events and reconstructed stdout/stderr bytes.
- Integration cases cover success, nonzero exit, timeout, spaces/Chinese cwd, argv, environment and exact stdin.

- [ ] Write the fixture, client expectations and integration tests before the Rust binary exists.
- [ ] Add a three-platform CI workflow that builds `--bin stage-b-runner` and runs exactly the same Node integration suite.
- [ ] Push and confirm all jobs fail because the binary target is missing; reject unrelated setup failures as invalid RED.

### Task 2: Green — self-contained Rust Stage B binary

**Files:**
- Create: `experiments/milestone-0/native-runner/src/bin/stage-b-runner.rs`

**Interfaces:**
- Reads the finite request batch from stdin.
- Emits `runner.ready`, `capabilities.reported`, `boundary.created`, `process.started`, `input.accepted*`, stream frames, `process.exited`, both drain events, final boundary snapshot and `run.completed`.

- [ ] Implement strict serde parsing with `deny_unknown_fields`, canonical Base64 validation and 1 MiB stdin ceiling.
- [ ] Spawn with `std::process::Command`, absolute cwd, argv, frozen environment and piped standard streams.
- [ ] Use reader threads plus one event-loop writer so JSONL lines cannot interleave.
- [ ] Map exit 0 to `succeeded`, nonzero to `failed`, timeout to `timed_out`; root-only kill must be stated explicitly.
- [ ] Run Rust format, Clippy and tests plus the Node integration suite on all three CI hosts.

### Task 3: Evidence and handoff

**Files:**
- Create: `experiments/milestone-0/docs/stage-b-status.md`
- Update the Draft Technical Validation PR description.

- [ ] Record all three job IDs, OS images, Rust/Node versions and exact transport outcomes.
- [ ] Record actual Stage A containment availability separately from Stage B `containment_applied=false`.
- [ ] Keep Stage B status `PASS` only for the transport contract; keep Spike 1 and Technical Gate `NOT EVALUATED`.
- [ ] Hand off to Stage C: ProcessKit-owned start/live Cancel against the existing hostile fixture.

## Completion boundary

Stage B is complete only when the same executable integration suite passes on all three pinned CI images and proves exact argv/cwd/env/stdin/stdout/stderr/timeout/exit behavior. It does not prove descendant ownership, root-early-exit containment, zero survivors, post-stop stability, crash reconciliation or real Codex behavior.
