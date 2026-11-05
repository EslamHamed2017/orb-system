# Phase 1 Data Model: ORB Release 1

## Global conventions

UUIDv7 primary keys; immutable scoped references; UTC timestamps; `numeric` for quantity/weight/money/rates; ISO currency; integer aggregate `version`; actor/time on create/update. Approved versions, evidence, approval decisions, send manifests, and audit events are append-only. Business records cancel/reverse/supersede rather than delete. Unlike currencies are never summed. All cross-row totals and state changes use locked/serializable transactions.

## Access and masters

- `User(id, auth_subject, name_ar, name_en, locale, status, mfa_state)`.
- fixed `UserRole(user_id, role OWNER_ADMIN|OPERATIONS|FINANCE_VIEWER)`; a user may have several roles.
- `Party(id, reference, legal_name_ar/en, country_code, customer, supplier, sensitive_identity_ciphertext, status, version)`.
- `CoffeeSpecification(id, reference, origin, type, grade, crop_year, bag_type, standard_bag_weight, attributes, version)`.
- `Currency(code, decimals, active)` and `ExpenseCategory(code, name_ar/en, active)`.

Server-side projections hide supplier cost, margins, money, identity, or evidence without permission. Controlled actions record requester and reject self-approval.

## Project and contracts

`Project(id, reference, customer_id, primary_sales_contract_id, lifecycle_state DRAFT|ACTIVE|CANCELLED, financial_state OPEN|FINANCIALLY_CLOSED, final_state OPEN|FINAL_CLOSED, management_currency, version)`.

`Contract(id, project_id, kind SALES|PURCHASE, reference, counterparty_id, active_version_id, state, version)` owns immutable `ContractVersion(id, contract_id, revision_no, effective_date, amendment_reason, coffee_specification_id, quantity, unit_price, currency, route, incoterm, named_place, quantity_tolerance_under/over, net_weight_tolerance_under/over, gross_weight_tolerance_under/over, payment_terms, document_terms, state DRAFT|PENDING_APPROVAL|APPROVED|REJECTED|SUPERSEDED, approval_id)`.

Constraints: Project creation and its sales-contract draft are atomic; exactly one SALES contract per Project; independent sales contract means another Project; >=1 purchase contract before supplier execution; omitted tolerances store zero; approved versions never mutate; reducing amendments cannot invalidate executed quantity without exact exception approval.

## Shipments and fixed route checklist

`SupplierShipment(id, project_id, purchase_contract_id, reference, active_dataset_id, execution_state DRAFT|CONFIRMED|IN_TRANSIT|RECEIVED|CANCELLED|REJECTED, version)` owns immutable `SupplierShipmentDataset(...quantity, bags, net_weight, gross_weight, logistics, state, approval_id)`.

`SalesShipment(id, project_id, sales_contract_id, reference, primary_supplier_shipment_id, active_dataset_id, execution_state DRAFT|CONFIRMED|IN_TRANSIT|DELIVERED|CANCELLED|REJECTED, financial_state OPEN|FINANCIALLY_CLOSED, document_state MISSING|DRAFT|PENDING_APPROVAL|COMPLETE, claim_state CLEAR|OPEN|UNDER_REVIEW|RESOLVED|REJECTED, version)` owns immutable `SalesShipmentDataset(id, shipment_id, revision_no, coffee_specification_id, quantity, bags, bag_weight, net_weight, gross_weight, load/discharge/destination, incoterm, named_place, container/seal/transport, state, approval_id)`.

Exactly one `primary_supplier_shipment_id` is required to confirm; that supplier shipment must be confirmed, in the same Project, and have compatible purchase-contract/coffee facts. There is no source-allocation entity in Release 1. Outside-tolerance confirmation requires an approved `TOLERANCE_EXCEPTION` for the exact dataset and breached values.

`RouteChecklist(id, sales_shipment_id unique, template_code FOREIGN_TO_FOREIGN|UAE_FREE_ZONE_REEXPORT|UAE_IMPORT, template_version, snapshot_hash, status, version)` owns fixed `RouteChecklistItem(id, checklist_id, code, category EVIDENCE|MILESTONE, required, closure_blocking, state NOT_STARTED|IN_PROGRESS|SATISFIED|NOT_APPLICABLE|EXCEPTION_APPROVED, evidence_id?, milestone_at?, completed_by/at?, exception_approval_id?)`. Only template rules can mark not applicable. The snapshot cannot be redesigned by users.

## Evidence and controlled documents

`EvidenceObject(id, sha256, byte_length, media_type, object_key, object_version_id, original_filename, verification_state, uploaded_by/at, retention_until)` is immutable. `EvidenceLink(id, evidence_id, subject_type, subject_id, purpose)` links an occurrence. Authorized view/download emits audit events.

`CommercialDocument(id, project_id, sales_shipment_id, kind CINV|PACKING_LIST, reference, active_revision_id, version)` owns `DocumentRevision(id, document_id, revision_no, source_sales_shipment_dataset_id, language AR|EN|BILINGUAL, generation_state QUEUED|RENDERING|READY|FAILED, lifecycle_state DRAFT|PENDING_APPROVAL|APPROVED|SENT|CANCELLED|SUPERSEDED, evidence_id?, sha256?, reason?, approval_id?, version)`.

`OutboundManifest(id, document_revision_id, output_sha256, to_recipients, cc_recipients, attachment_manifest, subject, body_digest, manifest_hash, state DRAFT|PENDING_APPROVAL|APPROVED|SENT|CANCELLED, approval_id?, delivery_reference?, version)` freezes all controlled fields. Each attachment entry contains evidence/document ID, revision/version and SHA-256. Approval matches `manifest_hash`; any change creates a new manifest version and invalidates prior approval. Send requires the exact approved manifest and records delivery result.

## Supplier invoice, money, expense, and statements

`SupplierInvoice(id, project_id, supplier_shipment_id, supplier_id, reference, invoice_date, amount, currency, evidence_id, state DRAFT|PENDING_APPROVAL|CONFIRMED|REJECTED|CANCELLED, approval_id?, version)`.

`MoneyMovement(id, project_id, party_id, contract_id, kind CUSTOMER_ADVANCE|CUSTOMER_RECEIPT|CUSTOMER_REFUND|SUPPLIER_ADVANCE|SUPPLIER_PAYMENT|SUPPLIER_REFUND|REVERSAL, direction, amount, currency, occurred_on, reference, evidence_id?, state DRAFT|CONFIRMED|PARTIALLY_ALLOCATED|FULLY_ALLOCATED|REVERSED, aed_amount?, fx_rate/date/source?, reversal_of_id?, version)`.

`SettlementAllocation(id, movement_id, target_type CINV|SUPPLIER_INVOICE, target_id, amount, currency, state ACTIVE|REVERSED, allocated_by/at, reversal_of_id?, version)`. Active totals cannot exceed movement availability or target outstanding; party and currency must match. Corrections are compensating rows.

`DirectExpense(id, project_id, sales_shipment_id?, vendor_id, category_code, amount, currency, occurred_on, evidence_id, state DRAFT|PENDING_APPROVAL|APPROVED|REJECTED|CANCELLED, approval_id?, version)`. XOR constraint: scope is whole Project (`sales_shipment_id` null) or exactly one shipment. There is no allocation entity.

Statements are read models from confirmed movements, active settlement allocations, confirmed invoices, and approved expenses: `StatementLine(source_type/id, party/project/shipment keys, date, reference, debit, credit, currency, running_balance)`. Views exist for customer, supplier, sales shipment, supplier shipment, and Project; currencies partition balances.

## Claims, approval, profit, and closure

`Claim(id, project_id, sales_shipment_id?, supplier_shipment_id?, type QUANTITY|WEIGHT|QUALITY|DELIVERY|PRICE|DOCUMENT, claimant_id, respondent_id, description, quantity?, amount?, currency?, state OPEN|UNDER_REVIEW|RESOLVED|REJECTED, evidence_id?, outcome_reason?, outcome_evidence_id?, approval_id?, version)`. No automated settlement rows are created.

`Approval(id, action_code, subject_type/id, subject_version, subject_hash, requester_id, decision PENDING|APPROVED|REJECTED|EXPIRED, approver_id?, decided_at?, reason/comment?, evidence_id?)` is immutable after decision. Fixed action codes are exactly those in the spec matrix. Approver differs from requester. A later subject version/hash expires applicability.

`ProfitSnapshot(id, project_id, project_version, as_of, currency, expected_margin, committed_margin, actual_operational_margin, cash_position, formula_version, input_hash, generated_at)` owns drill-down `ProfitLine(snapshot_id, measure, source_type/id, amount, currency, explanation)`. Advances affect cash only.

`ClosureAssessment(id, project_id, project_version, assessed_at, quantity_delivery_complete, route_complete, documents_complete, supplier_obligations_complete, expenses_complete, claims_complete, approvals_complete, blockers_hash)` owns `ClosureBlocker(id, assessment_id, code, subject_type/id, message_key, exception_eligible, covered_by_approval_id?)`.

Financial states are computed: shipment closes iff customer invoice outstanding is zero; Project closes financially iff all non-cancelled shipments do. `FINAL_CLOSED` requires a current assessment and every blocker absent or covered by an eligible exact blocker/version exception. Reopen records reason and recomputes financial state.

## Audit and request integrity

`AuditEvent(id, aggregate_type/id, aggregate_version, sequence_no, action, actor_id, session_id, occurred_at, reason?, correlation_id, idempotency_key?, before_hash?, after_hash, previous_event_hash?, event_hash)` is append-only and transactionally written. Daily signed heads are retained in object storage.

`IdempotencyRecord(actor_id, operation_id, key, request_hash, response_status, response_locator/hash, created_at, expires_at)` is unique by actor/operation/key; same key/different request fails. Existing-aggregate commands require quoted version via `If-Match`.

## Explicitly absent from Release 1 schema

No bank statement/import/match, tax pack/classification, migration staging, supplier-source allocation, expense allocation, configurable approval policy/designer, dynamic route template designer, or advanced claim settlement entity exists. No closure rule references them.
