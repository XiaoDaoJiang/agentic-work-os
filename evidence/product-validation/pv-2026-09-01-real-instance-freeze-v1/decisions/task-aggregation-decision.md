# Task Aggregation Decision Record

- Decision ID: `TA-2026-09-01-DRAFT-01`
- Date: 2026-09-01
- Last evidence update: 2026-09-03
- Owner: Product decision owner
- Record status: **Draft**
- Protocol version: `ee83598caba483b36248fd85c18ba8c7516cb3d1`
- Evidence snapshot: `pv-2026-09-01-real-instance-freeze-v1`
- Assumption: A2
- Independent question: Task 是否能稳定聚合候选领域事实？
- Final Decision: **NOT_RECORDED**
- Current disposition: **CONTINUE_VALIDATION — fit positive, first adverse trajectory proven, coverage still insufficient**

## Evidence snapshot

- Nine-instance frozen index: `experiments/product-validation/domain-walkthrough-matrix.md`
- Fit / trajectory review: `domain-walkthrough/fit-and-trajectory-review.md`
- Frozen first-nine: I01..I09 = Orbis PR #14, #13, #12, #11, #10, #9, #8, #7, #5
- Additional instances counted as actual trajectories:
  - `S01-ORBIS-PLAN40B-DELIVERY-INTEGRITY.yaml` → `TR-09 actual_end_to_end`
- Distinct actual end-to-end trajectory count: **1 / required 6**

## Fit results

- Frozen first-nine `natural_fit`: **9 / 9**
- Supplemental `natural_fit`: **1**
- Total `natural_fit`: **10**
- `strained_fit`: **0**
- `model_break`: **0**
- Frozen first-nine giant Task cases: **0**
- Frozen first-nine special FK cases: **0**
- Frozen first-nine ambiguous ownership cases: **0**
- Exception lifecycle cases: **0**

### Positive finding

Across nine recent real engineering slices, the **known** objective, verification evidence, artifacts/references and final repository decision can be expressed under one task-like work aggregate without changing fact ownership/cardinality or inventing case-specific relations.

The first qualifying adverse case strengthens one specific invariant: historical acceptance and delivery integrity can remain separate facts. A Task-centered model does not need to rewrite an accepted historical decision merely because intended delivery later proves incomplete.

### Important boundary

GitHub Actions checkpoints are Verification events, not automatically Work OS `Run` boundaries. Public evidence does not expose native Coding Agent Run/Session identity or local Workspace allocation/loss. Those facts remain `unknown`.

Therefore the positive fit result must not be interpreted as proof that the full candidate `Task → Run → Session/Workspace → Artifact → ReviewDecision` production model is validated.

## Trajectory coverage

Current strict coverage:

- TR-01: **NOT_COVERED** — no complete actual case including post-accept original Workspace loss.
- TR-02: **NOT_COVERED** — failed Verification is present in several instances, but the failed state was not itself sealed and sent to Review as the final package.
- TR-03: **NOT_COVERED** — no actual Review Reject → immutable old Run → new Run case.
- TR-04: **NOT_COVERED** — no Agent process-tree Cancel + containment-safe case.
- TR-05: **NOT_COVERED** — no process-fact loss + reconciliation case.
- TR-06: **NOT_COVERED** — no Prepare-failed/no-Workspace actual case.
- TR-07: **NOT_COVERED** — no qualifying no-Task exploratory code-work fact pack.
- TR-08: **NOT_COVERED** — no cross-repository/out-of-scope actual case.
- TR-09: **ACTUAL_END_TO_END** — Orbis Plan 40B delivery-integrity failure/recovery.

### TR-09 evidence

Orbis PR #16 carried the final validated Plan 40B head and was merged while still targeting the stacked Plan 40A branch. The repository therefore recorded a successful merge, but the intended target `main` did not receive the Plan 40B commits. The historical merge/acceptance fact was retained rather than rewritten.

PR #18 then carried the **same validated head** directly onto `main` and passed a fresh full build/artifact/Preview, but it remained Draft because the connector's Ready-for-review mutation failed against the current GitHub schema. PR #19 superseded #18 as a non-Draft main-targeted delivery attempt, carried the same validated head, and merged successfully.

This satisfies TR-09 at the SCM/delivery-integrity level:

```text
validated package
→ repository acceptance recorded
→ intended delivery target later found missing
→ historical acceptance remains immutable
→ delivery_integrity becomes failed
→ new delivery attempts
→ delivery restored
```

It does **not** claim local Workspace corruption or native Agent package-file loss.

Orbis PR #4 and `sooperset/mcp-atlassian#1404` remain partial supplemental candidates only; neither is counted as Review Reject or Agent Cancel.

## Alternatives considered

- **WorkItem:** remains a viable neutral aggregate if future adverse cases show that `Task` implies too much pre-definition.
- **ExecutionRequest:** may be useful as an execution-level object but does not naturally replace the observed durable engineering objective.
- **ChangeSet:** naturally represents code/result artifacts but does not own the original goal/DoD by itself. TR-09 also shows that ChangeSet validity and delivery integrity are distinct.
- **Run-first:** remains plausible if future adverse evidence shows objectives are often absent or unstable; current evidence does not require it.

No alternative is selected at this Draft checkpoint because five more distinct adverse trajectories are still required.

## Counterevidence and limitations

- first-nine sample is concentrated in one repository and successful delivery work;
- the only counted adverse trajectory so far is also from Orbis;
- no native Agent Session evidence is public;
- no local Workspace lifecycle evidence is public;
- no Cancel/reconciliation/cross-repo actual path is present;
- fit classification tests known-fact expressibility, not missing-fact correctness;
- no external participant behavior is used in this A2 record.

## Required consequence

- Task aggregation supports later production freeze after joint gate: **NOT_YET**
- PRD change required now: **none; continue evidence acquisition**
- Re-review required: **yes, after >=6 distinct actual trajectories and all supplemental instances are mapped**

## Draft rationale

The evidence now contains both broad positive fit (9/9 frozen first-nine natural for known facts) and one genuine adverse lifecycle/delivery path. TR-09 supports an important modeling boundary: historical acceptance must be immutable while delivery integrity can later degrade and recover independently.

However, the pre-registered protocol requires at least six distinct actual trajectories. With only 1/6, a Final `Keep` would still violate the gate. The only defensible current disposition remains **CONTINUE_VALIDATION**.

## Sign-off

- Product decision owner: pending
- Domain reviewer: pending final evidence cutoff
