# Linux cgroup-v2 active-state diagnostic

> Status: `DIAGNOSTIC_COMPLETE / PROSPECTIVE_CORRECTION_REQUIRED`  
> Date: 2026-09-04  
> Scope: Issue #15 / PR #46 only  
> This note does **not** close Issue #15 and does not declare Spike 1 or the Technical Gate PASS.

## Why this diagnostic exists

The frozen Linux `cgroup_v2` hostile matrix repeatedly reported raw `survivor_pids` and non-empty `members_after` even though stdout/stderr were drained, no late writes or teardown errors occurred, and later cleanup succeeded.

The existing Linux PID observer uses ProcessKit `process_is_alive(pid, start_time)`. That is reuse-safe for process identity, but a matching `/proc/<pid>/stat` entry in state `Z` still counts as the same existing process instance. Therefore raw ProcessKit liveness alone cannot distinguish an actively executing original process from a zombie awaiting reap.

The frozen Milestone 0 protocol requires the configured post-stop observation window to complete before `zero survivor / zero late write` is judged. Issue #12 likewise pre-registered a final `survivor/membership snapshot after teardown`; it did not require the cgroup to be empty at every instantaneous sample immediately after `kill_all()` returns.

Historical raw verdicts remain immutable.

## Frozen raw history

### Run 1 — 33849471804

`HARNESS_ERROR_AFTER_VALID_PREFLIGHT`.

Artifact `9927795514`, digest:

`sha256:6e898602d2a5043eafce02a1a36bbe0acc43e09022a92d14539bbe93f035dfa4`

The real preflight proved writable cgroup v2 and `actual_mechanism=cgroup_v2` before a shell/heredoc harness bug stopped execution.

### Run 2 — 33849770655

Artifact `9928008439`, digest:

`sha256:2754e73a2fe5c69c74acb93dcbcc1744acec25a248030cdd269dcdde03538ac3`

```text
run_count = 200
harness = 200 PASS / 0 FAIL
actual_mechanisms = [cgroup_v2]
raw physical = 149 PASS / 51 FAIL / 0 INCONCLUSIVE
```

Run 2 had no container init/subreaper, so orphan-zombie reaping was an explicit environment confounder.

### Run 3 — 33852486665

Artifact `9928999000`, digest:

`sha256:f1e4110b28e454b4b5c9baa30b0ca7d6b8bfb45cb2e5a4e606d4bf66f4247542`

The only environment correction was `docker run --init`.

```text
run_count = 200
harness = 200 PASS / 0 FAIL
actual_mechanisms = [cgroup_v2]
raw physical = 147 PASS / 53 FAIL / 0 INCONCLUSIVE
```

The subreaper did not eliminate the raw failures, so a stronger process-state observer was required.

## Linux process-truth contract

The prospective truth source is `/proc/<pid>/stat`, anchored to the same ProcessKit `start_time()` identity already captured by the hostile harness.

Classification:

```text
ACTIVE_ORIGINAL
  same start-time identity
  state != Z

ZOMBIE_ORIGINAL
  same start-time identity
  state == Z

GONE
  /proc entry missing

REUSED_PID
  PID exists but start-time identity differs

INCONCLUSIVE
  stat read/parse/identity unavailable or contradictory
```

A live Linux CI contract test also proved ProcessKit `process_info(pid).start_time()` is directly comparable with `/proc/<pid>/stat` field 22 for the same process.

## Synchronized detached-case characterization

Evidence-producing head before the later formatting-only commit:

`b47a914c070ccc58a823ac7681f46fbf1e4ddbd3`

Dedicated workflow:

`33854055599`

Artifact:

- ID `9929615539`
- digest `sha256:c3b4e05c0a88aae453fd2d58e0351fd662afd746837093507743b70a0cfc4441`

The diagnostic reused the exact `root-exit-detached` hostile fixture, real ProcessKit `cgroup_v2`, seeds `0..49`, `trigger_ms=250`, `post_stop_ms=750`, and `sample_ms=50`.

### Final-window result

Across all 50 repetitions, at the end of the 750 ms observation window:

```text
ACTIVE_ORIGINAL final          = 0 / 50 runs
ZOMBIE_ORIGINAL final          = 0 / 50 runs
REUSED_PID final               = 0 / 50 runs
INCONCLUSIVE final             = 0 / 50 runs
non-empty final cgroup members = 0 / 50 runs
cleanup incomplete             = 0 / 50 runs
```

### During-window diagnostic facts

```text
any ZOMBIE_ORIGINAL observed after kill = 50 / 50 runs
any ACTIVE_ORIGINAL observed after kill = 2 / 50 runs
```

The two active observations occurred only in the first post-`kill_all()` sample at approximately 0 ms, while those original processes were still cgroup members. By the later samples and by the final 750 ms snapshot they were gone.

This is evidence of **bounded teardown latency**, not evidence that an original descendant remains executing through the frozen post-stop window.

## Same-head frozen matrix

The ordinary frozen matrix also ran successfully on `b47a914c...` without changing its historical evaluator:

```text
run_count = 200
harness = PASS
actual_mechanisms = [cgroup_v2]
raw physical = 149 PASS / 51 FAIL / 0 INCONCLUSIVE
```

By case:

```text
late-output-hang + cancel     50 PASS
root-exit-detached + cancel   49 FAIL / 1 PASS
tree-hang + cancel            49 PASS / 1 FAIL
tree-hang + timeout           49 PASS / 1 FAIL
```

The raw matrix remains evidence. It is not rewritten by this diagnostic.

## Diagnostic conclusion

**`FINAL_WINDOW_SAFE / TRANSIENT_ACTIVE_AND_ZOMBIE_OBSERVED / PROSPECTIVE_OBSERVER_CORRECTION_REQUIRED`**

The evidence does not support calling the detached cgroup-v2 case a persistent executing-survivor failure through the end of the observation window. It also does not authorize converting the old raw FAILs into PASS.

The current hostile implementation accumulates every cgroup member observed at any point during the 750 ms window into `members_after`, and similarly retains any raw ProcessKit liveness observation as a survivor. That representation is stricter than the frozen protocol's final post-stop snapshot semantics and conflates bounded teardown/reaping latency with final unsafe resource state.

## Required prospective consequence

Use the same governance pattern as TECH-XP-04 / TECH-XP-04B on Windows:

1. preserve all historical `survivor_pids`, membership observations and physical verdicts;
2. preserve a separate `members_observed_during_window` / equivalent diagnostic fact;
3. record `final_members_after_window` explicitly;
4. collect synchronized Linux active-state truth using reuse-safe identity;
5. Gate-level survivor truth must use final active-state truth after the frozen window;
6. `REUSED_PID` or `INCONCLUSIVE` fails closed;
7. any late write during the observation window remains an immediate hard failure;
8. drain failure or teardown error remains a hard failure;
9. do not weaken owner-exit semantics: Linux cgroup owner death remains Issue #17 R-07.

The prospective consequence should be implemented as a separate follow-up increment before Issue #15 can receive its final `PASS | FAIL | INCONCLUSIVE` verdict.

## Non-claims

- Historical hosted-Ubuntu `process_group` evidence is unchanged.
- Historical cgroup-v2 raw FAIL verdicts are unchanged.
- No resource-limit guarantee is established.
- No `owner_exit_cleanup` guarantee is established.
- Linux is not globally declared `managed` by this diagnostic.
- No real Codex or user repository was executed.
- Spike 1 and the Technical Gate remain unresolved.
