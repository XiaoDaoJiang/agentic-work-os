# Spike 3 Change Package Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a minimal deterministic Change Package candidate that can encode the supported working-tree result, survive Workspace deletion, rebuild the same Git tree in a clean checkout, and bind sealed Diff/Verification evidence without introducing Merge/Push or a product delivery phase.

**Architecture:** `change-package-v0` is deterministic UTF-8 JSON whose sorted file entries use delete/upsert operations; upsert bytes are base64 with size/SHA-256 and Git mode. The package binds `base_revision`, Git object format, `result_tree_hash`, sealed Agent Log/Diff/Verification refs and a frozen VerificationInvocation contract. Creation computes the result tree with a temporary Git index so the real index is untouched. Replay validates the full package before any filesystem mutation, requires checkout HEAD to equal `base_revision`, applies delete/upsert operations, recomputes the temporary-index tree hash, and fails closed on any mismatch.

**Tech Stack:** Node.js >=22.13 built-ins, Git CLI using argv mode/NUL-delimited output, existing M0 Artifact Store/SQLite experiment modules, `node:test`.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` section 8, CP-01..CP-11.

## Global Constraints

- Experiment format only; not a frozen production Package schema.
- Supported result entries are regular files and tracked executable files; symlink/submodule/sparse/LFS generalization is out of scope and must fail closed if encountered.
- Rename is represented as delete + add.
- Package creation/read/replay must never mutate the source Workspace index.
- Package bytes contain no credential material and do not depend on the original Workspace after sealing.
- Replay validates schema, hashes, embedded payload bytes and base revision before applying any operation.
- No automatic commit, merge, push, publish or conflict resolution.
- ReviewDecision remains immutable and refers to the sealed content-addressed Package row/hash.

---

### Task 1: Git result-tree and change collection

**Files:**
- Create: `experiments/milestone-0/src/git-result-tree.mjs`
- Create: `experiments/milestone-0/test/git-result-tree.test.mjs`

**Interfaces:**
- `computeResultTreeHash({ workspace, baseRevision, gitExecutable })` uses a temporary `GIT_INDEX_FILE` and returns `{ objectFormat, resultTreeHash }`.
- `collectWorkspaceChanges({ workspace, baseRevision, gitExecutable })` returns sorted delete/upsert entries with path/mode/size/hash/bytes.

- [ ] Write failing tests with text/binary, spaces/Chinese paths, modification, deletion, untracked file and rename-as-delete+add.
- [ ] Confirm real index hash/status are unchanged after both helpers.
- [ ] Implement NUL-safe Git discovery and temp-index tree hashing.
- [ ] Re-run focused tests to green.

### Task 2: Deterministic package encode/validate

**Files:**
- Create: `experiments/milestone-0/src/change-package.mjs`
- Create: `experiments/milestone-0/test/change-package.test.mjs`

**Interfaces:**
- `buildChangePackage({...})` returns `{ bytes, sha256, manifest }`.
- `validateChangePackageBytes(bytes)` returns parsed/validated package or throws before replay.

- [ ] Write failing tests for CP-01/CP-03 deterministic coverage, sealed evidence refs, payload hash/size, duplicate paths and malformed/tampered bytes.
- [ ] Implement canonical sorted encoding and full preflight validation.
- [ ] Re-run focused tests to green.

### Task 3: Clean-checkout replay

**Files:**
- Create: `experiments/milestone-0/src/change-package-replay.mjs`
- Create: `experiments/milestone-0/test/change-package-replay.test.mjs`

**Interfaces:**
- `replayChangePackage({ bytes, checkout, gitExecutable })` validates package/base, applies operations, recomputes tree and returns replay evidence.

- [ ] Write failing tests for CP-05 same result tree after original Workspace deletion, CP-07 wrong base rejected before mutation and CP-08 tampering rejected before mutation.
- [ ] Implement replay with all payload validation completed before the first write/delete.
- [ ] Re-run focused tests to green.

### Task 4: Unique package seal and immutable Review binding

**Files:**
- Create: `experiments/milestone-0/src/change-package-seal.mjs`
- Create: `experiments/milestone-0/test/change-package-seal.test.mjs`

**Interfaces:**
- `sealUniqueChangePackage({ db, store, runId, artifactId, packageBytes })` wraps the Artifact seal protocol.

- [ ] Write failing tests for CP-02 ordering prerequisites, CP-09 same-Run idempotency/no second Package and CP-10 post-Review reseal rejection.
- [ ] Implement strict prerequisite/uniqueness/decision guards and seal through existing Artifact Store.
- [ ] Re-run focused tests to green.

### Task 5: Verification replay binding and handoff

**Files:**
- Create: `experiments/milestone-0/src/verification-replay.mjs`
- Create: `experiments/milestone-0/test/verification-replay.test.mjs`
- Modify: `docs/superpowers/plans/2026-08-31-spike-3-change-package.md`

- [ ] Write tests proving CP-06 only rebinds `cwd_binding=assigned_workspace` to the replay checkout while execution/env/timeout/output/cancel contract bytes stay equivalent.
- [ ] Run all Spike 3 focused suites plus syntax checks.
- [ ] Feed the real package validator/replay validator into Spike 4 delivery-integrity tests, replacing stub success validators for integrated evidence.
- [ ] Record CP-11 drift gate as a separate cross-contract dependency; no Accept/Delivery claim without drift evidence.

## Verification boundary

Passing cross-platform Git/package/replay tests proves the candidate format can encode/rebuild the declared Git fixture and bind evidence. Spike 3 PASS still requires indexed evidence, integration with Spike 4 sealed bytes/reconciliation, the frozen VerificationInvocation replay, and the relevant drift gate. The format remains experimental until Technical Gate selection.