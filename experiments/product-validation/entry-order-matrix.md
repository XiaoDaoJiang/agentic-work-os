# Frozen A/B/C Entry Order Matrix

The first shown variant is rotated across the three anonymous participant IDs. This matrix is frozen before any participant observation.

| Participant | Presentation order | Required comparable pairs |
|---|---|---|
| P01 | A → B → C | A↔B, B↔C |
| P02 | B → C → A | B↔C, A↔B |
| P03 | C → B → A | B↔C, A↔B |

Variant definitions:

- **A — Direct CLI:** current CLI/Git workflow; no user-visible automatic Project/Run archive.
- **B — CLI-first archive:** same CLI start; Wizard-of-Oz/script archive using `templates/common-archive-contract.yaml` with no extra user data-entry burden.
- **C — Task-first archive:** minimal Task card before the same CLI; archive presentation/fields must remain identical to B.

If parity fails, set `comparison_confounded=true`; do not count that observation as passing evidence.
