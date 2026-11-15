# ORB QuickBooks-like accounting + coffee trade gap map

**Observed:** 2026-11-15  
**Canonical code examined:** `origin/main` at `550d82c0b6c24f64eb7a4d5dba588084c1125ea5`
**Owner direction:** Build a coherent daily-use accounting system plus international back-to-back coffee shipments. The prior “no accounting module” scope is obsolete.  
**Readiness:** **Not owner-ready.** This map is a source-level baseline, not an acceptance claim.

## Truthful current-state summary

ORB has a substantial PostgreSQL/Prisma operational trade schema (58 models), API contracts, and many workflow screens. Canonical main now includes additive `Tenant`, tenant-owned `Customer`, and append-only `CustomerAuditEvent` models plus a transactionally audited customer repository/service. It still has no tenant membership or session-to-tenant resolver, so production customer routes correctly remain fail-closed. The schema also has no chart-of-accounts, ledger/journal/posting, accounting-period, bank-account/transaction/reconciliation, estimate, credit memo, vendor credit, or bill models. Operational `SalesInvoice`, `SupplierInvoice`, `MoneyMovement`, and `DirectExpense` records therefore do not post into a double-entry ledger and cannot produce authoritative financial statements.

The visible daily-work surface is fragmented. Many UI modules still read or write `localStorage`, including Today, Suppliers, Products, Projects, Shipments, Accounts, roles, and backup. Customer UI no longer falls back to browser business persistence, but it cannot complete operations until trusted server authentication/tenant context is wired. Demo-oriented paths and fixed presentation still remain elsewhere. Browser-only records are single-device conveniences, not acceptable shared business persistence.

Authentication and tenancy remain blocking seams. Canonical customer routes deliberately inject `authenticate: async () => null`; there is no durable tenant membership model from which a server can derive scope. Existing `Party` and `CoffeeSpecification` records are global rather than tenant-owned. Current role concepts are not a substitute for server-derived tenant membership and record-level authorization.

## Target capability map

| Area | Existing evidence | Missing for target | Priority / acceptance boundary |
| --- | --- | --- | --- |
| Platform tenancy | `Tenant`, `User`, `Role`, `Session`, permission services, and tenant-scoped Customer exist | Memberships, authenticated principal → tenant resolution, broader tenant ownership, row-scope enforcement | **P0 foundation.** No caller-supplied tenant IDs trusted. |
| Audit/control | Project-bound `AuditEvent`, approvals, evidence exist | Tenant-wide auditable mutations for masters/accounting; actor/session/correlation; optimistic versions; retention and searchable audit | **P0 foundation.** Create/edit/archive must write audit atomically. |
| Customers | PostgreSQL customer identity/contact/status, scoped repository/service, optimistic versions, atomic audit; UI/API shells fail closed | Membership/session-derived route activation, bilingual names, addresses/tax/payment terms, working list/view/create/edit/archive/reactivate UI | **First vertical slice.** Must work across browsers/users and survive restart. |
| Suppliers/vendors | Browser workspace and legacy `Party` | Same durable lifecycle as Customers, supplier defaults and balances | Second slice after Customers. |
| Products | Browser product register; `CoffeeSpecification` operational model | Tenant ownership, names, lifecycle, validated CRUD, no `localStorage` source of truth | Third slice. |
| Projects/contracts | Rich operational project/contract schema; browser projects also exist | Tenant scope, durable UI binding, customer/supplier/product master links, remove demo/browser fork | Fourth slice. |
| Shipments | Detailed supplier/sales shipment datasets, documents, claims, closure controls | Independent execution-unit UI bound to durable records; container/seal/ports/ETD/ETA/BL/docs; collections/payments/expenses/landed cost/profit; no demo IDs | Fifth slice. |
| Sales/AR | Operational sales invoices and money movements | Estimates/quotes if confirmed, customer invoices/credits/payments, AR application, ledger posting, aging/balances | After Shipment foundation. |
| Purchasing/AP | Supplier invoices and expenses | Bills/vendor credits/payments, AP application, ledger posting, aging/balances | Same accounting tranche. |
| Accounting | No accounting models | Tenant chart of accounts, balanced journal entries/lines, posting rules, controlled manual journals, fiscal periods and locks, immutable posted history/reversals | **P0 for financial truth.** No finance screen may bypass it. |
| Banking | No bank/reconciliation models | Bank accounts/registers, import/feed abstraction, matching, transfers, reconciliation statements and locks | After core posting. |
| Reports | Operational reports and project profit formulas | Ledger-derived P&L, balance sheet, cash flow, AR/AP aging, party balances, transaction detail; period/as-of/currency controls | Must reconcile to postings; never fixed data. |
| Settings/roles/attachments | Partial services and screens | Tenant settings, enforceable server roles, cross-record attachment index tied to durable records | Incrementally across every slice. |
| Internationalization/UX | English/Arabic and MD3 components exist | Server-consistent locale/direction, complete responsive states, no query-param role authority, evidence at desktop/mobile in both locales | Required per vertical slice. |

## Owner daily back-to-back coffee workflow target

1. **Set up counterparties and product:** select durable customer, one or more durable suppliers, and a tenant-owned coffee specification.
2. **Open one trade/project:** enter the customer sale contract and linked supplier purchase contract(s), including quantities, unit prices, currencies, Incoterms, named places, tolerances, payment/document terms, and approval state.
3. **Plan independent execution units:** split the trade into supplier and customer shipment units without losing contract-line traceability or supplier attribution.
4. **Execute logistics:** maintain bags/net/gross weight, container and seal, origin/destination/load/discharge ports, ETD/ETA/actual dates, carrier/vessel, BL, commercial invoice, packing list, revisions, and attachments.
5. **Record financial events:** issue the customer invoice, enter supplier bills, receive and allocate collections, pay and allocate suppliers, record shipment expenses/claims, and post every approved event once to the ledger.
6. **Reconcile landed cost and margin:** allocate purchase cost and shipment expenses to execution units; show quantity fulfillment, AR/AP position, cash, landed cost, revenue, and realized/expected profitability by shipment and whole trade.
7. **Resolve exceptions:** manage short/over shipment, document revision, quality/quantity claims, credits, reversals, and controlled accounting adjustments with evidence and approval.
8. **Close or reopen:** block closure while quantities, documents, payments, expenses, claims, approvals, or postings are incomplete; retain an auditable controlled reopen path.
9. **Run the business:** Today/Dashboard surfaces overdue logistics, receivables, payables, approvals, bank matching, and close blockers; reports reconcile to the same ledger and subledgers.

## Architectural sequence

1. Stabilize CI so exact-head results finish: fix the hanging product-storage lock regression; serialize workflow runs without cancelling in-progress exact-head evidence.
2. Complete tenant membership and server-derived request context, extending the landed `Tenant` and Customer repository/audit foundation.
3. Finish Customers, then deliver complete vertical slices in this order: Suppliers → Products → Projects/Contracts → Shipments → Invoices/Bills/Payments → Banking/Reconciliation → Reports.
4. Build the accounting kernel as the prerequisite portion of the Invoices/Bills/Payments tranche—before any financial event is called authoritative—and extend it through Banking and ledger-derived Reports.
5. Delete or migrate each browser/demo persistence path only when its durable replacement is exercised and covered by migration/rollback tests.

## Immediate Customer slice definition of done

- Tenant is derived from a validated server session/membership, never request headers or form fields.
- PostgreSQL/Prisma owns customer identity, reference, bilingual name, contacts, addresses, payment terms, status, timestamps, version, and tenant-scoped uniqueness.
- Create, list/search/filter, view, edit with optimistic concurrency, archive, and restore/reactivate are real server operations.
- Every mutation writes an append-only audit row in the same transaction.
- Role policy is enforced server-side and action visibility mirrors—not replaces—that enforcement.
- English/LTR and Arabic/RTL desktop/mobile flows cover loading, empty, validation, conflict, forbidden, success, and archived states.
- Integration tests use real PostgreSQL; browser tests prove persistence across page reload and a second context. No fixture or `localStorage` fallback.
- The exact pushed HEAD must have a completed, successful GitHub Actions run. Owner readiness still requires Eslam’s walkthrough and approval.

## Evidence limitations

No screenshots were captured for this planning/CI increment. Existing screenshots do not prove the target architecture. The shared Obsidian vault was inaccessible to this scheduled session (`PermissionError`), so this map is grounded in live repository and GitHub Actions inspection only.
