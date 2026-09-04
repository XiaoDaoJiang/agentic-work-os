# P00 Founder Rehearsal — Minimal Task Card

> Classification: **REHEARSAL_ONLY**. This is the only extra participant-visible input allowed in Variant C.

- Task card ID: `P00-ORBIS-PR14-TASK-v1`
- Real problem ID: `ORBIS-PR-14`
- Objective: implement Weekly v1 Presentation integration while preserving existing Daily/Talk and platform-neutral generator/build boundaries
- Definition of Done:
  - `weekly-v1` supports the required dynamic slide range and real Weekly output;
  - Registry validates Weekly payload + Reading URL and escapes hostile markup;
  - Daily + Weekly + Talk mixed build succeeds without regressing Daily contracts;
  - Weekly remains a Brief in Archive/RSS/Topic while entering Slides/Latest Presentation;
  - trusted Preview exposes correct Reading/Slides linkage.
- Repository / context reference: `XiaoDaoJiang/Orbis`
- Base reference: `main@cde4f82de2f84ce6266e56008fe69c63d77bc725`
- VerificationInvocation:
  - execution mode: shell
  - program or explicit shell: `pnpm`
  - argv or command: `pnpm build`
  - cwd binding: `assigned_workspace`
  - env policy: inherit repository CI-safe environment; credentials not part of this card
  - timeout_ms: unknown in historical public evidence
  - output: separate ordered stdout/stderr
  - cancel: runner_owned_process_containment
- Frozen at: `2026-09-02T17:16+08:00`
- Content hash: represented by committed Git blob; no self-hash embedded

Do not add backlog fields, estimates, assignees, workflow selection, lifecycle UI fields or other production Task schema.
