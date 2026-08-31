# Product Validation Sampling Plan

> Status: Frozen before participant observation. No evidence recorded.

## Participants

Use three individual developers who already use a Coding Agent. Assign anonymous IDs P01, P02, P03 in the order they pass qualification. Do not reorder IDs after observing any task outcome.

Qualification only establishes recruitment fit; it does not prove the target segment is valid.

## Real problems

Each participant first brings one current real code problem that already belongs to their work. The researcher must not invent, split, or replace it. The activity target is five real problems total. Additional problems may be naturally brought by participants or separately scheduled real research tasks, but scheduled tasks cannot count as qualifying spontaneous reuse.

A real problem record must contain enough evidence to confirm independent objective, DoD, repository/context reference, and one VerificationInvocation. Demo problems do not count toward the five.

## A/B/C comparisons

Use the fixed participant order in `entry-order-matrix.md`. Each participant must produce at least one usable A↔B and one usable B↔C observation. Do not execute the same real problem three times merely to fill the matrix; use matched real fact packs or low-fidelity start/recovery walkthroughs and record matching basis/confounders.

## Domain walkthrough

Before mapping results, freeze the nine most recent accessible real code-work instances by occurrence time descending. The selection rule must be independent of whether the candidate Task model fits. Keep all first nine, including adverse examples. At least six distinct protocol trajectories must have an `actual_end_to_end` mapping; counterfactual mappings are recorded but do not count toward six.

## Reuse window

The reuse observation window is 14 calendar days from the first problem Review completion for each participant. During the window there are no direct reminders, emails, calendar invitations, verbal prompts, or rewards conditioned on second use. A second task is audited before execution and is excluded if it was preallocated, researcher-scheduled, same-task continuation, artificially split, facilitator-initiated, non-real, interest-only, control-mechanism-free, or Codex-only.

The 14-day duration is an operational pre-registration choice, not a claim of statistical sufficiency.

## Evidence cutoff

Each Decision Record declares its own evidence cutoff timestamp and evidence snapshot hash. Evidence created after the cutoff cannot be silently backfilled into a finalized record.
