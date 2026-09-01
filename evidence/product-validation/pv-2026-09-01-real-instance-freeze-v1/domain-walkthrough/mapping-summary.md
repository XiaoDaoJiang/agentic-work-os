# Neutral Mapping Summary — First Nine

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Status: **9 / 9 neutral mappings recorded; fit and trajectory labels intentionally pending**

## Cross-instance facts before candidate-model judgment

1. All nine frozen instances have one independent engineering objective represented by a dedicated Orbis PR scope.
2. All nine involve exactly one repository in the public evidence sample.
3. Seven of nine (I01..I07) preserve at least one failed verification checkpoint before a later successful checkpoint. I08 and I09 are success-oriented governance/cutover paths without a recorded RED checkpoint in the PR evidence used here.
4. PR/CI/publish events can be uniquely attributed to the corresponding change objective at the GitHub level.
5. Public build artifacts / Preview outputs, where present, are uniquely attributable to the corresponding PR/change objective.
6. The final repository merge/cutover decision is separable from intermediate verification checkpoints; several PRs explicitly state that merge or production deployment is a separate human decision.
7. Native Coding Agent Session identity is not present in the public evidence for any of the nine.
8. Local Workspace allocation/loss/reconciliation is not observable from the public PR evidence for any of the nine.

## Modeling question exposed by the sample

The dominant unresolved issue is not whether one change objective exists. It is **where the immutable attempt/Run boundary should be placed**.

For I01/I02/I03 in particular, one objective contains several preserved failing and succeeding CI checkpoints while work continues on the same feature branch. Treating every CI checkpoint as a Work OS Run may be too fine-grained; treating the whole PR as one mutable Run may erase failed-attempt history. The walkthrough must derive the boundary from the protocol invariants rather than from GitHub vocabulary.

## Coverage warning

The first-nine sample is concentrated in successful single-repository delivery work. It does not by itself establish actual end-to-end evidence for Cancel, process-fact loss/reconciliation, prepare-without-workspace failure, no-Task exploration, cross-repository ownership or post-accept artifact corruption.

Per protocol, supplemental real instances may be added to cover missing trajectories, but I01..I09 cannot be replaced after fit inspection.

## Current decision discipline

- `fit_classification`: not evaluated for all nine.
- `giant_task_required`: not evaluated.
- `special_fk_required`: not evaluated.
- `ambiguous_ownership`: not evaluated.
- `exception_lifecycle_required`: not evaluated.
- `trajectory_evidence`: not yet labeled.

This prevents the repository's PR terminology from being silently reinterpreted as proof of the candidate Task/Run production model.
