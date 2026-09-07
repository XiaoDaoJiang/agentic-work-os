# M0-00 Milestone 0 Harness Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest reusable Milestone 0 experiment harness foundation without starting real Codex or claiming any Technical Gate result.

**Architecture:** Use a dependency-free Node.js ESM package under `experiments/milestone-0`. Small modules own experiment IDs, SHA-256 evidence indexing, disposable fixture boundaries, trusted-local acknowledgement, VerificationInvocation v0 validation, and the repository identity canonical vector. A thin CLI exposes only diagnostic/setup commands; later Spikes consume these modules rather than duplicating contracts.

**Tech Stack:** Node.js >=20, ESM, built-in `node:test`, `node:crypto`, `node:fs`, `node:path`, `node:os`.

**Spec:** `docs/pm/50-milestone-0-experiment-plan.md`

## Global Constraints

- Milestone 0 is an experiment set, not product UI.
- Do not start real Codex in M0-00.
- Do not freeze production Schema/API/Runner architecture.
- Evidence must stay inside a designated disposable root and use unique experiment IDs.
- Evidence indexes record relative path, byte size, and SHA-256.
- trusted-local acknowledgement must match `ACK-TRUSTED-LOCAL:<experiment_run_id>` before a real start can be authorized by later Spikes.
- VerificationInvocation must preserve the frozen `argv` vs explicit `shell` contract.
- M0-00 validates only the canonical `repository_identity` test vector; Windows FILE_ID_INFO acquisition belongs to M0-01.

---

### Task 1: Package skeleton and experiment IDs

**Files:**
- Create: `experiments/milestone-0/package.json`
- Create: `experiments/milestone-0/src/ids.mjs`
- Test: `experiments/milestone-0/test/ids.test.mjs`

**Interfaces:**
- Produces: `createExperimentRunId(now?: Date, randomUUIDFn?: () => string): string`

- [ ] Write the failing test for a UTC timestamp + UUID based ID and uniqueness.
- [ ] Run `node --test test/ids.test.mjs` and verify it fails because `src/ids.mjs` is missing.
- [ ] Implement `createExperimentRunId` with no external dependency.
- [ ] Run the focused test and verify it passes.

### Task 2: SHA-256 evidence manifest and disposable boundary

**Files:**
- Create: `experiments/milestone-0/src/hash.mjs`
- Create: `experiments/milestone-0/src/paths.mjs`
- Create: `experiments/milestone-0/src/manifest.mjs`
- Create: `experiments/milestone-0/src/fixture.mjs`
- Test: `experiments/milestone-0/test/manifest.test.mjs`
- Test: `experiments/milestone-0/test/fixture.test.mjs`

**Interfaces:**
- Produces: `sha256Bytes`, `sha256File`, `assertPathWithinRoot`, `createManifest`, `writeManifest`, `indexEvidenceFile`, `createDisposableFixture`.

- [ ] Write failing tests for known SHA-256, relative evidence indexing, outside-root rejection, and ASCII/space/Chinese fixture directories.
- [ ] Run the focused tests and verify missing modules cause RED.
- [ ] Implement the minimal modules using built-in filesystem APIs.
- [ ] Run focused tests and verify GREEN.

### Task 3: trusted-local contract

**Files:**
- Create: `experiments/milestone-0/src/trusted-local.mjs`
- Test: `experiments/milestone-0/test/trusted-local.test.mjs`

**Interfaces:**
- Produces: `renderTrustedLocalPrompt(input): string`, `expectedTrustedLocalAck(runId): string`, `verifyTrustedLocalAck(runId, response): boolean`.

- [ ] Write failing tests for rendered paths/run ID and exact acknowledgement behavior.
- [ ] Run the focused test and verify RED.
- [ ] Implement the prompt and ACK check without starting processes.
- [ ] Run the focused test and verify GREEN.

### Task 4: VerificationInvocation v0 validator

**Files:**
- Create: `experiments/milestone-0/src/verification-invocation.mjs`
- Test: `experiments/milestone-0/test/verification-invocation.test.mjs`

**Interfaces:**
- Produces: `VerificationContractError`, `validateVerificationInvocation(document): object`.

- [ ] Write failing tests covering valid argv mode, valid explicit shell mode, ambiguous mode, invalid cwd binding, invalid timeout, and invalid output/cancel semantics.
- [ ] Run the focused test and verify RED.
- [ ] Implement minimal structural validation matching section 4 of the experiment plan.
- [ ] Run the focused test and verify GREEN.

### Task 5: repository identity canonical vector

**Files:**
- Create: `experiments/milestone-0/src/repository-identity.mjs`
- Test: `experiments/milestone-0/test/repository-identity.test.mjs`

**Interfaces:**
- Produces: `computeRepositoryIdentityVector(volumeSerialHex, fileIdHex)`, `verifyCanonicalRepositoryIdentityVector()`.

- [ ] Write the failing test using the exact RI-11 vector from the experiment plan.
- [ ] Run the focused test and verify RED.
- [ ] Implement canonical NUL-delimited payload bytes and SHA-256; do not implement Windows file identity acquisition.
- [ ] Run the focused test and verify byte length, SHA-256, and final identity.

### Task 6: Diagnostic CLI and documentation

**Files:**
- Create: `experiments/milestone-0/src/cli.mjs`
- Create: `experiments/milestone-0/README.md`
- Create: `.gitignore`
- Test: `experiments/milestone-0/test/cli.test.mjs`

**Interfaces:**
- Produces CLI commands: `init`, `index-evidence`, `repository-vector`, `validate-verification`, `trusted-local-prompt`, `create-fixture`.

- [ ] Write failing CLI tests around `repository-vector`, contract validation, and a temporary `init` evidence root.
- [ ] Run the focused test and verify RED.
- [ ] Implement the thin CLI only by composing earlier modules.
- [ ] Run `npm test` and confirm the full suite passes.
- [ ] Run `npm run check` and confirm source syntax checks pass.
- [ ] Review scope to ensure no real Codex, Runner, product UI, production DB schema, or Gate verdict was introduced.
