# P00 Researcher-Reconstructed Return-Context Answer Key

> Classification: **REHEARSAL_ONLY / RESEARCHER_RECONSTRUCTION**  
> Source problem: `XiaoDaoJiang/Orbis#14`  
> Purpose: provide an evidence-supported answer key for the six frozen return-context questions. This is **not** founder observed behavior and contributes zero Product Gate evidence.

## Q1 — What was the objective / DoD?

### Evidence-supported answer

The objective was to complete Plan 30B by adding `weekly-v1` Presentation integration while preserving the existing Presentation Platform boundaries and Daily/Talk behavior.

The observable DoD included:

- add a dedicated `apps/slides/templates/weekly-v1.ts` renderer;
- register `weekly-v1` through the existing Template Registry;
- require the Weekly payload to satisfy `weeklyBriefSchema` and have a Reading URL;
- preserve Weekly-specific semantics and dynamic slide count (`sections.length + 5`);
- prove representative Weekly sizes including the real 3-section Weekly producing 8 slides;
- keep Daily at exactly 11 slides and Talk behavior unchanged;
- reject Daily/Talk payloads at the Weekly Registry boundary;
- escape hostile script/iframe-like content;
- enable the real Weekly Presentation only after the required RED checkpoints;
- prove Daily + Weekly + Talk coexist in one normal build;
- preserve Weekly's Brief identity in Archive/RSS/Topic while exposing it in Slides/Homepage Presentation discovery;
- keep `/latest/`, Daily date aliases and `archive.json` Daily-only;
- preserve the platform-neutral generator/build boundaries and avoid committed generated artifacts.

### Confidence

`FACT_AVAILABLE_FROM_VARIANT` at summary level. The full detailed DoD lives in the referenced PR/plan; the compact B archive only carries an objective/prompt reference rather than every acceptance criterion inline.

---

## Q2 — What is the current execution state / where did it stop?

### Evidence-supported answer

At the repository-work level, the last observed state is **completed/accepted**:

- final GREEN run `33466065425` succeeded;
- the final artifact was uploaded;
- trusted Preview evidence existed;
- PR #14 was merged at `2026-09-01T03:57:12Z`.

So the historical engineering slice stopped after successful Verification and human merge acceptance.

### Important limitation

The B archive does **not** contain a first-class Work OS `state` / `phase` field. This answer is derived from the latest Verification and Review facts.

Native Codex Run/Session state is not available and must remain `unknown`.

### Classification

`FACT_DERIVABLE_FROM_VARIANT`, but this is a **LIVE_REHEARSAL_CHECK** because state is not first-class in `pv-archive-v0`.

---

## Q3 — What changed in the code/workspace?

### Evidence-supported answer

The final production scope was limited to:

- a dedicated `weekly-v1` renderer;
- one Template Registry entry;
- six narrow Weekly CSS utility rules;
- one-line enablement of the real Weekly Presentation.

Additional changed files were focused tests and approved design/plan documentation. The PR explicitly reports 11 changed files overall and says generated Slidev source / `dist/**` were not committed.

Important non-changes included the source-neutral generator/build boundaries such as the Brief adapter/discovery/generator and `tools/build-slides/**`.

### Confidence

`FACT_AVAILABLE_FROM_VARIANT` through the Diff reference plus PR scope evidence.

### Limitation

The historical local Workspace directory and uncommitted intermediate filesystem state are not known from the archive.

---

## Q4 — What was the VerificationInvocation and result?

### Evidence-supported answer

The verification history contains four key checkpoints:

1. **RED 1 — run `33465703923`**: baseline contracts passed, then Weekly capability failed because the `weekly-v1` renderer did not yet exist.
2. **GREEN 1 — run `33465780926`**: renderer + Registry contracts passed while the real Weekly remained disabled.
3. **RED 2 — run `33465986406`**: mixed integration failed because it required a published `weekly-v1` seed while the real Weekly was still disabled.
4. **GREEN 2 — run `33466065425`**: final mixed Daily + Weekly + Talk integration succeeded, future-Daily regression passed, normal repository state returned to three real Presentation outputs, and the final artifact was uploaded.

Final artifact evidence:

- artifact ID `9784902857`;
- head `edd84cb83fd88d7cde2257b8a804f9f6164b061e`;
- SHA-256 `cfc6590063a697323ec940ae5052ee96fe4b654383ebe259bd0681b1dcc1886b`.

### Important limitation

The compact Variant B archive preserves a `verification_invocation_ref`, but the excerpt itself does **not** expose the exact shell program/argv/cwd/env/timeout that launched the checks. The exact command therefore cannot be reconstructed from this archive alone without following the referenced raw evidence.

### Classification

- Verification sequence/result: `FACT_AVAILABLE_FROM_VARIANT`.
- Exact invocation command contract: `NOT_VISIBLE_IN_VARIANT` unless the reference is opened.

---

## Q5 — What Review / Accept / Reject decision exists?

### Evidence-supported answer

A final human acceptance decision exists at repository level: **PR #14 was merged** on `2026-09-01T03:57:12Z` after final GREEN and Preview evidence.

The PR explicitly states there were no submitted independent reviews or unresolved review threads, so no separate second-review approval should be invented.

There is no recorded Reject decision for this slice.

### Classification

`FACT_AVAILABLE_FROM_VARIANT` for merge acceptance; independent reviewer approval is `NOT_PRESENT`.

---

## Q6 — What should happen next?

### Evidence-supported answer

For the historical Plan 30B engineering slice itself, no further implementation step is required after successful merge: the PR states that Plan 30 Weekly Brief is functionally complete for its first release after merge.

Therefore the immediate next action for this slice is effectively **close the work item and move to the next independently planned product/engineering work**, while retaining the artifact/verification evidence for later reference.

### Important limitation

This is derived from objective/DoD + final Verification + merge decision. `pv-archive-v0` contains no first-class `next_action` field, so B does not directly display this answer.

### Classification

`FACT_DERIVABLE_FROM_VARIANT`, and this is a second **LIVE_REHEARSAL_CHECK** for archive sufficiency.

---

# Scenario supplements exposed by the answer key

## S1 — Successful multi-checkpoint task

One real engineering objective can contain multiple preserved RED/GREEN Verification events. These are not automatically separate Agent Runs.

## S2 — Verification evidence vs exact invocation

A user may know that verification passed and still be unable to reconstruct the exact executable command/cwd/env from the compact archive unless `verification_invocation_ref` is opened. This is a concrete recovery-design question for P00/P01.

## S3 — Repository acceptance vs independent ReviewDecision

A GitHub merge is observable human acceptance for the historical slice, but it is not automatically equivalent to an independent Work OS reviewer approval. The model must keep these concepts separable.

## S4 — Current state is derivable, not first-class

The final state can be inferred from final GREEN + merge, but `pv-archive-v0` has no first-class state/phase projection. Live rehearsal must test whether inference is sufficient.

## S5 — Next action is derivable, not first-class

After an accepted completed task the next action is inferable (`close/move on`), but the archive has no explicit next-action field. More ambiguous incomplete tasks may expose greater friction.

## S6 — Workspace and Session remain genuine unknowns

The archive cannot reconstruct original local cwd, Codex native Session/Run identity or intermediate Workspace state from PR evidence. Those unknowns must not be filled using GitHub terminology.

# Gate treatment

These reconstructed answers are an **answer key / scenario supplement only**.

They may be used to score a later live P00/P01 return-context response and to detect research-kit defects. They must not be counted as observed participant behavior, Project-native benefit, Task-first benefit, spontaneous reuse, or Product Validation Gate PASS evidence.
