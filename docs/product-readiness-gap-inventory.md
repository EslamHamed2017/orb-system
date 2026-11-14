# Product readiness gap inventory

**Audit date:** 14 November 2026
**Scope:** the ORB web UI on canonical `origin/main`, the browser-persisted Today/Projects flow, project setup, and the bounded supplier-shipment slice delivered on 14 November 2026.

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

- User-entered project fields persist in an evaluation-user-scoped `localStorage` key; every affected screen states “saved in this browser”. No project is seeded.
- Today uses the browser's real current date and shows exactly one specific next action per saved project, with loading, empty, and error states; that action opens the exact saved project data rather than a generic blocker or fixture route.
- The project register searches the user's records and uses responsive cards with mobile bottom-navigation clearance.
- Creation saves one exact record and routes to that record's detail page.
- Detail identifies the exact record and shows customer, supplier, contracts, shipments, invoices/payments, expenses, claims, and closure/reopen stages without invented totals or links to unrelated demo records.
- A setup-stage project can save its customer, supplier, sales-contract reference, and purchase-contract reference; the saved record becomes active and Today advances to recording the first supplier shipment.
- An active project can save one user-entered supplier-shipment reference, expected-arrival date, and quantity. The project lifecycle and Today then show the recorded shipment and direct the user toward preparing the customer shipment, without sending anything externally.
- Strict persisted-data validation rejects impossible dates, non-positive or excessive shipment quantities, duplicate shipment writes, and shipments attached to impossible project states; corrupt records use the visible storage-error state.
- Setup completion refuses stale submissions if the stored project was already activated or closed, preserving the newer stored record.
- English and Arabic business copy and route-scoped RTL are provided for the bounded flow; technical status enums and hashes remain hidden.

## Remaining work before readiness

1. Replace browser-only persistence with authenticated, tenant-scoped server persistence, concurrency control, authorization, audit history, backup, and recovery.
2. Replace browser-only setup and supplier-shipment records with authoritative customer, supplier, contract, and shipment services; then connect customer shipments, invoices, payments, expenses, claims, and closure before making those later stages actionable.
3. Remove remaining fixed/demo data throughout Finance, approvals, roles, recovery, and all routes outside this slice.
4. Complete end-to-end permissions, accessibility, localization, offline/error recovery, migration, security, observability, and multi-user acceptance testing.
5. Validate operational calculations and compliance controls against production requirements and representative customer data.

No production deployment, outbound communication, payment, or external send is performed by this slice.
