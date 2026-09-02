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

Candidate head: `55dc3a0cc65095e276a47bd98d637f4a33509fe6`

Fresh runs:

- cross-platform runtime: `33613520917` — Windows/Linux/macOS quality gates PASS
- hostile containment: `33613520929` — Windows/Linux/macOS harness and matrix steps PASS
- Windows artifact: `9840150805`
- artifact digest: `sha256:1ad07c201d2931ae74e87b5e9ad7cea0a9d3b9ef0e0ed3d1f314ee63e4cbc5a3`

Fresh Windows matrix:

- 200 / 200 harness executions PASS
- 123 physical PASS
- 77 physical FAIL
- 0 physical INCONCLUSIVE
- mechanism: `job_object`

FAIL clusters:

- `root-exit-detached-cancel`: 50 / 50 FAIL
- `tree-hang-cancel`: 13 / 50 FAIL
- `tree-hang-timeout`: 14 / 50 FAIL
- `late-output-hang-cancel`: 0 / 50 FAIL

## Same-tick truth correlation

The diagnostic records repeated observation-window samples. For each PID it captures Win32 truth immediately before ProcessKit liveness, then ProcessKit liveness, Job membership, and Win32 truth again.

Across the fresh matrix there are exactly **77** samples satisfying:

```text
ProcessKit alive = true
Job membership   = false
```

All 77 correlate one-to-one with the 77 physical FAIL runs and the reported `survivor_pids`.

For all 77 disagreement samples, the independent Win32 verdict captured **before** the ProcessKit liveness call is:

```text
TERMINATED_ORIGINAL
```

There are:

- 77 / 77 `TERMINATED_ORIGINAL` before ProcessKit
- 0 `ACTIVE_ORIGINAL`
- 0 `REUSED_PID`
- 0 `INCONCLUSIVE`

After the ProcessKit liveness call:

- 49 remain `TERMINATED_ORIGINAL`
- 28 have already become `GONE`

Every disagreement occurred at observation sample index `0`; later ticks observe the processes as gone/not alive.

## Conclusion

**TECH-XP-04 = OBSERVER_MISMATCH.**

The fresh evidence does not show an executing original process outside an empty Windows Job. It shows ProcessKit PID-liveness reporting `true` for an original process that Win32 process-handle truth already classifies as terminated.

Therefore the historical Windows hostile FAILs remain valid historical evidence under the old observer contract, but they must not be interpreted as proof that Windows Job Object containment failed.

## Prospective consequence

For future Windows physical-observer decisions:

- Job membership remains an independent containment fact.
- ProcessKit liveness remains diagnostic input but is not sufficient to prove an executing survivor.
- Reuse-safe Win32 process identity + exit/wait state is the authoritative active/exited truth for the original PID identity.
- `ACTIVE_ORIGINAL` outside the Job is a real survivor.
- `TERMINATED_ORIGINAL` / `GONE` with ProcessKit `alive=true` is observer mismatch, not an executing survivor.
- identity conflict or unavailable truth remains fail-closed / INCONCLUSIVE.

A separate prospective observer-contract change must implement and re-run this rule. This diagnostic alone does not make Spike 1 PASS.
