# Product Validation Gate Decision Record — Draft Execution Checkpoint

- Decision ID: `PV-GATE-2026-09-01-DRAFT-03`
- Original date: 2026-09-01
- Last evidence update: 2026-09-03
- Owner: Product decision owner
- Record status: **Draft**
- Protocol version: `docs/pm/40-validation-protocol.md` blob `ee83598caba483b36248fd85c18ba8c7516cb3d1`
- Evidence snapshot: `pv-2026-09-01-real-instance-freeze-v1`
- Final decision: **NOT_RECORDED**
- Current execution disposition: **CONTINUE_VALIDATION** (non-final)

## Evidence state

### Nine Real Instances / Task Aggregation

- Frozen first-nine: **9 / 9**
- Neutral mappings: **9 / 9**
- First-pass fit classifications: **9 / 9**
- Frozen first-nine `natural_fit`: **9 / 9**
- Supplemental adverse instances: **1**
- Total `natural_fit`: **10**
- `strained_fit`: **0**
- `model_break`: **0**
- giant Task / special FK / ambiguous ownership / exception lifecycle cases in first nine: **0 / 0 / 0 / 0**
- Distinct `actual_end_to_end` trajectory IDs: **1 / required 6**
- Counted trajectory IDs: **TR-09**
- Task Aggregation record: **Draft — CONTINUE_VALIDATION**

The first-nine evidence is positive for the known objective/evidence/artifact/final-decision aggregation shape. It is insufficient to freeze the complete production Task model because native Agent Run/Session boundaries, local Workspace lifecycle and five additional distinct adverse trajectories are still not established.

GitHub Actions checkpoints are treated as Verification events, not silently promoted to Work OS Runs.

### First counted adverse trajectory — TR-09

Supplemental record:

`domain-walkthrough/S01-ORBIS-PLAN40B-DELIVERY-INTEGRITY.yaml`

Observed real-work chain:

1. Orbis PR #16 carried the final validated Plan 40B head, passed final build/artifact/Trusted Preview, and was merged while still targeting the stacked Plan 40A branch.
2. GitHub's historical merge fact remained valid, but the intended target `main` did not receive the Plan 40B commits.
3. PR #18 carried the exact validated head directly against `main` and passed a fresh build/artifact/Preview, but remained Draft because the connector could not perform the Ready-for-review transition against the then-current GitHub schema.
4. PR #19 superseded #18 as a non-Draft main-targeted attempt, carried the same validated head, and merged successfully.

This satisfies `TR-09 actual_end_to_end` at the SCM/delivery-integrity layer:

```text
validated package
→ repository acceptance recorded
→ intended delivery later found missing
→ historical acceptance remains immutable
→ delivery_integrity = failed
→ new delivery attempt(s)
→ delivery_integrity = restored
```

Modeling consequence: historical acceptance/review facts and delivery integrity must be represented separately. A later delivery failure must not mutate a historical accepted decision.

S01 is `natural_fit`; no giant Task, special FK, ambiguous ownership or exception lifecycle is required.

### Founder Validation

- Status: `STRONG_SIGNAL_SUPPORTING_ONLY`
- External participant contribution: 0
- Qualifying reuse contribution: 0

Founder evidence supports continuing the study but cannot independently decide Project-native, Task-first or external control-plane demand.

Founder rehearsal material under `experiments/product-validation/rehearsal/P00-orbis-pr14/` is procedure/answer-key material only. It is not external behavior and contributes zero Product Gate counters.

### External Participants

- Qualified participants: **0 / 3**
- External real problems completed: **0 / 5**
- Independent qualifying reuse users: **0 / 2 minimum support threshold**
- Status: `NOT_STARTED / BLOCKING`

This remains a hard blocker for any final Product Validation Gate PASS.

## Remaining Task Aggregation coverage gap

Current strict status:

- TR-01: `NOT_COVERED`
- TR-02: `NOT_COVERED`
- TR-03: `NOT_COVERED`
- TR-04: `NOT_COVERED`
- TR-05: `NOT_COVERED`
- TR-06: `NOT_COVERED`
- TR-07: `NOT_COVERED`
- TR-08: `NOT_COVERED`
- TR-09: `ACTUAL_END_TO_END`

Historical search audit:

`domain-walkthrough/trajectory-gap-audit-2026-09-03.md`

The audit records the current search cutoff and explicit near-match exclusions. Important exclusions include:

- Orbis PR #4: superseded/abandoned branch cleanup, not Review Reject or Agent Cancel;
- `sooperset/mcp-atlassian#1404`: closed at author request, not Review Reject;
- GitHub Actions infra Issue #23: genuine pre-checkout zero-step failure, but remote hosted-runner execution is outside the current local-runner/local-Workspace Product scope and therefore does not count as TR-06;
- `easy-yapi` upstream sync: two-repository relationship, but only the fork owns the actual change/delivery, so it does not establish TR-08;
- historical Hermes/Desktop cwd references: incomplete real-task/retry fact chain, so no TR-06;
- `learn-claude-code` default-branch commits: insufficient attribution and no-Task-start facts, so no TR-07;
- user-authored PR search with `review:changes_requested`: no qualifying historical case found for TR-03;
- Technical Validation hostile-process/fault-injection cases remain independent and are not automatically backfilled into Product Validation.

Historical mining is now treated as saturated for the currently available sources. Broad repeated searches without new source material should not be used to pressure a near-match into the six-trajectory count.

## Independent decision records

| Decision unit | Required decision | Current status |
|---|---|---|
| Project-native | Keep / Modify / Remove | NOT_RECORDED |
| Task-first | Keep / Modify / Remove | NOT_RECORDED |
| Task Aggregation | Keep / Modify / Remove | Draft: 9/9 frozen first-nine natural fit + S01 TR-09, **1/6** actual trajectories → CONTINUE_VALIDATION |
| Product Validation Gate | PASS / CONTINUE_VALIDATION / FAIL_AND_REVISE | Draft only; final NOT_RECORDED |

## Evidence against premature PASS

- zero external participants have executed Concierge validation;
- no usable external A↔B or B↔C comparison exists;
- no spontaneous external reuse has been observed/audited;
- Task Aggregation adverse trajectory threshold is only **1/6**;
- native Agent Run/Session and local Workspace facts are unknown in the frozen first-nine public evidence;
- five additional distinct actual trajectories are still required;
- founder behavior cannot substitute for independent external behavior.

## Authorized next actions

1. Capture newly occurring real adverse trajectories prospectively under Issue #37; do not manufacture them.
2. Accept newly discovered historical evidence only when it contains a complete auditable fact chain.
3. Keep counterfactual walkthroughs and Technical fault injection separate from Product actual evidence.
4. Identify a real external P01 candidate under Issue #38 without weakening qualification or consent requirements.
5. Once P01 qualifies, freeze the first real-problem fact pack before A/B/C comparison.
6. Execute fixed A/B/C coverage and Concierge observations.
7. Start the 14-day no-reminder reuse window after each first-problem Review completion.
8. Finalize Task Aggregation only after >=6 distinct actual trajectories and all supplemental fit reviews close.
9. Produce Project-native and Task-first Final Decision Records before final Product Gate evaluation.

## Explicit non-authorizations

This draft does not authorize Product MVP WWA, production Task schema/API, Project/Task product UI, general Workflow, multi-runtime, Sandbox, Session Resume or other Deferred scope. It does not claim market validation.
