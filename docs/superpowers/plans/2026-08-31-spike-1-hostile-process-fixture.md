# Spike 1 Hostile Process Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, experiment-only hostile process fixture that can exercise Spike 1 process containment, streaming, stdin, descendant, hang, and late-write cases without implementing the Runner or claiming containment evidence.

**Architecture:** A single Node fixture executable runs in `parent`, `child`, or `grandchild` roles. A JSON scenario controls timing and behavior; every role writes append-only structured fixture events to a dedicated control JSONL file while stdout/stderr remain raw streams for Runner capture. Descendants re-exec the same fixture with an explicit role, and marker writes are confined to a supplied disposable fixture root.

**Tech Stack:** Node.js >=20 built-ins, `node:test`, no third-party dependencies.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md` section 6, Spike 1 Test Fixture and R-01..R-11.

## Global Constraints

- Experiment-only code under `experiments/milestone-0`; no product Runner or UI.
- No real Codex process.
- All writable paths must resolve under an explicitly supplied disposable root.
- The fixture must not claim a process belongs to a Runner-owned boundary; it only reports its own PID/PPID/role and observable actions.
- Seeded timing must be reproducible for the same scenario/seed.
- stdout and stderr remain separate OS streams; no cross-stream total-order claim.
- A hanging fixture must always be externally terminable; tests use finite timeouts.
- Late-write behavior is intentionally hostile but may only write inside the supplied marker path under the disposable root.
- Cross-platform fixture tests do not satisfy Windows containment R-02/R-06/R-07/R-08.

---

### Task 1: Scenario validation and deterministic timing

**Files:**
- Create: `experiments/milestone-0/src/hostile-scenario.mjs`
- Create: `experiments/milestone-0/test/hostile-scenario.test.mjs`

**Interfaces:**
- `validateHostileScenario(document)` returns a normalized immutable scenario.
- `createSeededDelays(seed, count, minMs, maxMs)` returns deterministic integer delays.

- [x] Write failing tests for role-neutral defaults, invalid negative delays/counts, allowed exit modes, and deterministic seeded delay generation.
- [x] Run focused tests and confirm failure because the module does not exist.
- [x] Implement the minimal validator and deterministic PRNG without dependencies.
- [x] Re-run focused tests to green.

### Task 2: Hostile process executable

**Files:**
- Create: `experiments/milestone-0/fixtures/hostile-process.mjs`
- Create: `experiments/milestone-0/test/hostile-process.test.mjs`

**Interfaces:**
- CLI requires `--root`, `--scenario`, `--control-file`, `--role` and optional `--marker`.
- Writes control JSONL events containing `event`, `role`, `pid`, `ppid`, monotonic/high-resolution timestamp and event payload.
- Parent may spawn child; child may spawn grandchild; descendants receive the same scenario/control/marker paths.

- [x] Write failing integration tests for cwd/argv/stdout/stderr, stdin nonce acknowledgement, child/grandchild observation, normal/nonzero exit, and hang mode terminated by the test harness.
- [x] Run the focused tests and confirm the fixture is absent.
- [x] Implement minimal role execution, raw stream writes, stdin handling, descendant spawning, and exit modes.
- [x] Re-run focused tests to green.

### Task 3: Marker and hostile timing behavior

**Files:**
- Modify: `experiments/milestone-0/fixtures/hostile-process.mjs`
- Modify: `experiments/milestone-0/test/hostile-process.test.mjs`

**Interfaces:**
- Scenario supports finite `markerWrites`, `markerIntervalMs`, optional `lateWriteDelayMs`, `rootExitBeforeDescendants`, and `delayedDescendantMs`.
- Marker lines include role, PID, sequence and timestamp; marker path is rejected if outside the disposable root.

- [x] Add failing tests for deterministic marker writes, path escape rejection, delayed descendant creation, root-early-exit behavior, and a configured late write after a soft-stop signal.
- [x] Run focused tests and confirm marker/root-early/late-write cases fail before implementation.
- [x] Implement only the declared hostile behavior.
- [x] Re-run focused tests to green and verify spawned descendants are cleaned up by the test harness or finish on their own.

### Task 4: Fixture CLI discovery and documentation

**Files:**
- Modify: `experiments/milestone-0/src/cli.mjs`
- Modify: `experiments/milestone-0/README.md`
- Create: `experiments/milestone-0/examples/hostile-process-scenario.json`

**Interfaces:**
- Add `hostile-fixture-plan --scenario <file> --seed <integer>` to print the validated scenario and frozen derived delays without spawning a process.
- README documents direct fixture execution only as a disposable diagnostic tool; the future Runner remains responsible for ownership and cancellation.

- [x] Add a failing CLI test for scenario validation/derived timing without process spawn.
- [x] Implement the diagnostic command and example scenario.
- [x] Run the full relevant M0 test suite and `node --check src/*.mjs fixtures/*.mjs`.
- [x] Record that fixture behavior is verified, but Spike 1 R-02/R-06/R-07/R-08 containment verdicts remain NOT RUN until the Windows Runner boundary exists.

## Verification boundary

Passing fixture tests only proves that the adversarial stimulus is deterministic and observable. It cannot prove process ownership, full-tree cancellation, zero survivors, drain barriers, resource reconciliation, or any Spike 1 PASS criterion. Those require the next Runner/boundary increment and target-Windows evidence.

## Current status

Fresh verification on the available non-Windows host:

- full relevant M0 suite: **37/37 PASS**;
- `node --check src/*.mjs fixtures/*.mjs`: **PASS**;
- `test/hostile-process.test.mjs` repeated three additional times: **PASS each run**;
- real Codex starts: **none**;
- Windows process-boundary ownership / Cancel / zero-survivor evidence: **NOT RUN**;
- Spike 1 verdict: **NOT EVALUATED**.
