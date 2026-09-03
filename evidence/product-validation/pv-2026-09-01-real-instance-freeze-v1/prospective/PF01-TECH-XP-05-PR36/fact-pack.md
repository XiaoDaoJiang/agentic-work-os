# Prospective Real-Work Fact Pack — PF01 / TECH-XP-05 / PR #36

> Classification: **PROSPECTIVE_CAPTURE / NOT_YET_A_TRAJECTORY**  
> Capture date: 2026-09-03 15:52 +08:00  
> Product Validation counter effect: **none**  
> Current candidate watch: `TR-02` only; no TR is counted from this file.

## 1. Real work identity

- Repository: `XiaoDaoJiang/agentic-work-os`
- Technical issue: `#20 TECH-XP-05: validate RuntimeReceipt ownership and startup reconciliation`
- Pull request: `#36 test(m0): continue RuntimeReceipt ownership on current aggregate`
- Base branch: `spike/milestone-0-harness`
- Base SHA at PR snapshot: `76f7d0efecc6f630020d8c54206d5523f3bad7be`
- Head branch: `spike/runtime-receipt-ownership-v2`
- Head SHA at capture: `930a71fd36fdc29ef7835b9c387339d8643b1afa`
- PR created: 2026-09-03T06:23:57Z
- PR state at capture: open, non-Draft, mergeable, not merged

This work predates this Product Validation capture and exists independently as active Milestone 0 technical work.

## 2. Objective / DoD owner

Issue #20 and the v2 implementation plan own the objective.

Goal:

> Validate the minimum RuntimeReceipt ownership/reconciliation contract required for a trustworthy local Run without introducing a persistent Runtime daemon.

The v2 plan keeps one coherent TECH-XP-05 objective and advances explicit OWN increments:

- completed pure contract: OWN-01 / OWN-07 / OWN-08;
- next A: OWN-03 root exits before descendants;
- next B: OWN-04 duplicate Cancel;
- next C: OWN-05 owner/helper crash + startup reconciliation;
- next D: OWN-06 stale receipt / process gone;
- next E: OWN-09 cleanup cannot rewrite failure;
- receipt publication / immutability;
- fresh Windows / Ubuntu / macOS quality gates at every GREEN increment.

Allowed technical exit is PASS / FAIL / INCONCLUSIVE for Issue #20, and Issue #20 alone cannot PASS Spike 1 or the Technical Gate.

## 3. Scope facts

The current PR description is stale relative to the latest branch contents: it still emphasizes the initial pure-contract port, while the branch has continued into later OWN increments.

Current changed-file set includes 12 files:

- `docs/superpowers/plans/2026-09-03-runtime-receipt-ownership-v2.md`
- `experiments/milestone-0/native-runner/Cargo.lock`
- `experiments/milestone-0/native-runner/Cargo.toml`
- `experiments/milestone-0/native-runner/src/lib.rs`
- `experiments/milestone-0/native-runner/src/runtime_receipt.rs`
- `experiments/milestone-0/native-runner/src/runtime_receipt_publication.rs`
- `experiments/milestone-0/native-runner/src/runtime_reconciliation.rs`
- `experiments/milestone-0/native-runner/tests/runtime_failure_ledger.rs`
- `experiments/milestone-0/native-runner/tests/runtime_receipt.rs`
- `experiments/milestone-0/native-runner/tests/runtime_receipt_publication.rs`
- `experiments/milestone-0/native-runner/tests/runtime_reconciliation.rs`
- `experiments/milestone-0/native-runner/tests/runtime_startup_reconciliation.rs`

This is **not** currently classified as TR-08 or model break. The v2 plan explicitly places publication/reconciliation/OWN-09 work inside the same TECH-XP-05 objective. The mismatch is a stale PR summary, not proven cross-repository or out-of-boundary change ownership.

## 4. Baseline verification before current head

The PR base SHA `76f7d0e...` had fresh successful workflow evidence:

- `M0 cross-platform runtime` run `33722604647`: success;
- `M0 containment provider eval` run `33722604701`: success;
- `M0 ProcessKit hostile containment` run `33722604678`: success.

Therefore the current failure is not inherited from a red base commit.

## 5. Current head verification state

Head `930a71fd...` triggered two PR workflow runs:

- `33725124815` — `M0 cross-platform runtime`: **failure**;
- `33725124838` — `M0 ProcessKit hostile containment`: **failure**.

Both failures reproduce on Windows, Ubuntu and macOS.

For `33725124815`, all of the following passed before the failure on all three platforms:

- runner allocation and setup;
- repository checkout;
- Node 22.16.0 setup;
- Rust 1.88.0 setup;
- pinned ProcessKit check;
- Node contract tests;
- Node syntax check;
- Cargo lock validation.

The failing step is `Run Rust tests`.

Windows job `100552299070` records the exact compile failure:

```text
error[E0432]: unresolved import `agentic_native_runner::runtime_failure_ledger`
 --> tests/runtime_failure_ledger.rs:1:28
 could not find `runtime_failure_ledger` in `agentic_native_runner`

error: could not compile `agentic-native-runner`
(test "runtime_failure_ledger") due to 1 previous error
```

The hostile workflow fails at the same Rust-test gate before running the physical hostile race matrix.

## 6. Failure interpretation at capture time

This is currently classified as:

```text
VerificationEvent = FAILED
failure_class = EXPECTED_TDD_RED_CANDIDATE
infrastructure_failure = false
base_regression = false
final_task_failure = unknown
```

Why:

- base workflow evidence is GREEN;
- new `tests/runtime_failure_ledger.rs` explicitly imports a production module that does not yet exist;
- the test contract is OWN-09-oriented and asserts that historical physical failures remain immutable across cleanup/reconciliation;
- the v2 plan explicitly requires RED-first for new increments.

No claim is made that the task itself has failed. The observed fact is that the current implementation checkpoint is RED.

## 7. Review / decision facts

At capture time:

- submitted PR discussion/comments: none;
- Review Reject: not observed;
- Review Accept: not observed;
- merge: not observed;
- explicit user decision on this RED checkpoint: not recorded;
- follow-up GREEN after this RED: not yet recorded in this fact pack.

Therefore this does **not** satisfy TR-02 yet.

Protocol TR-02 requires a failed Verification state to become an evidence-safe sealed package and reach an actual Review Accept/Reject decision. A normal TDD RED followed immediately by implementation is not enough.

## 8. Candidate trajectory watch

### TR-02 watch

Current observed prefix:

```text
real task
→ baseline GREEN
→ new implementation/test increment
→ Verification FAILED with explicit evidence
```

Still required before TR-02 could be counted:

```text
→ failed state intentionally sealed as a reviewable attempt/package
→ ReviewDecision Accept or Reject
```

If implementation simply continues RED→GREEN without a review boundary, this case remains ordinary TDD and contributes **0** trajectory IDs.

### Other TRs

- TR-03: no Review Reject yet.
- TR-04: no active Agent Cancel event.
- TR-05: no real process-fact-loss/reconciliation event in Product work.
- TR-06: no local Prepare failure before Workspace.
- TR-07: this work has a pre-existing Issue/plan objective; not no-Task exploration.
- TR-08: no proven cross-repo/out-of-boundary ownership.
- TR-09: unrelated; already covered by S01.

## 9. Run / Session / Workspace evidence boundary

This prospective fact pack is derived from repository/CI facts for ongoing real engineering work.

Unknown at capture time:

- native Coding Agent Run identity;
- local Coding Agent Session identity;
- local Workspace ID/path used to create the commits;
- local terminal transcript;
- process-tree identity for the coding session.

Do not infer those from GitHub Actions jobs.

## 10. Next capture event

Update this fact pack only when a new real event occurs, such as:

- a GREEN implementation checkpoint after the current RED;
- explicit human/research Review Accept or Reject of a sealed failed attempt;
- active Agent Cancel;
- startup/process reconciliation during real work;
- local Workspace/Prepare failure;
- scope ownership change.

Until then:

- Product actual trajectory count remains **1 / 6**;
- counted ID remains `TR-09` only;
- PF01 is prospective evidence, not Gate success evidence.
