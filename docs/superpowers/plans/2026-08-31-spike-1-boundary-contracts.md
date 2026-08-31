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

- [ ] Write failing tests for boundary creation before process assignment, root PID facts, monotonic per-stream sequence, cancel/terminate ordering, active-process snapshots, drain completion, duplicate terminal helper facts and late stream frames after drain.
- [ ] Run the focused test and confirm failure because the module is absent.
- [ ] Implement the minimal strict validator/reducer; unknown frame kinds or impossible transitions must fail closed.
- [ ] Re-run focused tests to green.

### Task 2: Resource reconciliation reducer

**Files:**
- Create: `experiments/milestone-0/src/resource-reconciliation.mjs`
- Create: `experiments/milestone-0/test/resource-reconciliation.test.mjs`

**Interfaces:**
- `evaluateResourceSafety(facts)` returns `{ resourceState, lockAction, reasonCodes, hardFail }`.
- `nextReconciliationProjection(previous, facts)` returns only resource-state/lock changes and allowed reconciliation event type.

- [ ] Write failing tests mapping RR-01..RR-09 where the contract is pure-data testable: live process, undrained streams, known safe facts, drift orthogonality, insufficient facts, user-only confirmation, terminal late write, delivery-integrity orthogonality and unrelated repository identity.
- [ ] Run the focused tests and confirm failure because the module is absent.
- [ ] Implement the strict reducer; never mutate or synthesize `phase`, business `state`, `run.terminal`, ReviewDecision or delivery integrity.
- [ ] Re-run focused tests to green.

### Task 3: Independent post-stop observer

**Files:**
- Create: `experiments/milestone-0/src/post-stop-observer.mjs`
- Create: `experiments/milestone-0/test/post-stop-observer.test.mjs`

**Interfaces:**
- `observePostStop({ durationMs, sampleIntervalMs, processProbe, markerProbe, outputProbe, sleep, now })` returns every sample plus zero-survivor/zero-late-write verdict facts.
- Probes are injected so tests do not let the Runner self-attest.

- [ ] Write failing tests for full-window sampling, survivor detection, marker mutation detection, output mutation detection and no early-success return before the declared observation duration.
- [ ] Run the focused tests and confirm failure because the module is absent.
- [ ] Implement a minimal observer that always completes the full window unless a probe itself errors; probe errors produce `INCONCLUSIVE`, not PASS.
- [ ] Re-run focused tests to green.

### Task 4: Contract verification and handoff boundary

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-spike-1-boundary-contracts.md`

- [ ] Run all three focused suites plus syntax checks for the new modules.
- [ ] Verify no Windows Job Object source, `taskkill`, PID-tree inference, real Codex start or product state machine was introduced.
- [ ] Record that the next increment is a minimal Windows native Job Object helper using suspended creation/assignment plus an OS-backed independent probe; Windows evidence remains NOT RUN.

## Verification boundary

Green reducer/observer tests mean the evidence/state contracts are executable and deterministic. They do **not** prove R-02/R-04/R-05/R-06/R-07/R-08, zero survivors, drain correctness or Windows Job Object behavior. Those remain `NOT RUN` until a target-Windows helper produces indexed raw evidence.