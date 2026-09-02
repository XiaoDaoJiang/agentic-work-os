# Cross-platform Runtime Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the first executable cross-platform Technical Validation foundation: amendment-aware evidence manifests, `repo-marker-v1`, a strict `local-runner-jsonl-v0` contract, a Rust native-runner `doctor`, and a pinned Windows/Linux/macOS CI matrix.

**Architecture:** Keep Project/Task/Run semantics in the existing Node harness. Add a platform-neutral JSONL boundary and a small Rust binary that reports the actual host containment mechanism through `processkit`; no child process is started in this increment. Repository identity moves to an atomic UUID marker under Git common-dir while the Windows `FILE_ID_INFO` implementation remains a reference candidate.

**Tech Stack:** Node.js 22.16.0 built-ins and `node:test`; Rust 1.88.0 edition 2024; `processkit = 3.3.4`; Git CLI; GitHub Actions pinned to `ubuntu-24.04`, `windows-2025`, and `macos-15`.

**Spec:** `docs/superpowers/specs/2026-09-01-cross-platform-runtime-design.md`

## Global Constraints

- This is Milestone 0 experiment code only; it does not freeze a production Runner, repository schema, API, or dependency.
- No real Codex process is started.
- Existing Windows Job Object and `repo-local-git-v0` files remain reference candidates and are not deleted or silently treated as the cross-platform default.
- Every new experiment manifest records both the original Milestone 0 plan SHA-256 and the accepted cross-platform amendment SHA-256.
- Repository identity never falls back to path, remote URL, branch, or commit.
- Runner capability claims are conservative and must be rejected when structurally inconsistent with the reported mechanism.
- A green single-platform suite is not a cross-platform PASS; the CI matrix is required evidence.
- Raw evidence and credentials remain outside Git.

---

### Task 1: Amendment-aware evidence manifest

**Files:**
- Modify: `experiments/milestone-0/src/manifest.mjs`
- Modify: `experiments/milestone-0/src/cli.mjs`
- Modify: `experiments/milestone-0/test/manifest.test.mjs`
- Modify: `experiments/milestone-0/test/cli.test.mjs`

**Interfaces:**
- `createManifest({ experimentRunId, planSha256, amendments, harnessRevision, planPath, createdAt })`
- `amendments` is a sorted array of `{ path, sha256 }` with unique paths and lowercase SHA-256 values.
- `init` requires `--amendment <path>` for new cross-platform runs and writes `scope_amendments` into `manifest.json`.

- [ ] **Step 1: Write failing tests** proving an amendment path/hash is persisted, duplicate paths are rejected, and malformed hashes fail closed.
- [ ] **Step 2: Run `node --test test/manifest.test.mjs test/cli.test.mjs`** and confirm failure because `scope_amendments` is absent.
- [ ] **Step 3: Implement minimal manifest/CLI support** using the existing `sha256File` helper; do not mutate old manifest files.
- [ ] **Step 4: Re-run the focused tests** and require zero failures.
- [ ] **Step 5: Commit** with `test(m0): bind scope amendments in evidence manifests`.

### Task 2: `repo-marker-v1` repository identity

**Files:**
- Create: `experiments/milestone-0/src/repository-marker.mjs`
- Create: `experiments/milestone-0/test/repository-marker.test.mjs`
- Modify: `experiments/milestone-0/src/cli.mjs`

**Interfaces:**
- `resolveGitCommonDir(inputPath, options): Promise<string>`
- `readRepositoryMarker(commonDir, options): Promise<RepositoryIdentity | null>`
- `ensureRepositoryMarker(inputPath, options): Promise<{ scheme, uuid, repositoryIdentity, gitCommonDir, markerPath, created }>`
- CLI: `repository-marker --path <git-path>` prints the result as JSON.

- [ ] **Step 1: Write failing RID tests** using disposable repositories for root/subdirectory/relative paths, spaces/Chinese paths, linked worktree, independent clone, rename, re-clone, nested repo, concurrent registration, corrupt marker, and injected read-only creation failure.
- [ ] **Step 2: Run `node --test test/repository-marker.test.mjs`** and confirm failure because the module does not exist.
- [ ] **Step 3: Implement the minimal identity provider**: resolve absolute Git common-dir with argv-mode Git; create `<common-dir>/agentic-work-os/repository-id` via exclusive `wx`; write lowercase UUID v4 plus newline; sync/close; on `EEXIST` read the winner; fail closed on all other errors.
- [ ] **Step 4: Add and test the CLI command** without writing markers into the development repository.
- [ ] **Step 5: Re-run focused tests and `node --check src/*.mjs`**.
- [ ] **Step 6: Commit** with `test(m0): add cross-platform repository marker identity`.

### Task 3: `local-runner-jsonl-v0` contract

**Files:**
- Create: `experiments/milestone-0/src/runner-contract.mjs`
- Create: `experiments/milestone-0/test/runner-contract.test.mjs`

**Interfaces:**
- `validateRunnerCapabilities(value)` returns a normalized capability object.
- `validateRunnerRequest(value)` validates `start | input | finish_input | cancel` requests.
- `RunnerEventReducer.push(event)` validates envelope order, stream order, drain barriers, and terminal uniqueness.
- `parseRunnerJsonLine(line)` rejects blank, malformed, or non-object JSON.

- [ ] **Step 1: Write failing tests** for capability/mechanism consistency, request shape, base64 byte length, global and per-stream sequence monotonicity, frames after drain, duplicate completion, and protocol mismatch.
- [ ] **Step 2: Run `node --test test/runner-contract.test.mjs`** and confirm the missing-module failure.
- [ ] **Step 3: Implement only the frozen v0 contract**; unknown fields may be preserved, but unknown protocol/kind/mechanism and impossible guarantees fail closed.
- [ ] **Step 4: Re-run focused tests and syntax checks**.
- [ ] **Step 5: Commit** with `test(m0): freeze local runner JSONL contract`.

### Task 4: Rust native-runner Stage A (`doctor`)

**Files:**
- Create: `experiments/milestone-0/native-runner/Cargo.toml`
- Create: `experiments/milestone-0/native-runner/Cargo.lock`
- Create: `experiments/milestone-0/native-runner/src/main.rs`
- Create: `experiments/milestone-0/native-runner/src/capabilities.rs`

**Interfaces:**
- Command: `agentic-native-runner doctor`
- Stdout: exactly one compact JSON object matching `validateRunnerCapabilities`.
- Exit `0` only when host containment discovery yields a supported conservative profile.

- [ ] **Step 1: Write Rust unit tests first** for mechanism mapping (`job_object`, `cgroup_v2`, `process_group`, `process_reaper`) and unknown-mechanism rejection.
- [ ] **Step 2: Run `cargo test --manifest-path native-runner/Cargo.toml`** and confirm failure before the implementation exists.
- [ ] **Step 3: Implement capability mapping** using `processkit::host_containment()` and its reported mechanism/scope/cleanup facts; never infer strong escape resistance for a process group.
- [ ] **Step 4: Generate and commit `Cargo.lock`** with Rust 1.88.0-compatible dependencies.
- [ ] **Step 5: Run `cargo test`, `cargo fmt --check`, and `cargo clippy -- -D warnings`**.
- [ ] **Step 6: Commit** with `test(m0): add native runner capability doctor`.

### Task 5: Node doctor integration

**Files:**
- Create: `experiments/milestone-0/src/runner-client.mjs`
- Create: `experiments/milestone-0/test/runner-client.test.mjs`
- Modify: `experiments/milestone-0/src/cli.mjs`

**Interfaces:**
- `runNativeRunnerDoctor({ executable, spawnFn })` returns validated capabilities and raw stdout/stderr facts.
- CLI: `runner-doctor --executable <path>`.

- [ ] **Step 1: Write failing tests** for valid one-line output, nonzero exit, malformed/multiple stdout lines, stderr preservation, and capability-schema rejection using injected child processes.
- [ ] **Step 2: Run `node --test test/runner-client.test.mjs`** and confirm failure.
- [ ] **Step 3: Implement minimal spawn/read/validate behavior** with argv mode and no shell.
- [ ] **Step 4: Build the Rust binary and run the real Node↔Rust doctor integration locally when the host toolchain is available**.
- [ ] **Step 5: Re-run focused Node/Rust suites and syntax checks**.
- [ ] **Step 6: Commit** with `test(m0): connect Node harness to native runner doctor`.

### Task 6: Pinned three-platform CI matrix

**Files:**
- Create: `.github/workflows/m0-cross-platform-runtime.yml`
- Modify: `experiments/milestone-0/README.md`
- Modify: `docs/superpowers/plans/2026-09-01-cross-platform-runtime-foundation.md`

**Interfaces:**
- Matrix OS values: `ubuntu-24.04`, `windows-2025`, `macos-15`.
- Node: `22.16.0`; Rust: `1.88.0`.
- Every job runs Node tests/checks, Rust fmt/clippy/tests, builds `agentic-native-runner`, invokes `runner-doctor`, and uploads a redacted doctor JSON artifact.

- [ ] **Step 1: Add the workflow** with `fail-fast: false`, pinned action major versions, no `continue-on-error`, least-privilege `contents: read`, and path filters for M0 runtime files.
- [ ] **Step 2: Add a workflow-structure test** that parses the YAML as text and asserts all three pinned images, versions, commands, permissions, and absence of `continue-on-error`.
- [ ] **Step 3: Run the structure test and complete local verification**.
- [ ] **Step 4: Push and inspect all three GitHub Actions jobs**; preserve exact failures instead of weakening the matrix.
- [ ] **Step 5: Update this plan with actual run IDs and per-platform results**. Until all jobs complete, status remains `CI_RUNNING` or `INCONCLUSIVE`.
- [ ] **Step 6: Update Draft PR #2 without claiming Spike/Technical Gate PASS**.

## Completion Boundary

This plan completes only the cross-platform foundation and native-runner capability discovery. It does not implement process start, streaming, Cancel, timeout, hostile XP-01..XP-10 execution, or a real Codex Adapter. Those require the next Stage B/C/D plans and evidence. The Technical Gate remains `NOT EVALUATED`.