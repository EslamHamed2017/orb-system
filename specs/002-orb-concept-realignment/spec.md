# ORB Concept Realignment — Functional Specification

**Status:** Approved for implementation
**Source:** User decisions from Telegram session 20261110_093942_80229520, recorded in `docs/CONCEPT-DECISIONS-2026-11-10.md`.
**Target:** Internal alpha gate by 2026-11-19; owner UAT by 2026-11-23; controlled canary pilot by 2026-11-24; 48–72 hour soak through 2026-11-27.

## Scope
1. Bidirectional 360° navigation between project and all related records.
2. Contract header + versioned multiple line items.
3. Sales and supplier shipment headers + multiple line items tied to contract lines.
4. Partial fulfillment and multi-supplier physical-container consolidation.
5. Product master and movement history without free-stock inventory.
6. Global Accounts hub plus project-filtered accounts views.
7. Customer/supplier management exposed in the UI.
8. Full user management and configurable granular permissions.
9. Professional bilingual sign-in experience.
10. Attachments on every transaction, system serial/reference, and printable outputs.
11. Reports hub and coherent Settings control center.

## Business rules
- Every shipment line references an existing contract line.
- A contract line may be fulfilled by many shipment lines across many shipments.
- A physical purchase container may consolidate supplier lines from multiple suppliers/contracts.
- Customer invoice grouping is one invoice per sales shipment with line detail.
- Supplier invoices remain attributable to a supplier; multi-supplier containers may therefore have multiple supplier invoices.
- ORB is back-to-back: no free inventory, warehouse balance, or inventory valuation.
- The Accounts hub is operational/commercial tracking, not a general ledger.
- Every transaction has an immutable human-readable serial and audit events.
- Attachments inherit access control from their parent transaction.
- Arabic RTL and English LTR are release gates, not later enhancements.

## Pilot acceptance flow
Create customer and suppliers → create products → create project → create multi-line sales contract → create purchase contracts → consolidate supplier lines into a container → create partial sales shipments → issue customer invoice → register supplier invoices, collection/payment, and expenses → attach evidence → print transactions → view product movement and reports → close project.

## Migration safety model
- Expand-only schema first; no database down-migration.
- Deterministic idempotent 1:1 backfill from each legacy single-line version/dataset.
- Preserve v1 approval/dataset hashes; multi-line data uses versioned v2 canonical hashes and reapproval.
- Dual write/read behind feature flags, reconcile, then cut over. Legacy columns are removed only after pilot stabilization.
- Application rollback must work against the expanded schema.
