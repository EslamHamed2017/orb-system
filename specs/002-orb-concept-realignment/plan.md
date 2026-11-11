# ORB Fast-Track Execution Plan

## Delivery commitment
- **Daily-use pilot target:** 2026-11-19 (8 calendar days from plan start).
- **Hardening target:** 2026-11-22 (3 additional days).
- Scope is implemented on the existing Next.js/Prisma/PostgreSQL foundation; no rewrite.

## Execution strategy
Five lanes run in parallel after the schema contract is frozen:
- **Lane A — Data/API:** expand-migrate-contract schema, line items, fulfillment, invoice grouping.
- **Lane B — 360 UI:** project workspace, detail pages, navigation, Accounts and Masters hubs.
- **Lane C — Access/Admin:** users, roles, permissions, Settings, sign-in.
- **Lane D — Documents/Output:** serials, attachments, printing, reports.
- **Lane E — QA/Ops:** contract/unit/integration/E2E, AR/EN/RTL, backup, security, deployment evidence.

## Critical path
Schema contract → backward-compatible migration → APIs → 360 screens → full lifecycle E2E → pilot deployment.

## Daily milestones
| Day | Date | Deliverable |
|---|---|---|
| D1 | Nov 11 | Freeze domain model; migration design; preserve current fixes; baseline tests |
| D2 | Nov 12 | ContractLine + shipment-line schema/APIs; product/party APIs; migration + seed |
| D3 | Nov 13 | Multi-line contract and shipment UI; partial fulfillment; multi-supplier container model |
| D4 | Nov 14 | Products movement + customers/suppliers + global Accounts hub |
| D5 | Nov 15 | 360° project navigation; serial framework; attachments on core transactions |
| D6 | Nov 16 | Users/permissions + Settings + professional sign-in |
| D7 | Nov 17 | Printing + reports + bilingual/RTL completion; integration tests |
| D8 | Nov 18 | Full lifecycle E2E, security, backup/restore, data integrity, release candidate |
| Pilot | Nov 19 | Controlled daily-use pilot with real data and rollback plan |
| H1-H3 | Nov 20–22 | Bug fixes, UX polish, performance, cross-browser and final stability |

## Release gates
1. Migration is reversible and verified on an isolated database.
2. No shipment item can bypass contract-line validation.
3. Quantities cannot exceed approved contract tolerance.
4. Supplier financial records remain supplier-attributable.
5. Role/permission denial is enforced server-side, not only hidden in UI.
6. Every transaction serial is unique and audit-traceable.
7. Attachments cannot leak across projects/permissions.
8. Typecheck, unit, contract, integration, build and Chromium E2E are green.
9. Firefox/WebKit defects are either green or documented as non-blocking browser-specific issues before pilot.
10. Backup and isolated restore rehearsal pass before real data.

## Scope control
No Odoo, general ledger, inventory valuation, AI features, mobile app, or unrelated redesign. New requests after D1 enter the post-pilot backlog unless they block the approved lifecycle.
