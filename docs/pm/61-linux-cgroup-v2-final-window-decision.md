# Linux cgroup-v2 final-window containment decision

> Status: **PASS within tested Linux `cgroup_v2` strong-profile scope**  
> Date: 2026-09-07  
> Parent validation: Issue #15 / TECH-XP-05  
> Prospective observer correction: Issue #47 / TECH-XP-05B  
> Delivery PR: #48  
> This decision is a Milestone 0 technical evidence decision, not a production-platform declaration.

## 1. Decision

The tested Linux ProcessKit 3.3.4 `cgroup_v2` profile is **PASS** for the frozen Milestone 0 hostile-containment cases when evaluated with the prospective final-window observer contract.

This decision is deliberately narrow:

```text
platform under test = Linux / Ubuntu 24.04 disposable delegated cgroup-v2 environment
ProcessKit = 3.3.4
actual mechanism = cgroup_v2
post-stop observation = 750 ms
sample interval = 50 ms
frozen hostile matrix = 4 cases × 50 seeds = 200 runs
verdict = PASS within tested strong-profile containment scope
```

It does **not** prove Linux owner-exit cleanup, resource-limit enforcement, every Linux distribution/kernel/cgroup delegation arrangement, or a global `managed` platform declaration. Issue #17 remains the independent owner-exit/race prerequisite.

## 2. Why a prospective observer correction was required

Earlier raw Linux cgroup-v2 runs preserved ProcessKit PID-liveness and union-style cgroup membership throughout the entire post-stop observation window. Those raw facts produced historical physical FAILs even though later investigation showed that Linux `/proc` could still expose the original PID as a zombie or a cgroup member transiently during bounded teardown/reaping.

Historical results remain immutable:

- run `33849770655`: raw 149 PASS / 51 FAIL;
- run `33852486665`: raw 147 PASS / 53 FAIL;
- diagnostic-head ordinary matrix `33854055599`: raw 149 PASS / 51 FAIL.

The correction does not edit those records. It adds parallel prospective truth:

```text
raw survivor_pids
raw members_after
members_observed_during_window
linux_truth_samples
final_members_after_window
final_active_original_pids
final_zombie_original_pids
final_reused_pids
linux_observer_inconclusive_pids
```

The frozen Milestone 0 protocol requires the post-stop observation window to complete before zero-survivor / zero-late-write judgment. Issue #12 likewise pre-registered a final survivor/membership snapshot after teardown. Therefore final-window process/resource truth is the prospective Gate input, while during-window transient facts remain auditable diagnostics.

Late writes are intentionally different: any late write at any point after the stop boundary remains a hard failure. Drain failure and teardown error also remain hard failures.

## 3. Diagnostic evidence

The synchronized detached-case diagnostic established the observer mismatch before any prospective verdict change.

Evidence head:

`b47a914c070ccc58a823ac7681f46fbf1e4ddbd3`

Workflow:

`33854055599`

Artifact:

- ID `9929615539`
- digest `sha256:c3b4e05c0a88aae453fd2d58e0351fd662afd746837093507743b70a0cfc4441`

For 50 repetitions of `root-exit-detached`, final 750 ms truth was:

```text
final ACTIVE_ORIGINAL = 0 / 50
final ZOMBIE_ORIGINAL = 0 / 50
final REUSED_PID = 0 / 50
final INCONCLUSIVE = 0 / 50
non-empty final cgroup membership = 0 / 50
cleanup incomplete = 0 / 50
```

During the window, zombie/original and occasional active/original observations remained visible. The diagnostic conclusion was:

**`FINAL_WINDOW_SAFE / TRANSIENT_ACTIVE_AND_ZOMBIE_OBSERVED / PROSPECTIVE_OBSERVER_CORRECTION_REQUIRED`**

## 4. TDD evidence for the prospective contract

### 4.1 Pure reducer RED → GREEN

Correct RED head:

`99d500c9b96ec352258f3142a9e138439ff67f93`

The RED intentionally required a non-existent `linux_observer` contract and was reproduced by cross-platform run `33857373811` as:

```text
E0432 unresolved import agentic_native_runner::linux_observer
```

The reducer then implemented the frozen separation:

```text
during-window ACTIVE/ZOMBIE/member -> diagnostic facts
final ACTIVE_ORIGINAL              -> executing-survivor Gate fact
final ZOMBIE_ORIGINAL              -> non-executing resource/reaping fact
final GONE                         -> not executing
final REUSED_PID/INCONCLUSIVE      -> fail closed
final membership                   -> resource Gate fact
```

Key contract:

```text
ACTIVE -> ZOMBIE -> final GONE
!= final executing survivor
```

Cross-platform run `33857852244` completed Windows / Ubuntu / macOS Rust tests, rustfmt, Clippy, build and doctor successfully.

### 4.2 Hostile integration RED → GREEN

Integration RED head:

`a3bbc45b4895622cff9a9cbd0e954eb7b4871878`

Run `33858074437` reproduced exactly the missing prospective fields as `E0026`, while the old raw summary fields remained present.

A one-shot verification workflow then applied the corrected large-file integration patch without risking an unverified whole-file overwrite.

Temporary GREEN-v2 workflow:

`33860072013`

All three verification jobs succeeded:

- Ubuntu 24.04 — format, Rust tests, Clippy PASS;
- macOS 15 — format, Rust tests, Clippy PASS;
- Windows Server 2025 — format, Rust tests, Clippy PASS.

The verified source artifact was then installed into the branch and the temporary delivery workflows removed. Installed code commit:

`41b3b8fec6458f4be6dee93bfb506c38414875cf`

## 5. Final prospective evidence

Evidence head used for final standard verification:

`e96c2e374d815bcddacb7484fbc570329f713c61`

### 5.1 Cross-platform quality gate

Run `34096634352`:

```text
Ubuntu 24.04        PASS
macOS 15            PASS
Windows Server 2025 PASS
```

On all three platforms the workflow completed Node contracts, Rust tests, rustfmt, Clippy, native build and doctor successfully.

### 5.2 Standard hostile regression

Run `34096634406`:

```text
Ubuntu 24.04        full frozen matrix + artifact upload PASS
macOS 15            full frozen matrix + artifact upload PASS
Windows Server 2025 full frozen matrix + artifact upload PASS
```

This verifies that the Linux prospective change does not break the existing Windows observer path or macOS compatible process-group evidence path.

### 5.3 Dedicated Linux cgroup-v2 matrix

Run:

`34096634351`

Artifact:

- ID `10009012117`
- digest `sha256:07256ea27edc7bae57bf6941d67f305802b22bacbfd43c9cfc5861e8c1f1d9f4`

Artifact is bound to exact head `e96c2e374d815bcddacb7484fbc570329f713c61`.

Matrix summary:

```text
run_count = 200
harness = 200 PASS / 0 FAIL
actual mechanisms = [cgroup_v2]
prospective physical = 200 PASS / 0 FAIL / 0 INCONCLUSIVE
```

Per-case prospective results:

```text
tree-hang-cancel           50 PASS / 0 FAIL
tree-hang-timeout          50 PASS / 0 FAIL
root-exit-detached-cancel  50 PASS / 0 FAIL
late-output-hang-cancel    50 PASS / 0 FAIL
```

Gate-relevant audit across all 200 runs:

```text
non-empty final_active_original_pids      = 0 / 200
non-empty final_members_after_window      = 0 / 200
non-empty final_reused_pids               = 0 / 200
non-empty linux_observer_inconclusive     = 0 / 200
observed_late_write                       = 0 / 200
stdout not drained                        = 0 / 200
stderr not drained                        = 0 / 200
teardown_error                            = 0 / 200
observer incomplete                       = 0 / 200
control parse incomplete                  = 0 / 200
observation window incomplete             = 0 / 200
cleanup failed                            = 0 / 200
observation_errors non-empty              = 0 / 200
cleanup_errors non-empty                  = 0 / 200
```

Every fixture PID had a final Linux truth sample:

```text
150 three-process runs -> 3 / 3 final samples each
50 single-process runs -> 1 / 1 final sample each
missing final PID truth = 0
```

Historical/raw disagreement remains visible rather than erased:

```text
raw survivor_pids non-empty       = 50 / 200
raw members_after non-empty       = 48 / 200
members observed during window    = 48 / 200
```

All 50 raw-survivor observations occurred in `root-exit-detached-cancel`. That case still produced:

```text
raw survivor non-empty = 50 / 50
raw union membership non-empty = 48 / 50
final active non-empty = 0 / 50
final membership non-empty = 0 / 50
prospective verdict = 50 / 50 PASS
```

This is the intended evidence shape: transient/raw ProcessKit facts remain auditable while the completed observation-window snapshot determines prospective containment truth.

The same final artifact's independent 50-run diagnostic again showed bounded transient activity:

```text
any ACTIVE_ORIGINAL during window = 5 / 50
any ZOMBIE_ORIGINAL during window = 50 / 50
final ACTIVE_ORIGINAL = 0 / 50
final ZOMBIE_ORIGINAL = 0 / 50
final non-empty membership = 0 / 50
final reused/inconclusive = 0 / 50
cleanup incomplete = 0 / 50
```

The changed transient-active frequency compared with the earlier diagnostic is not averaged or hidden; it is retained as timing-sensitive diagnostic evidence. It does not represent a final survivor because every frozen final snapshot remained safe.

## 6. Final verdict

### TECH-XP-05B / Issue #47

**PASS — prospective Linux final-window observer contract is validated.**

The observer preserves raw disagreement facts, uses synchronized reuse-safe Linux `/proc` truth, has complete final snapshots, and fails closed on reuse/inconclusive truth.

### TECH-XP-05 / Issue #15

**PASS — tested Linux `cgroup_v2` strong-profile hostile containment satisfies the frozen scope.**

No failed repetition was averaged away: the prospective matrix is 200/200 PASS.

## 7. Non-implications

This decision does **not** imply:

- Linux owner-exit cleanup PASS — Issue #17 R-07 remains independent;
- cgroup resource-limit enforcement;
- every Linux host or delegation configuration is supported;
- macOS becomes managed — it remains `process_group / compatible`;
- ProcessKit is frozen as a production dependency;
- Spike 1 is PASS — Issue #17 physical races remain;
- Technical Gate is PASS — real Codex Spike 2 and other mandatory decisions remain;
- Product Gate or Product MVP WWA changes in any way.
