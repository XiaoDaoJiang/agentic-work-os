# Frozen Nine-Instance Domain Walkthrough Matrix

> Freeze snapshot: `pv-2026-09-01-real-instance-freeze-v1`

Positions I01..I09 are now frozen using the sampling rule before candidate-model mapping. Never replace an adverse first-nine instance after seeing fit results.

| Position | Instance ID | Source date / merged at UTC | Raw timeline ref | Selected before mapping | Fit | Actual trajectory IDs | Reviewer status |
|---|---|---|---|---|---|---|---|
| I01 | ORBIS-PR-14 | 2026-09-01T03:57:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/14 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I02 | ORBIS-PR-13 | 2026-09-01T01:58:51Z | https://github.com/XiaoDaoJiang/Orbis/pull/13 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I03 | ORBIS-PR-12 | 2026-08-31T10:36:28Z | https://github.com/XiaoDaoJiang/Orbis/pull/12 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I04 | ORBIS-PR-11 | 2026-08-31T09:28:29Z | https://github.com/XiaoDaoJiang/Orbis/pull/11 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I05 | ORBIS-PR-10 | 2026-08-31T09:04:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/10 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I06 | ORBIS-PR-9 | 2026-08-31T08:46:59Z | https://github.com/XiaoDaoJiang/Orbis/pull/9 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I07 | ORBIS-PR-8 | 2026-08-31T08:05:04Z | https://github.com/XiaoDaoJiang/Orbis/pull/8 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I08 | ORBIS-PR-7 | 2026-08-31T05:25:27Z | https://github.com/XiaoDaoJiang/Orbis/pull/7 | yes | NOT_EVALUATED | | PENDING_MAPPING |
| I09 | ORBIS-PR-5 | 2026-08-31T02:32:12Z | https://github.com/XiaoDaoJiang/Orbis/pull/5 | yes | NOT_EVALUATED | | PENDING_MAPPING |

Protocol trajectories remain TR-01..TR-09. At least six distinct IDs require an `actual_end_to_end` instance before the Task Aggregation support signal can be satisfied. Supplemental real instances may be added when the first nine do not cover a required adverse trajectory, but they may not replace I01..I09.

Selection and exclusion rationale is recorded in `evidence/product-validation/pv-2026-09-01-real-instance-freeze-v1/domain-walkthrough/frozen-instance-register.md`.
