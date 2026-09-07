# Spike 1 Process Boundary Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze and test the platform-neutral state/evidence contracts that a future Windows Job Object helper and independent observer must satisfy before collecting Spike 1 containment evidence.

**Architecture:** Keep OS control out of this increment. A strict boundary-event reducer consumes structured helper facts and rejects impossible ordering; a resource-reconciliation reducer maps machine facts to `safe | blocked` without changing business terminal state; an independent post-stop observer samples separately supplied process/marker/output probes for the full frozen observation window. Windows-native code will later plug into these interfaces and is not implemented or claimed here.

**Tech Stack:** Node.js >=20 built-ins, `node:test`, no third-party dependencies.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` sections 5-6, especially RR-01..RR-09 and R-01..R-11.

## Global Constraints

- Experiment-only code under `experiments/milestone-0`.
- No real Codex process and no product Runner/UI.
- Never infer process ownership from PID ancestry alone; boundary membership must come from the future OS helper.
- `run.terminal` is a business-history fact; post-terminal resource reconciliation may change only resource state/locks.
- `safe` requires zero active boundary processes, stdout/stderr drain completion, a known retained/released workspace lease, and completed registered drift checks.
- User confirmation cannot substitute for machine facts.
- Any output/marker mutation after a completed stop observation is a hard containment/drain signal and must not create a new Artifact or business terminal.
- Non-Windows tests prove reducer/observer semantics only, not Windows process containment.

---

### Task 1: Boundary event protocol and reducer

**Files:**
- Create: `experiments/milestone-0/src/process-boundary-protocol.mjs`
- Create: `experiments/milestone-0/test/process-boundary-protocol.test.mjs`

**Interfaces:**
- `validateBoundaryFrame(frame)` validates structured helper frames.
- `reduceBoundaryFrames(frames)` returns root/boundary facts, active process count, stream sequences, drain state, cancel facts and protocol violations.

- [x] Write failing tests for boundary creation before process assignment, root PID facts, monotonic per-stream sequence, cancel/terminate ordering, active-process snapshots, drain completion, duplicate terminal helper facts and late stream frames after drain.
- [x] Run the focused test and confirm failure because the module is absent.
- [x] Implement the minimal strict validator/reducer; unknown frame kinds or impossible transitions fail closed.
- [x] Re-run focused tests to green.

### Task 2: Resource reconciliation reducer

**Files:**
- Create: `experiments/milestone-0/src/resource-reconciliation.mjs`
- Create: `experiments/milestone-0/test/resource-reconciliation.test.mjs`

**Interfaces:**
- `evaluateResourceSafety(facts)` returns `{ resourceState, lockAction, reasonCodes, hardFail }`.
- `nextReconciliationProjection(previous, facts)` returns only resource-state/lock changes and allowed reconciliation event type.

- [x] Write failing tests mapping RR-01..RR-09 where the contract is pure-data testable: live process, undrained streams, known safe facts, drift orthogonality, insufficient facts, user-only confirmation, terminal late write, delivery-integrity orthogonality and unrelated repository identity.
- [x] Run the focused tests and confirm failure because the module is absent.
- [x] Implement the strict reducer; it never mutates or synthesizes `phase`, business `state`, `run.terminal`, ReviewDecision or delivery integrity.
- [x] Re-run focused tests to green.

### Task 3: Independent post-stop observer

**Files:**
- Create: `experiments/milestone-0/src/post-stop-observer.mjs`
- Create: `experiments/milestone-0/test/post-stop-observer.test.mjs`

**Interfaces:**
- `observePostStop({ durationMs, sampleIntervalMs, processProbe, markerProbe, outputProbe, sleep, now })` returns every sample plus zero-survivor/zero-late-write verdict facts.
- Probes are injected so tests do not let the Runner self-attest.

- [x] Write failing tests for full-window sampling, survivor detection, marker mutation detection, output mutation detection and no early-success return before the declared observation duration.
- [x] Run the focused tests and confirm failure because the module is absent.
- [x] Implement a minimal observer that always completes the full window unless a probe itself errors; probe errors produce `INCONCLUSIVE`, not PASS.
- [x] Re-run focused tests to green.

### Task 4: Contract verification and handoff boundary

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-spike-1-boundary-contracts.md`

- [x] Run all three focused suites plus syntax checks for the new modules.
- [x] Verify no Windows Job Object source, `taskkill`, PID-tree inference, real Codex start or product state machine was introduced.
- [x] Record that the next Windows increment is a minimal native Job Object helper using suspended creation/assignment plus an OS-backed independent probe; Windows evidence remains NOT RUN.

## Verification boundary

Green reducer/observer tests mean the evidence/state contracts are executable and deterministic. They do **not** prove R-02/R-04/R-05/R-06/R-07/R-08, zero survivors, drain correctness or Windows Job Object behavior. Those remain `NOT RUN` until a target-Windows helper produces indexed raw evidence.

## Current status

Fresh verification for this increment on Node v22.16.0:

- boundary protocol suite: **8/8 PASS**;
- resource reconciliation suite: **10/10 PASS**;
- independent post-stop observer suite: **6/6 PASS**;
- combined new contract suites: **24/24 PASS**;
- `node --check src/*.mjs` for the new modules: **PASS**;
- Windows Job Object helper compile/run: **NOT RUN / NOT IMPLEMENTED in this increment**;
- Spike 1 containment verdict: **NOT EVALUATED**.

The next native design must create the target process suspended, establish the Job Object ownership boundary before user code runs, then resume execution; the independent observer must consume OS-backed process facts rather than infer ownership from a PID tree.