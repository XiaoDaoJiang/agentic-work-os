# Milestone 0 Experiment Harness

This directory contains **experiment-only** tooling for `docs/pm/50-milestone-0-experiment-plan.md`.

M0-00 established repeatable experiment IDs, evidence layout/hash indexing, disposable fixture boundaries, trusted-local acknowledgement text, VerificationInvocation v0 validation, and the RI-11 canonical repository-identity vector.

M0-01 adds an executable candidate for the frozen `repo-local-git-v0` repository identity contract:

- Git top-level and common-dir discovery via `git rev-parse --path-format=absolute`;
- Windows directory identity from `FILE_ID_INFO` (`VolumeSerialNumber` + raw 128-bit `FileId`);
- final path resolution that follows reparse points;
- short-path alias probing for RI-02;
- fail-closed handling for missing Git facts, malformed native output, inaccessible paths, and unsupported all-zero `FILE_ID_128`;
- a disposable RI-01..RI-11 matrix runner.

M0-01 still does **not** start real Codex, implement the Windows Runner/process containment, freeze a production schema/API, or produce a Technical Gate verdict. RI-01..RI-10 only become evidence after the matrix is executed on the target Windows environment and the raw output is indexed in an experiment manifest.

## Requirements

- Node.js 20 or newer.
- Git available on `PATH` (or supplied with `--git`).
- For RI-01..RI-10: Windows with Windows PowerShell 5.1+ (`powershell.exe` by default).
- No third-party runtime dependencies.

## Tests

```bash
npm test
npm run check
```

A green non-Windows unit suite proves the Node contracts and orchestration only. It does not satisfy RI-01..RI-10.

## Commands

Initialize an evidence run. The plan SHA-256 is computed from the exact plan file bytes:

```bash
node src/cli.mjs init \
  --evidence-root ./evidence/milestone-0 \
  --plan ../../docs/pm/50-milestone-0-experiment-plan.md \
  --harness-revision <git-commit-sha>
```

Create a disposable path fixture under an explicitly supplied parent:

```bash
node src/cli.mjs create-fixture --parent <temp-parent> --run-id <experiment-run-id>
```

Verify the frozen RI-11 canonical vector only:

```bash
node src/cli.mjs repository-vector
```

### Compute one Windows repository identity

Run only against an allowed disposable repository while M0 is being executed:

```powershell
node src/cli.mjs repository-identity `
  --path "C:\m0-fixtures\repo"
```

Optional executable overrides:

```powershell
node src/cli.mjs repository-identity `
  --path "C:\m0-fixtures\repo" `
  --git "C:\Program Files\Git\cmd\git.exe" `
  --powershell "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
```

The JSON result records the original input, resolved input, Git top-level, Git common-dir, final common-dir path, volume serial, raw file ID, and `repo-local-git-v0:<sha256>` identity. No remote URL, branch, directory name, or current commit participates in the hash.

### Run RI-01..RI-11

First create an experiment run with `init`, then run the matrix using a dedicated disposable parent. Write the matrix result directly into that experiment run's repository-identity evidence directory:

```powershell
node src/cli.mjs repository-identity-matrix `
  --parent "C:\m0-fixtures" `
  --run-id "<experiment-run-id>" `
  --output ".\evidence\milestone-0\<experiment-run-id>\cross-contracts\repository-identity\ri-matrix.json"
```

Exit codes:

- `0`: every RI case is `PASS`;
- `1`: at least one RI case is `FAIL`, or command execution fails;
- `2`: no case failed, but at least one case is `INCONCLUSIVE`.

If Windows 8.3 alias generation is disabled and no actual short-path alias exists for the disposable fixture, RI-02 remains `INCONCLUSIVE`; the harness does not silently drop that declared variation.

After the matrix finishes, add the JSON result to the evidence manifest:

```powershell
node src/cli.mjs index-evidence `
  --manifest ".\evidence\milestone-0\<experiment-run-id>\manifest.json" `
  --file ".\evidence\milestone-0\<experiment-run-id>\cross-contracts\repository-identity\ri-matrix.json"
```

Validate a JSON representation of `verification_invocation_v0`:

```bash
node src/cli.mjs validate-verification ./verification.json
```

Render, but do not automatically accept, the trusted-local prompt:

```bash
node src/cli.mjs trusted-local-prompt \
  --source <disposable-source-repository> \
  --workspace <disposable-workspace> \
  --run-id <experiment-run-id>
```

Index any other raw evidence file after it has been written under the same run directory as `manifest.json`:

```bash
node src/cli.mjs index-evidence --manifest <manifest.json> --file <evidence-file>
```

## Evidence discipline

Raw evidence is intentionally ignored by Git. Do not place tokens, cookies, credential values, production data, or unredacted participant data in experiment evidence. Save raw bytes first, then index them with relative path, byte size, and SHA-256. Missing or unexplained evidence must remain missing/inconclusive; the harness does not infer PASS.

The RI matrix creates and mutates repositories only inside the supplied disposable parent. RI-08 intentionally deletes and recreates a repository **inside that matrix fixture root**; never point the matrix at a real working repository parent.

## Current evidence state

- RI-11 canonical vector: covered by deterministic unit tests and currently matches the frozen 83-byte/SHA-256 vector.
- RI-01..RI-10: **NOT RUN on the target Windows environment by this repository change**.
- Repository-identity cross-cutting contract: **INCONCLUSIVE until target-Windows evidence is indexed**.
- Technical Gate: **NOT EVALUATED by M0-01**.

## Next work

Execute and index RI-01..RI-11 on the target Windows environment. In parallel, Spike 1 process containment/Cancel may proceed using its own hostile mock because the frozen plan allows that work independently; repository identity must still PASS before it is relied on as the experiment scheduling key. Real Codex remains deferred to Spike 2 and still requires the trusted-local acknowledgement before every real start.

## Spike 1 hostile process fixture

The hostile fixture is an adversarial stimulus for Spike 1; it is **not** the Local Runner and does not claim process containment. It can emit segmented and continuous stdout/stderr, acknowledge a stdin nonce, create child/grandchild processes, exit zero/nonzero, hang, detach a descendant after root exit, write bounded marker sequences, and deliberately keep writing after an ignored soft-stop signal.

Freeze and inspect a scenario/seed without spawning any process:

```bash
node src/cli.mjs hostile-fixture-plan \
  --scenario ./examples/hostile-process-scenario.json \
  --seed 20260831
```

Direct fixture execution is for disposable diagnostics only. Both the control log and marker must stay under the supplied root:

```bash
node fixtures/hostile-process.mjs \
  --root ./evidence/scratch-hostile \
  --scenario ./examples/hostile-process-scenario.json \
  --control-file ./evidence/scratch-hostile/control.jsonl \
  --marker ./evidence/scratch-hostile/marker.jsonl \
  --role parent
```

The control log records only fixture-observed facts such as role, PID, PPID, cwd, descendant PID and fixture actions. It never asserts that a process is inside a Runner-owned boundary. The future Runner/independent observer must establish ownership, survivor facts, drain barriers and terminal semantics from OS evidence.

Current Spike 1 evidence status:

- hostile scenario validation / deterministic timing: executable test coverage;
- raw fixture behavior (streams, stdin, descendants, exit/hang, marker, root-early descendant, controlled late write): executable test coverage;
- Windows process boundary ownership, zero-survivor Cancel, Runner crash reconciliation and post-stop observation: **NOT RUN / NOT IMPLEMENTED by this fixture increment**;
- Spike 1 verdict: **NOT EVALUATED**.
