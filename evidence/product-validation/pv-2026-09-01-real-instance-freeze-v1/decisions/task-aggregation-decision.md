# Task Aggregation Decision Record

- Decision ID: `TA-2026-09-01-DRAFT-01`
- Date: 2026-09-01
- Owner: Product decision owner
- Record status: **Draft**
- Protocol version: `ee83598caba483b36248fd85c18ba8c7516cb3d1`
- Evidence snapshot: `pv-2026-09-01-real-instance-freeze-v1`
- Assumption: A2
- Independent question: Task 是否能稳定聚合候选领域事实？
- Final Decision: **NOT_RECORDED**
- Current disposition: **CONTINUE_VALIDATION — fit positive, trajectory coverage insufficient**

## Evidence snapshot

- Nine-instance frozen index: `experiments/product-validation/domain-walkthrough-matrix.md`
- Fit / trajectory review: `domain-walkthrough/fit-and-trajectory-review.md`
- Frozen first-nine: I01..I09 = Orbis PR #14, #13, #12, #11, #10, #9, #8, #7, #5
- Additional instances counted as actual trajectories: none
- Distinct actual end-to-end trajectory count: **0 / required 6**

## Fit results

- `natural_fit`: **9**
- `strained_fit`: **0**
- `model_break`: **0**
- Frozen first-nine giant Task cases: **0**
- Frozen first-nine special FK cases: **0**
- Frozen first-nine ambiguous ownership cases: **0**
- Exception lifecycle cases: **0**

### Positive finding

Across nine recent real engineering slices, the **known** objective, verification evidence, artifacts/references and final repository decision can be expressed under one task-like work aggregate without changing fact ownership/cardinality or inventing case-specific relations.

This is meaningful support for a task-like aggregate at the level of observed work intent and evidence.

### Important boundary

GitHub Actions checkpoints are Verification events, not automatically Work OS `Run` boundaries. Public evidence does not expose native Coding Agent Run/Session identity or local Workspace allocation/loss. Those facts remain `unknown`.

Therefore `9/9 natural_fit` must not be interpreted as proof that the full candidate `Task → Run → Session/Workspace → Artifact → ReviewDecision` production model is validated.

## Trajectory coverage

Strict actual coverage is currently zero:

- TR-01: no complete actual case including post-accept original Workspace loss.
- TR-02: failed Verification is present in several instances, but the failed state was not itself sealed and sent to Review as the final package.
- TR-03: no actual Review Reject → immutable old Run → new Run case.
- TR-04: no Agent process-tree Cancel + containment-safe case.
- TR-05: no process-fact loss + reconciliation case.
- TR-06: no Prepare-failed/no-Workspace actual case.
- TR-07: no qualifying no-Task exploratory code-work fact pack in this snapshot.
- TR-08: first-nine is single-repository; no cross-repo/out-of-scope actual case.
- TR-09: no accepted Package later missing/corrupt actual case.

Orbis PR #4 is retained as a supersession/abandonment partial case only. Closing a PR is not equivalent to Agent process Cancel or Review Reject.

## Alternatives considered

- **WorkItem:** remains a viable neutral aggregate if adverse cases later show that `Task` implies too much pre-definition.
- **ExecutionRequest:** may be useful as an execution-level object but does not naturally replace the observed durable engineering objective in the first nine.
- **ChangeSet:** naturally represents code/result artifacts but does not own the original goal/DoD by itself.
- **Run-first:** remains plausible if future adverse evidence shows objectives are often absent or unstable; current first-nine does not require it.

No alternative is selected at this Draft checkpoint because trajectory evidence is insufficient to discriminate them under adverse paths.

## Counterevidence and limitations

- first-nine sample is concentrated in one repository and successful delivery work;
- no native Agent Session evidence is public;
- no local Workspace lifecycle evidence is public;
- no Cancel/reconciliation/cross-repo/package-corruption actual path is present;
- fit classification only tests known-fact expressibility, not missing-fact correctness;
- no external participant behavior is used in this A2 record.

## Required consequence

- Task aggregation supports later production freeze after joint gate: **NOT_YET**
- PRD change required now: **none; evidence acquisition first**
- Re-review required: **yes, after >=6 distinct actual trajectories and any supplemental instances are mapped**

## Draft rationale

The first-nine evidence is stronger than `WAITING_FOR_REAL_INPUT`: known facts fit naturally in 9/9 cases and show no immediate model break. But the protocol intentionally requires adverse lifecycle coverage before allowing a Task-centered production freeze. Since actual trajectory coverage is 0/6, a Final `Keep` would violate the pre-registered gate.

The only defensible current disposition is **CONTINUE_VALIDATION** while preserving Task as a live candidate rather than freezing or removing it.

## Sign-off

- Product decision owner: pending
- Domain reviewer: pending final evidence cutoff
