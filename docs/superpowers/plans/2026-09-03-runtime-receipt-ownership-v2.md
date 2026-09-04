# TECH-XP-05 — RuntimeReceipt Ownership / Reconciliation Plan v2

> Status: **COMPLETE / PASS**  
> Date: 2026-09-03  
> Completed: 2026-09-04  
> Issue: #20  
> Replaces implementation branch context from Draft PR #22; preserves its verified RED→GREEN evidence.  
> Architecture basis: `docs/pm/56-local-runtime-host-decision.md`  
> Technical basis: `docs/pm/50-milestone-0-experiment-plan.md`, `docs/pm/55-cross-platform-runtime-decision.md`  
> Final Decision Record: `docs/pm/58-runtime-receipt-ownership-decision.md`

## Goal

Validate the minimum ownership/reconciliation contract required for a trustworthy local Run without introducing a persistent Runtime daemon.

A Run must not be represented only by a PID. The experiment binds Run, runtime instance, reuse-safe process identity, containment boundary, workspace and repository identity. OS/backend containment and active-state truth remain authoritative physical facts; ownership markers are corroborating evidence only.

This plan does not freeze a production RuntimeReceipt schema or Runtime daemon architecture.

## Current prerequisite state

Windows TECH-XP-04 is complete as `OBSERVER_MISMATCH` and integrated into the technical aggregate. TECH-XP-04B prospectively applies Win32 active-state truth while retaining raw ProcessKit liveness evidence and defensive cleanup input.

This removes the previous Windows diagnostic prerequisite from Issue #20 but does not make Spike 1 PASS. Linux/macOS containment profiles remain independent prerequisites.

The original RuntimeReceipt pure contract from PR #22 completed a real RED→GREEN cycle:

- RED: `unresolved import agentic_native_runner::runtime_receipt` in run `33586249042`;
- GREEN: Windows/Linux/macOS quality gates PASS in run `33599190794`;
- unchanged hostile matrix completed successfully in run `33599190821`.

The v2 branch started from the current technical aggregate and ported those verified RuntimeReceipt files before completing the remaining OWN increments.

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

The pure contract proves:

- required receipt bindings are non-empty;
- root PID is positive;
- exact ownership markers derive from the immutable receipt;
- same PID + different reuse-safe process identity => `REUSED_PID`;
- missing markers => `MARKER_MISSING`;
- conflicting markers => `MARKER_CONFLICT`;
- marker match + unavailable process identity => `INCONCLUSIVE`;
- only matching process identity + matching markers + affirmative boundary membership may classify as `OWNED`.

## Completed increment A — OWN-03 root exits before descendants

A platform-neutral reconciliation reducer plus real hostile characterization proves:

```text
root_exited = true
known_descendants_unresolved_or_active = true
=> safe_terminal = false
=> reconciliation_required
```

Root exit, empty root-PID observation, or marker match alone cannot establish safety.

Evidence head `f06bdf3fd3e78fe579a72612d1f31caddd43e06d`:

- foundation `33732797342`: Windows / Ubuntu / macOS PASS;
- hostile `33732797313`: Windows / Ubuntu / macOS PASS.

## Completed increment B — OWN-04 duplicate Cancel

For the same immutable receipt and ProcessKit boundary:

- first Cancel maps to one real teardown;
- duplicate Cancel is idempotent;
- no second receipt/boundary is created;
- no second business terminal transition is manufactured;
- receipt fingerprint and boundary identity remain stable.

Evidence head `6afc47ba494899a4626fe5a37da699c8df13bf98`:

- foundation `33733121137`: 3/3 PASS;
- hostile `33733121142`: 3/3 PASS.

## Completed increment C — OWN-05 owner/helper crash + startup reconciliation

Crash/recovery is modeled without a persistent daemon, matching the frozen scope.

For a persisted nonterminal receipt after helper memory loss/restart:

```text
receipt exists
+ process/boundary truth active or unavailable
=> reconciliation_required
=> same-resource scheduling blocked
```

The implementation reloads immutable receipt bytes/hash from disk, revalidates integrity and identity, then applies fresh startup facts. Active/unknown facts hold the resource lock. PID or marker evidence alone never causes auto-adoption or kill-by-PID.

## Completed increment D — OWN-06 stale receipt / process gone

A valid persisted nonterminal receipt whose original process identity is proven gone does not become releasable until all required resource facts are safe:

```text
original gone
+ boundary empty
+ stdout drained
+ stderr drained
=> interrupted/reconciled
=> resource releasable
```

Boundary-not-empty, undrained, unknown, or reused-PID facts remain fail-closed. A reused PID is never adopted or killed as the old Run.

## Completed increment E — OWN-09 cleanup cannot rewrite failure

A survivor, late-write, incomplete-drain or other already-recorded physical failure remains historical failure after successful cleanup/re-observation.

Cleanup outcome is a separate fact.

Evidence head `d60749283f24c76d3b1b31f7528472135d7fd00d`:

- foundation `33731125250`: 3/3 PASS;
- hostile `33731125205`: 3/3 PASS.

## Completed marker characterization — OWN-02

The hostile fixture proves the receipt-derived marker trio survives ordinary OS environment inheritance root → child → grandchild:

```text
AGENTIC_RUNTIME_ID
AGENTIC_RUN_ID
AGENTIC_SPAWN_NONCE
```

Markers remain corroborating evidence only.

Evidence head `7aeaffaf64425e159de67444b232fa5e298c2b79`:

- foundation `33731874750`: 3/3 PASS;
- hostile `33731874802`: 3/3 PASS.

## Receipt publication / immutability

Publication/persistence semantics are frozen for this experiment:

- one receipt per Run/spawn_nonce;
- byte-identical duplicate publication/persistence is idempotent;
- conflicting duplicate bytes fail closed;
- raw receipt bytes + SHA-256 are evidence-indexable;
- persisted bytes are synced before success is returned;
- reload re-verifies hash, schema and metadata against frozen bytes;
- tampered persisted bytes fail closed;
- Cancel/reconcile cannot rewrite root, workspace, repository or boundary identity.

This is experiment evidence, not a production database/storage selection.

## Verification matrix

Every GREEN increment ran the current quality gates on:

```text
windows-2025
ubuntu-24.04
macos-15
```

Process-touching increments also ran the frozen hostile matrix.

Final evidence-producing code head:

`f8765ca54d88b93f314a3481831496b66226e046`

Final runs:

- `M0 cross-platform runtime` `33734111011`: success;
- `M0 ProcessKit hostile containment` `33734110963`: success.

The cross-platform run completed Node contracts, Rust tests, rustfmt, Clippy, native build and doctor on all three platforms. The hostile run completed Rust tests, hostile-probe build and the frozen hostile matrix on all three platforms.

## Exit decision

Allowed Issue #20 conclusion:

```text
PASS
FAIL
INCONCLUSIVE
```

**Final: PASS.**

Fresh final-head regression covers OWN-01..OWN-09 with no unresolved ownership/reconciliation disagreement inside the frozen Issue #20 scope. The detailed evidence/classification boundary is recorded in `docs/pm/58-runtime-receipt-ownership-decision.md`.

Issue #20 PASS does **not** make Spike 1 or Technical Gate PASS.

## Explicit non-goals

- persistent Runtime daemon;
- PTY multiplexer / detach / reattach;
- Session Resume;
- real Codex;
- multi-agent runtime;
- Remote Runner;
- Sandbox;
- production database/API schema freeze.
