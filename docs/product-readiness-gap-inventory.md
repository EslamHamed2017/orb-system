# Product readiness gap inventory

**Audit date:** 14 November 2026
**Scope:** the ORB web UI on canonical `origin/main`, the browser-persisted Today/Projects flow, project setup, and the bounded supplier- and customer-shipment slice delivered on 14 November 2026.

## Truthful status

This slice **does not make ORB product-ready**. It replaces fabricated projects in Today, the project register, creation, and overview with user-entered records stored only in the current browser. It is a visible workflow for evaluation, not a production data architecture.

## Gaps observed in the live baseline

- Today showed a fixed date and a hardcoded wall of twelve blockers rather than current, user-specific work.
- The Projects register contained fixed sample projects, inert filters, and project detail ignored the requested project identifier.
- Some narrow-screen project views overflowed or competed with the bottom navigation.
- Finance surfaces still expose fixed `DEMO` data.
- Approval surfaces can expose implementation enums and opaque hashes instead of business language.
- Roles, backup/recovery, and other administration views still rely on fixtures.
- Production database and authentication adapters are unavailable to this slice.

## What this slice closes

- User-entered project fields persist in an evaluation-user-scoped `localStorage` key. Supplier/customer save and review actions prominently warn in English and Arabic that data exists only in this browser, is not synchronized or backed up, and is removed when browser data is cleared. No project is seeded.
- Today uses the browser's real current date and shows exactly one specific next action per saved project that needs work in the bounded flow, with loading, empty, and error states; that action opens the exact saved project data rather than a generic blocker or fixture route.
- The project register searches the user's records and uses responsive cards with mobile bottom-navigation clearance.
- Creation saves one exact record and routes to that record's detail page.
- Detail identifies the exact record and shows customer, supplier, contracts, shipments, invoices/payments, expenses, claims, and closure/reopen stages without invented totals or links to unrelated demo records.
- A setup-stage project can save its customer, supplier, sales-contract reference, and purchase-contract reference; the saved record becomes active and Today advances to recording the first supplier shipment.
- An active project can save one user-entered supplier-shipment reference, expected-arrival date, and quantity. The project lifecycle and Today then advance to recording the first customer shipment.
- After a supplier shipment exists, the project can save one user-entered customer-shipment reference, planned-dispatch date, and quantity bounded by both project and supplier-shipment quantities. Today then advances to a completable shipment-handover review; completing it is persisted once, removes the project from actionable Today work, and shows the bounded flow as complete without inventing an invoice or payment action.
- Strict persisted-data validation rejects impossible dates, non-positive or excessive supplier/customer shipment quantities, duplicate writes/reviews, review timestamps without eligible customer shipments, customer shipments without supplier shipments, and shipments attached to impossible project states. Customer shipments and completed reviews remain parse-valid if the project later closes; corrupt records use the visible storage-error state.
- Setup, shipment recording, and shipment-handover review refuse stale submissions when the stored lifecycle has already advanced, preserving the newer stored record.
- English and Arabic business copy and route-scoped RTL are provided for the bounded flow; technical status enums and hashes remain hidden.

## Remaining work before readiness

1. Replace browser-only persistence with authenticated, tenant-scoped server persistence, concurrency control, authorization, audit history, backup, and recovery.
2. Replace browser-only setup and supplier/customer-shipment records with authoritative customer, supplier, contract, and shipment services; then connect invoices, payments, expenses, claims, and closure before making those later stages actionable.
3. Remove remaining fixed/demo data throughout Finance, approvals, roles, recovery, and all routes outside this slice.
4. Complete end-to-end permissions, accessibility, localization, offline/error recovery, migration, security, observability, and multi-user acceptance testing.
5. Validate operational calculations and compliance controls against production requirements and representative customer data.

No production deployment, outbound communication, payment, or external send is performed by this slice.
