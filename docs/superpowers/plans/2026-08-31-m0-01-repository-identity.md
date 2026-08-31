# M0-01 Repository Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the frozen `repo-local-git-v0` contract into an executable Windows repository-identity helper and RI-01..RI-11 experiment matrix without claiming Windows evidence before it is actually run.

**Architecture:** Keep the SHA-256 encoding pure and dependency-free. Resolve Git facts in Node, obtain Windows `FILE_ID_INFO` and final/short paths through a small PowerShell P/Invoke helper, then compose both into one fail-closed repository identity result. A separate matrix runner creates only disposable Git fixtures and writes machine-readable case results; it refuses to run RI-01..RI-10 off Windows.

**Tech Stack:** Node.js >=20 built-ins, `git`, Windows PowerShell 5.1+ P/Invoke to Kernel32, `node:test`.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` sections 1-2, especially `repository_identity` `repo-local-git-v0` and RI-01..RI-11.

## Global Constraints

- This is experiment-only code under `experiments/milestone-0`; it is not a production repository ID implementation.
- The identity payload and RI-11 frozen vector must remain byte-for-byte compatible with the experiment plan.
- `git rev-parse --path-format=absolute --git-common-dir` is authoritative for the Git common directory.
- Linked worktrees must inherit the source repository identity; temporary product workspace policy is not defined here.
- File identity failure, inaccessible Git common-dir, malformed native output, or unstable facts fail closed; never fall back to path strings or remote URLs.
- RI-01..RI-10 require real Windows execution. Non-Windows unit tests may prove orchestration logic but cannot produce Gate verdicts.
- No real Codex process is started in M0-01.
- Raw matrix evidence stays under ignored `evidence/` paths.

---

### Task 1: Git fact resolution and identity composition

**Files:**
- Modify: `experiments/milestone-0/src/repository-identity.mjs`
- Create: `experiments/milestone-0/test/repository-identity-core.test.mjs`

**Interfaces:**
- Produces: `resolveGitRepositoryFacts(inputPath, options)` returning `inputPath`, `resolvedInputPath`, `gitTopLevel`, and `gitCommonDir`.
- Produces: `computeLocalRepositoryIdentity(inputPath, options)` returning audit fields, raw file identity, and final `repositoryIdentity`.
- Consumes: an injected async `fileIdentityResolver(commonDir)` so Git semantics are unit-testable on non-Windows hosts.

- [ ] **Step 1: Write failing tests** covering root/subdirectory/relative path discovery, linked-worktree common-dir reuse, independent clone common-dir separation, and fail-closed behavior for non-Git paths.
- [ ] **Step 2: Run `node --test test/repository-identity-core.test.mjs`** and confirm failure because the new exports do not exist.
- [ ] **Step 3: Implement the minimal Git resolver and identity composition** with `execFile`, no shell interpolation, one `rev-parse` command per lookup, strict two-line output validation, and no fallback identity.
- [ ] **Step 4: Re-run the focused test** and require all cases to pass.

### Task 2: Windows FILE_ID_INFO helper

**Files:**
- Create: `experiments/milestone-0/scripts/windows-file-identity.ps1`
- Create: `experiments/milestone-0/src/windows-file-identity.mjs`
- Create: `experiments/milestone-0/test/windows-file-identity.test.mjs`

**Interfaces:**
- Produces: `getWindowsFileIdentity(targetPath, options)` returning `{ finalPath, volumeSerialHex, fileIdHex }`.
- Produces: `getWindowsShortPath(targetPath, options)` returning a short-path alias when Windows exposes one, otherwise `null`.
- The PowerShell helper supports `file-id` and `short-path` operations and emits exactly one compact JSON object.

- [ ] **Step 1: Write failing wrapper tests** for platform guard, JSON validation, lowercase fixed-width hex validation, and native-command failure propagation using an injected executor.
- [ ] **Step 2: Run the focused test** and confirm it fails because the wrapper is absent.
- [ ] **Step 3: Implement the Node wrapper and PowerShell P/Invoke helper** using `CreateFileW` with directory backup semantics, `GetFileInformationByHandleEx(FileIdInfo)`, `GetFinalPathNameByHandleW`, and `GetShortPathNameW`.
- [ ] **Step 4: Re-run focused tests and `node --check src/*.mjs`**. Record that the PowerShell P/Invoke still requires real Windows execution before any RI verdict.

### Task 3: RI-01..RI-11 disposable matrix runner

**Files:**
- Create: `experiments/milestone-0/src/repository-identity-matrix.mjs`
- Create: `experiments/milestone-0/test/repository-identity-matrix.test.mjs`
- Modify: `experiments/milestone-0/src/cli.mjs`

**Interfaces:**
- Produces: `runRepositoryIdentityMatrix({ parent, experimentRunId, powershellExecutable })`.
- Produces JSON with matrix version, platform, per-case `PASS | FAIL | INCONCLUSIVE`, evidence details, and an overall verdict calculated by strict conjunction.
- Adds CLI commands `repository-identity` and `repository-identity-matrix`.

- [ ] **Step 1: Write failing matrix tests** for the complete RI ID set, strict overall verdict reduction, and non-Windows refusal/inconclusive handling.
- [ ] **Step 2: Run focused tests** and confirm failure because the matrix runner is absent.
- [ ] **Step 3: Implement disposable Git fixture helpers and cases:** RI-01 path variants; RI-02 case/separator plus short-path alias; RI-03 junction; RI-04 linked worktree; RI-05 same-origin independent clones; RI-06 same-volume rename; RI-07 re-clone; RI-08 delete/rebuild same path; RI-09 nested repository; RI-10 explicit native/Git failure; RI-11 frozen vector.
- [ ] **Step 4: Re-run focused tests and syntax checks.** Do not map an unavailable Windows short-path alias to PASS; record RI-02 as `INCONCLUSIVE` until the full declared variation is observed.

### Task 4: Usage documentation and evidence discipline

**Files:**
- Modify: `experiments/milestone-0/README.md`

**Interfaces:**
- Documents exact Windows commands to compute one identity and run the matrix into `evidence/milestone-0/<experiment_run_id>/cross-contracts/repository-identity/`.

- [ ] **Step 1: Document prerequisites and commands** without implying RI execution occurred.
- [ ] **Step 2: Run focused Node tests plus `npm run check`.** If the host is not Windows, explicitly record Windows RI-01..RI-10 as not executed rather than PASS.
- [ ] **Step 3: Review the diff against RI-01..RI-11 and confirm no product UI, Codex start, production schema, or path/remote fallback was introduced.

## Verification boundary

A green Node test suite on Linux/macOS means the helper contracts and matrix orchestration are internally consistent. It does **not** satisfy Technical Gate RI-01..RI-10. M0-01 only reaches an RI verdict after the matrix is executed on the target Windows environment and its raw evidence is indexed by the M0 harness.