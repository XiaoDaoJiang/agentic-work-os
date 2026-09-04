# Execution Interpretation 01 — Development Checkpoints vs Run Gate Verification

> Status: **ACTIVE CLARIFICATION — NO PROTOCOL THRESHOLD CHANGE**  
> Date: 2026-09-03  
> Applies to: future Product Validation observation/encoding under the existing frozen protocol  
> Does not modify: participant criteria, A/B/C order, reuse rules, trajectory definitions, Gate thresholds, or existing evidence

## Why this clarification exists

The frozen materials already require:

- one `VerificationInvocation` per Run;
- `passed | failed | error` from that invocation may proceed through the seal barrier into Review when resource/evidence conditions are satisfied;
- GitHub/CI checkpoints must not be silently equated one-for-one with Work OS Runs.

Prospective real-work capture PF01 (`TECH-XP-05 / PR #36`) shows why the boundary must be explicit during observation: the ongoing engineering task contains a normal TDD RED checkpoint on an intentionally missing `runtime_failure_ledger` implementation. Treating every test/CI checkpoint as the Run's one gate verification would create false Run/Review boundaries.

## Interpretation

For Product Validation encoding:

### 1. Coordinator gate verification

`VerificationInvocation` means the **single coordinator-owned verification invocation for one candidate Run/attempt after the Agent has yielded control to the fixed `test` phase**.

Only this invocation owns the Run-level `verification_result` used by the seal/review transition.

### 2. Development checkpoint

Any test/check performed while implementation is still being developed is a **development checkpoint**, including:

- tests executed by the Coding Agent inside its working session;
- TDD RED/GREEN checks intentionally used to guide implementation;
- intermediate CI runs while commits are still being added to the same engineering attempt;
- lint/build/test diagnostics opened as evidence during the Agent/development activity.

A development checkpoint may be stored or referenced as Event/log/Artifact evidence, but it is **not automatically**:

- a new Work OS Run;
- the Run's unique `VerificationInvocation`;
- a sealed Change Package;
- a Review Gate;
- a ReviewDecision.

### 3. Do not infer Run cardinality from CI cardinality

```text
3 CI runs
!= 3 Work OS Runs

4 TDD RED/GREEN checkpoints
!= 4 Review gates
```

Run boundaries must come from the actual execution attempt/session/control boundary, not from the number of verification-like records visible in SCM/CI.

### 4. A failed gate verification remains reviewable

This clarification does **not** weaken the existing failed-verification rule.

If the actual coordinator-owned gate `VerificationInvocation` returns `failed` or `error`, and the Run reaches the protocol's evidence-safe seal/resource conditions, it remains eligible to enter Review exactly as the frozen protocol specifies.

The distinction is therefore:

```text
development checkpoint failed
→ continue the same development attempt when appropriate

coordinator gate VerificationInvocation failed/error
→ seal barrier
→ Review Accept/Reject when safe
```

## PF01 application

PF01 currently records:

- base `76f7d0e...` = GREEN;
- head `930a71f...` = both PR workflows fail on all three platforms;
- exact failure = expected missing `runtime_failure_ledger` implementation for a new OWN-09 test;
- implementation is still in an explicit RED-first increment;
- no ReviewDecision exists.

Therefore PF01's current failed CI state is encoded as a **development checkpoint / VerificationEvent**, not the unique Run-level gate `VerificationInvocation`.

PF01 remains `NOT_YET_A_TRAJECTORY` and Product trajectory coverage remains `TR-09 = 1/6`.

## Measurement consequence for P01..P03

Observers must ask one extra factual question before scoring a verification-like record:

> Was this the frozen coordinator verification after the Agent yielded for this attempt, or an intermediate development checkpoint while implementation was still continuing?

If unknown, encode `unknown`; do not infer from GitHub Actions, command name, exit code, or CI status alone.

## Schema consequence

None is authorized by this interpretation.

Do **not** add a production `verification_kind` field or change `pv-archive-v0` solely from this note. The existing archive's single `verification_invocation_ref` / `verification_result_ref` continue to refer to the Run-level gate verification. Intermediate checkpoints remain supporting evidence unless later Product evidence justifies a schema change.
