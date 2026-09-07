# Linux final-window observer integration — prospective evidence note

> Scope: TECH-XP-05B / Issue #47 / PR #48  
> Status: implementation installed; fresh standard verification pending  
> Historical hostile evidence remains immutable.

## Purpose

Record the prospective Linux hostile-observer integration boundary without rewriting any earlier `survivor_pids`, `members_after`, or `physical_verdict` evidence.

The prospective model keeps raw and Gate-relevant facts separate:

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

For Linux only, the prospective physical evaluator consumes the final-window truth:

- final `ACTIVE_ORIGINAL` => executing-survivor failure;
- final non-empty cgroup membership => unsafe resource state;
- final reused/inconclusive truth => fail closed through observer completeness;
- final `GONE` => not an executing survivor;
- transient active/zombie/member observations remain diagnostics and do not overwrite the final snapshot;
- any late write, drain failure or teardown error remains unchanged as a hard failure condition.

Cleanup continues to use the raw historical `survivor_pids` defensively; cleanup success cannot rewrite a prior failure fact.

## TDD / verification chain

### Pure reducer

The final-window reducer contract was introduced RED-first and then implemented prospectively. The frozen behavior includes:

```text
ACTIVE -> ZOMBIE -> final GONE
!= final executing survivor
```

Cross-platform runtime run `33857852244` verified Windows / Ubuntu / macOS tests, rustfmt, Clippy, build and doctor successfully before hostile integration began.

### Hostile integration RED

Run `33858074437` reproduced the expected integration RED on Ubuntu:

```text
E0026: HostileProbeSummary does not have fields
members_observed_during_window
final_members_after_window
linux_truth_samples
final_active_original_pids
final_zombie_original_pids
final_reused_pids
linux_observer_inconclusive_pids
```

The old raw fields remained present.

### Verified prospective integration

Temporary workflow `Temporary M0 Linux observer GREEN v2`, run `33860072013`, applied the corrected integration patch to the same branch source and verified it independently on:

- Ubuntu 24.04 — Rust tests PASS, rustfmt PASS, Clippy PASS;
- macOS 15 — Rust tests PASS, rustfmt PASS, Clippy PASS;
- Windows Server 2025 — Rust tests PASS, rustfmt PASS, Clippy PASS.

After all three verification jobs succeeded, its `Commit GREEN v2` job downloaded the verified Ubuntu source artifact, installed that exact `hostile_probe.rs`, removed both one-shot workflows, formatted the source and pushed commit:

`41b3b8fec6458f4be6dee93bfb506c38414875cf`

Commit message:

`test(m0): integrate Linux final-window observer`

The one-shot workflow was delivery scaffolding only and is intentionally absent from the final PR tree.

## Current implementation boundary

The installed `HostileProbeSummary` now exposes both historical raw facts and prospective Linux final-window facts.

The observation loop still preserves the historical union-style raw `members_after` and raw ProcessKit `survivor_pids`. Separately, it records synchronized Linux truth samples during the frozen 750 ms window and performs a distinct final snapshot after the window completes.

On Linux, only `final_active_original_pids` and `final_members_after_window` are projected into the prospective `HostileEvidence` survivor/resource fields used by the physical evaluator. On Windows, the existing Win32 observer path remains unchanged; on macOS, the existing raw process-group behavior remains unchanged.

## Fresh verification required before verdict

Because `41b3b8fe...` was pushed by `github-actions[bot]`, the standard PR workflows on that exact head were `action_required` and did not run jobs. Therefore this integration is **not yet merge-ready solely from the bot push**.

This note is the first ordinary user-authored commit after the verified source was installed. Its purpose is also to trigger fresh standard verification of the actual final tree:

1. cross-platform runtime;
2. standard three-platform hostile matrix;
3. dedicated delegated `cgroup_v2` matrix.

Only fresh successful standard workflows and review of the dedicated raw artifact may support the Issue #15 Final verdict.

## Non-claims

- Historical TECH-XP-03 and earlier cgroup-v2 raw FAIL verdicts are unchanged.
- Issue #15 Final remains `NOT_RECORDED` until the prospective dedicated full matrix is reviewed.
- Linux is not declared globally `managed` yet.
- Owner-exit cleanup remains independent under Issue #17.
- No real Codex execution is validated here.
- Spike 1 and the Technical Gate are not PASS.
- Product Validation and WWA are unaffected.
