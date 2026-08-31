# VAL-00 — Validation Execution Kit

This directory turns `docs/pm/40-validation-protocol.md` into an executable, low-fidelity research kit without building product UI or claiming validation results.

## What is frozen here

- protocol identity and baseline commit;
- participant/sample selection rules;
- A/B/C presentation order;
- B/C common archive contract;
- minimal Task card;
- observation, facilitator, review, domain-mapping and reuse-audit records;
- four empty Decision Record templates.

## What is not present

No participant has been recruited by this commit. No real problem, comparison, reuse, PASS/FAIL, Keep/Modify/Remove, or Product Validation Gate verdict is recorded. `NOT_RECORDED` means exactly that.

## Evidence safety

Raw evidence belongs under `evidence/product-validation/<evidence_snapshot_id>/` and is ignored by Git by default. Participant identity mapping, unredacted repositories, recordings, credentials, and production data must remain outside the public repository. Only redacted indexes, hashes, protocol versions, and final Decision Records may be promoted later.

## Execution order

1. Verify `protocol-lock.json` against the current protocol/baseline.
2. Assign qualified participants to P01..P03 in qualification order; do not reorder after seeing outcomes.
3. Freeze real problem fact packs before each comparison.
4. Use the fixed entry-order matrix and the same B/C archive contract.
5. Save raw evidence before interpretation; log every facilitator intervention.
6. Complete the frozen nine-instance domain walkthrough.
7. Audit any second use with `reuse-audit.md` before counting it as qualifying reuse.
8. Produce three independent product Decision Records first, then the Product Validation Gate record.

## Non-goals

No Project/Task product UI, production schema/API, general Workflow, multi-runtime, Sandbox, Session Resume, or MVP WWA is created by VAL-00.
