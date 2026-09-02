# Windows Job Observer Diagnostic — TECH-XP-04

Status: **OBSERVER_MISMATCH**

This record closes the diagnostic question in Issue #14. It does **not** rewrite any historical hostile verdict, declare Windows managed, make Spike 1 PASS, or change the Technical Gate.

## Frozen historical evidence

- historical hostile head: `c8d011c5c6fccc71a0a389039ec2048adf6805eb`
- historical run: `33491181220`
- historical Windows artifact: `9794040383`
- mechanism: `job_object`
- historical verdicts: 106 PASS / 94 FAIL
- all 94 historical FAIL verdicts remain immutable

## Fresh synchronized diagnostic evidence

Evidence-producing head: `55dc3a0cc65095e276a47bd98d637f4a33509fe6`

Fresh runs:
- cross-platform runtime `33613520917`: Windows/Linux/macOS quality gates PASS
- hostile containment `33613520929`: Windows/Linux/macOS quality gates, matrix, and evidence upload PASS
- Windows artifact `9840150805`
- digest `sha256:1ad07c201d2931ae74e87b5e9ad7cea0a9d3b9ef0e0ed3d1f314ee63e4cbc5a3`

Fresh Windows matrix: 200/200 harness PASS; 123 physical PASS; 77 physical FAIL; 0 INCONCLUSIVE; mechanism `job_object`.

FAIL clusters: `root-exit-detached-cancel` 50/50, `tree-hang-cancel` 13/50, `tree-hang-timeout` 14/50, `late-output-hang-cancel` 0/50.

## Same-tick truth correlation

The diagnostic records repeated observation-window samples. Each PID sample captures Win32 truth immediately before ProcessKit liveness, then ProcessKit liveness + Job membership, then Win32 truth again.

Exactly 77 samples satisfy `ProcessKit alive=true` and `Job membership=false`. They correlate one-to-one with all 77 fresh physical FAIL runs and their reported `survivor_pids`.

For all 77 disagreement samples, Win32 truth captured **before** ProcessKit is `TERMINATED_ORIGINAL`: 77/77 terminated; 0 active; 0 reused; 0 inconclusive. After ProcessKit, 49 remain `TERMINATED_ORIGINAL` and 28 are already `GONE`. Every disagreement is at observation sample index 0; later ticks see the original process gone/not alive.

## Conclusion

**TECH-XP-04 = OBSERVER_MISMATCH.**

No synchronized sample shows an `ACTIVE_ORIGINAL` process outside an empty Job. ProcessKit PID-liveness can report `true` for an original Windows process object that independent Win32 exit/wait truth already proves terminated.

The historical 94 FAILs remain immutable under the old observer contract, but they are not evidence of a Windows Job Object containment failure.

## Prospective consequence

For future Windows physical-observer decisions, Job membership remains an independent containment fact; ProcessKit liveness is diagnostic but not sufficient to prove an executing survivor; reuse-safe Win32 process identity + exit/wait state is authoritative for active/exited original-PID truth. `ACTIVE_ORIGINAL` outside the Job is a real survivor; `TERMINATED_ORIGINAL`/`GONE` with ProcessKit alive=true is observer mismatch; unavailable or conflicting identity truth remains fail-closed / INCONCLUSIVE.

A separate prospective observer-contract change must implement and re-run this rule. This diagnostic alone does not make Spike 1 PASS.
