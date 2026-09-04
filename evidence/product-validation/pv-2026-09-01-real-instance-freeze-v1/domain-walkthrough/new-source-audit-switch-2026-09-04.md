# Product Validation — Newly Discovered Historical Source Audit: `XiaoDaoJiang/switch`

- Audit date: 2026-09-04
- Evidence snapshot: `pv-2026-09-01-real-instance-freeze-v1`
- Source status: **NEW_RAW_SOURCE_AFTER_2026-09-03_SEARCH_CUTOFF**
- Product trajectory counter effect: **none**

## Why this audit is allowed after the historical-search cutoff

The 2026-09-03 trajectory-gap audit treats broad re-mining of the then-available sources as saturated, but explicitly allows a newly discovered raw historical source with a complete fact chain to be evaluated.

`XiaoDaoJiang/switch` was not part of that source set. It contains multiple real engineering PRs explicitly marked as Codex work, so it is a legitimate new source rather than a reinterpretation of an already-excluded near-match.

## Coding Agent attribution visible at the repository boundary

Relevant merged PRs include:

- PR #4 — `[codex] add dynamic params and config TUI workflows`
- PR #6 — `[codex] add split CLI/TUI demo assets for cx`
- PR #7 — `[codex] add cx CLI/TUI demo assets to README`
- PR #8 — `[codex] integrate cx run selector and dynamic settings line`
- PR #9 — `feat(selector): complete cx run simple TUI with code review fixes`

These records strengthen founder-side evidence that real Coding Agent work existed before the current Product Validation study. Founder evidence still contributes zero external-participant/reuse counters.

## Adverse-trajectory checks

### TR-03 — Review Reject → immutable prior attempt → new attempt

PR #9 says it contains “code review fixes”, and release history contains commit subjects such as `address code review feedback` / `address code review findings`.

That wording is **not sufficient** to establish protocol TR-03.

Fresh GitHub review checks found:

- PR #8 submitted reviews: none;
- PR #8 PR discussion/comments: none;
- PR #9 submitted reviews: none;
- PR #9 PR discussion/comments: none.

No raw GitHub `CHANGES_REQUESTED`, explicit human Reject decision, or equivalent immutable ReviewDecision was found for this sequence. Therefore the later fixes cannot be promoted to TR-03.

### Closed/unmerged attempt search

A repository-wide search for user-owned Codex work did not surface an unmerged `switch` Codex PR. The obvious Codex PR sequence above is merged.

This source therefore does not currently establish:

- TR-02 failed gate Verification → sealed failed package → Review;
- TR-03 explicit Review Reject → new Run/attempt;
- TR-04 active Agent Cancel + safe containment;
- TR-05 process fact loss + reconciliation_required;
- TR-06 local Prepare failure before Workspace;
- TR-07 no-Task exploratory coding with a recoverable no-Task start fact;
- TR-08 one objective with true cross-repository/out-of-boundary change ownership;
- a second TR-09 distinct delivery-integrity case.

## Modeling observations that remain useful but non-counting

The PR chain demonstrates that one Coding-Agent-assisted product goal can span stacked and follow-up branches/PRs while remaining understandable as multiple delivery slices. It also reinforces the rule that PR/commit cardinality alone cannot be converted into Work OS Run cardinality.

“Code review fixes” in commit/PR prose must not be interpreted as `ReviewDecision=Reject` without the raw decision fact.

## Strict conclusion

```text
new historical source discovered
→ Coding Agent attribution supported
→ adverse paths inspected
→ no complete new TR fact chain
→ Product trajectory count unchanged
```

Current strict state remains:

- actual trajectories: **1 / 6**;
- counted ID: `TR-09` only;
- external participants/problems/reuse: **0 / 3**, **0 / 5**, **0 / 2**;
- Task Aggregation Final: `NOT_RECORDED`;
- Product Validation Gate Final: `NOT_RECORDED`;
- Product MVP WWA: `BLOCKED`.
