# TECH-XP-02 — Rust Containment Provider Selection

> Status: **SELECTED_FOR_NEXT_EXPERIMENT**  
> Date: 2026-09-01  
> Scope: Milestone 0 Technical Validation only  
> Issue: #8  
> Evidence run: GitHub Actions `33477288678` at `3fd080b5c44bced9b71a1f32beec38d31ab0d3e4`

## Decision

**Select `processkit = 3.3.4` for the next hostile-containment adapter increment.**

This is an experiment selection, not a production dependency freeze. It does **not** mark any platform `managed`, does not satisfy Spike 1, does not authorize real Codex execution, and does not change the Technical Gate from `NOT_EVALUATED`.

Candidate dispositions:

| Candidate | Version | License | Decision | Role after this spike |
|---|---:|---|---|---|
| ProcessKit | 3.3.4 | MIT | **Select** | Primary candidate for hostile-process containment tests |
| process-wrap | 10.0.0 | Apache-2.0 OR MIT | **Modify** | Keep as a narrow wrapper/reference alternative; not the primary LocalRunner provider without project-owned lifecycle/observability additions |
| Direct OS adapter | project-owned | project-owned | **Reject** as default | Retain only as fallback/control baseline when a library cannot satisfy a platform requirement |

## Evidence collected

The same locked Rust probe and contract suite completed successfully on `windows-2025`, `ubuntu-24.04`, and `macos-15`. The probe used `ProcessKit::ProcessGroup::new()` and recorded the mechanism of the group actually created; `process-wrap` actually spawned a disposable child through its platform wrapper; the direct-OS candidate only probed a primitive and explicitly did not present itself as a complete provider.

| Hosted profile | ProcessKit actual group | ProcessKit membership | ProcessKit owner-exit cleanup | process-wrap actual wrapper spawn | Direct-OS primitive |
|---|---|---:|---|---|---|
| Windows x86_64 | `job_object` | yes | `whole_tree` | `job_object`, spawn succeeded | create/close Job Object |
| Ubuntu x86_64 | `process_group` | yes | `direct_child_only` | `process_group`, spawn succeeded | `getpgrp` |
| macOS arm64 | `process_group` | yes | `none` | `process_group`, spawn succeeded | `getpgrp` |

Evidence artifacts from run `33477288678`:

- Windows: `containment-provider-eval-windows-2025`, artifact `9788679764`;
- Ubuntu: `containment-provider-eval-ubuntu-24.04`, artifact `9788642652`;
- macOS: `containment-provider-eval-macos-15`, artifact `9788627411`.

All three profiles also passed tests, `rustfmt --check`, Clippy with `-D warnings`, release build, probe execution, and artifact upload before this decision was recorded.

## Why ProcessKit is selected

ProcessKit has the closest fit to the frozen LocalRunner evidence contract rather than merely the broadest API surface:

1. **Actual mechanism is observable.** The spike records the mechanism from a successfully created `ProcessGroup`, so Linux fallback behavior is evidence rather than a platform-name guess.
2. **Membership is observable.** The next hostile fixture needs to distinguish a safe terminal from an unobserved descendant; ProcessKit exposes the group abstraction needed to make that test meaningful.
3. **Lifecycle pieces are integrated.** Process start, stdin/output handling, timeout/cancellation primitives, group teardown, and mechanism reporting live in one library boundary, reducing project-owned coordination code.
4. **Capability degradation stays explicit.** The hosted Ubuntu runner created a process group rather than cgroup v2, and macOS reports no abrupt parent-death cleanup. Those facts can remain visible to the upper capability model instead of being normalized away.
5. **It already matches the Stage A/Stage B direction.** The Milestone 0 native runner is already pinned to ProcessKit 3.3.4, so the next experiment can attack one containment path without changing the platform-neutral JSONL contract.

## Why process-wrap is Modify, not Select

`process-wrap 10.0.0` successfully demonstrated Windows Job Object and POSIX Process Group child launch. That makes it a useful reference and potential narrow platform wrapper. It is not selected as the primary LocalRunner provider because this spike did not find equivalent first-class runtime mechanism discovery, group membership observation, Linux cgroup-v2 coverage, or an integrated owner-exit/timeout/cancel/stream-drain lifecycle. Filling those gaps would move substantial control-plane responsibility back into project-owned code.

The result is therefore **Modify**: keep it as an alternative if a later ProcessKit platform path fails hostile testing, but do not build the default execution fabric around it now.

## Why direct OS is rejected as the default

The direct-OS probe proved only that the expected primitive is available on each hosted platform. Turning those primitives into a correct cross-platform runner would require the project to own the highest-risk parts of Job Object/cgroup/process-group setup, process identity and membership, race handling, teardown, output draining, and parent-death behavior. That defeats the purpose of this provider selection unless a library cannot meet a concrete requirement.

The result is **Reject as default**, while retaining direct OS as a diagnostic/fallback baseline.

## Important negative evidence

The selection must preserve these observed limits:

- **Ubuntu in this CI environment did not create cgroup v2; it created a POSIX process group.** No cgroup or strong escape-resistance claim is allowed from this run.
- **macOS created a process group and reported owner-exit cleanup `none`.** A process that creates a new session/process group remains a known hostile case to test explicitly.
- **Windows created a Job Object, but zero-survivor and late-write behavior has not yet been attacked by the Milestone 0 hostile matrix.** A Job Object mechanism name is not itself Spike 1 evidence.
- The provider probe did not run real Codex and did not test user Cancel races.

## Next experiment boundary

The next increment must place the existing hostile fixture behind a ProcessKit-owned group and record per-platform evidence for:

- root + descendant termination;
- root exits before descendants;
- descendant/session escape attempts;
- timeout and explicit Cancel teardown;
- duplicate Cancel and Cancel/natural-exit races;
- stdout/stderr drain barriers and post-stop late writes;
- final membership/survivor observation;
- the frozen repeat count for race cases.

Only those results can upgrade or downgrade Windows/Linux/macOS capability profiles. Real Codex Spike 2 remains blocked until the relevant owned boundary satisfies its required evidence.

## Explicit non-claims

```text
spike_1_pass = false
technical_gate_pass = false
real_codex_authorized = false
production_provider_frozen = false
```
