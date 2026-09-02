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

## Tasks

- [x] Establish RED with a three-platform workflow that requires the absent `stage-b-runner` binary.
- [ ] Add the minimal self-contained Rust binary using existing direct dependencies only.
- [ ] Add the Node child fixture, protocol client and success/nonzero/timeout integration suite.
- [ ] Run Rust build, format and Clippy plus the same Node suite on all three pinned hosts.
- [ ] Record platform results while leaving Spike 1 and Technical Gate `NOT EVALUATED`.

## Completion boundary

Stage B is complete only when the same executable integration suite passes on all three pinned CI images and proves exact argv/cwd/env/stdin/stdout/stderr/timeout/exit behavior. It does not prove descendant ownership, root-early-exit containment, zero survivors, post-stop stability, crash reconciliation or real Codex behavior.
