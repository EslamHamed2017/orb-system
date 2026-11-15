# ORB accounting and coffee-trade foundation design

## Decision

Use a single tenant-aware PostgreSQL/Prisma system of record with explicit domain modules and one double-entry accounting kernel. Operational trade events create accounting postings through controlled policies; reports read the same ledger and subledgers. Browser storage may be used only for ephemeral UI preferences, never business records.

## Boundaries

- **Identity/Tenancy:** authenticated session, membership, tenant, role assignments. Produces a trusted `RequestContext` containing tenant, actor, session, locale, and permissions.
- **Masters:** Customers, Suppliers, Products. Tenant-scoped CRUD/lifecycle and audit.
- **Trade:** Projects, sales/purchase contracts, independent shipments, documents, claims, closure.
- **Sales/AP/Expenses/Banking:** commercial documents and settlements with explicit allocation state.
- **Accounting:** chart of accounts, posting policies, journal entries/lines, periods/locks, reversals. It alone creates posted ledger facts.
- **Reporting:** ledger/subledger queries with as-of/period/currency inputs; no fixture totals.
- **Attachments/Audit:** immutable metadata and append-only mutation history, tenant-scoped across modules.

## Data and control rules

Every business table carries `tenant_id`, lifecycle state, optimistic `version`, and timestamps. References are unique inside a tenant. API handlers derive tenant and actor from the authenticated session, validate closed request schemas, authorize operations server-side, and call a service that commits record plus audit atomically. Posted accounting entries are immutable and balanced by currency; corrections use reversal/replacement. Period locks reject backdated postings without a controlled reopen/adjustment path.

## Financial integration

Each approved event has a deterministic posting policy: invoice, credit, bill, expense, customer receipt, supplier payment, bank transaction, landed-cost allocation, and approved claim settlement. Posting records retain source type/id/version and idempotency key, preventing duplicate postings. AR/AP allocations and bank reconciliation reference posted lines rather than maintaining disconnected totals. P&L, balance sheet, cash flow, aging, balances, transaction detail, and shipment profitability reconcile to these records.

## Migration strategy

Add tenancy and accounting tables additively. Introduce durable vertical slices one at a time and migrate only validated business records; never silently import browser data. Keep fail-closed legacy routes until real session-to-membership resolution exists. Remove fixture/browser business paths only after replacement API, UI, migration, rollback, and evidence tests pass.

## UX

Use ORB Material 3 patterns with task-first dashboard/navigation. Every slice provides responsive table/cards, meaningful empty/loading/error/conflict/forbidden states, keyboard/focus support, English LTR and Arabic RTL. Role-based hiding is convenience only; the server remains authoritative.

## CI evidence discipline

Workflow runs are serialized per ref with `cancel-in-progress: false` so a started exact-head run can finish. GitHub may still replace an older *pending* run in the same concurrency group; therefore success is claimed only for a completed run whose `headSha` exactly equals the pushed commit.

## Verification

Each slice requires schema/migration tests against PostgreSQL, repository/service/API tests, browser workflows in four viewport/locale combinations, audit/permission/tenant-isolation regression tests, independent technical and product/UX review, and a completed successful exact-head GitHub Actions run. “Owner-ready” remains false until Eslam approves the working daily workflow.
