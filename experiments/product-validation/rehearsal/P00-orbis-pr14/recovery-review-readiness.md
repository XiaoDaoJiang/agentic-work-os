# P00 Founder Rehearsal — Recovery / Review Readiness Matrix

> Classification: **REHEARSAL_ONLY**  
> This is a structural evidence-location rehearsal, not an observed A/B/C user result.

Legend:

- `FACT_AVAILABLE_FROM_VARIANT`: the variant exposes a defined evidence location.
- `DERIVED_NOT_FIRST_CLASS`: answer can only be inferred from available evidence.
- `NOT_VISIBLE_IN_VARIANT`: the research-side fact exists but is intentionally not visible in that variant.
- `NOT_OBSERVED_BEHAVIOR`: historical reconstruction cannot claim what the founder actually opened/remembered.
- `LIVE_REHEARSAL_CHECK`: material sufficiency must be tested in a live founder walkthrough before P01.

## Variant contract

- A: Direct CLI / Git; research archive is invisible.
- B: CLI-first + exact `common-archive-record.yaml` using `pv-archive-v0`.
- C: exact same archive as B + pre-start `minimal-task-card.md` only.

B/C parity: **structurally satisfied by construction** because both point to one committed archive record. C has exactly one extra visible input: the minimal Task card.

## Six return-context questions

| # | Return question | Variant A evidence location | Variant B evidence location | Variant C evidence location | Rehearsal status |
|---|---|---|---|---|---|
| 1 | Objective / DoD? | original CLI prompt / developer memory; historical transcript unavailable | `objective_or_prompt_snapshot_ref` | Task card + same archive objective ref | B/C `FACT_AVAILABLE_FROM_VARIANT`; A historical behavior `NOT_OBSERVED_BEHAVIOR` |
| 2 | Current execution state / where stopped? | terminal/process state at return time | no first-class state field; infer from latest agent output / Verification / Review facts | same derivation as B; Task card does not contain current state | `DERIVED_NOT_FIRST_CLASS` + `LIVE_REHEARSAL_CHECK` |
| 3 | What changed? | `git diff` / working tree | `diff_ref` | same `diff_ref` | B/C `FACT_AVAILABLE_FROM_VARIANT` |
| 4 | VerificationInvocation + result? | terminal history / CI if user chooses to open it | `verification_invocation_ref` + `verification_result_ref` | same archive refs; Task card also freezes intended invocation | B/C `FACT_AVAILABLE_FROM_VARIANT` |
| 5 | Review / Accept / Reject decision? | repository/terminal context outside Direct CLI session | `review_fact_ref` when it exists | same `review_fact_ref` | B/C `FACT_AVAILABLE_FROM_VARIANT`; historical final merge is available |
| 6 | What should happen next? | developer memory / current terminal context | infer from latest Verification + Review; no first-class next-action field | Task DoD can constrain completion intent, but next action still derived | `DERIVED_NOT_FIRST_CLASS` + `LIVE_REHEARSAL_CHECK` |

## Historical PR #14 evidence locator

- Objective / acceptance: PR #14 body and `Plan 30B acceptance`.
- Changes: PR #14 Files / final head `edd84cb83fd88d7cde2257b8a804f9f6164b061e`.
- Verification sequence:
  - `33465703923` RED — weekly-v1 renderer absent;
  - `33465780926` GREEN — renderer/Registry capability works with Weekly still disabled;
  - `33465986406` RED — integration requires published weekly-v1 seed;
  - `33466065425` GREEN — final mixed integration + artifact.
- Artifact: `9784902857`, SHA-256 `cfc6590063a697323ec940ae5052ee96fe4b654383ebe259bd0681b1dcc1886b`.
- Review/final repository decision: merged at `2026-09-01T03:57:12Z`.

## What this rehearsal cannot claim

Historical reconstruction cannot truthfully populate:

- actual `time_to_start_seconds`;
- actual `time_to_recover_seconds`;
- which evidence the founder naturally opened;
- whether external terminal was required at the time;
- whether B would have changed behavior relative to A;
- whether C would have changed behavior relative to B;
- spontaneous later entry selection;
- any qualifying reuse.

All such fields remain `NOT_OBSERVED_BEHAVIOR` until an explicit live rehearsal or external participant run.

## Research-kit risks to test live

1. `pv-archive-v0` has no first-class `current_state / last_phase` field. Confirm whether latest output + Verification/Review refs are sufficient for recovery.
2. `pv-archive-v0` has no first-class `next_action` field. Confirm whether objective/DoD + latest evidence are sufficient without extra facilitator explanation.
3. Historical public evidence cannot fill `cwd` or native Agent output/session identity. Live capture must prove these required fields can be populated without participant burden.
4. A must keep research-side archive invisible; otherwise the A baseline is contaminated.

No contract change is authorized from this document alone. A change requires a reproducible live rehearsal failure and must preserve B/C parity.
