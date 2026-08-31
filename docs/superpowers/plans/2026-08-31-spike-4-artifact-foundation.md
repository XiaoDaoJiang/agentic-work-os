# Spike 4 Artifact Durability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest real filesystem + SQLite Artifact seal/reconciliation prototype needed to exercise F-01..F-09 and F-17 without freezing production schema or claiming the full Spike 4 verdict.

**Architecture:** Keep staging and finalized objects under the same experiment store root. Sealing requires producer stop + drain, writes/flushed/closes a run-scoped temp file, hashes it, atomically renames it to a content-addressed object path, then commits Artifact row + `artifact.created` Event + optional dependent phase/state change in one SQLite transaction. Reconciliation independently re-hashes objects, classifies temp/orphan/dangling/corrupt facts, and computes Review readiness from the four Required Artifact types. Fault hooks deliberately abort at each boundary; this increment uses deterministic thrown faults first, with process-kill crash injection as the next evidence increment.

**Tech Stack:** Node.js >=22.5 built-ins (`node:fs`, `node:crypto`, experimental `node:sqlite`), `node:test`, no third-party packages.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` section 9, especially F-01..F-09 and F-17.

## Global Constraints

- Experiment-only schema and Store layout; neither is a production API/schema decision.
- Artifact types in scope: `agent_log`, `diff`, `verification_result`, `change_package`.
- A persisted Artifact row means the finalized object is sealed and immutable.
- Final object path is derived from SHA-256; mismatching existing bytes must fail closed and must never be overwritten.
- Filesystem rename and SQLite transaction are not described as one atomic transaction; reconciliation must expose the crash window as orphan/dangling facts.
- No Artifact or phase advance before producer stopped + output drained.
- Review readiness requires all four Required Artifact types readable/hash-matching and exactly one `change_package`.
- Partial sealed evidence for failed/cancelled/interrupted runs may remain visible but never becomes Review-ready.
- This increment does not implement accepted `delivery_integrity` F-10..F-14, Change Package replay, real Codex, or product UI.

---

### Task 1: Experiment SQLite state store

**Files:**
- Create: `experiments/milestone-0/src/artifact-db.mjs`
- Create: `experiments/milestone-0/test/artifact-db.test.mjs`

**Interfaces:**
- `openArtifactExperimentDb(path)` initializes minimal `runs`, `artifacts`, `events`, and `review_decisions` tables.
- `withImmediateTransaction(db, operation)` guarantees rollback on injected failure.

- [ ] Write failing tests for schema creation, unique Artifact/Event constraints, and rollback of Artifact row + Event + phase transition when an injected exception occurs mid-transaction.
- [ ] Run focused tests and confirm failure because the module is absent.
- [ ] Implement only the experiment schema and transaction helper with `node:sqlite`.
- [ ] Re-run focused tests to green.

### Task 2: Artifact staging/finalize/seal protocol

**Files:**
- Create: `experiments/milestone-0/src/artifact-store.mjs`
- Create: `experiments/milestone-0/test/artifact-store.test.mjs`

**Interfaces:**
- `createArtifactStore(root)` prepares `staging/` and `objects/` on one root.
- `sealArtifact({ store, db, runId, artifactId, type, bytes, producerStopped, outputDrained, transition, fault })` returns sealed metadata.
- `fault(point, context)` may throw at frozen boundaries: after staging write, after flush/close, after hash, after finalize, after Artifact row, after Event, before commit.

- [ ] Write failing tests for F-01/F-02 gating, F-03 finalized orphan, F-04 transactional rollback, F-05 idempotent same object and F-06 collision/mismatch rejection.
- [ ] Run focused tests and confirm failure because the module is absent.
- [ ] Implement staging → sync/close → SHA-256 → same-root atomic rename → DB transaction.
- [ ] Re-run focused tests to green.

### Task 3: Artifact reconciliation and Review readiness

**Files:**
- Create: `experiments/milestone-0/src/artifact-reconciliation.mjs`
- Create: `experiments/milestone-0/test/artifact-reconciliation.test.mjs`

**Interfaces:**
- `reconcileArtifacts({ store, db, runId })` returns temp/orphan/dangling/missing/corrupt/healthy facts without mutating historical decisions.
- `evaluateReviewReadiness(reconciliation)` returns `{ ready, reasonCodes }`.
- `validateReviewDecisionReference({ db, reconciliation, runId })` checks Package ID/hash binding when a decision exists.

- [ ] Write failing tests for F-07 row/object missing and hash mismatch, F-08 missing/duplicate Required Artifact, F-09 ReviewDecision package mismatch, and F-17 partial sealed evidence not pretending to be Review-ready.
- [ ] Run focused tests and confirm failure because the module is absent.
- [ ] Implement independent object verification and strict Review readiness.
- [ ] Re-run focused tests to green.

### Task 4: Verification and crash-injection handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-spike-4-artifact-foundation.md`

- [ ] Run all focused suites plus syntax checks.
- [ ] Inspect temp/finalized/SQLite facts for every injected boundary.
- [ ] Confirm no production schema, Event Sourcing, remote store, delivery-integrity projection or automatic cleanup was added.
- [ ] Record that actual process-kill crash injection and F-10..F-16 remain separate evidence increments.

## Verification boundary

Thrown fault hooks prove commit ordering and deterministic allowed-state classification inside one process. They do **not** prove OS/process-crash durability, filesystem semantics on target Windows, or the complete F-01..F-17 Spike verdict. Strong-kill crash injection must rerun the same boundaries using fresh DB/Store instances before Technical Gate evidence can be formed.