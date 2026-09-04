# TECH-XP-05 — RuntimeReceipt Ownership / Reconciliation Decision

> Status: **Final**  
> Date: 2026-09-04  
> Issue: #20  
> Implementation PR: #36  
> Decision: **PASS — contract validated within frozen experiment scope**  
> Evidence-producing code head: `f8765ca54d88b93f314a3481831496b66226e046`

## 1. Decision boundary

This decision evaluates only the experiment-scoped `RuntimeReceipt` ownership/reconciliation contract accepted in `docs/pm/56-local-runtime-host-decision.md` and implemented under Issue #20.

It does **not** declare:

- Spike 1 PASS;
- Technical Gate PASS;
- any platform profile `managed`;
- real Codex execution validated;
- a production Runtime daemon architecture;
- Session Resume, Remote Runner, Sandbox or multi-agent runtime;
- a production database/API schema freeze.

## 2. Frozen question

Can a local Run be represented by an immutable receipt that binds Run/runtime/process/boundary/workspace/repository identity, survives helper memory loss, fails closed on ambiguous ownership, and reconciles stale/nonterminal execution facts without rewriting earlier evidence?

Allowed conclusion from Issue #20: `PASS | FAIL | INCONCLUSIVE`.

## 3. Result

**PASS.**

The current experiment provides fresh Windows / Ubuntu / macOS evidence for OWN-01..OWN-09 with no unresolved ownership/reconciliation disagreement inside the frozen Issue #20 scope.

The evidence intentionally mixes two layers:

1. **physical characterization** where OS/process behavior is part of the claim;
2. **persisted restart/reducer characterization** where the frozen design explicitly models helper crash/restart without introducing a persistent Runtime daemon.

These layers are not conflated.

## 4. OWN matrix

| Row | Result | Evidence class | What is established |
|---|---|---|---|
| OWN-01 | PASS | pure contract + fresh final regression | Required RuntimeReceipt bindings are validated; receipt identity is immutable and evidence-indexable. |
| OWN-02 | PASS | physical hostile fixture | `AGENTIC_RUNTIME_ID`, `AGENTIC_RUN_ID`, `AGENTIC_SPAWN_NONCE` survive root → child → grandchild inheritance; markers remain corroborating only. |
| OWN-03 | PASS | physical hostile fixture + reducer | Natural root exit while descendants remain observed yields `ReconciliationRequired`; root exit alone cannot make a Run safe. |
| OWN-04 | PASS | real ProcessKit boundary | Duplicate Cancel maps to exactly one real `ProcessGroup.kill_all()`; second request is idempotent and does not create a second receipt/boundary/terminal transition. |
| OWN-05 | PASS | persisted restart + startup reducer | A published nonterminal receipt survives helper memory loss/reload; active/unknown process or boundary truth keeps resource lock held and requires reconciliation; no auto-adopt/kill-by-PID. |
| OWN-06 | PASS | persisted restart + startup reducer | Gone original process is not sufficient alone; only gone + empty boundary + drained streams yields `InterruptedReconciled` / releasable resource. Reused PID is never adopted or killed as the old Run. |
| OWN-07 | PASS | pure identity contract + fresh final regression | Same PID with different reuse-safe process identity is classified as reused, not old ownership. |
| OWN-08 | PASS | pure ownership contract + fresh final regression | Missing/conflicting markers and unavailable physical identity fail closed; marker match alone never proves ownership. |
| OWN-09 | PASS | failure ledger + hostile regression | Survivor/late-write/incomplete-drain/teardown failures remain append-only historical facts; later cleanup/safe observation cannot erase them or manufacture a terminal transition. |

## 5. Receipt persistence / integrity

`runtime_receipt_store` freezes these experiment properties:

- persisted envelope stores raw published receipt bytes plus SHA-256;
- path creation is create-new; byte-identical duplicate persistence is idempotent;
- conflicting duplicate bytes fail closed;
- reload re-verifies SHA-256 against raw bytes;
- raw receipt is parsed and revalidated after reload;
- persisted run/spawn metadata must match the frozen raw receipt;
- tampered persisted bytes fail closed as integrity mismatch;
- file contents are synced before persistence returns success.

This is enough for the Issue #20 experiment question. It is not a production crash-consistent storage/database selection.

## 6. Physical evidence

### OWN-02 / marker continuity

Evidence head `7aeaffaf64425e159de67444b232fa5e298c2b79`:

- foundation `33731874750`: Windows / Ubuntu / macOS PASS;
- hostile `33731874802`: Windows / Ubuntu / macOS PASS with frozen hostile matrix and evidence upload.

Artifacts:

- Windows `9884352734`, `sha256:1cd7a51062d68285d5ec8cae9fa10b70cd7849f0acfc704906b4218b3a5999d6`;
- macOS `9884329170`, `sha256:375b8d69d3c399b452e29f75b608646617c0d97375959386ee2ec8aed2366278`;
- Ubuntu `9884314976`, `sha256:a524730f3f337b803af8d268898cae7871e15f963945d5538287de434f3348e2`.

### OWN-03 / root exits first

Evidence head `f06bdf3fd3e78fe579a72612d1f31caddd43e06d`:

- foundation `33732797342`: 3/3 PASS;
- hostile `33732797313`: 3/3 PASS.

The real `root-exit-detached` characterization observes root gone while descendant/boundary facts remain, and reduces the Run to `ReconciliationRequired` rather than safe.

### OWN-04 / duplicate Cancel

Evidence head `6afc47ba494899a4626fe5a37da699c8df13bf98`:

- foundation `33733121137`: 3/3 PASS;
- hostile `33733121142`: 3/3 PASS.

A real ProcessKit group receives one effective teardown for two Cancel requests.

### OWN-09 / historical failure preservation

Evidence head `d60749283f24c76d3b1b31f7528472135d7fd00d`:

- foundation `33731125250`: 3/3 PASS;
- hostile `33731125205`: 3/3 PASS.

FailureLedger preserves observed physical failures independently from later cleanup/safe observations.

## 7. Persisted restart evidence

OWN-05/06 intentionally model helper crash/restart without a persistent daemon, matching the frozen v2 plan.

`runtime_receipt_restart.rs` proves on a disposable filesystem boundary:

```text
publish immutable receipt
→ persist bytes/hash
→ lose in-memory state
→ reload receipt from storage
→ revalidate integrity/identity
→ apply fresh startup process/boundary/drain facts
→ hold or release same-resource scheduling fail-closed
```

OWN-05:

```text
reloaded nonterminal receipt
+ active original / unresolved boundary truth
→ ReconciliationRequired
→ ResourceLock::Held
→ no auto-adopt
→ no kill-observed-pid
```

OWN-06:

```text
reloaded stale receipt
+ original gone
+ boundary empty
+ stdout/stderr drained
→ InterruptedReconciled
→ ResourceLock::Releasable
```

If boundary or drain facts remain unsafe/unknown, reconciliation remains required. Tampered receipt persistence fails closed.

This decision does not claim that a real long-lived Runtime daemon crash was exercised; such a daemon is explicitly outside the frozen scope.

## 8. Final same-head regression

Final evidence-producing code head:

`f8765ca54d88b93f314a3481831496b66226e046`

- `M0 cross-platform runtime` run `33734111011`: **success**;
- `M0 ProcessKit hostile containment` run `33734110963`: **success**.

On Windows / Ubuntu / macOS the final cross-platform run completed:

- Node contract tests;
- Rust tests, including RuntimeReceipt persistence/restart/reconciliation contracts;
- rustfmt;
- Clippy;
- native runner build;
- doctor.

The hostile workflow also completed its Rust tests, hostile probe build and frozen race matrix on all three platforms.

## 9. Remaining Technical Gate work

Issue #20 PASS closes only the ownership/reconciliation question. The Technical Gate remains blocked by independent prerequisites, including at minimum:

- unresolved Linux strong-profile containment work;
- macOS containment-profile decision after Process Group escape evidence;
- remaining integrated Spike 1 race/scheduling evidence where not already closed elsewhere;
- real Codex Adapter / Spike 2;
- indexed Change Package / durability evidence and independent Spike decisions required by the Milestone 0 plan.

Product Validation remains completely independent.

## 10. Consequence

The minimum experiment-scoped Local Runtime ownership model may retain:

```text
RuntimeReceipt
+ reuse-safe process identity
+ explicit physical boundary identity
+ persisted immutable receipt bytes/hash
+ fail-closed startup reconciliation
+ independent resource lock/safety facts
+ append-only historical failure facts
```

No production schema/API or persistent Runtime service is authorized by this decision.
