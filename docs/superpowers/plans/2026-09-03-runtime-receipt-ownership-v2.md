# TECH-XP-05 — RuntimeReceipt Ownership / Reconciliation Plan v2

> Status: IN_PROGRESS  
> Date: 2026-09-03  
> Issue: #20  
> Replaces implementation branch context from Draft PR #22; preserves its verified RED→GREEN evidence.  
> Architecture basis: `docs/pm/56-local-runtime-host-decision.md`  
> Technical basis: `docs/pm/50-milestone-0-experiment-plan.md`, `docs/pm/55-cross-platform-runtime-decision.md`

## Goal

Validate the minimum ownership/reconciliation contract required for a trustworthy local Run without introducing a persistent Runtime daemon.

A Run must not be represented only by a PID. The experiment binds Run, runtime instance, reuse-safe process identity, containment boundary, workspace and repository identity. OS/backend containment and active-state truth remain authoritative physical facts; ownership markers are corroborating evidence only.

This plan does not freeze a production RuntimeReceipt schema or Runtime daemon architecture.

## Current prerequisite state

Windows TECH-XP-04 is complete as `OBSERVER_MISMATCH` and integrated into the technical aggregate. TECH-XP-04B prospectively applies Win32 active-state truth while retaining raw ProcessKit liveness evidence and defensive cleanup input.

This removes the previous Windows diagnostic prerequisite from Issue #20 but does not make Spike 1 PASS. Linux/macOS containment profiles remain independent prerequisites.

The original RuntimeReceipt pure contract from PR #22 already completed a real RED→GREEN cycle:

- RED: `unresolved import agentic_native_runner::runtime_receipt` in run `33586249042`;
- GREEN: Windows/Linux/macOS quality gates PASS in run `33599190794`;
- unchanged hostile matrix completed successfully in run `33599190821`.

The v2 branch starts from the current technical aggregate and ports only those verified RuntimeReceipt files before continuing new OWN increments.

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

Ownership markers:

```text
AGENTIC_RUNTIME_ID
AGENTIC_RUN_ID
AGENTIC_SPAWN_NONCE
```

Markers never override process identity, containment membership, OS active-state truth or observer errors.

## Completed increment — OWN-01 / OWN-07 / OWN-08 pure contract

The pure contract must continue to prove:

- required receipt bindings are non-empty;
- root PID is positive;
- exact ownership markers derive from the immutable receipt;
- same PID + different reuse-safe process identity => `REUSED_PID`;
- missing markers => `MARKER_MISSING`;
- conflicting markers => `MARKER_CONFLICT`;
- marker match + unavailable process identity => `INCONCLUSIVE`;
- only matching process identity + matching markers + affirmative boundary membership may classify as `OWNED`.

## Next increment A — OWN-03 root exits before descendants

RED first. Reuse the existing hostile descendant model; do not introduce a second process framework.

Freeze a platform-neutral reconciliation reducer with facts sufficient to prove:

```text
root_exited = true
known_descendants_unresolved_or_active = true
=> safe_terminal = false
=> reconciliation_required
```

The reducer must not infer safety from root exit, empty root PID observation, or marker match alone.

After the pure reducer is GREEN, integrate it with hostile evidence where appropriate. Windows must use the prospective active-state observer already integrated; Linux/macOS keep their explicit platform capability semantics.

## Next increment B — OWN-04 duplicate Cancel

RED first. For the same immutable receipt and containment boundary:

- first cancel may transition teardown state;
- duplicate cancel cannot create a second receipt or boundary;
- duplicate cancel cannot create a second business terminal transition;
- unresolved first teardown remains unresolved after duplicate cancel;
- a later safe observation may converge the same Run once, without rewriting earlier evidence.

## Next increment C — OWN-05 owner/helper crash + startup reconciliation

Crash/recovery is modeled without a persistent daemon.

For a nonterminal receipt after helper restart:

```text
receipt exists
+ process/boundary truth active or unavailable
=> reconciliation_required
=> same-resource scheduling blocked
```

Do not auto-adopt from PID or ownership markers alone.

## Next increment D — OWN-06 stale receipt / process gone

A valid nonterminal receipt whose original process identity is independently proven gone must reconcile to an interrupted/reconciled state while preserving receipt identity and prior evidence.

A reused PID is not the old Run and must remain `REUSED_PID`, never auto-adopted or killed as the old Run.

## Next increment E — OWN-09 cleanup cannot rewrite failure

A survivor, late-write, incomplete-drain or other already-recorded physical failure remains historical failure after successful cleanup/re-observation.

Cleanup outcome is a separate fact.

## Receipt publication / immutability

Before owner-crash integration, freeze publication semantics:

- one receipt per Run/spawn_nonce;
- byte-identical duplicate publication is idempotent;
- conflicting duplicate publication fails closed;
- receipt bytes and SHA-256 are evidence-indexable;
- Cancel/reconcile cannot rewrite root identity, workspace identity, repository identity or boundary identity.

## Hostile marker evidence

When extending the hostile fixture, capture only non-secret markers and reuse-safe process identity observations for parent/child/grandchild. Marker continuity is evidence, not containment authority.

Do not record inherited full environment snapshots or credentials.

## Verification matrix

At every GREEN increment run current quality gates on:

```text
windows-2025
ubuntu-24.04
macos-15
```

When an increment touches hostile process behavior, also run the frozen hostile matrix and preserve actual mechanism/capability evidence.

## Exit decision

Allowed Issue #20 conclusion:

```text
PASS
FAIL
INCONCLUSIVE
```

PASS requires fresh evidence for OWN-01..OWN-09 with no unresolved ownership/reconciliation disagreement. Issue #20 PASS cannot by itself make Spike 1 or Technical Gate PASS.

## Explicit non-goals

- persistent Runtime daemon;
- PTY multiplexer / detach / reattach;
- Session Resume;
- real Codex;
- multi-agent runtime;
- Remote Runner;
- Sandbox;
- production database/API schema freeze.
