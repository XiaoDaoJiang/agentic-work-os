# Frozen Nine Real Code-Work Instances — v1

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Status: **Frozen before candidate-model mapping**  
> Selection rule: most recent accessible real code-work instances by occurrence time descending. Selection is independent of candidate Task-model fit and independent of whether the work eventually succeeded, failed, was cancelled, rejected or merged.

## Selection boundary

Included instances must have an independent engineering objective and observable execution evidence in a real repository/context. Pure documentation-only records, research/learning discussions and future ideas are excluded. Failed, cancelled, rejected or superseded engineering work must not be excluded merely because it did not merge.

Occurrence time for this freeze is the GitHub merge/closure timestamp when available. The repository is `XiaoDaoJiang/Orbis` for all first-nine positions, giving strong raw evidence: PR objective/scope, implementation history, CI/build evidence, artifacts/preview references and actual outcome.

## Frozen positions

| Position | Instance ID | Occurred / merged at (UTC) | Raw evidence | Neutral objective | Actual outcome |
|---|---|---|---|---|---|
| I01 | ORBIS-PR-14 | 2026-09-01T03:57:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/14 | Add `weekly-v1` Presentation integration while keeping Daily/Talk contracts isolated | Merged after staged RED/GREEN CI and trusted Preview evidence |
| I02 | ORBIS-PR-13 | 2026-09-01T01:58:51Z | https://github.com/XiaoDaoJiang/Orbis/pull/13 | Add Weekly Brief model and cadence-specific reading experience without prematurely enabling Weekly Slides | Merged after schema/reading RED checkpoints, final build and Preview evidence |
| I03 | ORBIS-PR-12 | 2026-08-31T10:36:28Z | https://github.com/XiaoDaoJiang/Orbis/pull/12 | Add standalone structured Presentations and `talk-v1` through the Presentation platform | Merged after capability RED, HTML-safety RED, full build and Preview evidence |
| I04 | ORBIS-PR-11 | 2026-08-31T09:28:29Z | https://github.com/XiaoDaoJiang/Orbis/pull/11 | Introduce source-neutral Presentation Descriptor and Template Registry without changing Daily output | Merged after missing-capability RED and complete build/Preview verification |
| I05 | ORBIS-PR-10 | 2026-08-31T09:04:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/10 | Replace ambiguous homepage latest content with deterministic Brief/Essay/Presentation discovery | Merged after site-check RED, full build and trusted Preview verification |
| I06 | ORBIS-PR-9 | 2026-08-31T08:46:59Z | https://github.com/XiaoDaoJiang/Orbis/pull/9 | Add cross-content navigation, related-content projection and Reading/Slides backlinks | Merged after relation-contract RED, full build and Preview verification |
| I07 | ORBIS-PR-8 | 2026-08-31T08:05:04Z | https://github.com/XiaoDaoJiang/Orbis/pull/8 | Add Archive/Slides/Daily/Weekly discovery indexes over structured content | Merged after missing-artifact RED, build verification and trusted Preview publication |
| I08 | ORBIS-PR-7 | 2026-08-31T05:25:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/7 | Retire legacy `docs/**` publishing compatibility and make structured content the only active publishing source | Merged after PR Preview Build, trusted publish and public HTTP smoke evidence |
| I09 | ORBIS-PR-5 | 2026-08-31T02:32:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/5 | Prepare governed GitHub Pages cutover: required Preview Gate, production smoke checks and dry-run controls | Merged after cleanup Preview lifecycle evidence and `deploy=false` Pages dry run |

## Records around the cutoff

These records are retained explicitly so the sample boundary is auditable:

- `Orbis PR #6` (`docs: record successful Pages production cutover`) occurred between I08 and I09 but is documentation-only. It records an already-completed production event rather than a new code-work execution, so it is excluded by the predeclared code-work rule.
- `Orbis PR #4` (`chore: retire obsolete foundation branch`) is older than I09 and therefore falls outside the first-nine cutoff. It is **not** excluded because it failed to merge; instead it is retained as a useful supplemental candidate for a cancellation/supersession trajectory if actual coverage is missing.
- `Orbis PR #3` is also outside the first-nine cutoff and remains a supplemental candidate. Neither #3 nor #4 may replace an adverse I01..I09 after mapping.

## Neutral reconstruction notes

The freeze deliberately does **not** yet decide whether any instance is a Project, Task, WorkItem, Run, ChangeSet or another aggregate. The raw PR evidence must first be read as a chronology of intent, execution attempts, changes, verification evidence, artifacts and human repository decisions.

Several first-nine instances contain multiple failing and succeeding CI checkpoints inside one engineering objective. During mapping, those checkpoints must not automatically be called separate Runs or attempts; the walkthrough must determine whether the candidate model can represent the observed boundaries without rewriting history.

All nine first positions involve one repository. This is a property of the time-ordered sample, not a statement that cross-repository work is unimportant. If TR-08 or other required trajectories are absent, supplemental real instances may be added per protocol but I01..I09 remain frozen.

## Mapping status

- Candidate-model mapping: **NOT_STARTED**
- `natural_fit / strained_fit / model_break`: **NOT_EVALUATED**
- Actual trajectory coverage: **NOT_EVALUATED**
- Second reviewer: **NOT_RECORDED**
- Task Aggregation Decision Record: **NOT_RECORDED**

Next execution action is to create one neutral `domain-instance-mapping.yaml` record per frozen instance, reconstruct ownership/boundaries from the raw evidence before assigning fit or trajectory labels, and then evaluate coverage against TR-01..TR-09.
