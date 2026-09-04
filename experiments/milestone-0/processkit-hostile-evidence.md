# ProcessKit Hostile Containment Evidence

> Status: **FAIL — evidence collected**  
> Scope: Milestone 0 / Spike 1 physical containment contribution only  
> Evidence head: `c8d011c5c6fccc71a0a389039ec2048adf6805eb`  
> Evidence workflow: `M0 ProcessKit hostile containment` run `33491181220`

This document records the frozen hostile-process matrix exactly as observed from the uploaded GitHub Actions artifacts. Scenario failure is valid experiment output. A green workflow means the harness/build/protocol ran successfully; it does **not** mean the containment scenarios passed.

## Evidence provenance

| Platform | Artifact | SHA-256 digest | Size |
| --- | --- | --- | ---: |
| Windows Server 2025 | `9794040383` / `processkit-hostile-evidence-windows-2025` | `2f5cb60a7c14f298065d538170452d16bd5d5dbd5230e63812b474d95f681406` | 392,992 B |
| Ubuntu 24.04 | `9793969916` / `processkit-hostile-evidence-ubuntu-24.04` | `65b8191cd836ebb25aeac8d9c19eb7ce431057e2da993961bc9a797b5334b02d` | 469,476 B |
| macOS 15 | `9793960123` / `processkit-hostile-evidence-macos-15` | `1bd874821c42296b77ef016a4ed05c6592525a00feee14896e448c2d9f23e621` | 458,050 B |

Frozen execution inputs:

- ProcessKit `3.3.4`
- Node.js `22.16.0`
- Rust `1.88.0`
- race mode, 50 repetitions per case, seeds `0..49`
- 750 ms post-stop observation, sampled every 50 ms
- four cases per platform, 200 runs per platform, 600 total runs

All **600/600 harness runs passed**. Scenario verdicts were **361 PASS / 239 FAIL / 0 INCONCLUSIVE**.

## Platform results

| Platform | Actual mechanism | Scenario PASS | Scenario FAIL | `late-output-hang + cancel` | `root-exit-detached + cancel` | `tree-hang + cancel` | `tree-hang + timeout` |
| --- | --- | ---: | ---: | --- | --- | --- | --- |
| Windows Server 2025 | `job_object` | 106 | 94 | 50 PASS / 0 FAIL | 3 PASS / 47 FAIL | 28 PASS / 22 FAIL | 25 PASS / 25 FAIL |
| Ubuntu 24.04 | `process_group` | 110 | 90 | 50 PASS / 0 FAIL | 0 PASS / 50 FAIL | 31 PASS / 19 FAIL | 29 PASS / 21 FAIL |
| macOS 15 | `process_group` | 145 | 55 | 50 PASS / 0 FAIL | 0 PASS / 50 FAIL | 47 PASS / 3 FAIL | 48 PASS / 2 FAIL |

Every run that needed post-evidence cleanup reported successful cleanup. No teardown error was recorded in the matrix.

## Artifact-derived findings

### 1. The evidence harness is stable enough to expose scenario failures

The same frozen matrix executed 600 times without a harness crash or malformed probe result. The dedicated late-output cancel case passed all 50 repetitions on all three platforms, demonstrating that the harness can observe clean cancel/drain/no-late-write behavior when the target process stays inside the effective boundary.

### 2. POSIX process-group escape is directly reproduced

On both Ubuntu and macOS, the actual ProcessKit mechanism was `process_group`.

For `root-exit-detached + cancel`:

- Ubuntu: 50/50 FAIL; every run observed surviving child and grandchild PIDs and a post-stop late write.
- macOS: 50/50 FAIL; every run observed surviving child and grandchild PIDs and a post-stop late write.
- cleanup succeeded after the failure snapshot in every repetition.

This is direct physical evidence that the current process-group profile is not escape-resistant against the detached/new-session scenario. It must not be represented as strong containment or a `managed` profile.

### 3. Windows Job Object has an observer disagreement that must remain a failure until diagnosed

Windows created an actual `job_object`. Its 94 failed repetitions all failed on the independent `survivor_pids` observer.

At the same time:

- `members_after` was empty in those Windows failures;
- no Windows run recorded a post-stop late write;
- stdout/stderr drain remained complete;
- no teardown error was recorded;
- cleanup succeeded.

The current frozen evaluator therefore correctly records these repetitions as **FAIL**, because an independent observer reported the original child/grandchild identity as still present. However, the disagreement between Job membership and standalone PID liveness is itself the next technical question. Do not reinterpret these 94 failures as PASS without a separate, pre-registered observer diagnostic.

### 4. Ordinary POSIX tree teardown is not consistently clean under the frozen zero-survivor contract

Ubuntu also produced intermittent failures without deliberate detachment:

- `tree-hang + cancel`: 19/50 FAIL; 17 runs reported survivor PIDs, 19 recorded post-stop group membership, 1 had incomplete observer evidence.
- `tree-hang + timeout`: 21/50 FAIL; 21 reported survivor PIDs and post-stop group membership, 3 had incomplete observer evidence.

macOS was substantially more stable in the same cases but not perfect:

- `tree-hang + cancel`: 3/50 FAIL from post-stop membership observations.
- `tree-hang + timeout`: 2/50 FAIL; one post-stop membership observation and one stdout drain timeout.

These are failures under the frozen experiment contract. Whether a subset represents exited-but-not-yet-reaped process state rather than executable survivors is a follow-up diagnostic question; the collected verdicts are not changed after the fact.

## Spike 1 requirement contribution

| Requirement | Windows `job_object` | Ubuntu `process_group` | macOS `process_group` | Evidence note |
| --- | --- | --- | --- | --- |
| R-02 descendant ownership / root-early behavior | **FAIL** | **FAIL** | **FAIL** | Frozen observer sees descendants after teardown; POSIX detached case also proves active escape via late writes. |
| R-03 timeout / Cancel physical teardown | **FAIL** | **FAIL** | **FAIL** | At least one frozen repetition fails the zero-survivor/drain criteria on every platform. |
| R-06 zero-survivor containment | **FAIL** | **FAIL** | **FAIL** | Any survivor or post-stop membership is a hard failure under this experiment. |
| R-08 no post-stop output / late write | **PASS contribution** | **FAIL** | **FAIL** | Windows recorded no late write and complete drains; Ubuntu/macOS detached runs late-wrote; macOS also had one stdout drain timeout. |
| RR-02 stream drain | **PASS contribution** | **PASS contribution** | **FAIL** | macOS had one stdout drain timeout; no Windows/Ubuntu drain failure was recorded. |
| RR-07 post-stop write barrier | **PASS contribution** | **FAIL** | **FAIL** | 50/50 detached runs late-wrote on both POSIX profiles. |

A “PASS contribution” above is limited to the physical evidence exercised here. It does not satisfy Spike 1 by itself.

## Technical decision from this experiment

Overall result: **FAIL** for the current ProcessKit hostile-containment matrix under the frozen Milestone 0 criteria.

This does **not** mean “ProcessKit is rejected”. It means:

1. the GitHub-hosted Linux fallback and macOS Process Group profiles cannot meet an escape-resistant zero-survivor contract as currently defined;
2. the Windows Job Object result cannot be accepted while independent PID liveness and Job membership disagree;
3. platform capability grading is required rather than flattening all three hosts to one containment guarantee.

## Next technical actions

1. **Windows observer diagnostic:** independently distinguish an active executable process from a terminated-but-still-queryable process object and reconcile that result with Job `ActiveProcesses` / membership. Preserve the current 94 FAIL verdicts as historical evidence.
2. **Linux cgroup-v2 profile:** execute the identical matrix on a host with writable/delegated cgroup v2. The GitHub Ubuntu artifact proved the fallback `process_group` profile, not the strong Linux profile.
3. **macOS containment decision:** either identify a stronger native containment mechanism or explicitly keep macOS at a limited/compatible profile whose escape limitation is visible to scheduling and review.
4. **Finish remaining Spike 1 contracts:** R-04/R-05 business terminal/CAS races, R-07 abrupt Runner-owner exit, and R-09/R-10/R-11 terminal/reconciliation/scheduling invariants remain independent work.

## Explicit non-claims

- No platform is declared `managed`.
- Spike 1 is **not PASS**.
- Technical Gate remains **NOT EVALUATED**.
- ProcessKit is not frozen as a production dependency.
- No real Codex or user repository was executed in this matrix.
