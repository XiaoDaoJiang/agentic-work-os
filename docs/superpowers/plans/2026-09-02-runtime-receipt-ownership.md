# TECH-XP-05 — RuntimeReceipt Ownership / Reconciliation Plan

> Status: RED_PENDING_EXECUTION  
> Date: 2026-09-02  
> Issue: #20  
> PR: #22  
> Architecture basis: `docs/pm/56-local-runtime-host-decision.md`  
> Technical basis: `docs/pm/50-milestone-0-experiment-plan.md`, `docs/pm/55-cross-platform-runtime-decision.md`

## Goal

Validate the minimum ownership/reconciliation contract required for a trustworthy local Run without introducing a persistent Runtime daemon.

The experiment must prove that a Run is not represented only by a PID. The candidate ownership record binds Run, runtime instance, process identity, containment boundary, workspace and repository identity, while OS/backend membership and liveness remain the physical truth sources.

This plan does **not** freeze a production schema or Runtime daemon architecture.

## Current prerequisite state

TECH-XP-04 (#14) is explicitly `INCONCLUSIVE`: its Windows diagnostic implementation exists on Draft PR #18, but fresh hostile-matrix evidence cannot currently be produced because GitHub Actions jobs fail before any step starts and expose no job logs.

That satisfies Issue #20's prerequisite for proceeding, but it does not resolve the historical Windows 94 FAIL results and does not make Windows managed.

The same no-step Actions failure currently affects PR #22. Therefore the first TDD RED is committed but **not yet observed**. No production implementation may be added until the expected RED executes.

## RuntimeReceipt v0 candidate

```text
runtime_instance_id
run_id
spawn_nonce
root_pid
process_identity              # opaque, reuse-safe token
containment.mechanism
containment.boundary_id       # opaque provider identity
workspace.workspace_id
workspace.repository_identity
workspace.canonical_path      # experiment evidence only
started_at
helper_revision
```

Ownership markers passed to child processes:

```text
AGENTIC_RUNTIME_ID
AGENTIC_RUN_ID
AGENTIC_SPAWN_NONCE
```

Markers are corroborating evidence only. A marker match never overrides process identity, containment membership, OS active-state truth or observer errors.

## Task 1 — Pure receipt / ownership contract

### RED

Committed test:

```text
experiments/milestone-0/native-runner/tests/runtime_receipt.rs
```

Required first observed failure:

```text
unresolved import agentic_native_runner::runtime_receipt
```

If the first executable failure is formatting, infrastructure, dependency or another unrelated error, repair that blocker and rerun until the missing contract is the failure reason.

### GREEN

Only after the expected RED is observed, add:

```text
experiments/milestone-0/native-runner/src/runtime_receipt.rs
```

and export it from `src/lib.rs`.

Minimum behavior:

- validate required non-empty receipt bindings;
- derive exact ownership markers;
- classify same PID + different process identity as `REUSED_PID`;
- classify missing markers as `MARKER_MISSING`;
- classify conflicting markers as `MARKER_CONFLICT`;
- marker match + unavailable process identity remains `INCONCLUSIVE`;
- only matching process identity + matching markers + affirmative boundary membership may classify as `OWNED` in this pure contract.

This task covers deterministic portions of OWN-01 / OWN-07 / OWN-08 only.

## Task 2 — Receipt publication / immutability

Freeze receipt bytes before the first mutable Run action can be reported as started.

Tests must prove:

- exactly one receipt per Run / spawn_nonce;
- duplicate publication is idempotent only for byte-identical receipt content;
- conflicting receipt data fails closed;
- raw bytes + SHA-256 are evidence-indexable;
- Cancel never rewrites root identity, workspace identity or boundary identity.

This contributes to OWN-01 / OWN-04.

## Task 3 — Hostile tree ownership markers

Extend the existing hostile fixture instead of creating a new process framework.

For parent, child and grandchild, record:

```text
pid
process identity token
AGENTIC_RUNTIME_ID
AGENTIC_RUN_ID
AGENTIC_SPAWN_NONCE
backend membership observation
```

Requirements:

- marker continuity is visible for the owned fixture tree;
- missing/conflicting marker is a reconciliation hard-stop or `INCONCLUSIVE` according to the frozen observer contract;
- marker observations never substitute for ProcessKit/OS membership.

This covers OWN-02 / OWN-08.

## Task 4 — Root exits before descendants

Reuse `root-exit-detached` / hostile descendants.

Prove:

```text
root exit != resource safe
```

A Run with receipt + known descendants cannot become `cancelled_safe` or equivalent while descendant membership/liveness/drain facts remain unresolved.

This covers OWN-03.

## Task 5 — Duplicate Cancel

Drive the same Run/receipt through two Cancel requests.

Prove:

- same immutable receipt;
- one containment boundary;
- no second business terminal transition;
- repeated teardown request is idempotent;
- if the first teardown is unresolved, the second cannot manufacture safety.

This covers OWN-04.

## Task 6 — Owner/helper crash + startup reconciliation

Crash the helper after receipt publication at pre-registered points.

On startup/recovery, scan nonterminal receipts and require:

```text
receipt exists
+ process/boundary truth unknown or active
=> reconciliation_required
=> same-resource scheduling lock
```

Do not auto-adopt from PID or marker alone.

This covers OWN-05.

## Task 7 — Stale receipt / process gone

Provide a valid nonterminal receipt whose process identity is no longer observable as active.

Expected result:

```text
interrupted / reconciled
```

while preserving the immutable receipt and original evidence.

This covers OWN-06.

## Task 8 — PID reuse

Use a pre-registered synthetic or platform integration case where the numeric PID is the same but the reuse-safe process identity differs.

Expected:

```text
REUSED_PID
```

Never adopt or terminate the new process as the old Run solely because its numeric PID matches.

This covers OWN-07.

## Task 9 — Failure preservation after cleanup

Feed a previously observed survivor or late-write failure into cleanup/re-observation.

Even if cleanup later succeeds:

```text
historical physical failure remains failure
```

Cleanup success is a separate fact and cannot rewrite the earlier verdict.

This covers OWN-09.

## Verification matrix

At each GREEN increment, run the existing platform-neutral and hostile workflows on:

```text
windows-2025
ubuntu-24.04
macos-15
```

Do not infer platform PASS from compilation alone. Actual mechanism/capability must remain visible.

## Evidence

Store or upload at minimum:

```text
receipt raw bytes
receipt sha256
runtime_instance_id / run_id / spawn_nonce
actual mechanism
boundary id (opaque)
process identity observations
marker observations
membership / liveness observations
reconciliation transition
cleanup result
```

No credentials or inherited full environment snapshots.

## Exit decision

Allowed TECH-XP-05 conclusion:

```text
PASS
FAIL
INCONCLUSIVE
```

`PASS` requires all OWN-01..OWN-09 relevant matrix cases to have fresh evidence with no unresolved disagreement. `PASS` for this issue alone cannot make Spike 1 or the Technical Gate PASS.

## Explicit non-goals

- persistent Runtime daemon;
- PTY multiplexer / detach / reattach;
- Session Resume;
- real Codex;
- multi-agent runtime;
- Remote Runner;
- Sandbox;
- production RuntimeReceipt database/API schema.
