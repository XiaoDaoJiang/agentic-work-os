# Windows physical observer contract fix — TECH-XP-04B

## Goal

Apply the TECH-XP-04 `OBSERVER_MISMATCH` finding prospectively so future Windows hostile evidence distinguishes an executing original process from a terminated-but-still-queryable process object.

Historical hostile artifacts and verdicts are immutable.

## Frozen rule

For an anchored original PID identity on Windows:

1. capture Job membership;
2. capture reuse-safe Win32 process identity and active/exited truth;
3. keep ProcessKit liveness as diagnostic evidence;
4. classify an executing survivor only when Win32 truth is `ACTIVE_ORIGINAL` after the relevant stop boundary;
5. treat `TERMINATED_ORIGINAL` or `GONE` as not executing, even if ProcessKit liveness transiently returns true;
6. `REUSED_PID`, access failure, identity conflict, or contradictory facts remain fail-closed / `INCONCLUSIVE`.

## TDD order

1. RED: Windows physical-verdict test where ProcessKit says alive, Job is empty, Win32 says `TERMINATED_ORIGINAL`; future verdict must not be survivor FAIL.
2. RED: Win32 `ACTIVE_ORIGINAL` outside an empty Job remains hard survivor FAIL.
3. RED: `REUSED_PID` / `INCONCLUSIVE` cannot become PASS.
4. GREEN: introduce a narrow Windows observer reducer; do not rewrite `process_is_alive` globally.
5. Integrate reducer into future hostile physical evidence while preserving raw ProcessKit/Job/Win32 facts.
6. Re-run frozen 4-case × 50-seed Windows matrix.
7. Confirm historical artifacts and TECH-XP-03 verdicts are untouched.

## Gate consequence

Passing this change only resolves the Windows observer semantics needed for Spike 1. It does not by itself make Spike 1 or the Technical Gate PASS; Linux/macOS containment semantics and RuntimeReceipt ownership/reconciliation evidence remain independent prerequisites.
