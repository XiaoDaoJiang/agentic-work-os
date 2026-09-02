# Milestone 0 Experiment Harness

This directory contains **experiment-only** tooling for `docs/pm/50-milestone-0-experiment-plan.md`.

The branch currently contains four independent technical work areas. None of them alone authorizes the Technical Gate.

## M0-00 — Harness Foundation

Established repeatable experiment IDs, evidence layout/hash indexing, disposable fixture boundaries, trusted-local acknowledgement text, VerificationInvocation v0 validation, and the RI-11 canonical repository-identity vector.

## M0-01 — `repository_identity` candidate

Implemented:

- Git top-level/common-dir discovery through `git rev-parse --path-format=absolute`;
- Windows `FILE_ID_INFO` helper (`VolumeSerialNumber` + raw 128-bit `FileId`);
- final path and short-path probing;
- fail-closed repository identity composition;
- RI-01..RI-11 disposable matrix runner.

Evidence state:

- RI-11 deterministic vector: unit verification available;
- RI-01..RI-10 target Windows matrix: **NOT RUN**;
- repository-identity contract: **INCONCLUSIVE until Windows evidence is indexed**.

## Spike 1 — hostile process / boundary foundations

The hostile fixture is an adversarial stimulus, not the Local Runner. It covers deterministic seeded timing, segmented/continuous stdout/stderr, stdin nonce acknowledgement, child/grandchild creation, zero/nonzero/hang modes, marker writes, root-early descendant survival and controlled late writes. Boundary/reconciliation/post-stop modules are experiment contracts only until they are backed by Windows OS process facts.

Evidence state:

- hostile fixture behavior: executable cross-platform tests exist;
- Windows Runner-owned boundary, zero-survivor Cancel, drain barrier and crash reconciliation: **NOT PROVEN**;
- Spike 1 verdict: **NOT EVALUATED**.

## Spike 3 — `change-package-v0` replay candidate

The candidate format is deterministic UTF-8 JSON. It binds:

- `base_revision` and Git object format;
- `result_tree_hash` computed with a temporary Git index;
- sorted delete/upsert operations;
- regular/executable file bytes with size + SHA-256;
- sealed Agent Log, Diff and Verification Result references;
- the frozen VerificationInvocation contract.

Implemented behavior:

- source Workspace index is not modified while collecting changes or computing the result tree;
- rename is encoded as delete + add;
- symlink/unsupported modes fail closed;
- malformed/tampered package bytes fail validation before replay mutation;
- wrong base revision fails before mutation;
- after deleting the original Workspace, a fresh checkout can replay the package and reproduce the same Git tree;
- each Run can seal at most one Change Package, with same-byte idempotency before ReviewDecision;
- ReviewDecision prevents package reseal/replacement;
- Verification replay preserves the logical invocation bytes and records original/replay cwd resolution separately;
- Spike 4 `delivery_integrity=healthy` can be demonstrated with the real package validator and a real fresh-checkout replay rather than success stubs.

Fresh focused verification for the Spike 3 implementation on Node `v22.16.0`:

```text
17/17 tests PASS
node --check src/*.mjs: PASS for the reconstructed Spike 3 dependency set
```

This is **implementation evidence**, not the final Spike 3 verdict. Final PASS still requires indexed raw package/replay evidence, the relevant Spike 4 sealed-byte/reconciliation evidence, VerificationInvocation replay evidence, and the independent CP-11 drift gate.

## Spike 4 — Artifact durability foundation

The branch also contains the local Artifact Store/SQLite candidate, crash worker, artifact reconciliation and three-value `delivery_integrity` projection. These remain governed by F-01..F-17; the presence of code/tests is not a Spike 4 PASS claim.

## Core commands

Initialize an evidence run:

```bash
node src/cli.mjs init \
  --evidence-root ./evidence/milestone-0 \
  --plan ../../docs/pm/50-milestone-0-experiment-plan.md \
  --harness-revision <git-commit-sha>
```

Validate the deterministic repository-identity vector:

```bash
node src/cli.mjs repository-vector
```

Run the target-Windows RI matrix only inside a disposable parent:

```powershell
node src/cli.mjs repository-identity-matrix `
  --parent "C:\m0-fixtures" `
  --run-id "<experiment-run-id>" `
  --output ".\evidence\milestone-0\<experiment-run-id>\cross-contracts\repository-identity\ri-matrix.json"
```

Freeze a hostile fixture plan without spawning a process:

```bash
node src/cli.mjs hostile-fixture-plan \
  --scenario ./examples/hostile-process-scenario.json \
  --seed 20260831
```

Index any raw evidence file only after it has been written beneath the same experiment run root:

```bash
node src/cli.mjs index-evidence --manifest <manifest.json> --file <evidence-file>
```

## Evidence discipline

Raw `evidence/` is intentionally ignored by Git. Never store tokens, cookies, credential values, production data or unredacted participant data in this repository. Save raw bytes first, then index them by relative path, byte size and SHA-256.

A green unit/integration suite proves only the behavior it actually executed. Missing Windows process facts, unexecuted matrix cases, missing raw evidence or unresolved drift checks must remain `NOT RUN`, `INCONCLUSIVE` or `NOT EVALUATED`; the harness never infers PASS.

## Current Technical Gate state

- real Codex: **NOT STARTED**;
- Product UI / production Schema/API: **NOT IMPLEMENTED by this branch**;
- repository identity: **INCONCLUSIVE pending Windows evidence**;
- Spike 1: **NOT EVALUATED**;
- Spike 3: **READY_FOR_EVIDENCE / NOT EVALUATED**;
- Spike 4: **NOT EVALUATED**;
- Technical Gate: **NOT EVALUATED**.
