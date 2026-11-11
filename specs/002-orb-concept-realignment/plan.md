# ORB Fast-Track Execution Plan

## Delivery commitment
- **Internal alpha target:** 2026-11-19.
- **Owner UAT target:** 2026-11-23.
- **Controlled canary pilot target:** 2026-11-24.
- **Soak and broader-pilot decision:** 2026-11-25 through 2026-11-27.
- Scope is implemented on the existing Next.js/Prisma/PostgreSQL foundation; no rewrite.

## Execution strategy
Five lanes run in parallel after the schema contract is frozen:
- **Lane A — Data/API:** expand-migrate-contract schema, line items, fulfillment, invoice grouping.
- **Lane B — 360 UI:** project workspace, detail pages, navigation, Accounts and Masters hubs.
- **Lane C — Access/Admin:** users, roles, permissions, Settings, sign-in.
- **Lane D — Documents/Output:** serials, attachments, printing, reports.
- **Lane E — QA/Ops:** contract/unit/integration/E2E, AR/EN/RTL, backup, security, deployment evidence.

## Critical path
Baseline/CI repair → schema contract → expand/backfill/dual-read migration → APIs → 360 screens → full lifecycle E2E → restore/security rehearsal → immutable candidate → owner UAT → canary pilot.

## Daily milestones
| Date | Deliverable |
|---|---|
| Nov 11 | Repair two red baseline tests and CI topology; preserve current fixes; freeze terminology/invariants |
| Nov 12 | Freeze versioned line/container/invoice/permission architecture, backfill mapping and rollout contract |
| Nov 13 | Expand-only schema and parallel API/UI route shells |
| Nov 14 | Disposable-PostgreSQL migration, legacy backfill reconciliation, old-app compatibility proof |
| Nov 15 | Contract/shipment line APIs, partial fulfillment, tolerance and concurrency tests |
| Nov 16 | Multi-supplier consolidation, supplier invoices, source allocations, serial/attachment services |
| Nov 17 | Multi-line UI, Accounts, product movement, 360 navigation, server-side permissions |
| Nov 18 | Feature-complete integration: printing, reports, settings, users, bilingual core workflows |
| Nov 19 | **Internal alpha gate:** isolated full lifecycle, zero skipped DB migration tests; no real data yet |
| Nov 20 | Integrated defect correction, RTL/a11y, attachment and permission negative-path tests |
| Nov 21 | Firefox/WebKit smoke, security, performance, backup and isolated restore |
| Nov 22 | Clean immutable build, SBOM, signed candidate, app rollback rehearsal |
| Nov 23 | Owner UAT in English and Arabic; close all Sev-1/Sev-2 defects |
| Nov 24 | Controlled canary pilot with limited users/data and monitoring |
| Nov 25–27 | 48–72 hour soak, corrections and broader-pilot go/no-go |

## Release gates
1. Expand migration is idempotent and verified on an isolated database; application rollback requires no database down-migration.
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
