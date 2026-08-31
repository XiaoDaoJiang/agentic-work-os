# Spike 1 Windows Job Object Runner Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the smallest Windows-only Job Object runner candidate that can create a target process suspended, assign it to a Runner-owned Job before user code runs, resume it, observe active Job membership, and terminate the Job on Cancel while feeding the already-frozen boundary/resource contracts.

**Architecture:** Keep the Windows-native mechanism isolated in `scripts/windows-job-runner.ps1` with an embedded C# P/Invoke helper. The helper launches the requested executable with `CreateProcessW(CREATE_SUSPENDED)`, creates/configures a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, assigns the process, resumes the primary thread, writes structured control JSONL to a disposable control file, polls Job accounting until no active process remains, and watches a disposable cancel file to invoke `TerminateJobObject`. Child stdout/stderr inherit the helper's stdout/stderr handles so the Node wrapper can capture them as separate byte streams without mixing protocol frames into user output. Node only owns argument encoding, stream capture, cancel-file creation and post-run control-log validation.

**Tech Stack:** Node.js >=22.13 built-ins; Windows PowerShell 5.1+ `Add-Type`; Kernel32 Job Object / process APIs; `node:test`.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` sections 5-6, especially R-01..R-11 and RR-01..RR-09; `docs/superpowers/plans/2026-08-31-spike-1-boundary-contracts.md`.

## Global Constraints

- Experiment-only; this is not a product Runner or production protocol.
- Target process must not execute user code before successful Job assignment.
- No PID-tree inference is accepted as ownership evidence.
- No `taskkill /T`, WMI descendant walking, shell string interpolation or terminal-text parsing.
- The Job is configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`; explicit Cancel uses `TerminateJobObject`.
- Job active-process facts come from `QueryInformationJobObject`, not parent/child ancestry.
- The helper must keep the Job handle open until the Job reaches zero active processes or an explicit failure occurs.
- Control facts go to JSONL under a disposable root; child stdout/stderr remain raw streams.
- Node tests on non-Windows can verify launch/control contracts only. R-02/R-04/R-05/R-06/R-07/R-08 and zero-survivor claims require target-Windows execution.
- No real Codex is started in this increment.

---

### Task 1: Node launch-spec / control-log contract

**Files:**
- Create: `experiments/milestone-0/src/windows-job-runner.mjs`
- Create: `experiments/milestone-0/test/windows-job-runner.test.mjs`

**Interfaces:**
- `encodeWindowsJobLaunchSpec({ program, argv, cwd }) -> base64url UTF-8 JSON`.
- `buildWindowsJobRunnerArgs({ helperScript, launchSpec, controlFile, cancelFile, pollIntervalMs }) -> argv[]`.
- `readAndReduceBoundaryControlLog(controlFile)` parses each JSONL frame through the existing boundary protocol reducer.
- `startWindowsJobRun(options)` is platform-guarded and returns `{ process, cancel, completion, stdoutFrames, stderrFrames }`.

- [ ] Write RED tests for argument-safe encoding, invalid spec rejection, non-Windows guard, control-log protocol validation and cancel-file idempotency using injected filesystem/spawn functions.
- [ ] Implement only the Node wrapper/contract; no Windows truth is inferred by unit tests.
- [ ] Re-run focused tests to green and syntax-check the module.

### Task 2: Windows Job Object helper

**Files:**
- Create: `experiments/milestone-0/scripts/windows-job-runner.ps1`

**Native requirements:**
- `CreateJobObjectW`.
- `SetInformationJobObject(JobObjectExtendedLimitInformation)` with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
- `CreateProcessW` with `CREATE_SUSPENDED`, explicit application path/command line, requested cwd and inherited standard handles.
- `AssignProcessToJobObject` before `ResumeThread`.
- `QueryInformationJobObject(JobObjectBasicAccountingInformation)` for active-process count.
- `TerminateJobObject` for explicit Cancel.
- `WaitForSingleObject`/process handle facts for root exit; `CloseHandle` cleanup.

**Control frames:** reuse `process-boundary-protocol.mjs` kinds: `boundary.created`, `process.assigned`, `boundary.snapshot`, `cancel.requested`, `boundary.terminate.started`, `boundary.terminate.completed`, `process.exited`, `helper.exited`. The helper must never emit `process.assigned` for a PID that was not successfully assigned by the OS.

- [ ] Add source-level contract tests in Task 1 that require the suspended-create/assign/resume ordering and required Job APIs to be present; these tests are only an implementation guard, not Windows evidence.
- [ ] Implement the helper with a single Job handle and fail-closed cleanup.
- [ ] Ensure helper diagnostics go to stderr/control JSONL, never into child stdout.

### Task 3: Target-Windows execution harness boundary

**Files:**
- Modify: `experiments/milestone-0/README.md`
- Modify: `docs/superpowers/plans/2026-08-31-spike-1-windows-job-runner.md`

- [ ] Document exact disposable invocation using the frozen hostile fixture scenario and pre-registered seed.
- [ ] Document output/control/marker evidence paths under `evidence/milestone-0/<run>/spike-1-runner/`.
- [ ] Document that the available non-Windows environment has no `powershell.exe/pwsh`; helper compile/runtime remains NOT RUN here.
- [ ] Record target-Windows matrix steps for Cancel during output, root-early descendant, delayed spawn, repeated Cancel and post-stop observation.
- [ ] Keep Spike 1 verdict `NOT EVALUATED` until indexed Windows OS evidence proves zero survivors, drain completion and terminal/resource invariants.

## Verification boundary

Passing Node wrapper tests and source-contract checks means the candidate is internally wired to the frozen evidence protocol. It does **not** prove Windows Job Object behavior. The next evidence step must execute the helper on the target Windows machine against the hostile fixture and preserve raw control JSONL, stdout/stderr bytes, marker observations, Job active-process samples, Cancel timing and post-stop observer results.