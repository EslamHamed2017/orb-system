# Feature Specification: ORB Trade Operations Core

**Feature Branch**: `001-orb-trade-operations`

**Created**: 2026-11-05

**Status**: Draft — ready for clarification

**Input**: User description: "Create a focused, standalone, bilingual ORB international coffee trade operations system. A Project contains one primary sales contract, multiple sales shipments, purchase contracts and supplier shipments, documents, advances, receipts, payments, expenses, bank matching, profit analysis, tax evidence packs, and historical migration from 2024. No Odoo and no accounting ledger."

## Clarifications

### Session 2026-11-05

- Q: If the same customer signs a new independent sales contract, is it a new Project? → A: Yes. Every independent sales contract creates a new Project; amendments to the same contract remain in the existing Project.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Control a Trade Project (Priority: P1)

An operations user creates one Project as the canonical record for a back-to-back coffee trade, records the primary sales contract and linked purchase contracts, and sees contracted, shipped, delivered, collected, paid, and remaining quantities and values without searching email or spreadsheets.

**Why this priority**: The Project is the operating and profitability center. Every later shipment, document, money movement, and report depends on this stable structure.

**Independent Test**: Create a sample 100 MT project with one customer and two suppliers, approve its contracts, and verify that its quantities, values, responsibilities, versions, and current statuses are visible from one page.

**Acceptance Scenarios**:

1. **Given** valid customer, supplier, coffee, route, and commercial terms, **When** a user creates a Project and its primary sales contract, **Then** the system assigns stable unique references and shows the project as Draft.
2. **Given** an approved sales contract, **When** a user records an amendment, **Then** the prior version remains readable and the amended quantity, value, schedule, and reason become the active version after approval.
3. **Given** a Project with multiple purchase contracts, **When** a user views the Project, **Then** the customer side and supplier side remain separated while contributing to one operational summary.

---

### User Story 2 - Execute Partial Shipments and Documents (Priority: P1)

An operations user divides a contract into one or more shipments, records logistics and coffee packing data, links each sales shipment to its supplier source, and generates a Commercial Invoice and Packing List from one controlled shipment dataset.

**Why this priority**: ORB fulfils contracts through shipments; inconsistent quantities, weights, references, or versions create customs, customer, and tax-evidence risk.

**Independent Test**: Split a 100 MT contract into 20, 40, and 40 MT shipments; generate English, Arabic, and bilingual outputs; revise one approved document; and verify contract remaining quantity and document history.

**Acceptance Scenarios**:

1. **Given** an approved 100 MT contract, **When** shipments of 20 MT and 40 MT are confirmed, **Then** the contract shows 60 MT committed/shipped and 40 MT remaining without exceeding approved tolerance.
2. **Given** a shipment with bags, bag weight, net weight, gross weight, ports, Incoterm, container, seal, and transport data, **When** CINV and Packing List are generated, **Then** all shared quantities, weights, parties, and references match exactly.
3. **Given** an approved CINV or Packing List, **When** a correction is required, **Then** the user creates a new revision with a reason and the sent/approved prior revision is immutable.
4. **Given** a short shipment, over shipment, rollover, quality variance, or claim, **When** the user records the event, **Then** the unresolved quantity/value and claim block final closure until resolved or exceptionally approved.

---

### User Story 3 - Track Advances, Settlements, and Statements (Priority: P1)

A finance or operations user records customer advances before an invoice, later allocates them to one or more CINV documents, records subsequent receipts, and obtains consistent customer, contract, shipment, and project statements in original currency.

**Why this priority**: Advance-before-invoice is a normal ORB workflow and must not be confused with invoiced value, delivered value, cash position, or profit.

**Independent Test**: Record a USD 30,000 advance before invoice; allocate USD 20,000 to shipment one and USD 10,000 to shipment two; then verify all four statement levels and remaining balances.

**Acceptance Scenarios**:

1. **Given** no CINV exists, **When** a customer advance is recorded, **Then** it is linked to customer, Project, and sales contract and remains Unallocated without creating an invoice.
2. **Given** an unallocated advance and an issued CINV, **When** a user allocates all or part of the advance, **Then** allocated and unallocated amounts are visible and cannot exceed the available advance or invoice balance.
3. **Given** receipts in different currencies, **When** statements are viewed, **Then** original-currency balances remain separate and optional AED management equivalents show their recorded rates and dates.
4. **Given** a delivered shipment with an outstanding balance, **When** the user reviews closure, **Then** delivery is shown as complete but financial settlement remains open.

---

### User Story 4 - Control Purchases and Shipment Costs (Priority: P1)

A procurement user manages purchase contracts and supplier shipments separately from sales, records supplier advances and invoices, assigns freight, customs, inspection, insurance, bank charges, commissions, and other approved expenses to a shipment or Project, and sees the source cost of each sale shipment.

**Why this priority**: A project margin is not meaningful unless supplier commitments, actual supplier invoices, and shipment costs are traceable to their source evidence.

**Independent Test**: Create two supplier contracts, pay an advance before supplier invoice, link a supplier shipment to a sales shipment, assign customs and freight costs, and verify supplier and shipment balances.

**Acceptance Scenarios**:

1. **Given** no supplier invoice exists, **When** a supplier advance is recorded, **Then** it remains available for later allocation and does not affect customer collections.
2. **Given** an approved expense, **When** it is assigned to a shipment, **Then** it appears in shipment cost and Project profitability with source document, currency, status, and approver.
3. **Given** a shared project expense, **When** it is allocated by quantity, value, or an approved manual allocation, **Then** the distributed total equals the source expense exactly.
4. **Given** a supplier quality claim or shortage, **When** a claim, discount, replacement, or compensation is recorded, **Then** the Project remains open until the resolution is documented.

---

### User Story 5 - Understand Project Profit and Closure (Priority: P1)

An owner or authorized user sees expected margin, committed margin, actual operational margin, and cash position as separate figures, drills down to supporting documents, and closes the Project only when commercial, operational, documentary, and money-movement conditions are complete.

**Why this priority**: Combining profit and cash can produce dangerously misleading management decisions.

**Independent Test**: Use one Project with partial delivery, customer advance, unpaid supplier invoice, customs expense, and currency conversion; verify all four figures and closure blockers.

**Acceptance Scenarios**:

1. **Given** expected and actual commercial data, **When** the profit center opens, **Then** the four figures are separately labelled with formulas, currencies, rates, and source drill-down.
2. **Given** cash was collected before shipment, **When** profitability is viewed, **Then** cash position changes but actual operational margin does not treat the advance as sales value.
3. **Given** missing documents, unsettled balances, unresolved claims, unapproved expenses, or quantity differences, **When** closure is requested, **Then** the system lists blockers and refuses normal closure.
4. **Given** a justified exception, **When** an authorized approver closes or reopens the Project, **Then** reason, user, time, and affected version are retained.

---

### User Story 6 - Import and Match Bank Movements (Priority: P2)

A finance user imports an ORB bank statement for an AED, USD, or SAR account, validates the statement batch, receives match suggestions, and confirms, splits, rejects, or leaves movements unmatched without creating accounting entries.

**Why this priority**: Bank data completes operational evidence and exposes missing or duplicated receipts, payments, expenses, transfers, and fees.

**Independent Test**: Import the same statement twice, verify the second import is blocked, match one receipt to two CINV documents and two payments to one supplier invoice, and reconcile opening and closing balances.

**Acceptance Scenarios**:

1. **Given** a supported statement file, **When** it is imported, **Then** account, currency, period, opening/closing balance, source file, batch identity, and row identities are recorded.
2. **Given** an identical file or overlapping duplicate rows, **When** re-import is attempted, **Then** duplicates are blocked or quarantined without duplicating movements.
3. **Given** suggested matches by amount, currency, date, reference, and party, **When** a user reviews them, **Then** no final match occurs until confirmed.
4. **Given** an own-account transfer or FX conversion, **When** both legs are linked, **Then** it is excluded from sales, purchases, expenses, and tax value while bank charges remain separately assignable.
5. **Given** statement totals do not reconcile, **When** the batch is reviewed, **Then** it cannot reach Approved status and the difference is displayed.

---

### User Story 7 - Prepare a Review-First Tax Evidence Pack (Priority: P2)

An authorized user prepares a period Tax Pack that combines sales, purchases, expenses, customs/import evidence, export evidence, bank matching, and exception reports, then sends the exact approved version to the tax adviser only after Eslam's approval.

**Why this priority**: ORB needs complete evidence and exception visibility without pretending the application makes legal tax determinations or files a return.

**Independent Test**: Prepare a period containing an export CINV with missing transport evidence, a purchase expense without a tax classification, and an unmatched receipt; verify the pack remains Draft and lists all exceptions.

**Acceptance Scenarios**:

1. **Given** a selected tax period, **When** a pack is generated, **Then** it contains indexed sales, purchases/expenses, credit/debit notes if present, customs records, bank reconciliation, evidence checklist, and exceptions.
2. **Given** an export/foreign sale, **When** no approved tax classification or required evidence exists, **Then** the system does not classify it as zero-rated automatically and flags it for adviser review.
3. **Given** a reviewed pack, **When** Eslam has not approved the exact version and recipients, **Then** external sending is blocked.
4. **Given** an approved sent pack, **When** a correction is required, **Then** a new version is produced and the original sent contents, hashes, recipients, and delivery status remain immutable.

---

### User Story 8 - Migrate ORB History from 2024 (Priority: P2)

A migration reviewer processes original historical emails, PDF, image, spreadsheet, and archive files through duplicate detection, extraction, staging, human review, linking, and acceptance reconciliation while preserving every source file.

**Why this priority**: ORB needs its history in the new system, but uncontrolled OCR/import would create duplicate or unsupported business records.

**Independent Test**: Process the current indexed inventory, verify exact duplicates are not imported twice, link approved records to Projects and shipments, and produce source-to-target and exception reports.

**Acceptance Scenarios**:

1. **Given** files with identical content hashes, **When** migration staging runs, **Then** one unique source is retained with all email/archive occurrences referenced.
2. **Given** uncertain extracted data, **When** confidence or business validation is insufficient, **Then** the record stays in Review Required and is not posted to active operations.
3. **Given** an approved migrated record, **When** viewed later, **Then** its original source, extraction, reviewer, corrections, target record, and timestamps are traceable.
4. **Given** migration completion, **When** acceptance reconciliation runs, **Then** every unique source is classified as imported, duplicate, intentionally excluded, or unresolved with reason.

### Edge Cases

- Contract quantity is reduced after one or more shipments are already confirmed.
- Shipment quantity exceeds remaining contract quantity but remains within or outside an approved tolerance.
- One sales shipment is sourced from more than one supplier shipment.
- Coffee grade, quality, crop year, bag count, net weight, or gross weight differs from contract.
- A CINV is cancelled after an advance allocation or bank match.
- Customer overpays, pays in a different currency, or pays one amount for multiple Projects.
- Supplier refund or customer refund is received after apparent settlement.
- Shared expense allocation creates a rounding remainder.
- Two users edit the same Project, shipment, document, match, or allocation concurrently.
- A bank statement has no opening balance, reversed rows, duplicated references, or a different decimal/date convention.
- A document is corrupted, password-protected, unreadable, or missing from an archive.
- A Project uses UAE free-zone re-export or a direct foreign-to-foreign route.
- Delivery completes in a later reporting period than invoice or shipment clearance.
- The tax adviser changes classification or evidence requirements after a pack was sent.

## Scope Boundaries

### Included

- Project, contract, shipment, document, collection, payment, expense, bank matching, operational statements, profitability, tax evidence pack, approvals, audit history, and migration.
- Arabic, English, and bilingual document output chosen at print time.
- Google Material Design 3 interaction principles adapted to ORB identity.

### Excluded

- Odoo or dependency on an ERP platform.
- General ledger, chart of accounts, journal entries, trial balance, financial statements, stock valuation, or tax return filing.
- Automatic legal tax determination or automatic FTA submission.
- Direct live bank integration in the initial release.
- Advanced CRM, marketing, tender/RFQ, customer portal, supplier portal, or standalone mobile application.
- Automatic external email without Eslam approval.

## Requirements *(mandatory)*

### Functional Requirements

#### Canonical Structure and Contracts

- **FR-001**: The system MUST use Project as the canonical operating and profitability entity.
- **FR-002**: Each Project MUST have exactly one primary sales contract. Every independent sales contract MUST create a new Project; only changes to the same contract may be recorded as versioned amendments inside that Project.
- **FR-003**: A Project MUST support one or more purchase contracts without mixing customer and supplier balances.
- **FR-004**: Contracts MUST retain original and active versions, amendment reason, approver, and effective date.
- **FR-005**: The system MUST prevent duplicate active Project, contract, shipment, CINV, Packing List, and supplier-invoice references within their defined numbering scope.
- **FR-006**: Roles MUST be composable so one person may hold owner, operations, finance/payment, sales, reviewer, or administrator permissions.
- **FR-007**: Supplier cost, bank details, margin, tax, and identity data MUST be hidden from roles without explicit access.

#### Shipments, Documents, and Trade Exceptions

- **FR-008**: A sales contract MUST support multiple shipments and show contracted, planned, shipped, delivered, cancelled, and remaining quantities.
- **FR-009**: Purchase contracts MUST support multiple supplier shipments and show equivalent quantity progress.
- **FR-010**: Each sales shipment MUST identify at least one supplier source shipment; additional source allocations MUST reconcile to the sales-shipment quantity.
- **FR-011**: CINV and Packing List MUST be generated from one approved shipment dataset.
- **FR-012**: Printing language MUST support Arabic, English, or bilingual output without creating another business document.
- **FR-013**: Approved/sent documents MUST be immutable and corrected only by revision, cancellation, or replacement with reason.
- **FR-014**: The system MUST track document completeness by route, destination, customer, product, and Incoterm.
- **FR-015**: The system MUST store Incoterm and named place/port on contracts and shipments.
- **FR-016**: The system MUST handle short shipment, over shipment, rollover, cancellation, quality variance, weight variance, rejection, claim, discount, replacement, and compensation.
- **FR-017**: Quantity and weight tolerances MUST be explicit and require approval when exceeded.
- **FR-018**: Shipment execution, financial settlement, document completeness, and claims MUST have independent statuses.

#### Collections, Payments, Expenses, and Statements

- **FR-019**: Users MUST be able to record customer advances before a CINV and supplier advances before a supplier invoice.
- **FR-020**: An advance or bank movement MUST support partial allocation across multiple eligible documents, and one document MUST support settlement by multiple movements.
- **FR-021**: Allocations MUST never exceed available movement amount or target outstanding balance.
- **FR-022**: Customer, sales-contract, sales-shipment, supplier, purchase-contract, supplier-shipment, and Project operational statements MUST be available.
- **FR-023**: Statements MUST preserve original currency and keep balances of different currencies separate.
- **FR-024**: Optional AED management equivalents MUST disclose rate, rate date, and rate source recorded for each conversion.
- **FR-025**: Expenses MUST be assigned to one shipment or the whole Project with category, vendor, amount, currency, proof, status, and approver.
- **FR-026**: Shared expense allocation MUST support quantity, value, or approved manual methods and MUST reconcile exactly to the source amount.
- **FR-027**: Refunds, reversals, cancellations, and reallocations MUST preserve prior history.

#### Profit, Status, and Approvals

- **FR-028**: The Project Profit Center MUST separately present expected margin, committed margin, actual operational margin, and cash position.
- **FR-029**: Each profitability figure MUST disclose its formula and support drill-down to source records and documents.
- **FR-030**: Cash advances and internal bank transfers MUST NOT be treated as sales value or profit.
- **FR-031**: Project closure MUST validate quantity, delivery, documents, customer settlement, supplier settlement, expenses, claims, and approvals independently.
- **FR-032**: Authorized exceptional closure or reopening MUST require a reason and immutable audit event.
- **FR-033**: Approvals MUST be risk-based and configurable by action, value threshold, exception, and role rather than required for every routine edit.
- **FR-034**: Every approval MUST store actor, time, decision, comment, record version, and evidence where applicable.

#### Bank Imports and Matching

- **FR-035**: Bank accounts MUST preserve account alias, masked identifier, currency, and active status.
- **FR-036**: Statement imports MUST preserve source file, account, currency, period, opening/closing balances when present, import batch, and row identities.
- **FR-037**: Importing an identical batch or row MUST be idempotent and MUST NOT duplicate movements.
- **FR-038**: Statement validation MUST detect overlap, duplicate rows, balance discontinuity, unsupported format, and account/currency mismatch.
- **FR-039**: Match suggestions MAY use amount, currency, date, reference, counterparty, Project, contract, shipment, and document, but MUST require confirmation.
- **FR-040**: Bank movements MUST support Unmatched, Suggested, Partially Matched, Matched, and Excluded-with-reason statuses.
- **FR-041**: Own-account transfers and FX conversion legs MUST be linkable and excluded from sales, purchases, and tax values.
- **FR-042**: Approved bank matches and subsequent changes MUST retain full allocation and reviewer history.

#### Tax Evidence Pack

- **FR-043**: The system MUST prepare a versioned tax evidence/review pack and MUST NOT present it as an automatically determined or filed tax return.
- **FR-044**: Tax classifications MUST come from a controlled matrix approved by ORB's qualified tax adviser.
- **FR-045**: The system MUST NOT automatically classify foreign/export sales as zero-rated.
- **FR-046**: The tax pack MUST include indexed sales, purchases/expenses, credit/debit notes if present, customs/import evidence, export evidence, bank matching, and exceptions.
- **FR-047**: Missing classification or required evidence MUST create a visible exception and prevent Ready-to-Send status unless an authorized exception is recorded.
- **FR-048**: External sending MUST be blocked until Eslam approves the exact version, recipients, and attachments.
- **FR-049**: Sent-pack contents, attachment identities, recipients, delivery status, and later adviser responses MUST remain traceable.

#### Migration, Integrity, UX, and Security

- **FR-050**: Original migration source files MUST remain immutable and addressable by content identity.
- **FR-051**: Duplicate content MUST be retained once with references to all occurrences rather than imported as duplicate business records.
- **FR-052**: Extracted data MUST enter staging and require human review before becoming active business data.
- **FR-053**: Every migrated field correction MUST preserve extracted value, corrected value, reviewer, time, and source.
- **FR-054**: Migration completion MUST produce a source-to-target reconciliation and exception report covering every unique source.
- **FR-055**: Every critical record MUST use stable identity, version, created/updated actor, and auditable event history.
- **FR-056**: Concurrent conflicting changes MUST be detected and MUST NOT silently overwrite a later version.
- **FR-057**: The interface MUST provide equivalent Arabic RTL and English LTR workflows and use ORB terminology consistently.
- **FR-058**: The interface MUST apply Google Material Design 3 principles for hierarchy, components, states, accessibility, forms, tables, and responsive layouts while using ORB branding.
- **FR-059**: Sensitive source documents and exports MUST be available only to explicitly authorized roles.
- **FR-060**: The system MUST support tested backup and restoration of business records, versions, audit events, and source-document links before production approval.

### Key Entities

- **Project**: Canonical operating/profitability record linking customer, contracts, shipments, documents, movements, expenses, exceptions, and closure.
- **Party**: Customer, supplier, bank, carrier, broker, authority, or other counterparty with role-specific details.
- **Coffee Specification**: Origin, type, grade, crop year, quality attributes, bag type, and weight basis.
- **Sales Contract / Amendment**: Customer commitment, quantity, price, currency, route, Incoterm, payment and document terms, versions.
- **Purchase Contract / Amendment**: Supplier commitment and equivalent procurement terms and versions.
- **Sales Shipment**: Partial sales-contract execution, logistics, quantities, documents, settlements, claims, and statuses.
- **Supplier Shipment**: Partial purchase-contract execution and source allocation to sales shipments.
- **Commercial Document**: Proforma, CINV, Packing List, supplier invoice, credit/debit note, or revision with identity and status.
- **Trade Evidence**: BL/transport, customs, origin, inspection, quality, delivery, or other route-required document.
- **Money Movement**: Customer advance/receipt, supplier advance/payment, refund, expense payment, transfer, FX conversion, fee, or tax payment.
- **Allocation**: Controlled relationship allocating a movement, shipment source, or shared expense to eligible targets.
- **Expense**: Shipment or Project cost with category, proof, currency, approval, and allocation.
- **Claim**: Quantity, weight, quality, delivery, price, or document dispute with resolution and financial/quantity impact.
- **Bank Account / Import Batch / Bank Row**: Statement provenance, balances, movement identity, validation, and matching lifecycle.
- **Tax Pack / Tax Classification / Evidence Requirement**: Adviser-controlled period review package and exceptions.
- **Source File / Migration Record**: Immutable historical evidence, extraction, review, target mapping, and disposition.
- **Approval / Audit Event**: Actor, decision/action, time, reason, record version, and evidence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A trained user creates a complete standard Project and primary sales contract in 5 minutes or less.
- **SC-002**: Shared fields in generated CINV and Packing List have zero quantity, weight, party, and reference mismatches in acceptance tests.
- **SC-003**: A 100 MT contract split into partial shipments always shows exact contracted, executed, cancelled, and remaining quantities, including approved tolerances.
- **SC-004**: All tested customer and supplier advances allocate correctly without negative available balances or over-settled documents.
- **SC-005**: Customer, contract, shipment, supplier, and Project statements reconcile to their underlying approved movements with zero unexplained variance.
- **SC-006**: Profit Center figures reproduce their disclosed formulas exactly and every amount drills to an approved source record.
- **SC-007**: Re-importing the same bank statement creates zero duplicate movements.
- **SC-008**: Every approved bank batch reconciles opening balance, movements, and closing balance, or displays an unresolved blocking difference.
- **SC-009**: Tax Pack generation identifies 100% of acceptance-test cases with missing classifications, export evidence, unmatched bank movements, or unsupported source documents.
- **SC-010**: No external tax pack can be sent without recorded Eslam approval for the exact version and recipients.
- **SC-011**: Every approved/sent document revision retains the prior version and complete reason/actor/time history.
- **SC-012**: Every unique migration source receives exactly one final disposition: imported, duplicate, intentionally excluded, or unresolved.
- **SC-013**: Restoring the approved production backup reproduces all sampled records, document versions, allocations, audit events, and source links with no loss.
- **SC-014**: The same core journeys complete successfully in Arabic RTL and English LTR, and generated documents support Arabic, English, and bilingual modes.
- **SC-015**: At least 90% of pilot users complete Project creation, shipment creation, document generation, advance allocation, and bank matching on first attempt without assistance.

## Assumptions

- ORB uses exactly one Project for each independent sales contract. Amendments to that same contract remain in the original Project.
- A Project may use multiple purchase contracts and supplier shipments.
- Direct shipment is common, but direct foreign-to-foreign and UAE free-zone re-export routes must both be supported.
- Original transaction currencies are AED, USD, and SAR initially; currency lists remain configurable.
- AED equivalents are management views based on explicitly recorded rates, not accounting valuations.
- The tax adviser supplies ORB's official tax period, classification matrix, evidence rules, and final filing decisions.
- Initial bank import uses user-supplied statement files; direct bank connectivity is deferred.
- Historical migration starts from 1 January 2024 and uses the existing 107-file unique-source inventory as the initial control population.
- Desktop web is the primary working experience; mobile access is responsive for review and light actions, not a separate application.
- The system stores operational payment and tax-evidence information but does not replace professional accounting records or tax advice.
