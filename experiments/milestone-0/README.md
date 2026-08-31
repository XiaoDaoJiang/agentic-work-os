# Milestone 0 Harness Foundation

This directory contains **experiment-only** tooling for `docs/pm/50-milestone-0-experiment-plan.md`.

M0-00 does **not** start real Codex, implement the Windows Runner, read Windows `FILE_ID_INFO`, freeze a production schema, or produce a Technical Gate verdict. It only establishes repeatable experiment IDs, evidence layout/hash indexing, disposable fixture boundaries, trusted-local acknowledgement text, VerificationInvocation v0 validation, and the RI-11 canonical repository-identity vector.

## Requirements

- Node.js 20 or newer.
- No third-party runtime dependencies.

## Tests

```bash
npm test
npm run check
```

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

Index a raw evidence file after it has been written under the same run directory as `manifest.json`:

```bash
node src/cli.mjs index-evidence --manifest <manifest.json> --file <evidence-file>
```

## Evidence discipline

Raw evidence is intentionally ignored by Git. Do not place tokens, cookies, credential values, production data, or unredacted participant data in experiment evidence. Save raw bytes first, then index them with relative path, byte size, and SHA-256. Missing or unexplained evidence must remain missing/inconclusive; the harness does not infer PASS.

## Next work

M0-01 may implement the real Windows `repository_identity` helper and RI-01..RI-11 matrix. Spike 1 will separately implement process containment/Cancel. Spike 2 will be the first point at which real Codex may be started, subject to the frozen trusted-local acknowledgement contract.
