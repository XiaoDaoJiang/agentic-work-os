# Product Validation — Historical Trajectory Gap Audit

- Audit date: 2026-09-03
- Evidence snapshot: `pv-2026-09-01-real-instance-freeze-v1`
- Protocol: `docs/pm/40-validation-protocol.md` blob `ee83598caba483b36248fd85c18ba8c7516cb3d1`
- Purpose: record historical-search cutoff and explicit exclusion reasons so weak near-matches are not repeatedly reinterpreted as Product Validation evidence.

## Current strict result

- Distinct `actual_end_to_end` trajectory coverage: **1 / required 6**
- Counted trajectory: **TR-09 only**
- Counted supplemental record: `S01-ORBIS-PLAN40B-DELIVERY-INTEGRITY.yaml`
- Remaining required distinct trajectory IDs: **5**

## Counted adverse case

### TR-09 — Orbis Plan 40B delivery integrity

Accepted historical facts are preserved while intended delivery integrity later failed and was restored through new delivery attempts.

Evidence chain:

- Orbis PR #16: validated Plan 40B head, artifact and Trusted Preview; merged while still targeting the stacked Plan 40A branch.
- Intended target `main` did not receive the Plan 40B commits.
- Orbis PR #18: same validated head retargeted to `main`, fresh build/artifact/Preview green, but remained Draft because the connector could not mark it ready for review.
- Orbis PR #19: same validated head, non-Draft main-targeted delivery attempt, merged successfully.

Modeling consequence: historical acceptance / repository decision and `delivery_integrity` are separate facts. Later delivery failure must not rewrite historical acceptance.

## Historical searches performed and not counted

### TR-03 — Review Reject → new immutable attempt

Searches performed:

- GitHub PR search for user-authored `review:changes_requested` cases;
- historical supersession/closed-without-merge candidates;
- external contribution `sooperset/mcp-atlassian#1404`.

Result: **no qualifying historical case**.

Exclusions:

- Orbis PR #4: superseded/abandoned branch cleanup, not an explicit Review Reject.
- `sooperset/mcp-atlassian#1404`: closed at author request, not an explicit Review Reject.
- Agentic Work OS replacement continuation PR #36: old technical branch diverged from current aggregate; replacement is branch-recovery, not human Review Reject.

Disposition: **prospective capture required**.

### TR-04 — active Agent Cancel + containment safe → new Run

Searches performed:

- user-authored issue/PR search for cancel/cancelled/canceled;
- Orbis supersession/abandonment cases;
- technical containment evidence review.

Result: **no qualifying Product real-work case**.

Exclusions:

- PR close/supersession is not Agent process Cancel.
- GitHub Actions workflow cancellation/concurrency is not local Coding Agent Cancel.
- Technical hostile-process cancellation fixtures are deliberate Technical Validation and do not automatically count as Product real-work evidence.

Disposition: **prospective capture required**.

### TR-06 — local Prepare failure before valid Workspace exists

Candidates reviewed:

- GitHub Actions infra Issue #23;
- historical Hermes/Desktop cwd startup problem references;
- local IDE/JAVA_HOME setup errors.

Result: **no qualifying case**.

Exclusions:

- Issue #23 is a genuine pre-checkout, zero-step hosted-runner failure that recovered after private→public repository visibility change, but it occurred in GitHub-hosted remote execution rather than the current local-runner/local-Workspace MVP.
- Hermes/Desktop cwd history lacks a recoverable raw fact chain tying a specific real code problem to incorrect cwd, failed Workspace establishment and a successful retry.
- IntelliJ/JAVA_HOME errors are local tool/runtime failures, not Coding Agent Prepare/Workspace failures.

Disposition: **prospective local capture required**.

### TR-07 — real exploratory coding with no pre-existing Task

Candidates reviewed:

- `learn-claude-code` recent default-branch code commits;
- project learning conversations;
- prototype/experimental repositories.

Result: **no qualifying case**.

Exclusions:

- default-branch commits include upstream merges and do not establish user attribution plus a no-Task start condition;
- learning conversations alone are not code-changing real-work evidence;
- existing Orbis prototype PRs already contain explicit scoped objectives/acceptance conditions at the observable PR boundary.

Disposition: **prospective capture required**.

### TR-08 — cross-repository / out-of-boundary ownership

Candidates reviewed:

- `easy-yapi` upstream-sync work;
- fork/upstream repository relationships;
- external contribution PRs.

Result: **no qualifying case**.

Exclusion:

- `easy-yapi` sync references upstream `tangcent/easy-yapi`, but the actual engineering change/delivery is owned by the fork repository. Two remotes are not enough; the protocol requires one real objective whose change ownership genuinely crosses repository boundaries or exceeds the declared repository boundary.

Disposition: **prospective capture required**.

## Other remaining trajectories

### TR-01
No complete actual case proves success/acceptance followed by loss of the original local Workspace while the accepted package remains independently explainable.

### TR-02
Multiple real PRs contain failed Verification checkpoints, but no historical case proves the failed state itself was sealed as a reviewable package and then explicitly accepted/rejected under the candidate lifecycle.

### TR-05
No real Product work case establishes loss of process fact followed by `reconciliation_required` and safe/blocked ownership resolution. Technical reconciliation fixtures remain independent by default.

## Historical-search cutoff decision

Historical mining is now considered **saturated for the currently available sources**. Re-running broad searches without new source material is unlikely to produce higher-quality evidence and risks reinterpretation pressure.

Future count increases must come from one of:

1. a newly discovered raw historical source with a complete fact chain;
2. naturally occurring founder real code work captured prospectively;
3. external Concierge real problems where the trajectory naturally occurs.

Issue #37 owns prospective adverse-trajectory capture. Issue #38 owns entry of a real external P01 candidate.

## Counter discipline

Until a new fact pack passes strict review:

- actual trajectory count stays **1 / 6**;
- `TR-09` remains the only counted ID;
- Task Aggregation Final stays `NOT_RECORDED`;
- Product Validation Gate Final stays `NOT_RECORDED`;
- external participants/problems/reuse stay `0 / 3`, `0 / 5`, `0 / 2`;
- Product MVP WWA stays blocked.
