# UI Workflow and State Contracts

## Global interaction contract

- The same route and capability exists in Arabic and English. Arabic sets root `lang=ar dir=rtl`; English sets `lang=en dir=ltr`. Locale switching preserves record, tab, filters, and unsaved-form warning state.
- ORB MD3 components expose normal, hover, focus-visible, pressed, selected, disabled, loading, success, warning, and error states. Keyboard order follows visual/logical direction; focus is never lost after dialogs or mutations. WCAG 2.2 AA contrast, names, errors, and target sizes are acceptance gates.
- References, Latin codes, currencies, dates, container/seal numbers, and hashes use bidi isolation. Tables reverse layout direction but retain semantic column meaning. User-configurable density never reduces accessible hit targets.
- All tables are server-paginated, sortable, filterable, column-labelled, keyboard operable, and provide a non-visual summary. Sensitive columns are absent, not merely hidden, without permission.
- Every mutation shows pending state, prevents accidental duplicate submission, sends an idempotency key and expected version, and renders RFC 9457 field/global errors. A 412 opens a compare/reload flow; it never overwrites silently.
- Destructive-looking business actions are cancellation/reversal/revision commands with reason and consequences, never delete buttons. Approval dialogs name exact record/version, changed fields, evidence, and policy.

## Screen map

1. Project list: reference, customer, route, execution/financial/final status, blockers; permission-shaped filters and saved views.
2. Project workspace: Overview, Sales Contract, Purchases, Sales Shipments, Supplier Shipments, Documents, Money, Expenses, Claims, Profit, Closure, Audit.
3. Create Project wizard: customer/route -> one primary sales contract -> coffee/terms/tolerances -> review/create atomically.
4. Shipment workspace: approved dataset, logistics, route checklist, supplier sources, documents, settlement, expenses, claims, four independent status chips.
5. Approval inbox: policy reason, threshold/exception, exact subject version and evidence; approve/reject with comment.
6. Evidence viewer: immutable revision metadata, hash, source links, authorized download, revision timeline.

## Workflow contracts

### W1 — Project and sales contract

`Create -> Draft -> Submit -> Pending approval -> Approve -> Active`. Creation is atomic: no Project can remain without exactly one primary sales contract. Tolerances default visibly to zero. A new independent contract uses Create Project; the amendment command requires reason/effective date and creates a version comparison. Approved prior versions remain readable.

Acceptance: a trained user completes a standard record in <=5 minutes; duplicate scoped references show a localizable 409; supplier-side values never appear in customer-only views.

### W2 — Partial shipments and supplier sourcing

The remaining contract panel distinguishes contracted, planned, confirmed/shipped, delivered, cancelled, and remaining quantity. The source editor supports one-to-many rows and continuously displays allocated versus required quantity. Confirm remains disabled with an explained blocker until sources reconcile, route requirements pass, and tolerances pass or an exact exception approval/reason exists.

Concurrent allocation conflict returns 409/412 and reloads authoritative availability. No partial allocation rows persist.

### W3 — Route checklists

The selected profile and version are visible. `Foreign-to-Foreign`, `UAE Free Zone Re-export`, and `UAE Import` render their applicable document, milestone, expense, and evidence requirements. Items are `Not started`, `In progress`, `Satisfied`, `Not applicable by rule`, or `Exception approved`; users cannot manually claim legal/tax status. Missing closure-blocking requirements appear in Closure with source links.

### W4 — CINV and Packing List

Both document types select the exact same approved ShipmentDataset. User chooses Arabic, English, or bilingual at render time. Preview lists shared-field checks; acceptance requires zero mismatches. `Draft -> Pending approval -> Approved -> Sent`. An approved/sent correction uses Revise, requires reason, creates revision N+1, and leaves prior bytes/hash/timeline immutable.

### W5 — Advances, receipts, and allocations

Record advance permits customer/supplier, Project, contract, amount/currency/date/evidence without an invoice. It appears as Unallocated and never as invoiced revenue. Allocation editor shows movement available and target outstanding in the same currency; partial/multiple allocations are supported. Over-allocation is blocked transactionally. Reversal/reallocation creates linked history rather than editing prior rows.

Statements expose customer/contract/shipment/supplier/Project levels, keep currencies in separate sections, and label optional AED rate/date/source.

### W6 — Expenses

Expense requires vendor, category, amount/currency, proof, scope, status, and approver when policy requires. A project-wide allocation selects quantity, value, or approved manual method. Preview must reconcile source amount exactly and identify the rounding row. Approval freezes the allocation set; correction uses reversal/new version.

### W7 — Claims and closure

Claims show type, parties, quantity/value effect, evidence, owner, and resolution. Financial closure status is computed independently: a fully collected shipment may be Financially Closed while document/claim chips remain open. Project Final Close opens a dimension checklist (quantity, delivery, documents, supplier obligations, expenses, claims, approvals). Blockers link to records. Exceptions require authorized exact-version approval and reason. Reopen likewise requires reason and displays the immutable audit result.

### W8 — Profit Center

Four cards are always distinct: Expected Margin, Committed Margin, Actual Operational Margin, Cash Position. Each shows currency, as-of time, formula version, formula disclosure, and drill-down. Advances change Cash Position only; mixed currencies are not silently combined. Unauthorized users see neither cards nor amounts.

### W9 — Audit and evidence

Timeline is append-only and filters by aggregate/action/actor/date. Every event exposes version, correlation ID, reason, and hash verification result subject to permission. Evidence upload calculates/verifies SHA-256; a retry with the same idempotency key returns the prior result, while same key/different payload produces a conflict. Authorized download is audited.

## Explicit Release 1 exclusions

No navigation, screen, or acceptance dependency exists for bank statement import/matching, tax-pack preparation/sending, or historical migration. Extension points may appear only as unavailable future capability documentation, not interactive placeholders that imply delivery.
