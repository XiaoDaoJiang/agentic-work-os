# ProcessKit Hostile Containment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce auditable three-platform evidence for the physical ProcessKit containment/drain parts of Milestone 0 Spike 1 without starting Codex or duplicating the Node business-state machine.

**Architecture:** Keep the existing Node hostile fixture as the adversarial child tree and add one experiment-only Rust `hostile-probe` binary under `native-runner`. The Rust probe owns a real `processkit::ProcessGroup`, spawns the fixture into it, captures both output pipes, records actual group membership plus independent PID liveness from the fixture control log, performs teardown, observes the stopped system for a frozen window, and emits a machine-readable result. Node remains the owner of Run/phase/state/CAS contracts; this probe supplies physical resource facts only.

**Tech Stack:** Rust 1.88.0, `processkit = 3.3.4`, Tokio, serde/serde_json, Node.js 22.16.0 hostile fixture, GitHub Actions `windows-2025` / `ubuntu-24.04` / `macos-15`.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` §1.3, §5 and §6; Issue #12.

## Global Constraints

- Use `ProcessGroup::new()` and record `group.mechanism().name()` from the group actually created.
- A process-group result must never be relabeled as strong escape-resistant containment.
- Race configurations freeze at 50 repetitions before evidence collection.
- `post_stop_observation_ms` is frozen at 750 ms for the first matrix; sample every 50 ms. The current fixture's first matrix uses delays <= 250 ms, leaving >= 500 ms safety margin.
- Any observed survivor or write after the terminal drain point is a scenario `FAIL`, never averaged away.
- A scenario `FAIL` is valid experiment output and does not make the CI harness process fail; CI failure means the harness/build/protocol itself failed. No `continue-on-error` is allowed.
- Every escaped survivor discovered by the experiment must be explicitly cleaned up after its evidence snapshot so hosted runners are not polluted.
- No real Codex, user repository, credential, Product/Task UI, production schema, sandbox or remote runner.
- This plan cannot declare Spike 1 PASS or Technical Gate PASS.

---

### Task 1: Freeze hostile scenario catalog and physical-evidence contract

**Files:**
- Create: `experiments/milestone-0/hostile-scenarios/tree-hang.json`
- Create: `experiments/milestone-0/hostile-scenarios/root-exit-detached.json`
- Create: `experiments/milestone-0/hostile-scenarios/late-output-hang.json`
- Create: `experiments/milestone-0/native-runner/src/hostile_evidence.rs`
- Create: `experiments/milestone-0/native-runner/tests/hostile_evidence.rs`
- Modify: `experiments/milestone-0/native-runner/src/lib.rs`

**Interfaces:**
- `HostileVerdict = PASS | FAIL | INCONCLUSIVE`.
- `HostileEvidence` records scenario id, seed, repetition, platform/architecture, ProcessKit version, actual mechanism, trigger, root pid, `members_before`, `members_after`, fixture pids, survivors, stream byte counts, drain flags, marker/control snapshots, observation samples, cleanup result and verdict reasons.
- `evaluate_physical_verdict(&HostileEvidence) -> HostileVerdict` returns FAIL for any survivor, late write, undrained stream or teardown error; INCONCLUSIVE for missing observer facts; PASS only when the observation window completed with zero survivors and stable files.

- [x] **Step 1: Write failing Rust contract tests** that construct synthetic evidence for PASS, survivor FAIL, late-write FAIL, undrained FAIL and missing-observer INCONCLUSIVE.
- [x] **Step 2: Run** `cargo test --locked --manifest-path experiments/milestone-0/native-runner/Cargo.toml --test hostile_evidence` and confirm failure because `hostile_evidence` does not exist.
- [x] **Step 3: Implement the evidence types and pure verdict function only.** Do not spawn a process in this task.
- [x] **Step 4: Add the three frozen JSON scenarios:**
  - `tree-hang`: parent→child→grandchild, continuous stdout/stderr, hang;
  - `root-exit-detached`: same descendant tree with `rootExitBeforeDescendants=true`, hang, giving POSIX a deliberate new-session/process-group escape attempt;
  - `late-output-hang`: single root, continuous stdout/stderr, marker writes, hang.
- [x] **Step 5: Re-run the focused test, rustfmt and Clippy.**
- [x] **Step 6: Commit** `test(m0): freeze hostile physical evidence contract`.

### Task 2: Spawn the existing hostile fixture inside an actual ProcessKit group

**Files:**
- Create: `experiments/milestone-0/native-runner/src/bin/hostile-probe.rs`
- Create: `experiments/milestone-0/native-runner/src/hostile_probe.rs`
- Create: `experiments/milestone-0/native-runner/tests/hostile_probe_smoke.rs`
- Modify: `experiments/milestone-0/native-runner/Cargo.toml`
- Modify: `experiments/milestone-0/native-runner/src/lib.rs`

**Interfaces:**
- CLI: `hostile-probe --node <absolute> --fixture <absolute hostile-process.mjs> --scenario <absolute json> --root <absolute disposable root> --trigger cancel|timeout|natural --trigger-ms <u64> --post-stop-ms 750 --sample-ms 50 --seed <u32> --repetition <u32>`.
- The probe creates a `ProcessGroup`, records the actual mechanism, uses `group.spawn(tokio::process::Command)` for the Node parent, and starts stdout/stderr reader tasks before waiting or teardown.
- The probe emits exactly one summary JSON line on stdout; fixture stdout/stderr are represented as byte counts/hashes in the summary and may additionally be written beneath the disposable root.

- [x] **Step 1: Write a failing integration smoke test** that launches the binary against `late-output-hang.json`, requests Cancel, and asserts the summary contains `actual_mechanism`, root pid, stream drain facts, and a completed observation window.
- [x] **Step 2: Run the focused integration test** and confirm failure because the binary does not exist.
- [x] **Step 3: Add direct Tokio features** `process`, `io-util`, `time`, `rt-multi-thread`, `macros`, `sync` while preserving the committed lock.
- [x] **Step 4: Implement minimal group spawn and two concurrent pipe drains.** `cancel` maps to `group.kill_all()` after `trigger_ms`; `timeout` waits until the deadline then calls `kill_all`; `natural` only waits for exit with a finite harness deadline.
- [x] **Step 5: Parse the fixture control JSONL after the root is reaped to collect all reported pids and roles.**
- [x] **Step 6: Re-run focused tests, rustfmt, Clippy and the existing cross-platform runtime suite.**
- [x] **Step 7: Commit** `feat(m0): run hostile fixture in ProcessKit group`.

### Task 3: Independent survivor observation and cleanup

**Files:**
- Modify: `experiments/milestone-0/native-runner/src/hostile_probe.rs`
- Modify: `experiments/milestone-0/native-runner/tests/hostile_probe_smoke.rs`

**Interfaces:**
- `observe_fixture_pids(pids, duration=750ms, sample=50ms)` uses identity-aware ProcessKit process lookup/liveness for every fixture pid parsed from the control log, independently of `group.members()`.
- cleanup uses a separate cleanup `ProcessGroup`, adopts each still-live foreign fixture pid, then `kill_all()`; cleanup facts are recorded separately from the experiment verdict and never erase the survivor failure.

- [x] **Step 1: Write a failing test** proving a synthetic/real escaped descendant remains a scenario FAIL even when cleanup succeeds afterward.
- [x] **Step 2: Implement independent liveness sampling and stable file size/hash samples for both control and marker files through the whole observation window.**
- [x] **Step 3: Implement cleanup-after-evidence using external-process adoption + `kill_all`, refusing unsafe/current-process identities.**
- [x] **Step 4: Run the focused tests and all Rust quality checks.**
- [x] **Step 5: Commit** `feat(m0): observe and clean hostile survivors`.

### Task 4: Execute R-02/R-03/R-06/R-08 physical matrix

**Files:**
- Create: `experiments/milestone-0/scripts/run-processkit-hostile-matrix.mjs`
- Create: `experiments/milestone-0/test/processkit-hostile-matrix.test.mjs`

**Interfaces:**
- Matrix runner invokes the Rust probe as argv, never through a shell.
- Deterministic smoke cases run twice from fresh roots.
- Race cases freeze 50 repetitions and seeds `0..49` before the first evidence-producing run.
- Matrix result separates `harness_status` from `scenario_verdict`.

- [x] **Step 1: Write failing Node tests** for matrix expansion, frozen repetitions/seeds, argv construction and the rule that scenario FAIL does not become harness crash.
- [x] **Step 2: Implement the matrix runner for:**
  - `tree-hang + cancel` → R-02/R-03/R-06 physical facts;
  - `tree-hang + timeout` → R-03;
  - `root-exit-detached + cancel` → R-02/R-06 escape attempt;
  - `late-output-hang + cancel` → R-08/RR-02/RR-07 drain/late-write facts.
- [x] **Step 3: Save one JSON result per case/repetition plus a capability summary; never hide FAIL/INCONCLUSIVE.**
- [x] **Step 4: Run Node tests plus Rust tests/checks.**
- [x] **Step 5: Commit** `test(m0): add ProcessKit hostile matrix runner`.

### Task 5: Add three-platform evidence workflow

**Files:**
- Create: `.github/workflows/m0-processkit-hostile-containment.yml`
- Create: `experiments/milestone-0/test/processkit-hostile-workflow.test.mjs`

**Interfaces:**
- Pinned OS matrix: `windows-2025`, `ubuntu-24.04`, `macos-15`.
- Node 22.16.0, Rust 1.88.0, committed locks, no `continue-on-error`.
- Workflow first runs contract/unit/smoke checks, then the evidence matrix, then uploads raw redacted JSON/control/marker artifacts even when scenario verdict is FAIL.

- [x] **Step 1: Write a failing workflow-structure test** for platform pins, toolchain pins, `--locked`, artifact upload and absence of `continue-on-error`.
- [x] **Step 2: Add the workflow and run it on the spike branch.**
- [x] **Step 3: Inspect all three artifacts and confirm actual mechanisms instead of inferring from OS names.**
- [x] **Step 4: Commit** `ci(m0): run ProcessKit hostile containment matrix`.

### Task 6: Record capability evidence without declaring Spike 1 PASS

**Files:**
- Create: `experiments/milestone-0/processkit-hostile-capability-matrix.json`
- Create: `experiments/milestone-0/processkit-hostile-evidence.md`

**Interfaces:**
- Per platform: actual mechanism; scenario-level PASS/FAIL/INCONCLUSIVE; survivor/late-write/drain/observer facts; limitations.
- Overall document may say `EVIDENCE_COLLECTED`, `FAIL`, or `INCONCLUSIVE`; it must not say Spike 1 PASS because R-04/R-05/R-07/R-09/R-10/R-11 and the business-state harness remain independently required.

- [x] **Step 1: Generate the matrix only from uploaded artifacts, preserving every failed repetition.**
- [x] **Step 2: Compare findings against R-02/R-03/R-06/R-08 and RR-02/RR-07.**
- [x] **Step 3: Record the next action for each platform without flattening Job Object and process-group guarantees.**
- [x] **Step 4: Re-run the full branch verification and update Issue #12 / Draft PR.**
- [x] **Step 5: Commit** `docs(m0): record ProcessKit hostile containment evidence`.

## Frozen evidence result

Evidence-producing head: `c8d011c5c6fccc71a0a389039ec2048adf6805eb`.

Independent workflows on that head:

- `M0 cross-platform runtime` run `33491181182`: Windows / Ubuntu / macOS = **3/3 success**.
- `M0 ProcessKit hostile containment` run `33491181220`: Windows / Ubuntu / macOS = **3/3 harness success**.

The hostile workflow executed **600/600 harness runs successfully**. Scenario verdicts were **361 PASS / 239 FAIL / 0 INCONCLUSIVE**.

Observed mechanisms and scenario results:

- Windows Server 2025: `job_object`, 106 PASS / 94 FAIL. The failures are an observer disagreement: Job membership is empty but the independent PID liveness observer reports original descendants as alive. This requires TECH-XP-04 (#14); historical failures remain frozen.
- Ubuntu 24.04: `process_group`, 110 PASS / 90 FAIL. `root-exit-detached + cancel` is 50/50 FAIL with child/grandchild survivors and late writes. A true `cgroup_v2` profile remains untested and is TECH-XP-05 (#15).
- macOS 15: `process_group`, 145 PASS / 55 FAIL. `root-exit-detached + cancel` is 50/50 FAIL with child/grandchild survivors and late writes. The macOS capability/mechanism decision is TECH-XP-06 (#16).

Machine-readable evidence: `experiments/milestone-0/processkit-hostile-capability-matrix.json`.

Human-readable evidence: `experiments/milestone-0/processkit-hostile-evidence.md`.

Current experiment result: **FAIL — evidence collected**. This is a valid technical-validation outcome and does not mean the experiment harness failed or ProcessKit is rejected as a whole.

Post-evidence documentation commit `7b20c46beb6dd84d93008736871d4f4e89ec4aa0` triggered fresh verification. Foundation run `33492360956` is 3/3 success. The hostile rerun is verification-only and does not replace the frozen evidence snapshot above.

## Self-review result

- Spec coverage: this plan covers the physical containment/drain evidence of R-02, R-03, R-06, R-08, RR-02 and RR-07. It intentionally does not duplicate Node business-state/CAS coverage for R-04, R-05, R-09, R-10 or R-11, and it does not simulate Runner-process crash R-07 in this matrix; those remain explicit remaining Spike 1 work.
- No production architecture is frozen; all new code lives under Milestone 0 experiments.
- Process-group escape is recorded as a limitation rather than hidden by cleanup.
- The CI process exit reports harness execution health, while scenario verdicts remain machine-readable evidence and may be FAIL without weakening CI.
- No real Codex was started.
- No platform is `managed`.
- Spike 1 remains **NOT PASS**.
- Technical Gate remains **NOT EVALUATED**.
