# Feature Specification: ORB Limited Daily-Use Operational Beta

**Feature Branch**: `001-orb-trade-operations`
**Created**: 2026-11-05
**Status**: Planning repaired; Plan Gate blocked only by compatibility evidence and independent review
**Release authority**: This file is the authoritative Release 1 scope. If another planning artifact conflicts, this file and ADR-001 control.

## Fixed delivery milestones

- **2026-11-12**: deployed limited daily-use operational beta used for real ORB work.
- **2026-11-12 through 2026-11-18**: one week of observed real-use corrections; fixes may refine the accepted journeys but may not add deferred scope.
- **2026-11-19**: stabilized, offer-ready pilot with acceptance evidence.

These are fixed milestones, not permission to waive security, audit, backup/restore, review-first sending, or acceptance evidence.

## Release 1 scope and roles

Release 1 has exactly three fixed roles:

| Role | Allowed pilot responsibility |
|---|---|
| Owner/Admin | all pilot data; fixed approvals and exceptions; user/master administration; final close/reopen; exact external-send approval |
| Operations | masters and operational drafts; contracts, shipments, route evidence/milestones, documents, expenses and claims; no approval of own controlled action |
| Finance/Viewer | read all operational records; record/confirm money and supplier invoices; view statements/margins; no controlled approval unless also Owner/Admin |

One user may hold more than one fixed role, but self-approval is prohibited for contracts, tolerance exceptions, expenses, document outputs, claims, closure exceptions, and external sends.

Release 1 acceptance includes only:

1. Fixed pilot roles and essential masters: customers, suppliers, coffee specifications, currencies, expense categories, and the three fixed routes.
2. One Project for each independent sales contract; amendments stay in that Project; one or more purchase contracts.
3. Sales and supplier shipments with exactly one primary supplier shipment source per sales shipment.
4. Fixed checklists for Foreign-to-Foreign, UAE Free Zone Re-export, and UAE Import, including evidence and milestone completion.
5. Versioned Commercial Invoice (CINV) and Packing List generated from the same approved shipment dataset.
6. Simple supplier invoice and supplier-shipment confirmation.
7. Customer/supplier advances, receipts/payments, and allocation to eligible CINV/supplier invoices.
8. Direct expenses assigned to exactly one Project or one sales shipment.
9. Basic customer, supplier, shipment, and Project operational statements.
10. Expected margin, committed margin, actual operational margin, and cash position shown separately.
11. Simple controlled claims with record, review, resolve/reject, and closure blocking; no advanced settlement mechanism.
12. Shipment Financially Closed and Project Financially Closed/Final Closed rules and blockers.
13. Arabic RTL and English LTR ORB-branded Material Design 3 UI; Arabic, English, or bilingual document output.
14. Least privilege, immutable audit/evidence, encryption, tested backup/restore, concurrency control, and review-first external sending.

## Active user journeys and acceptance

### A1 — Project, contracts, and fixed approvals

Given essential masters, Operations can create a Project and its one primary sales-contract draft atomically, add purchase-contract drafts, submit exact versions, and Owner/Admin can approve or reject them. A new independent sales contract creates a new Project; a same-contract amendment creates a new immutable version. Duplicate scoped references fail. Omitted quantity/net/gross-weight tolerances persist as zero.

### A2 — Supplier and sales shipment execution

Operations creates and confirms a supplier shipment against an approved purchase contract, then creates a sales shipment against the approved sales contract and chooses exactly one confirmed supplier shipment as its primary source. Confirmation displays contracted, confirmed, delivered/cancelled, and remaining quantities. Outside-tolerance confirmation is blocked until Owner/Admin approves the exact shipment dataset and recorded reason.

### A3 — Fixed route checklist and evidence

Each sales shipment receives exactly one versioned fixed checklist:

| Route | Required Release 1 items |
|---|---|
| Foreign-to-Foreign | origin and destination; transport reference; origin/export evidence; departure, arrival, and delivery milestones/evidence |
| UAE Free Zone Re-export | free-zone entry evidence/milestone; storage/handling evidence when used; exit/re-export customs evidence; outbound transport and delivery evidence/milestone |
| UAE Import | UAE import declaration; customs clearance and assessed-charge evidence; inbound transport; release and delivery milestones/evidence |

Users upload, view, and download authorized evidence. Uploads are immutable and hash-verified; downloads are audited. Required incomplete items block final closure. The checklist makes no tax/legal classification.

### A4 — Controlled CINV and Packing List

CINV and Packing List are generated from the same exact approved shipment dataset in Arabic, English, or bilingual mode. Generation has a status endpoint. An exact output version moves `DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT` or `CANCELLED`; approved/sent bytes are immutable and correction creates a new version with reason.

Before approval and again before send, the system freezes and displays: output ID/version and SHA-256, recipient list (To/Cc), attachment IDs/versions/SHA-256, subject, and body digest. Owner/Admin approval binds that exact manifest. Any recipient, attachment, body, subject, output, or output-version change invalidates approval and requires a new approval. Send is always an explicit human command after preview; there is no automatic delivery.

### A5 — Supplier invoice and settlement

Finance/Viewer records a simple supplier invoice against one supplier shipment and confirms it after fixed approval. Users record customer advances/receipts and supplier advances/payments before or after invoices. Allocations may be partial and many-to-many across eligible documents in the same party/currency, never exceeding movement availability or document outstanding value. Reversal preserves history. Supplier-shipment confirmation and supplier-invoice balance appear in supplier and Project statements.

### A6 — Direct expense and approval

Operations records an expense with vendor, category, amount/currency, proof, and exactly one scope: Project or sales shipment. Owner/Admin approves/rejects the exact version. Approved expense corrections use cancellation/replacement. Release 1 has no shared-expense distribution.

### A7 — Statements, margin, and cash

Authorized users view customer, supplier, sales-shipment, supplier-shipment, and Project operational statements. Original currencies remain separate. Each line links to its source. Expected, committed, actual operational margin, and cash position have disclosed formulas and source drill-down. Advances affect cash position, not operational revenue. Optional AED equivalents show recorded rate, date, and source.

### A8 — Simple claims

Operations opens a quantity, weight, quality, delivery, price, or document claim with party, shipment, description, optional quantity/amount, and evidence. Owner/Admin may move it through review to resolved or rejected with reason/evidence. Open/under-review claims block Project Final Close unless an exact blocker-specific closure exception is approved. Release 1 records the outcome only; it does not automate discounts, replacement logistics, compensation, or netting.

### A9 — Financial and final closure

A non-cancelled shipment becomes `FINANCIALLY_CLOSED` automatically when its customer invoice balance is exactly zero; documents, route items, or claims may remain visibly open. It reopens financially after an authorized reversal/refund makes the balance non-zero. A Project becomes `FINANCIALLY_CLOSED` when all non-cancelled sales shipments are financially closed.

Project `FINAL_CLOSED` is blocked until quantity/delivery, required route milestones/evidence, CINV/Packing List, supplier shipment/invoice obligations, direct expenses, claims, and required approvals are complete. Assessment returns every blocker. Owner/Admin may approve only eligible named blocker exceptions against the exact Project version, with reason. Final close and reopen require a fresh assessment, exact version, Owner/Admin command, reason for reopen, and immutable audit.

### A10 — Bilingual MD3, security, audit, and recovery

All journeys A1–A9 work in Arabic RTL and English LTR using the exact screen map in `contracts/ui-workflows.md`. The ORB MD3 acceptance baseline covers color roles, type scale, shape, elevation, spacing, responsive navigation, states, focus, keyboard order, error/empty/loading states, dense tables, bidirectional references, and WCAG 2.2 AA. ORB identity replaces Google branding.

Authorization is server-side; supplier cost, margins, identities, evidence, and money are permission-shaped. Every mutation uses optimistic concurrency and audit. Evidence and approved versions are immutable. Backups meet RPO <=15 minutes/RTO <=4 hours and a pre-beta isolated restore must prove database/object linkage.

## Authoritative state machines

### Project

`DRAFT -> ACTIVE -> FINANCIALLY_CLOSED -> FINAL_CLOSED`

- `DRAFT -> ACTIVE`: primary sales contract approved.
- `ACTIVE <-> FINANCIALLY_CLOSED`: computed from all non-cancelled sales shipments; reversal can return it to `ACTIVE`.
- `FINANCIALLY_CLOSED -> FINAL_CLOSED`: only a current closure assessment with no uncovered blocker.
- `FINAL_CLOSED -> ACTIVE|FINANCIALLY_CLOSED`: Owner/Admin reopen with reason; resulting state is recomputed.
- `CANCELLED` is allowed only before any confirmed shipment or confirmed money movement, by Owner/Admin with reason.

### Sales shipment axes

- Execution: `DRAFT -> CONFIRMED -> IN_TRANSIT -> DELIVERED`; `DRAFT|CONFIRMED -> CANCELLED`; `CONFIRMED|IN_TRANSIT -> REJECTED` with reason.
- Finance: `OPEN <-> FINANCIALLY_CLOSED` computed strictly from customer invoice outstanding balance.
- Documents: `MISSING -> DRAFT -> PENDING_APPROVAL -> COMPLETE`; cancellation/revision can return it to `DRAFT` or `MISSING`.
- Claims: `CLEAR -> OPEN -> UNDER_REVIEW -> RESOLVED|REJECTED`; a new claim returns it to `OPEN`.

Supplier shipment execution is `DRAFT -> CONFIRMED -> IN_TRANSIT -> RECEIVED`, with controlled `CANCELLED|REJECTED`. These axes are independent and never collapsed into one status.

## Fixed approval matrix

| Action | Requester | Approver | Exact-version binding / required evidence |
|---|---|---|---|
| Sales/purchase contract or amendment | Operations | Owner/Admin | contract version; reason for amendment |
| Supplier shipment confirmation | Operations | Owner/Admin | supplier-shipment dataset and source evidence |
| Sales shipment tolerance exception | Operations | Owner/Admin | shipment dataset, breached fields/values, reason |
| Supplier invoice confirmation | Finance/Viewer | Owner/Admin | invoice version and invoice evidence |
| Direct expense | Operations | Owner/Admin | expense version and proof |
| CINV/Packing List output | Operations | Owner/Admin | output version/hash and source dataset |
| External send | Operations | Owner/Admin | exact output version/hash, To/Cc, attachment IDs/versions/hashes, subject/body digest |
| Claim resolution/rejection | Operations | Owner/Admin | claim version, reason, evidence |
| Closure exception/final close/reopen | Operations or Finance/Viewer | Owner/Admin | Project version, named blocker(s), current assessment; reason mandatory for exception/reopen |

Approvals expire when the bound subject version or send manifest changes. No configurable approval designer exists in Release 1.

## Release 1 requirements

- **R1-001** through **R1-014** are exactly the fourteen scope items above.
- **R1-015**: stable references are unique by documented scope; approved versions and audit events are immutable.
- **R1-016**: every state transition follows the state machines above and returns a localized RFC 9457 problem on failure.
- **R1-017**: all active journeys are executable through `contracts/openapi.yaml` and `contracts/ui-workflows.md`.
- **R1-018**: mutations require idempotency; mutations of existing aggregates require the current `If-Match` version.
- **R1-019**: numeric quantities, weights, money, and FX use exact decimal arithmetic; different currencies are not silently summed.
- **R1-020**: Release 1 exposes no route, screen, endpoint, schema, acceptance test, or closure dependency for a deferred feature.

## Measurable acceptance

- A trained pilot user completes Project + primary sales contract in <=5 minutes.
- A complete Project-to-close daily-use scenario is executable in both languages with zero critical/serious accessibility findings and no functional divergence.
- CINV/Packing List shared fields have zero mismatch; sent manifest approval is invalidated by any controlled change.
- Quantity, settlement, statement, margin, and cash examples reconcile with zero unexplained variance.
- No outside-tolerance shipment, unapproved direct expense, unapproved output/send, or blocked final close succeeds.
- Replayed idempotent commands create zero duplicate effects; stale writes never overwrite.
- Security scan has zero unaccepted Critical findings; pre-beta restore meets RPO/RTO and preserves hashes/audit/object links.
- The deployed beta has recorded daily use by 2026-11-12; correction log covers 2026-11-12–18; stabilization evidence is signed by 2026-11-19.

## Future features — not Release 1 acceptance

Bank import/matching, tax evidence pack, historical migration, multiple supplier sources per sales shipment, shared-expense allocation, configurable approval designer, dynamic route designer, and advanced claim settlements require separate future specifications. They MUST NOT appear as Release 1 endpoints, interactive controls, seeded acceptance data, pass criteria, or closure blockers.

## Assumptions and boundaries

AED, USD, and SAR are initial currencies. ORB is an operational trade system, not a ledger: no chart of accounts, journals, trial balance, inventory valuation, automated tax determination/filing, portals, or automated external email. The compatibility spike in `plan.md` remains blocking until a clean install and typecheck using exact pins is captured; this specification does not claim it passed.
