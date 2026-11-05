# Feature Specification: ORB Sales-Ready Trade Operations Pilot

**Feature Branch**: `001-orb-trade-operations`  
**Created**: 2026-11-05  
**Deadline**: 2026-11-19 (fixed commercial milestone)  
**Status**: Clarified; authoritative pilot cut aligned to ADR-001

## Authority and outcome

This specification defines the deployed, sales-ready working pilot due on 2026-11-19. It is not a full-production claim. [ADR-001](decisions/ADR-001-two-week-offer-pilot.md) is the scope decision; this file expresses its acceptance baseline. `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `contracts/` MUST conform to this file and ADR-001.

One independent customer sales contract creates one canonical Project. An amendment to that same contract remains in the Project as a new immutable version. The pilot proves one complete, review-controlled Core Trade cycle in a deployed environment.

## Pilot actors and fixed access

The pilot has exactly three fixed roles; users are assigned one role.

| Role | Pilot access |
|---|---|
| Owner/Admin | All pilot data; approval inbox and decisions; tolerance and closure exceptions; document approval; every external send; reopen; user/master administration |
| Operations | Masters; draft Projects/contracts/shipments; route checklists and milestones; evidence; document generation; supplier invoice/shipment confirmation; claims; send requests; no approval decision or margin access |
| Finance/Viewer | Record/confirm operational money movements; allocate settlements; create direct expenses and submit them; view statements, supplier cost, margin and closure; no approval decision or external send |

Server authorization is authoritative. Sensitive fields are omitted from unauthorized responses, not merely hidden in the UI.

## User journeys and acceptance

### P1 — Project and versioned contracts

An Operations user creates a Project atomically with one primary sales contract, adds one or more purchase contracts, submits versions, and Owner/Admin approves or rejects them from the approval inbox.

1. Valid creation produces stable unique Project and contract references in `DRAFT`.
2. Approval applies only to the exact submitted version. Editing approved terms creates a new draft revision with reason/effective date; prior approved revisions remain readable.
3. The Project separates customer and supplier values while showing quantity/value progress from one workspace.
4. A second independent sales contract creates another Project.

### P2 — Supplier and sales shipment execution

Operations records a supplier shipment and supplier invoice, confirms the supplier shipment, then assigns that single supplier shipment as the primary source of one sales shipment.

1. Each pilot sales shipment has exactly one primary supplier shipment before confirmation; multi-source allocation is rejected.
2. Contract progress shows planned, confirmed/shipped, delivered, cancelled, and remaining quantities exactly.
3. Omitted quantity/net/gross-weight tolerances are zero. An out-of-tolerance confirmation is blocked until Owner/Admin approves an exact-version `TOLERANCE_EXCEPTION` request with reason.
4. Sales-shipment execution follows the authoritative state machine below; stale versions never overwrite.

### P3 — Fixed route checklist and evidence

Each shipment uses exactly one versioned fixed checklist: Foreign-to-Foreign, UAE Free Zone Re-export, or UAE Import.

1. Operations records applicable milestone dates and satisfies each checklist item with immutable evidence or a permitted not-applicable reason.
2. Required checklist items block confirmation/delivery/final closure at their declared gate.
3. Evidence upload records SHA-256, size, media type, uploader, immutable object version, and link; authorized users can view metadata and download; every view/download is audited.
4. The checklist records operational completeness only and makes no tax/legal determination.

### P4 — CINV, Packing List, approval, and delivery

Operations generates Commercial Invoice (CINV) and Packing List revisions from the same approved shipment dataset in English, Arabic, or bilingual mode.

1. Shared party, reference, quantity, bags, net/gross weight, Incoterm and route data match exactly.
2. Generation creates `DRAFT`; Operations submits; Owner/Admin approves/rejects the exact revision. Approved bytes and hash are immutable.
3. Every external send, including the first and any resend, requires a separate `EXTERNAL_SEND` request naming exact approved revision, recipients, attachment evidence IDs, and channel. Only Owner/Admin may approve and execute that exact send.
4. Send is blocked if the document revision or recipient/attachment set differs from the approval. Delivery status and attempt evidence are retained.
5. Cancellation requires Owner/Admin, reason, and a new immutable status event. Correction creates a new revision; a prior approved/sent/cancelled revision is never overwritten.

### P5 — Operational money, expenses, and statements

Finance/Viewer records customer advances/receipts and supplier advances/payments before or after invoices, and allocates them to eligible CINV or supplier-invoice balances.

1. An advance before invoice remains unallocated and does not create revenue or an invoice.
2. Allocations may be partial/many-to-many but never exceed movement availability or target outstanding balance; currencies remain separate.
3. Expenses are assigned directly to exactly one sales shipment or the Project. Shared/weighted/manual allocation is rejected. Expense approval follows the fixed matrix.
4. Customer, sales-contract, sales-shipment, supplier, purchase-contract, supplier-shipment, and Project operational statements reconcile to approved/confirmed source records with zero unexplained variance.

### P6 — Simple controlled claims and resolutions

Operations opens a quantity, weight, quality, delivery, price, or document claim against one shipment with evidence and claimed quantity/amount where applicable.

1. Claim state is `OPEN -> UNDER_REVIEW -> RESOLVED` or `REJECTED|WITHDRAWN`.
2. Resolution is one of `DISCOUNT`, `REPLACEMENT`, `COMPENSATION`, `REJECTION`, or `WAIVER`, with reason, evidence, quantity/amount effect, and Owner/Admin exact-version approval.
3. Unresolved claims block Final Close unless an exact blocker receives an approved closure exception.

### P7 — Profit, settlement, and closure

Authorized users see Expected Margin, Committed Margin, Actual Operational Margin, and Cash Position as separate figures with formula, currency, as-of time, and source drill-down.

1. Advances affect cash position but not operational revenue.
2. Settlement assessment shows movement availability, target balances, and shipment/Project financial completeness.
3. A sales shipment becomes `FINANCIALLY_CLOSED` when its customer invoice balance is zero, independently of execution, documents, or claims; a reversal reopens financial status with audit.
4. A Project becomes `FINANCIALLY_CLOSED` when all non-cancelled sales shipments are financially closed.
5. Final Close requires all closure dimensions to pass or each named blocker to have an Owner/Admin exact-version `CLOSURE_EXCEPTION` approval. Close and reopen require reason and immutable audit.

### P8 — Bilingual MD3/ORB sales demonstration

The complete pilot path is executable in English LTR and Arabic RTL with equivalent capability. Generated output supports English, Arabic, and bilingual modes without duplicating the business record.

Acceptance evidence MUST include paired screenshots at 1440×900 and 390×844 for Project workspace, shipment/checklist, approval inbox, document preview/send, statement, and closure; keyboard-only recordings for create/approve/send; automated accessibility results; computed-token capture for ORB colors/type/shape/elevation; focus/error/disabled/loading state captures; RTL/LTR layout comparison; and representative generated PDFs. Evidence MUST identify build, locale, viewport, actor, UTC time, and scenario.

## Authoritative state machines

### Project

`DRAFT -> ACTIVE -> OPERATIONALLY_COMPLETE -> FINAL_CLOSED`

- `DRAFT -> ACTIVE`: primary sales-contract version approved.
- `ACTIVE -> OPERATIONALLY_COMPLETE`: every non-cancelled sales shipment delivered/cancelled and route completion gates satisfied.
- `OPERATIONALLY_COMPLETE -> FINAL_CLOSED`: current closure assessment has no uncovered blockers and Owner/Admin confirms close with reason.
- `FINAL_CLOSED -> ACTIVE|OPERATIONALLY_COMPLETE`: Owner/Admin reopen with reason; target is recomputed from current execution facts.
- `CANCELLED` is terminal for an unexecuted Project and requires Owner/Admin reason. Financial status is independent: `OPEN <-> FINANCIALLY_CLOSED` by computed settlement.

### Sales shipment

`DRAFT -> PLANNED -> CONFIRMED -> IN_TRANSIT -> DELIVERED`

- `DRAFT -> PLANNED`: required logistics data and one primary supplier shipment present.
- `PLANNED -> CONFIRMED`: supplier source confirmed, confirmation-gated route items satisfied, tolerances pass or approved exception exists.
- `CONFIRMED -> IN_TRANSIT`: departure milestone recorded.
- `IN_TRANSIT -> DELIVERED`: delivery milestone and delivery-gated checklist items satisfied.
- `DRAFT|PLANNED -> CANCELLED`; `CONFIRMED -> CANCELLED` only by Owner/Admin with reason and no sent active CINV, or after that CINV is cancelled.
- No backward execution transition; correction is a new dataset revision plus an audited command. Independent axes: financial `OPEN|FINANCIALLY_CLOSED`, document `MISSING|DRAFT|APPROVED|SENT|CANCELLED`, claim `NONE|OPEN|RESOLVED`.

### Commercial document revision

`DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT`; `PENDING_APPROVAL -> REJECTED`; `DRAFT|REJECTED -> CANCELLED`; `APPROVED|SENT -> CANCELLED` by Owner/Admin. Any correction starts revision N+1 at `DRAFT` with reason. `SENT` means at least one approved send succeeded; each later send still requires its own approval.

## Initial fixed approval matrix

| Action code | Requester | Approver/actor | Trigger and binding |
|---|---|---|---|
| `CONTRACT_VERSION` | Operations | Owner/Admin | Every sales/purchase contract version; exact version |
| `TOLERANCE_EXCEPTION` | Operations | Owner/Admin | Quantity/net/gross weight exceeds active contract tolerance; exact shipment dataset/version and reason |
| `DOCUMENT_REVISION` | Operations | Owner/Admin | Every CINV and Packing List revision; exact rendered hash/version |
| `EXTERNAL_SEND` | Operations | Owner/Admin | Every send/resend; exact approved document revision, recipient set, attachments and channel |
| `SUPPLIER_INVOICE` | Operations | Owner/Admin | Every supplier invoice revision before settlement/profit use |
| `EXPENSE` | Finance/Viewer | Owner/Admin | Every direct expense before settlement/profit use |
| `CLAIM_RESOLUTION` | Operations | Owner/Admin | Every resolution; exact claim version and effects |
| `CLOSURE_EXCEPTION` | Operations or Finance/Viewer | Owner/Admin | One named blocker on one assessment/version with reason |
| `FINAL_CLOSE_REOPEN` | Finance/Viewer | Owner/Admin | Exact closure assessment/closed Project version and reason |

Decisions are immutable. Any bound-content change invalidates the decision and requires a new request.

## Fixed route checklists

| Route | Confirmation gate | Delivery/final-close gate |
|---|---|---|
| Foreign-to-Foreign | origin, destination, carrier/transport reference, primary source | departure milestone + origin/export evidence; arrival/delivery milestone + destination/delivery evidence |
| UAE Free Zone Re-export | free-zone destination, entry reference, primary source | free-zone entry evidence; exit/re-export customs evidence; outbound transport; delivery evidence |
| UAE Import | UAE destination, import reference, primary source | import declaration; customs clearance and charge evidence; release/inbound transport; delivery evidence |

## Pilot requirements

- **FR-001**: Stable identities, scoped unique references, integer versions, optimistic concurrency, idempotent effect-creating commands, immutable audit events, and immutable approved evidence/revisions are mandatory.
- **FR-002**: Project is canonical and has exactly one primary sales contract; it may have multiple purchase contracts.
- **FR-003**: The fixed roles, approval matrix, state machines, three route checklists, one primary supplier source, direct expense assignment, simple claim workflow, settlement rules, and closure rules above are authoritative and not configurable in the pilot.
- **FR-004**: CINV/Packing List generation, approval, revision, cancellation and every external send obey exact-version review-first controls.
- **FR-005**: Supplier invoice and supplier shipment confirmation are required pilot workflows and feed statement, profit, settlement and closure calculations.
- **FR-006**: Evidence upload/view/download is authorization-controlled and audited; hashes and object versions are preserved.
- **FR-007**: Operational statements and all four profit figures disclose source records, formula/rates and currencies; unlike currencies are never silently summed.
- **FR-008**: Arabic RTL and English LTR are equivalent, WCAG 2.2 AA, and use MD3 behavior with ORB identity; visual evidence is collected as specified.
- **FR-009**: TLS, secure secret handling, least privilege, MFA for Owner/Admin, session revocation, sensitive-log exclusion, dependency/container scanning, backup/PITR and restore proof are pilot release gates.
- **FR-010**: The deployed pilot is not called production-ready until later hardening passes.

## Explicit future feature boundaries (not Release 1)

Bank accounts/statements/import/matching, tax evidence packs/classification/adviser delivery, and historical migration have no pilot endpoint, screen, entity, acceptance test, closure dependency, or interactive placeholder. Also deferred: multiple supplier sources per sales shipment, shared expense allocation, configurable roles/policy/checklist designers, advanced claims, portals, OCR, direct bank integration, automated tax filing, accounting/ledger, and automated third-party sending. Future work requires a separate Spec Kit feature and may link only through stable Party, Project, MoneyMovement, EvidenceObject and AuditEvent identities.

## Success criteria

- **SC-001**: The complete quickstart path runs in the deployed pilot by 2026-11-19 with no manual database intervention.
- **SC-002**: CINV/Packing List shared fields have zero mismatch; unauthorized or unapproved sends succeed zero times.
- **SC-003**: Contract, shipment, statement, settlement and profit acceptance populations reconcile with zero unexplained variance or negative available balance.
- **SC-004**: Every stale write, tolerance breach, missing route gate, unresolved closure blocker, multi-source attempt, shared-expense attempt and deferred endpoint is rejected with the contracted problem code.
- **SC-005**: Approved/sent revisions, evidence and decisions retain exact version/hash/actor/time/reason and survive backup restore sampling with zero missing links.
- **SC-006**: English and Arabic journeys pass keyboard and automated WCAG 2.2 AA checks with zero serious/critical violations, and all required MD3/ORB visual evidence is accepted.

## Assumptions

- Initial currencies are AED, USD and SAR; management conversion is optional and always discloses rate/date/source.
- Desktop is primary; responsive mobile supports review and light action.
- The pilot uses user-entered operational evidence and does not replace accounting records, legal advice, or tax advice.
