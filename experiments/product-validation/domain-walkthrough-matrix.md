# Frozen Nine-Instance Domain Walkthrough Matrix

> Freeze snapshot: `pv-2026-09-01-real-instance-freeze-v1`

Positions I01..I09 were frozen using the sampling rule before candidate-model mapping. Neutral mapping and first-pass fit classification are now recorded. Never replace an adverse first-nine instance after seeing fit results.

| Position | Instance ID | Source date / merged at UTC | Raw timeline ref | Selected before mapping | Fit | Actual trajectory IDs | Reviewer status |
|---|---|---|---|---|---|---|---|
| I01 | ORBIS-PR-14 | 2026-09-01T03:57:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/14 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I02 | ORBIS-PR-13 | 2026-09-01T01:58:51Z | https://github.com/XiaoDaoJiang/Orbis/pull/13 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I03 | ORBIS-PR-12 | 2026-08-31T10:36:28Z | https://github.com/XiaoDaoJiang/Orbis/pull/12 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I04 | ORBIS-PR-11 | 2026-08-31T09:28:29Z | https://github.com/XiaoDaoJiang/Orbis/pull/11 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I05 | ORBIS-PR-10 | 2026-08-31T09:04:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/10 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I06 | ORBIS-PR-9 | 2026-08-31T08:46:59Z | https://github.com/XiaoDaoJiang/Orbis/pull/9 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I07 | ORBIS-PR-8 | 2026-08-31T08:05:04Z | https://github.com/XiaoDaoJiang/Orbis/pull/8 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I08 | ORBIS-PR-7 | 2026-08-31T05:25:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/7 | yes | natural_fit | — | FIRST_PASS_COMPLETE |
| I09 | ORBIS-PR-5 | 2026-08-31T02:32:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/5 | yes | natural_fit | — | FIRST_PASS_COMPLETE |

First-pass fit totals:

- `natural_fit = 9`
- `strained_fit = 0`
- `model_break = 0`
- giant Task = 0
- special FK = 0
- ambiguous ownership = 0
- exception lifecycle = 0

The fit result applies only to **known evidence**. Native Agent Run/Session boundaries and local Workspace lifecycle remain unknown and are not inferred from CI checkpoints.

Protocol trajectories remain TR-01..TR-09. Strict actual end-to-end coverage is currently **0 distinct trajectories**. Partial/counterfactual resemblance is not counted. At least six distinct IDs require an `actual_end_to_end` real instance before the Task Aggregation support signal can be satisfied.

Detailed review: `evidence/product-validation/pv-2026-09-01-real-instance-freeze-v1/domain-walkthrough/fit-and-trajectory-review.md`.
