# Spike 4 Artifact Durability Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest real filesystem + SQLite Artifact seal/reconciliation prototype needed to exercise F-01..F-14 and F-17 without freezing production schema or claiming the full Spike 4 verdict.

**Architecture:** Keep staging and finalized objects under the same experiment store root. Sealing requires producer stop + drain, writes/syncs/closes a run-scoped temp file, hashes it, atomically publishes it to a content-addressed object path with a same-volume no-overwrite hard-link + staging unlink, then commits Artifact row + `artifact.created` Event + optional dependent phase/state change in one SQLite transaction. Reconciliation independently re-hashes objects, classifies temp/orphan/missing/corrupt facts, and computes Review readiness. A separate pure read model computes accepted Package `delivery_integrity` without rewriting historical decisions or terminal state.

**Tech Stack:** Node.js >=22.13 built-ins (`node:fs`, `node:crypto`, `node:sqlite`), `node:test`, no third-party packages. `node:sqlite` was added in Node 22.5 and is unflagged from Node 22.13; the M0 harness uses the unflagged floor.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` section 9, especially F-01..F-17.

## Global Constraints

- Experiment-only schema and Store layout; neither is a production API/schema decision.
- Artifact types in scope: `agent_log`, `diff`, `verification_result`, `change_package`.
- A persisted Artifact row means the finalized object is sealed and immutable.
- Final object path is derived from SHA-256; mismatching existing bytes fail closed and are never overwritten.
- Filesystem finalize and SQLite transaction are not described as one atomic transaction; reconciliation exposes the crash window as orphan/dangling facts.
- No Artifact or phase advance before producer stopped + output drained.
- Review readiness requires all four Required Artifact types readable/hash-matching and exactly one healthy `change_package`.
- Partial sealed evidence for failed/cancelled/interrupted runs may remain visible but never becomes Review-ready.
- `delivery_integrity` exists only for accepted decisions and is exactly `healthy | missing | corrupt`; it is a recalculated projection, not a business state or Event.
- This work does not implement Change Package format/replay itself, real Codex, product UI, Event Sourcing, remote Store, automatic cleanup, backup or production schema.

---

### Task 1: Experiment SQLite state store

**Files:**
- Create: `experiments/milestone-0/src/artifact-db.mjs`
- Create: `experiments/milestone-0/test/artifact-db.test.mjs`

**Interfaces:**
- `openArtifactExperimentDb(path)` initializes minimal `runs`, `artifacts`, `events`, and `review_decisions` tables.
- `withImmediateTransaction(db, operation)` guarantees rollback on injected failure.

- [x] Write failing tests for schema creation, unique Artifact/Event constraints, and rollback of Artifact row + Event + phase transition when an injected exception occurs mid-transaction.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement only the experiment schema and transaction helper with `node:sqlite`.
- [x] Re-run focused tests to green.

### Task 2: Artifact staging/finalize/seal protocol

**Files:**
- Create: `experiments/milestone-0/src/artifact-store.mjs`
- Create: `experiments/milestone-0/test/artifact-store.test.mjs`

**Interfaces:**
- `createArtifactStore(root)` prepares `staging/` and `objects/` on one root.
- `sealArtifact({ store, db, runId, artifactId, type, bytes, producerStopped, outputDrained, transition, fault })` returns sealed metadata.
- `fault(point, context)` may throw at frozen boundaries: after staging write, after flush/close, after hash, after finalize, after Artifact row, after Event, before commit.

- [x] Write failing tests for F-01/F-02 gating, F-03 finalized orphan, F-04 transactional rollback, F-05 idempotent same object and F-06 collision/mismatch rejection.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement staging → sync/close → SHA-256 → same-root atomic no-overwrite finalize → DB transaction.
- [x] Re-run focused tests to green.

### Task 3: Artifact reconciliation and Review readiness

**Files:**
- Create: `experiments/milestone-0/src/artifact-reconciliation.mjs`
- Create: `experiments/milestone-0/test/artifact-reconciliation.test.mjs`

**Interfaces:**
- `reconcileArtifacts({ store, db, runId })` returns temp/orphan/missing/corrupt/healthy facts without mutating historical decisions.
- `evaluateReviewReadiness(reconciliation)` returns `{ ready, reasonCodes }`.
- `validateReviewDecisionReference({ db, reconciliation, runId })` checks Package ID/hash binding when a decision exists.

- [x] Write failing tests for F-07 row/object missing and hash mismatch, F-08 missing/duplicate Required Artifact, F-09 ReviewDecision package mismatch, and F-17 partial sealed evidence not pretending to be Review-ready.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement independent object verification and strict Review readiness.
- [x] Re-run focused tests to green.

### Task 4: Accepted Package delivery_integrity projection

**Files:**
- Create: `experiments/milestone-0/src/delivery-integrity.mjs`
- Create: `experiments/milestone-0/test/delivery-integrity.test.mjs`

**Interfaces:**
- `computeDeliveryIntegrity({ store, db, runId, manifestValidator, replayValidator })` returns `null` for no accepted decision, otherwise `{ value, reasonCodes, checkedAt }`.
- `assertDeliveryIntegrityValue(value)` permits only `healthy | missing | corrupt`.

- [x] Write failing tests for F-10 healthy, F-11 no projection/invalid fourth value, F-12 missing row/object precedence, F-13 type/hash/manifest/replay corruption, and F-14 exact-byte restoration.
- [x] Run focused tests and confirm failure because the module is absent.
- [x] Implement read-only three-value projection with explicit manifest/replay validators.
- [x] Verify recomputation never appends Event or rewrites ReviewDecision/Run terminal facts.

### Task 5: Strong-kill crash injection

**Files:**
- Create: `experiments/milestone-0/fixtures/artifact-crash-worker.mjs`
- Create: `experiments/milestone-0/test/artifact-crash-worker.test.mjs`

- [x] Write crash tests and reject the initial false-positive RED where a missing worker also looked like a nonzero crash.
- [x] Tighten RED to require actual `SIGKILL` in the available Linux host.
- [x] Kill a separate sealing process at after-flush, after-hash, after-finalize, after-Artifact-row, after-Event and before-commit boundaries.
- [x] Reopen SQLite/Store after every kill and verify allowed facts: no DB advance before commit; finalized post-publish object becomes orphan; SQLite transaction rows/phase roll back.

### Task 6: Verification and remaining boundary

- [x] Run the complete Spike 4 focused suite and syntax checks.
- [x] Inspect temp/finalized/SQLite facts for every injected boundary.
- [x] Confirm no production schema, Event Sourcing, remote store or automatic cleanup was added.
- [ ] Run the same strong-kill matrix on the target Windows filesystem/Node runtime and save/index raw evidence.
- [ ] Implement/integrate F-15 nonterminal startup convergence with the Run/resource state harness.
- [ ] Integrate F-16 terminal late-output discard with the future Runner; the platform-neutral resource reducer already classifies it as a hard failure.
- [ ] Replace stub manifest/replay validators with Spike 3 Change Package parsing and replay evidence before claiming F-10/F-13 Gate evidence.

## Fresh verification

On the available Linux host with Node v22.16.0:

- experiment SQLite/transaction suite: 2 tests PASS;
- Artifact seal/fault suite: 7 tests PASS;
- Artifact reconciliation/Review readiness suite: 8 tests PASS;
- delivery_integrity suite: 6 tests PASS;
- strong-kill child-process crash suite: 6 tests PASS;
- combined Spike 4 focused suites: **29/29 PASS**;
- `node --check src/*.mjs fixtures/*.mjs`: **PASS**.

The strong-kill tests use a real separate Node process and actual `SIGKILL`; they are not thrown-exception simulations. They are preliminary Linux filesystem/SQLite evidence only and do not replace the required target-Windows rerun.

## Verification boundary

Current code makes F-01..F-14/F-17 semantics executable, but the Spike 4 verdict remains **INCONCLUSIVE / NOT EVALUATED** because target-Windows strong-kill evidence, F-15/F-16 integration, and real Change Package manifest/replay validation are still missing. No Technical Gate PASS is claimed.