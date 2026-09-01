# First-Nine Mapping Summary

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Status: **9 / 9 neutral mappings + 9 / 9 first-pass fit classifications complete; adverse trajectory acquisition still open**

## Cross-instance facts

1. All nine frozen instances have one independent engineering objective represented by a dedicated Orbis PR scope.
2. All nine involve exactly one repository in the public evidence sample.
3. Seven of nine (I01..I07) preserve at least one failed verification checkpoint before a later successful checkpoint. I08 and I09 are success-oriented governance/cutover paths without a recorded RED checkpoint in the evidence used here.
4. PR/CI/publish events can be uniquely attributed to the corresponding change objective at the GitHub level.
5. Public build artifacts / Preview outputs, where present, are uniquely attributable to the corresponding change objective.
6. Final repository merge/deployment decisions remain separable from intermediate verification events.
7. Native Coding Agent Run/Session identity is not present in the public evidence for any of the nine.
8. Local Workspace allocation/loss/reconciliation is not observable from public PR evidence for any of the nine.
9. CI executions are Verification events; they are not automatically mapped one-for-one to Work OS Runs.

## First-pass fit result

All nine classify as `natural_fit` **for known facts**:

- natural_fit: 9
- strained_fit: 0
- model_break: 0
- giant_task_required: 0
- special_fk_required: 0
- ambiguous_ownership: 0
- exception_lifecycle_required: 0

This means no known first-nine fact forces a giant Task, special relation, multiple center ownership or exception lifecycle merely to preserve the history.

It does **not** prove the unobserved Run/Session/Workspace model.

## Critical unresolved boundary

One engineering objective often contains multiple immutable failed/successful Verification events while work continues. The evidence rules out two simplistic mappings:

- **Wrong:** erase failed checkpoints and keep only final success;
- **Wrong:** assume every CI execution is a Work OS Run.

The eventual Run boundary must come from actual Agent execution facts (start/session/workspace/attempt/retry/review), not from GitHub Actions vocabulary.

## Trajectory coverage

Strict distinct `actual_end_to_end` coverage is **0 / required 6**.

The first nine do not establish complete actual cases for:

- TR-01 post-accept Workspace loss with package explainability;
- TR-02 failed Verification state sealed and reviewed;
- TR-03 Review Reject then new immutable Run;
- TR-04 active Agent Cancel + containment safe;
- TR-05 process fact loss + reconciliation;
- TR-06 Prepare fails before Workspace exists;
- TR-07 no-Task exploratory real coding run;
- TR-08 cross-repository/out-of-scope ownership;
- TR-09 accepted Package later missing/corrupt.

Orbis PR #4 is a useful supersession partial case but is not mislabeled as TR-03 or TR-04.

## Resulting A2 state

The first-nine evidence positively supports a **task-like work aggregate for known intent/evidence/artifact/final-decision facts**, but does not yet authorize a production Task-centered model.

Task Aggregation Draft disposition: **CONTINUE_VALIDATION**.

See:

- `fit-and-trajectory-review.md`
- `trajectory-acquisition-plan.md`
- `../decisions/task-aggregation-decision.md`
