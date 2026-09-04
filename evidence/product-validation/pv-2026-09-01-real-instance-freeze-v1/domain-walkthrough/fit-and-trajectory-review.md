# First-Nine Fit & Trajectory Review

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Review status: first-pass domain review complete; no second reviewer required by protocol because no `strained_fit` or `model_break` is assigned in this pass.

## Boundary correction before classification

The public Orbis PRs preserve many CI/build checkpoints. Those checkpoints are **Verification events**, not automatically Work OS `Run` boundaries.

For this review:

- one PR-level engineering objective is treated only as the neutral candidate work aggregate;
- GitHub Actions executions are preserved as immutable verification evidence/events;
- native Coding Agent `Run`, `Session` and local Workspace boundaries remain `unknown` unless raw evidence explicitly proves them;
- `unknown` is not converted into a supporting fact;
- fit classification asks whether the **known facts** force giant Task, special FK, ambiguous ownership or exception lifecycle. It does not claim that unobserved Run/Session/Workspace semantics have been validated.

## Fit classification

| Instance | Fit | Giant Task | Special FK | Ambiguous ownership | Exception lifecycle | Reason |
|---|---|---:|---:|---:|---:|---|
| I01 / ORBIS-PR-14 | natural_fit | false | false | false | false | One Plan 30B objective; verification checkpoints and final artifact/merge are uniquely attributable without re-owning another work item. |
| I02 / ORBIS-PR-13 | natural_fit | false | false | false | false | One Plan 30A objective; schema/read/diagnostic checkpoints remain evidence under the same objective and do not require separate center objects. |
| I03 / ORBIS-PR-12 | natural_fit | false | false | false | false | One Plan 20B slice; capability/safety failures are preserved verification evidence and final artifact/merge ownership is unique. |
| I04 / ORBIS-PR-11 | natural_fit | false | false | false | false | One Registry-foundation slice with one failed capability check and later final verification; no special ownership rule is needed. |
| I05 / ORBIS-PR-10 | natural_fit | false | false | false | false | One homepage discovery objective; build and publish evidence are attributable to it, while merge remains a separate human decision. |
| I06 / ORBIS-PR-9 | natural_fit | false | false | false | false | One navigation/related-content objective; failure, green build, publish artifact and merge are uniquely referencable. |
| I07 / ORBIS-PR-8 | natural_fit | false | false | false | false | One discovery-index objective; missing-artifact RED, green build, Preview and merge remain distinct evidence without lifecycle exception. |
| I08 / ORBIS-PR-7 | natural_fit | false | false | false | false | One legacy-retirement objective; Preview build/publish/smoke and merge fit without special relationships. |
| I09 / ORBIS-PR-5 | natural_fit | false | false | false | false | One governed-cutover-preparation objective. Prior PR #3 lifecycle evidence is referenced, not re-owned; PR #5's own dry-run artifact and merge decision remain unique. |

Counts:

- `natural_fit`: **9**
- `strained_fit`: **0**
- `model_break`: **0**
- first-nine giant Task cases: **0**
- first-nine special FK cases: **0**
- first-nine ambiguous ownership cases: **0**
- exception lifecycle cases: **0**

## What the fit result does NOT prove

The first-nine fit result does not prove:

- where a Work OS immutable `Run/attempt` boundary belongs;
- that every CI checkpoint should become a `Run` (it should not be assumed);
- native Coding Agent Session ownership;
- local Workspace allocation, loss, containment or reconciliation;
- Cancel semantics;
- cross-repository ownership;
- accepted Package durability after the original Workspace disappears.

Those are trajectory/coverage questions and remain independently gated.

## TR-01..TR-09 coverage review

| Trajectory | Actual end-to-end evidence | Counterfactual / partial source | Current disposition |
|---|---|---|---|
| TR-01 success → seal → Accept → completed → original Workspace lost | none | I01..I08 prove portions of successful verification/artifact/human merge, but no public evidence proves an Agent Run boundary plus post-accept Workspace loss | **UNcovered actual** |
| TR-02 Verification failed/error → evidence-safe seal → Review Accept/Reject | none | I01/I02/I03/I04/I05/I06/I07 preserve failed verification evidence, but work continued and the failed state was not itself sealed as the final package for Review | **UNcovered actual** |
| TR-03 Review Reject → old Run unchanged → new Run/attempt | none | Orbis PR #4 is superseded/closed without merge, but that is not evidence of a Work OS Review Reject followed by a new immutable Run | **UNcovered actual** |
| TR-04 Cancel → containment safe → cancelled → new Run | none | PR close/cancelled CI cannot substitute for Agent process-tree Cancel + containment evidence | **UNcovered actual** |
| TR-05 process fact lost → reconciliation_required → safe/blocked | none | none | **UNcovered actual** |
| TR-06 Prepare failed → no Workspace → failed | none | none | **UNcovered actual** |
| TR-07 no-Task exploratory Session/Run | none in frozen public code-work sample | prior research/exploration conversations exist but are not converted here into a code-work actual trajectory without a qualifying raw fact pack | **UNcovered actual** |
| TR-08 cross-repository / out-of-scope modification | none | first-nine sample is single-repository | **UNcovered actual** |
| TR-09 accepted Package later missing/corrupt | none | none | **UNcovered actual** |

Distinct `actual_end_to_end` trajectory count: **0 / required 6**.

This count is deliberately strict. A normal successful GitHub PR is not retroactively treated as proof of Agent process containment, Workspace loss, sealed Change Package durability or native Session ownership.

## Supplemental evidence candidates

- `Orbis PR #4` may be used only as a **supersession/abandonment partial case**. It must not be mislabeled as TR-03 or TR-04 actual evidence.
- Additional real code-work instances are required for at least six distinct actual trajectories. They may be historical or newly occurring real work, but may not be fabricated demo problems and may not replace I01..I09.

## First-pass Task aggregation interpretation

The first-nine evidence says:

> A task-like work aggregate can naturally hold the **known** objective, verification events, artifacts/references and final repository decision in nine recent real engineering slices without special-case modeling.

It does **not** yet say:

> Task has been proven as the production center for immutable Runs, Workspace/Session ownership and adverse lifecycle semantics.

Therefore Task Aggregation cannot receive a Final `Keep` from the first-nine fit result alone. The correct current state remains **IN_PROGRESS / trajectory evidence insufficient**.
