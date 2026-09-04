# VAL-00 — Validation Execution Kit

This directory turns `docs/pm/40-validation-protocol.md` into an executable, low-fidelity research kit without building product UI or claiming validation results.

## Frozen execution material

- protocol identity and baseline commit;
- participant/sample selection rules;
- A/B/C presentation order;
- B/C common archive contract;
- minimal Task card;
- observation, facilitator, review, domain-mapping and reuse-audit records;
- independent Decision Record templates.

## Current evidence checkpoint — 2026-09-01

Evidence snapshot:

`evidence/product-validation/pv-2026-09-01-real-instance-freeze-v1/`

Current facts:

- nine recent real code-work instances: **9 / 9 frozen**;
- neutral mappings: **9 / 9 complete**;
- first-pass fit classifications: **9 / 9 natural_fit for known facts**;
- `strained_fit`: 0; `model_break`: 0;
- giant Task / special FK / ambiguous ownership / exception lifecycle in first nine: 0 / 0 / 0 / 0;
- strict distinct actual TR-01..TR-09 coverage: **0 / required 6**;
- Founder signal: **STRONG_SIGNAL_SUPPORTING_ONLY**;
- qualified external participants: **0 / 3**;
- external real problems: **0 / 5**;
- independent qualifying-reuse users: **0 / 2**;
- Product Validation Gate final verdict: **NOT_RECORDED**.

The first-nine result is intentionally split: known work intent/evidence/artifact/final-decision facts fit a task-like aggregate naturally, but native Agent Run/Session, local Workspace lifecycle and adverse trajectory semantics remain unproven.

## Evidence safety

Raw evidence belongs under `evidence/product-validation/<evidence_snapshot_id>/`. Participant identity mapping, unredacted repositories, recordings, credentials and production data must remain outside the public repository. Public material should contain only permitted redacted facts, public repository evidence, hashes and Decision Records.

## Active execution work

1. `VAL-01` / issue #9: acquire at least six distinct **actual** adverse trajectories and finalize Task Aggregation.
2. `VAL-02` / issue #11: recruit P01..P03, complete five external real problems, A↔B/B↔C comparison and no-reminder reuse audit.
3. Project-native and Task-first remain `NOT_RECORDED` until external comparison evidence exists.
4. Product Gate remains Draft `CONTINUE_VALIDATION`; no PASS is claimed.

## Critical evidence discipline

- CI checkpoints are Verification events, not automatically Agent Runs.
- Failed/cancelled/rejected/superseded real work stays eligible; outcome cannot be used to filter the sample.
- Counterfactual trajectories never count toward the six actual trajectory threshold.
- Technical Validation fault injection is not automatically Product Validation real-work evidence.
- Founder usage does not count as an external participant or qualifying reuse.

## Non-goals

No Project/Task product UI, production schema/API, general Workflow, multi-runtime, Sandbox, Session Resume, Remote Runner or MVP WWA is authorized by this execution checkpoint.
