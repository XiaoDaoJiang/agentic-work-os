# External Participant Execution Status & Recruitment Packet

> Snapshot: `pv-2026-09-01-real-instance-freeze-v1`  
> Gate role: protocol activity 3 + activity 4  
> Current state: **NOT_STARTED / BLOCKING**

## Current counters

| Measure | Current | Required for activity / support signal |
|---|---:|---:|
| Qualified external Coding Agent users | 0 | 3 |
| External real problems completed | 0 | 5 |
| Independent users with qualifying spontaneous reuse | 0 | at least 2 for A3 support |

No colleague, reviewer, open-source maintainer, imagined persona or founder use is counted automatically. A participant only receives P01/P02/P03 after passing the frozen qualification rule.

## Qualification rule

A qualifying participant must:

- be an individual developer who already uses a Coding Agent in real development work;
- bring a current real code problem that already belongs to their work;
- have a real repository or a user-confirmed safe copy/context representing the problem;
- be able to state the real objective / DoD and one VerificationInvocation;
- be willing to use the existing low-fidelity materials rather than a product UI.

Qualification establishes sample fit only. It is not positive product evidence.

## Neutral invitation text

> 我在验证一种“如何更好地控制和回看 Coding Agent 真实代码任务”的工作方式，不是在测试 Agent 的代码能力。需要你带一个原本就要处理的真实代码问题，并继续使用你熟悉的 Coding Agent / Git 工作方式。过程中会比较几种非常低保真的启动与归档方式，观察离开后恢复、查看证据和做 Accept/Reject 决定时实际发生什么。不会要求你使用成品 UI，也不会把第二次使用作为奖励条件。

The invitation deliberately avoids saying that Project-native or Task-first is expected to be better.

## First-contact screening record

For each candidate, keep the identity map privately and only commit the anonymous qualification result:

```text
candidate_ref: private-only
already_uses_coding_agent: yes / no
current_real_code_problem_available: yes / no
real_repository_or_safe_context_available: yes / no
objective_and_dod_can_be_confirmed: yes / no
verification_invocation_available: yes / no
qualified: yes / no
qualification_reason_code: ...
assigned_participant_id: P01 / P02 / P03 / none
```

P01..P03 are assigned in qualification order and are not reordered after any observed result.

## First real problem intake

Before any A/B/C walkthrough, copy the frozen `real-problem-fact-pack.md` template and record:

- problem source and first-observed time;
- objective and DoD in the participant's own existing work terms;
- repository/context reference;
- current baseline CLI/Git workflow;
- one complete VerificationInvocation;
- whether the participant already planned to work on the issue independent of the study;
- fact-pack hash before comparison.

The researcher must not invent, split or replace the problem to improve comparability.

## A/B/C execution boundary

Each participant must eventually provide one usable A↔B and one usable B↔C observation using the frozen entry-order matrix. B and C must have the same archive contract and presentation. C may add only the pre-execution minimal Task contract.

Prompted behavior is recorded as prompted. A low-fidelity scheduled recovery walkthrough may test usability but cannot be treated as proof that natural recovery frequency exists.

## Reuse-window rule

The 14-calendar-day observation window begins at first-problem Review completion for each participant. During that window:

- no direct reminder to use the prototype again;
- no email/calendar/verbal prompt for second use;
- no reward conditioned on second use;
- scheduled research tasks may be recorded as real tasks but cannot count as spontaneous reuse.

A second use is counted only after the frozen `reuse-audit.md` passes all conditions. Same-task continuation, Reject/Cancel retry, artificially split problems, Codex-only return and facilitator-initiated use are excluded.

## Blocking condition

Until real external participant evidence exists, the Product Validation Gate cannot be finalized as PASS regardless of founder strength or nine-instance domain evidence.
