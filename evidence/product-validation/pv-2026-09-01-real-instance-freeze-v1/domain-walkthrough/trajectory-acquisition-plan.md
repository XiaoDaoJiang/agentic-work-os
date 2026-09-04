# Actual Trajectory Evidence Acquisition Plan

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Purpose: close the A2 Task Aggregation trajectory gap without fabricating demo evidence or replacing I01..I09.

## Hard rule

Only a **real code-work instance with auditable raw evidence** may count as `actual_end_to_end`.

The following do **not** count:

- a hypothetical walkthrough;
- a test fixture whose only purpose is to satisfy the Product Gate;
- a GitHub PR close mislabeled as Agent process Cancel;
- a failed CI job mislabeled as a failed Work OS Run when the Run boundary is not observable;
- Technical Validation fault injection automatically backfilled into Product Validation;
- a facilitator-created problem with no independent real objective.

A Technical Spike may only be considered if it independently satisfies the Product Validation real-code-work criteria; default treatment is **not counted** to preserve gate independence.

## Required trajectory inventory

At least **6 distinct** trajectory IDs must have an actual end-to-end case.

| ID | Real evidence required | Current source candidates | Status |
|---|---|---|---|
| TR-01 | real objective; Agent execution; Verification pass; immutable/sealed delivery evidence; human Accept; completed; later original Workspace unavailable while accepted package remains explainable | future real completed code task where workspace/worktree is later removed; first-nine only proves partial delivery facts | OPEN |
| TR-02 | Verification failed/error; failure evidence preserved; package/review boundary explicit; human Accept or Reject without confusing test failure with coordinator failure | first-nine has many failed verifications but not the required failed-state seal/review boundary | OPEN |
| TR-03 | explicit human Review Reject; old execution history immutable; a genuinely new Run/attempt follows | look for real MR/PR/code-agent task rejected and re-run; Orbis PR #4 is only a supersession partial and does not qualify yet | OPEN |
| TR-04 | real Cancel request while Agent/process is active; process-tree containment confirmed; terminal state `cancelled/safe`; later new Run is separate; no Test/Review after cancelled attempt | must come from a naturally cancelled real coding task or future Concierge/M0 use that independently qualifies | OPEN |
| TR-05 | controller loses process truth; run becomes interrupted/reconciliation-required; repository/resource remains locked until reconciliation resolves safe/blocked | historical local Agent/terminal loss case if raw facts exist; otherwise wait for real occurrence | OPEN |
| TR-06 | Prepare fails before Workspace exists; failure fact is still durable and no fake Workspace/Run artifacts are created | real repository/worktree/checkout/permission/path preparation failure with raw evidence | OPEN |
| TR-07 | real exploratory coding Session/Run begins without a pre-existing Task; mapping must not invent an empty/giant Task | historical coding exploration may qualify only after a raw fact pack proves it was real code work, not architecture/research discussion | OPEN |
| TR-08 | one real objective touches multiple repositories or attempts an out-of-scope repository/path change; ownership/blocking must be observable | search historical cross-repo engineering work; first-nine is single-repo | OPEN |
| TR-09 | human already Accepted a sealed delivery package; later package becomes missing/corrupt; historical ReviewDecision/Run terminal state remains unchanged while current delivery integrity changes | real artifact retention/corruption incident only; do not manufacture by deleting evidence for the study | OPEN |

## Acquisition order

Prefer evidence in this order:

1. **Existing historical real work** with source logs/PRs/terminal records already available.
2. **Naturally occurring new founder work** during ongoing engineering, recorded prospectively without forcing a failure.
3. **External Concierge participant real problems** when a trajectory naturally occurs; never induce Cancel/failure only to fill the matrix.
4. Do not use manufactured demo cases.

## Minimum fact pack for a supplemental instance

Each added instance must record:

- stable supplemental instance ID;
- occurrence time;
- independent objective and DoD owner;
- repository/context reference;
- raw timeline reference;
- actual attempt/Run boundary evidence, or `unknown`;
- actual Workspace ownership/lifecycle evidence, or `unknown`;
- event/artifact/review ownership;
- exact trajectory step-by-step mapping;
- why the case is actual rather than counterfactual;
- fit classification and exception flags;
- reviewer decision.

## Stop condition

Stop adding supplemental instances once:

- at least six distinct TR IDs have one valid `actual_end_to_end` case;
- all first-nine remain frozen and all supplemental mappings are retained, including adverse cases;
- all `strained_fit/model_break` records have a second reviewer;
- the Task Aggregation Decision Record can be finalized without unknown facts being treated as support.

More examples after the stop condition may improve understanding but are not required solely to satisfy the pre-registered A2 gate.
