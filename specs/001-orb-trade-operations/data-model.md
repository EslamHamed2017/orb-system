# Phase 1 Data Model: ORB Core Trade

## Conventions and invariants

- Primary keys are UUIDv7; user-facing references are immutable, unique within an explicit numbering scope, and never reused.
- Mutable aggregates carry `version bigint`, `created_at/by`, and `updated_at/by`; all timestamps are UTC. Mutation uses expected version.
- Quantities, weights, money, rates, and percentages use bounded PostgreSQL `numeric`, never binary floating point. Money stores ISO currency and amount; unlike currencies are never summed.
- Master/transaction rows use restrictive foreign keys. Business records are archived or cancelled, not hard-deleted.
- Translatable labels use explicit Arabic and English columns where controlled by ORB; transactional free text retains entered language.
- The database enforces uniqueness, non-negative values, exact allocation totals where required, and append-only audit/document revision rules. Cross-row invariants execute within locked transactions.

## Identity, parties, and access

### User, Role, Permission, UserRole, RolePermission

`User` stores auth subject, display names, locale (`ar|en`), status, and privileged-MFA state. Roles are composable; permissions are action/resource codes. Authorization is evaluated server-side and sensitive projections require explicit `supplier_cost.read`, `margin.read`, `bank.read`, `identity.read`, or `tax.read`. Role changes create audit events and revoke sessions.

### Party and PartyRole

`Party(id, reference, legal_name_en, legal_name_ar, country_code, tax_identifier_encrypted, bank_details_encrypted, status, version)` represents customers, suppliers, carriers, brokers, banks, and authorities. `PartyRole` permits multiple roles without duplicating identity. Sensitive fields are returned only through authorized projections.

### CoffeeSpecification

`CoffeeSpecification(id, reference, origin_country, coffee_type, grade, crop_year, quality_attributes_json, bag_type, standard_bag_weight, weight_uom, version)` is referenced by contract versions and shipment datasets. Material changes create a new version or specification rather than silently changing executed trade facts.

## Project and contracts

### Project

`Project(id, reference, customer_party_id, primary_sales_contract_id, status, financial_status, final_closure_status, route, base_management_currency, version)` is the canonical operating/profitability aggregate.

Constraints:

- `primary_sales_contract_id` is mandatory after initial atomic creation and unique; a deferred constraint ensures exactly one primary sales contract per project.
- An independent sales contract always creates another Project. Amendments point to versions within the same contract.
- `route` is `FOREIGN_TO_FOREIGN`, `UAE_FREE_ZONE_REEXPORT`, or `UAE_IMPORT` for Release 1.

### Contract and ContractVersion

`Contract(id, project_id, kind SALES|PURCHASE, reference, customer_or_supplier_id, active_version_id, lifecycle_status, version)` owns immutable `ContractVersion(id, contract_id, revision_no, effective_date, amendment_reason, coffee_specification_id, quantity, quantity_uom, unit_price, currency, value, quantity_tolerance_under, quantity_tolerance_over, net_weight_tolerance_under, net_weight_tolerance_over, gross_weight_tolerance_under, gross_weight_tolerance_over, incoterm, named_place, payment_terms, document_terms_json, schedule_json, approval_id, status)`.

Constraints:

- Exactly one `SALES` contract per Project; one or more `PURCHASE` contracts may exist.
- Revision numbers and active version are unique per contract. Approved versions are immutable.
- Omitted tolerances persist as zero. All numeric contract amounts/tolerances are non-negative; value equals the approved pricing basis using defined rounding.
- A reducing amendment cannot put already confirmed non-cancelled execution beyond the new tolerance unless an authorized exception approval and reason are linked.

Lifecycle: `DRAFT -> PENDING_APPROVAL -> APPROVED -> AMENDED|CANCELLED|COMPLETED`; rejection returns a new/editable draft, never mutates an approved version.

## Shipments, sources, and route requirements

### SalesShipment and ShipmentDataset

`SalesShipment(id, project_id, sales_contract_id, reference, active_dataset_id, execution_status, financial_status, document_status, claim_status, version)` owns immutable approved `ShipmentDataset(id, shipment_id, revision_no, coffee_specification_id, planned_quantity, shipped_quantity, delivered_quantity, cancelled_quantity, bags, bag_weight, net_weight, gross_weight, quantity_uom, weight_uom, load/discharge places, destination_country, incoterm, named_place, container/seal/transport_json, milestone_dates_json, approval_id, status)`.

Constraints:

- Confirming quantity/weight outside the active contract tolerance requires `TOLERANCE_EXCEPTION` approval with reason.
- Confirmed shipments plus cancelled/rolled quantities use explicit signs/categories and may not make contract remaining quantity inconsistent.
- Shared CINV and Packing List values are generated only from the same approved dataset ID.

Execution lifecycle: `DRAFT -> PLANNED -> CONFIRMED -> IN_TRANSIT -> DELIVERED`, with controlled `CANCELLED`, `ROLLED_OVER`, or `REJECTED` transitions. Execution, finance, documents, and claims are independent state axes.

### SupplierShipment and SupplierSourceAllocation

`SupplierShipment(id, project_id, purchase_contract_id, reference, active_dataset_id, execution_status, financial_status, claim_status, version)` has equivalent immutable datasets and progress controls. `SupplierSourceAllocation(id, sales_shipment_id, supplier_shipment_id, quantity, weight, allocation_basis, status, version)` maps source lots.

Constraints:

- Before a sales shipment can be confirmed, it has at least one approved source allocation.
- Active source-allocation quantity equals the sales shipment sourced quantity exactly; allocations cannot exceed available quantity of a supplier shipment.
- One sales shipment may have many sources and one supplier shipment may serve many sales shipments. Locked transactions prevent oversubscription.

### RouteRequirementProfile and RequirementSatisfaction

`RouteRequirementProfile(id, route, destination_country?, customer_id?, product_rule_json?, incoterm?, version, effective_from/to, status)` owns `RouteRequirement(id, profile_id, code, category DOCUMENT|MILESTONE|EXPENSE|EVIDENCE, mandatory, closure_blocking, rule_json)`. `RequirementSatisfaction(id, shipment_id, requirement_id, status, evidence_object_id?, satisfied_at/by, exception_approval_id?)` records compliance, not tax/legal conclusions.

Minimum Release 1 profiles:

| Route | Required controls (profile may add more) |
|---|---|
| Foreign-to-Foreign | origin and destination, carrier/transport reference, origin/export and delivery evidence; UAE import milestones prohibited/not applicable |
| UAE Free Zone Re-export | free-zone entry, storage/handling if applicable, exit/re-export customs evidence, outbound transport and delivery evidence |
| UAE Import | UAE import declaration, customs clearance and assessed charges, inbound transport, release and delivery evidence |

## Documents and evidence

### CommercialDocument and DocumentRevision

`CommercialDocument(id, project_id, shipment_id?, contract_id?, kind PROFORMA|CINV|PACKING_LIST|SUPPLIER_INVOICE|CREDIT_NOTE|DEBIT_NOTE|OTHER, reference, active_revision_id, lifecycle_status, version)` owns `DocumentRevision(id, document_id, revision_no, source_dataset_id?, language_mode AR|EN|BILINGUAL, status, reason, evidence_object_id, content_hash, rendered_at/by, approved_at/by?, sent_at/by?)`.

State: `DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT`; an approved/sent revision cannot change. Correction creates `SUPERSEDED`/`CANCELLED` disposition on the old revision and a new draft with mandatory reason. Language choice renders another representation/revision of the same business document and never duplicates its commercial identity.

### EvidenceObject and EvidenceLink

`EvidenceObject(id, sha256, byte_length, media_type, object_key, object_version_id, retention_until, uploaded_at/by, verification_status)` is immutable. `EvidenceLink(id, evidence_object_id, subject_type, subject_id, purpose, occurrence_reference?)` provides typed provenance. `(object_key, object_version_id)` is unique; SHA-256/length identify equal content but do not automatically collapse legitimate occurrences. Upload retry identity uses request idempotency plus canonical request hash.

## Money, settlement, and expenses

### MoneyMovement and SettlementAllocation

`MoneyMovement(id, project_id, party_id, kind CUSTOMER_ADVANCE|CUSTOMER_RECEIPT|CUSTOMER_REFUND|SUPPLIER_ADVANCE|SUPPLIER_PAYMENT|SUPPLIER_REFUND|EXPENSE_PAYMENT|REVERSAL, direction, amount, currency, occurred_on, reference, status, aed_equivalent?, fx_rate?, fx_rate_date?, fx_rate_source?, reversed_movement_id?, version)` is operational evidence, not a journal entry.

`SettlementAllocation(id, movement_id, target_type CINV|SUPPLIER_INVOICE|EXPENSE, target_id, amount, currency, status, allocated_at/by, reversal_of_id?, version)` supports many-to-many settlement.

Constraints:

- An advance needs party, Project, and relevant contract but no invoice.
- Active allocations never exceed movement available amount or target outstanding amount; target and allocation currency must match unless a separately evidenced conversion movement establishes the target currency.
- Different currencies remain separate. AED equivalents require rate, date, source, and defined rounding.
- Reallocation/reversal creates compensating rows; prior allocation history remains.

Money movement state: `DRAFT -> CONFIRMED -> PARTIALLY_ALLOCATED -> FULLY_ALLOCATED`; `REVERSED` only through a linked compensating movement.

### Expense and ExpenseAllocation

`Expense(id, project_id, shipment_id?, vendor_party_id, category, proof_evidence_id, amount, currency, status, approval_id?, version)` is either directly assigned to one shipment or project-wide. `ExpenseAllocation(id, expense_id, sales_shipment_id, method QUANTITY|VALUE|MANUAL, basis_value?, amount, rounding_adjustment, approval_id?, status, version)` distributes shared cost.

Constraints:

- Approved active allocations equal the source expense exactly in its currency, including one explicit deterministic rounding remainder.
- Manual allocation requires approval/reason. Approved expenses require proof and approver according to risk policy.

## Claims, approvals, closure, and profit

### Claim and ClaimResolution

`Claim(id, project_id, sales_shipment_id?, supplier_shipment_id?, type QUANTITY|WEIGHT|QUALITY|DELIVERY|PRICE|DOCUMENT, claimant_party_id, respondent_party_id, claimed_quantity?, claimed_amount?, currency?, status, opened_at, version)` owns immutable `ClaimResolution(id, claim_id, kind DISCOUNT|REPLACEMENT|COMPENSATION|REJECTION|WAIVER, quantity_effect?, amount_effect?, currency?, evidence_id, approved_by, resolved_at, reason)`.

State: `OPEN -> UNDER_REVIEW -> AGREED -> RESOLVED`, or `REJECTED/WITHDRAWN`; unresolved claims block final closure unless a closure-exception approval names the claim.

### ApprovalPolicy and Approval

`ApprovalPolicy(id, action_code, threshold_currency?, threshold_amount?, exception_type?, required_permission, version, effective_from/to, status)` drives risk-based approval. `Approval(id, subject_type/id, action_code, subject_version, decision PENDING|APPROVED|REJECTED, actor_id, decided_at, comment, reason, evidence_id?, policy_id)` is immutable after decision. A decision applies only to the exact subject version; changed content requires new approval.

### ClosureAssessment and ClosureException

`ClosureAssessment(id, subject_type PROJECT|SALES_SHIPMENT, subject_id, assessed_version, financial_complete, quantity_complete, delivery_complete, documents_complete, supplier_obligations_complete, expenses_complete, claims_complete, approvals_complete, blockers_json, assessed_at)` records reproducible closure facts.

- Shipment financial status becomes `FINANCIALLY_CLOSED` when its customer balance is exactly zero, regardless of documents/claims; refund/reversal can reopen it with audit.
- Project financial status becomes `FINANCIALLY_CLOSED` only when every non-cancelled sales shipment is financially closed.
- Project final state becomes `FINAL_CLOSED` only when every closure dimension passes or each named blocker has an authorized `ClosureException(subject_version, blocker_code, reason, approval_id)`.
- Reopen requires permission, reason, exact closed version, and immutable audit event.

### ProfitSnapshot

`ProfitSnapshot(id, project_id, project_version, as_of, currency, expected_margin, committed_margin, actual_operational_margin, cash_position, formula_version, input_hash, generated_at)` is reproducible/read-only. Formula definitions and source lines are separately drillable. Advances affect cash position but not operational revenue; currencies are shown separately or converted only using disclosed recorded rates.

## Audit and request integrity

### AuditEvent

`AuditEvent(id, aggregate_type/id, aggregate_version, sequence_no, action, actor_id, session_id, occurred_at, reason?, correlation_id, idempotency_key?, before_hash?, after_hash, previous_event_hash?, event_hash)` is append-only. Unique `(aggregate_type, aggregate_id, sequence_no)` and the chained hashes expose removal/reordering. Database roles prohibit update/delete; daily signed chain heads are retained in immutable object storage.

### IdempotencyRecord

`IdempotencyRecord(actor_id, route_id, key, request_hash, response_status, response_body_hash/location, created_at, expires_at)` is unique by actor/route/key. Replay with the same hash returns the stored result; a different hash returns conflict. Expiry does not relax business uniqueness.

## Deferred-release extension boundary

BankAccount/ImportBatch/BankRow, TaxPack/TaxClassification, and MigrationRecord are not Release 1 schemas or APIs. Later modules must link through stable `MoneyMovement`, `EvidenceObject`, `Party`, `Approval`, and `AuditEvent` identities and cannot weaken their immutability. No Release 1 closure depends on deferred workflows.
