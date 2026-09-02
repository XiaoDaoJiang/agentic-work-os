# P00 Founder Rehearsal — Historical Real Problem Fact Pack

> Classification: **REHEARSAL_ONLY**  
> Counts toward P01..P03 / external problems / qualifying reuse: **no / no / no**

- Fact pack ID: `P00-ORBIS-PR14-v1`
- Participant ID: `P00-founder-rehearsal`
- Real problem ID: `ORBIS-PR-14`
- Problem source / first observed at: Orbis PR #14, created `2026-09-01T03:17:56Z`
- Real problem confirmed: yes — public repository work predates this rehearsal
- Repository or context ref: `XiaoDaoJiang/Orbis#14`
- Base reference: `main@cde4f82de2f84ce6266e56008fe69c63d77bc725`
- Objective: implement Plan 30B Weekly v1 Presentation integration while preserving the platform-neutral Presentation architecture and existing Daily/Talk behavior
- Definition of Done:
  - dedicated `weekly-v1` renderer with dynamic 7..11 slide contract;
  - real Weekly produces 8 slides;
  - Registry enforces Weekly schema + Reading URL;
  - hostile structured markup is escaped;
  - Daily + Weekly + Talk coexist in the normal build;
  - mixed future-Daily regression remains green;
  - Weekly becomes a Presentation while retaining Brief identity in Archive/RSS/Topic;
  - Daily latest/date/archive contracts remain isolated;
  - trusted Preview exposes Weekly Reading + Slides;
  - generator/build platform-neutral boundaries remain unchanged.
- VerificationInvocation ref: PR build checkpoints `33465703923`, `33465780926`, `33465986406`, final `33466065425`; final artifact `9784902857`
- Existing CLI/Git workflow summary: plan/spec-driven feature branch → implementation checkpoints → read-only PR CI → trusted Preview publication → human merge decision
- Codex payload ref/hash: unknown / not recoverable from public PR evidence
- Fact pack content hash: represented by repository Git blob after commit; do not treat this line as a self-hash
- Frozen at: `2026-09-02T17:15+08:00`
- Researcher interventions before freeze: none to the historical work; this rehearsal is reconstructed after completion
- Known confounders:
  - historical reconstruction cannot measure original time-to-start or spontaneous evidence-opening behavior;
  - founder already knows the outcome;
  - GitHub PR/CI evidence is richer than a typical Direct CLI baseline;
  - no native Codex Session/Run identity is publicly available.

## Evidence references

- Problem existed before research: `https://github.com/XiaoDaoJiang/Orbis/pull/14`
- Repository/context evidence: PR #14 base/head and changed-file scope
- DoD evidence: PR #14 `Plan 30B acceptance` section
- Verification evidence definition: PR #14 TDD RED/GREEN checkpoints, final artifact digest, trusted Preview and merge timestamp

## Freeze rule

This packet is immutable once the rehearsal comparison begins. Any correction must create `v2` and preserve this version.

## Explicit non-implications

This historical fact pack proves only that the rehearsal uses a real engineering problem. It does not provide Project-native, Task-first, spontaneous-reuse or external-user evidence.
