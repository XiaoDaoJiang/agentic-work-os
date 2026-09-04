# Prospective Real-Work Fact Pack — PF01 / TECH-XP-05 / PR #36

> Classification: **PROSPECTIVE_CAPTURE_COMPLETE / NON_COUNTING_TDD_EXAMPLE**  
> Initial capture: 2026-09-03 15:52 +08:00  
> Closed observation: 2026-09-04  
> Product Validation counter effect: **none**  
> Trajectory outcome: **NO TR CREDIT**

## 1. Real work identity

- Repository: `XiaoDaoJiang/agentic-work-os`
- Technical issue: `#20 TECH-XP-05: validate RuntimeReceipt ownership and startup reconciliation`
- Pull request: `#36 test(m0): continue RuntimeReceipt ownership on current aggregate`
- Base branch: `spike/milestone-0-harness`
- Base SHA at initial PR snapshot: `76f7d0efecc6f630020d8c54206d5523f3bad7be`
- Head branch: `spike/runtime-receipt-ownership-v2`
- Initial RED head: `930a71fd36fdc29ef7835b9c387339d8643b1afa`
- Follow-up GREEN head: `f8765ca54d88b93f314a3481831496b66226e046`
- PR created: 2026-09-03T06:23:57Z
- PR state at close of this observation: open, non-Draft, mergeable, not merged

This work predates this Product Validation capture and exists independently as active Milestone 0 technical work.

## 2. Objective / DoD owner

Issue #20 and `docs/superpowers/plans/2026-09-03-runtime-receipt-ownership-v2.md` own one coherent objective:

> Validate the minimum RuntimeReceipt ownership/reconciliation contract required for a trustworthy local Run without introducing a persistent Runtime daemon.

The v2 plan explicitly contains the same TECH-XP-05 increments:

- completed pure contract: OWN-01 / OWN-07 / OWN-08;
- OWN-03 root exits before descendants;
- OWN-04 duplicate Cancel;
- OWN-05 owner/helper crash + startup reconciliation;
- OWN-06 stale receipt / process gone;
- OWN-09 cleanup cannot rewrite failure;
- receipt publication / immutability;
- fresh Windows / Ubuntu / macOS quality gates at every GREEN increment.

Allowed technical exit remains PASS / FAIL / INCONCLUSIVE for Issue #20; this Product observation does not reinterpret the Technical Gate.

## 3. Scope classification

PR #36's prose summary became stale as implementation advanced, but the v2 plan already authorized the later OWN increments under the same TECH-XP-05 objective.

Therefore this observation does **not** establish TR-08 or a model break. Stale PR prose is not equivalent to cross-repository or out-of-boundary change ownership.

## 4. Baseline before RED

Base SHA `76f7d0e...` had fresh successful workflow evidence:

- `M0 cross-platform runtime` run `33722604647`: success;
- `M0 containment provider eval` run `33722604701`: success;
- `M0 ProcessKit hostile containment` run `33722604678`: success.

The later RED was therefore not inherited from a red base.

## 5. RED checkpoint — real development failure

Head `930a71fd...` triggered:

- `33725124815` — `M0 cross-platform runtime`: **failure**;
- `33725124838` — `M0 ProcessKit hostile containment`: **failure**.

Both failed consistently on Windows, Ubuntu and macOS at the Rust-test gate after runner allocation, checkout, toolchain setup, Node contracts and Cargo-lock validation succeeded.

Windows job `100552299070` recorded:

```text
error[E0432]: unresolved import `agentic_native_runner::runtime_failure_ledger`
 --> tests/runtime_failure_ledger.rs:1:28
 could not find `runtime_failure_ledger` in `agentic_native_runner`

error: could not compile `agentic-native-runner`
(test "runtime_failure_ledger") due to 1 previous error
```

`tests/runtime_failure_ledger.rs` was a new OWN-09-oriented contract against a production module that did not yet exist.

Initial interpretation:

```text
VerificationEvent = FAILED
failure_class = EXPECTED_TDD_RED_CANDIDATE
infrastructure_failure = false
base_regression = false
```

## 6. Natural continuation — RED → GREEN

The same PR continued implementation naturally rather than sealing the failed checkpoint for Review.

Later head:

`f8765ca54d88b93f314a3481831496b66226e046`

Fresh workflows:

- `33734111011` — `M0 cross-platform runtime`: **success**;
- `33734110963` — `M0 ProcessKit hostile containment`: **success**.

Cross-platform runtime run `33734111011` completed successfully on Windows, Ubuntu and macOS through:

- Rust tests;
- rustfmt;
- Clippy;
- native runner build;
- native runner doctor;
- evidence uploads.

Hostile run `33734110963` completed successfully on all three platforms through:

- Rust tests;
- rustfmt;
- Clippy;
- release hostile probe build;
- frozen ProcessKit hostile race matrix;
- raw evidence upload.

At the GREEN observation point, PR #36 still had no PR discussion/review comments and no recorded Review Accept/Reject.

## 7. Why PF01 is not TR-02

Protocol TR-02 requires:

```text
Verification failed / error
→ evidence-safe seal
→ Review Accept or Reject
```

PF01 instead observed:

```text
real engineering objective
→ baseline GREEN
→ intentional development RED checkpoint
→ continued implementation in the same ongoing work
→ GREEN checkpoint
→ no ReviewDecision on the RED state
```

The failed checkpoint was not intentionally sealed as a reviewable failed attempt/package. It was a normal TDD development checkpoint.

Therefore:

- TR-02 credit: **0**;
- TR-03 credit: **0**;
- TR-04 credit: **0**;
- TR-05 credit: **0**;
- TR-06 credit: **0**;
- TR-07 credit: **0**;
- TR-08 credit: **0**.

Product actual trajectory coverage remains **1/6, `TR-09` only**.

## 8. Product-learning result

PF01 provides prospective evidence for an **observation/encoding boundary**, not for a missing adverse trajectory:

> A failed test/CI/TDD checkpoint inside active implementation must not automatically become the Run's unique coordinator VerificationInvocation, a new Run, a sealed Change Package or a Review Gate.

This result is recorded in:

`experiments/product-validation/execution-interpretations/01-verification-boundary.md`

The existing frozen rule remains unchanged: when the actual coordinator-owned gate `VerificationInvocation` after Agent yield returns `failed` or `error`, and evidence/resource seal conditions are satisfied, that failed gate remains reviewable.

## 9. Run / Session / Workspace evidence boundary

Unknown throughout PF01:

- native Coding Agent Run identity;
- local Coding Agent Session identity;
- local Workspace ID/path used to create commits;
- local terminal transcript;
- Coding Agent process-tree identity.

These are not inferred from GitHub Actions.

## 10. Closure

PF01 is closed as a **non-counting prospective TDD example**.

It should not be reopened merely because PR #36 later merges. A later independent event such as explicit Review Reject, active Agent Cancel, local Prepare failure, real process-fact reconciliation, or cross-repository boundary crossing must be captured as its own event/fact pack if it naturally occurs.

Current Product Gate counters remain unchanged:

- actual trajectories: **1 / 6**;
- actual IDs: `TR-09`;
- external participants: **0 / 3**;
- external real problems: **0 / 5**;
- qualifying reuse users: **0 / 2**.
