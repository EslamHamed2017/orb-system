# Product readiness gap inventory

**Audit date:** 15 November 2026
**Scope:** the ORB web UI on canonical `origin/main`, the browser-persisted Today/Projects flow, project setup, supplier and customer shipments, supplier invoice/payment, customer invoice/collection, direct project expenses, claims, and project closure/reopen slices delivered on 14 November 2026.

## Truthful status

This work **does not make ORB product-ready**. The bounded daily-use flow uses user-entered records stored only in the current browser. It is a visible workflow for evaluation, not authenticated multi-user persistence or a production data architecture.

## Gaps observed in the live baseline

- Today showed a fixed date and a hardcoded wall of twelve blockers rather than current, user-specific work.
- The Projects register contained fixed sample projects, inert filters, and project detail ignored the requested project identifier.
- Some narrow-screen project views overflowed or competed with the bottom navigation.
- Finance surfaces still expose fixed `DEMO` data.
- The approval service remains unconfigured and the approval screen previously presented a fixed request, technical enums, hashes, test addresses, fabricated counts, and inert decision controls.
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
- After a supplier shipment exists, the project can save one user-entered customer-shipment reference, planned-dispatch date, and quantity bounded by both project and supplier-shipment quantities. Today then advances to a completable shipment-handover review.
- After handover review, the project can save one user-entered supplier invoice and its full recorded payment. Today advances from invoice to payment and clears the action only after both are persisted. The UI explicitly states that payment is recorded only and ORB does not initiate or execute a bank transfer. Invoice-only and paid records can be cleared for corrected re-entry, with stale destructive resets rejected.
- After supplier payment, the project can save one user-entered customer sales invoice and one or more partial customer collections. Today shows the exact remaining balance after each collection and clears the receivables action only when recorded collections equal the invoice. The UI states that collections are records of received funds only; ORB does not connect to a bank, execute a transfer, send an invoice, or contact the customer.
- Customer invoices and collections use exact fixed-point arithmetic to six decimal places and reject invalid chronology, duplicate collection references, non-positive values, over-collection, impossible persisted relationships, and stale versions/timestamps. Customer receivables can be cleared for corrected re-entry without removing valid supplier finance; correcting upstream supplier finance explicitly removes dependent customer receivables rather than leaving orphaned data.
- Active projects can record user-entered direct expenses on a dedicated bilingual task page instead of the fixed demo expense presentation. Each record includes its reference, date, category, payee, amount, and project currency; the page provides honest empty/loading/error/read-only states, responsive mobile layout, a persisted total, and correction by explicit removal and re-entry. Recording an expense never initiates a payment or external communication.
- Direct expenses are independent project costs: they can be recorded while operational and finance work continues, remain discoverable from the project overview, and are preserved when upstream invoice/payment/collection entries are corrected. Duplicate references, invalid dates, non-positive or inexact amounts, stale writes, malformed persisted records, and mutation from the read-only route context are rejected or hidden.
- Strict persisted-data validation rejects impossible dates, non-positive or excessive supplier/customer shipment quantities, duplicate writes/reviews, review timestamps without eligible customer shipments, customer shipments without supplier shipments, and shipments attached to impossible project states. Customer shipments and completed reviews remain parse-valid if the project later closes; corrupt records use the visible storage-error state.
- Setup, shipment recording, and shipment-handover review refuse stale submissions when the stored lifecycle has already advanced, preserving the newer stored record.
- Claims are recorded and resolved from user-entered project parties and business details on a dedicated bilingual task page; open claims become a direct blocker only after the core lifecycle work is complete.
- Eligible projects now have a dedicated bilingual closure page backed by the saved record rather than fixed assessment identifiers. Readiness names shipment review, supplier payment, customer collection, open claims, and reopened-work review in business language. Close/reopen notes and dates persist, stale writes and impossible chronology are rejected, closed projects leave Today, and reopening creates a visible review step before another close. No external communication or payment occurs.
- English and Arabic business copy and route-scoped RTL are provided for the bounded flow; technical status enums and hashes remain hidden.
- The approval preview now uses English/Arabic business language, responsive RTL/LTR facts, and a business-readable change summary. Raw action/subject codes, source fields, recipient address, hash, and evidence metadata are collapsed under an explicit technical-details disclosure.
- The approval page no longer presents fabricated workload KPIs or inert approve/reject controls. It explicitly states that the secure approval service is not connected, that the fixed request is preview-only, and that no external message was sent.

## Remaining work before readiness

1. Replace browser-only persistence with authenticated, tenant-scoped server persistence, concurrency control, authorization, audit history, backup, and recovery.
2. Replace browser-only setup, shipment, supplier invoice/payment, customer invoice, collection, direct-expense, claim, and closure records with authoritative customer, supplier, contract, shipment, invoice, money-movement, claim, approval, and lifecycle services.
3. Connect the approval inbox and decision controls to authenticated server persistence, then remove the remaining fixed preview request; also remove fixed/demo data throughout Finance, roles, recovery, and all routes outside this slice.
4. Complete end-to-end permissions, accessibility, localization, offline/error recovery, migration, security, observability, and multi-user acceptance testing.
5. Validate operational calculations and compliance controls against production requirements and representative customer data.

No production deployment, outbound communication, payment, or external send is performed by this slice.
