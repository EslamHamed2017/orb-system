# ORB Concept Realignment — Execution Tasks

## Phase 0 — Safety and baseline
- [x] T001 Preserve and verify current uncommitted accessibility/navigation fixes
- [x] T002 Repair the two red baseline tests, then rerun typecheck, unit/contract tests, build, audit, and focused E2E
- [x] T003 Repair CI topology: separate offline, local-browser, and deployed acceptance gates and record baseline schema/seed counts
- [x] T004 Freeze approved domain terminology in Arabic and English
- [x] T005 Confirm customer-invoice vs supplier-invoice grouping rule in spec
- [x] T006 Create isolated PostgreSQL/object-storage migration and restore environment; eliminate skipped real-DB migration gate

## Phase 1 — Schema foundation
- [x] T007 Add stable ContractLine plus immutable ContractLineVersion under ContractVersion without dropping legacy fields
- [x] T008 Add SalesShipmentDatasetLine linked to the exact approved ContractLineVersion
- [x] T009 Add SupplierShipmentDatasetLine linked to the exact approved purchase ContractLineVersion
- [x] T010 Evolve SupplierShipment into the physical container header and move supplier/contract ownership to its dataset lines
- [x] T011 Add ShipmentLineSourceAllocation plus fulfillment, exact-decimal concurrency and tolerance constraints
- [x] T012 Add SalesInvoice and SalesInvoiceLine with one active sales invoice per sales shipment
- [x] T013 Add SupplierInvoiceLine and enforce same-supplier shipment-line attribution
- [x] T014 Add generic transaction serial registry and uniqueness rules
- [x] T015 Harden existing EvidenceObject/EvidenceLink with project scope, subject allowlist and parent authorization metadata
- [x] T016 Add Permission, Role, RolePermission and user assignment models
- [x] T017 Generate expand migration, feature-flag cutover and application-rollback procedure with no database down-migration
- [x] T018 Backfill legacy records 1:1, preserve v1 hashes, define v2 line hashes, and reconcile row/quantity/value totals

## Phase 2 — Domain APIs
- [x] T019 Contract line create/read/update/version APIs
- [x] T020 Contract line approval and amendment validation
  - Verification note (2026-11-11): focused contract-line tests, typecheck, and the full test suite pass; the RBAC inventory pin is synchronized with the accepted 84-operation OpenAPI surface.
- [x] T021 Sales shipment line APIs with contract-line validation
  - Verification note (2026-11-11): strict typecheck and the full 411-test suite pass; nested list/create/get APIs reject non-draft datasets, arbitrary or cross-contract/unapproved line versions, duplicate contract-line use, invalid facts, and unauthorized writes.
- [x] T022 Supplier shipment line APIs with purchase-line validation
  - Verification note (2026-11-11): strict typecheck and the full 428-test suite pass; nested list/create/get APIs reject non-draft datasets, arbitrary, sales, cross-contract, cross-supplier, unapproved, duplicate, malformed, and unauthorized writes.
- [x] T023 Partial fulfillment, source-allocation and remaining-quantity/value query
  - Verification note (2026-11-11): strict typecheck and the full 432-test suite pass; exact-decimal line allocations require a serializable locked repository transaction, enforce sales/source capacity and project/product compatibility, and expose authorized remaining quantity/value queries.
- [x] T024 Multi-supplier container consolidation APIs
  - Verification note (2026-11-11): strict typecheck and the full 447-test suite pass; supplier-container lines now carry explicit purchase-contract/supplier ownership, reject cross-project or mismatched approved lines, support multiple suppliers in one physical dataset, and expose an exact-decimal supplier-attributable consolidation summary API.
- [x] T025 Product master CRUD and status controls
  - Verification note (2026-11-11): product create/list/exact-read/update services use immutable references and explicit ACTIVE/INACTIVE status (no deletion); the additive PostgreSQL status migration passed fresh isolated deployment and idempotent backfill with zero skips, strict typecheck passed, and the canonical 448-test suite passed.
- [x] T026 Product movement/traceability query across projects
  - Verification note (2026-11-11): the authorized product movement API returns deterministic inbound/outbound traceability across projects with optional project filtering and source-allocation lineage, while exposing no stock balance or inventory valuation; strict typecheck, the full 462-test suite, and the production build pass.
- [x] T027 Customer and supplier UI-ready CRUD contracts
  - Verification note (2026-11-11): dedicated typed customer/supplier list, create, exact-read, update/archive contracts and route factories reuse the validated party master lifecycle with server-side role checks; strict typecheck, all 464 tests, and the production build pass.
- [x] T028 Customer invoice create/read/print data APIs
  - Verification note (2026-11-11): one active customer invoice is grouped per sales shipment with immutable exact shipment-line traceability, partial quantity bounds, exact-decimal totals, authorized reads, and deterministic EN/LTR or AR/RTL print data; strict typecheck, the full test suite, and the production build pass.
- [x] T029 Supplier invoice line and supplier-attribution APIs
  - Verification note (2026-11-11): supplier invoices are line-driven against the physical container's exact approved active-dataset lines, derive exact-decimal totals server-side, reject cross-supplier attribution, and preserve legacy single-supplier compatibility during cutover; strict typecheck, all 465 tests, and the production build pass.
- [x] T030 Global Accounts summary/list APIs with project filters
  - Verification note (2026-11-11): finance-authorized operational Accounts summary and typed list APIs expose deterministic exact-decimal, currency-partitioned totals and optional project filtering without general-ledger semantics; strict typecheck, all 481 tests, and the production build pass.
- [x] T031 Transaction reference allocator for all core movements with concurrency guarantees
  - Verification note (2026-11-11): immutable year-scoped ORB references cover every closed core transaction type; PostgreSQL `SERIALIZABLE` allocation uses transaction-scoped series and subject advisory locks plus retry handling to prevent collisions, including UTC year rollover; six focused concurrency/repository tests, strict typecheck, the full 481-test suite, and the production build pass.
- [x] T032 EvidenceObject/EvidenceLink attachment upload/list/download authorization service
  - Verification note (2026-11-11): uploads now resolve and persist project-scoped authorization-parent metadata before object storage, list/read/download filter through source authorization, and Prisma writes all hardened EvidenceObject/EvidenceLink fields; strict typecheck, the canonical 485-test suite, and the production build pass.
- [x] T033 Reports query layer for operational pilot reports
  - Verification note (2026-11-11): finance-authorized contract-fulfillment, Accounts, and project-profitability report queries support deterministic project/date filtering and exact-decimal summaries without general-ledger, stock, or valuation semantics; strict typecheck, all 501 tests, and the production build pass.
- [x] T034 Settings read/update APIs with audit trail
  - Verification note (2026-11-11): owner-only non-secret settings reads and optimistic versioned updates cover bilingual organization, numbering and print controls; every update requires a reason and appends an immutable before/after audit record. Focused TDD contracts, strict typecheck, the full suite, production build, and the isolated PostgreSQL/object-store gate pass with all five migrations and zero skipped database tests.
- [ ] T035 User, role and permission administration APIs
- [ ] T036 Enforce permissions server-side on all new APIs

## Phase 3 — Core UI and 360° navigation
- [ ] T037 Multi-line sales contract form and detail page
- [ ] T038 Multi-line purchase contract form and detail page
- [ ] T039 Multi-line sales shipment form and detail page
- [ ] T040 Multi-supplier container/supplier shipment workspace
- [ ] T041 Partial fulfillment and remaining quantities visualization
- [ ] T042 Project 360° overview with linked record counts and actions
- [ ] T043 Bidirectional breadcrumbs/related-record navigation
- [ ] T044 Products master page
- [ ] T045 Product movement/history page
- [ ] T046 Customers page and customer detail
- [ ] T047 Suppliers page and supplier detail
- [ ] T048 Global Accounts hub
- [ ] T049 Project-filtered sales invoices view
- [ ] T050 Project-filtered purchase invoices view
- [ ] T051 Project-filtered payments/collections view
- [ ] T052 Project-filtered expenses view

## Phase 4 — Administration and experience
- [ ] T053 Full users management screen
- [ ] T054 Roles and granular permissions matrix screen
- [ ] T055 Permission-aware navigation and action states
- [ ] T056 Settings control center and navigation
- [ ] T057 Serial/numbering settings
- [ ] T058 Print/template and organization settings
- [ ] T059 Refine the existing strong ORB sign-in experience in EN/LTR without rebuilding it
- [ ] T060 Refine the existing strong ORB sign-in experience in AR/RTL without rebuilding it
- [ ] T061 Sign-in accessibility, performance and security verification

## Phase 5 — Documents, printing and reports
- [ ] T062 Add attachment panel to contracts
- [ ] T063 Add attachment panel to shipments/containers
- [ ] T064 Add attachment panel to invoices and money movements
- [ ] T065 Add attachment panel to expenses and other pilot transactions
- [ ] T066 Central attachments index linked to source transaction
- [ ] T067 Printable contract output
- [ ] T068 Printable shipment/container output
- [ ] T069 Printable customer and supplier invoice outputs
- [ ] T070 Printable payment/collection/expense outputs
- [ ] T071 Reports hub and filter framework
- [ ] T072 Product movement report
- [ ] T073 Contract fulfillment report
- [ ] T074 Accounts and project profitability operational reports

## Phase 6 — Verification and pilot
- [ ] T075 Unit/contract tests for new schema and rules
- [ ] T076 Integration tests for multi-line and multi-supplier flows
- [ ] T077 Permission matrix negative-path tests
- [ ] T078 Attachment isolation/security tests
- [ ] T079 Serial concurrency and uniqueness tests
- [ ] T080 Arabic/English and RTL/LTR acceptance tests
- [ ] T081 Full internal-alpha lifecycle E2E on Chromium using isolated PostgreSQL/object storage
- [ ] T082 Firefox and WebKit smoke/regression runs
- [ ] T083 Security audit and dependency review
- [ ] T084 Backup plus isolated restore rehearsal with integrity comparison
- [ ] T085 Clean immutable build, SBOM, health checks and signed release candidate
- [ ] T086 Owner UAT plus application rollback verification against expanded schema
- [ ] T087 Controlled canary real-data walkthrough with owner review, stop conditions and monitoring

## Definition of done
A task is complete only after implementation, relevant automated test, successful verification output, and a focused Git commit. No checkbox may be marked from documentation alone.
