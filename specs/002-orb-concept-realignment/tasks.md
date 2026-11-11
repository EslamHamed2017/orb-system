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
- [x] T035 User, role and permission administration APIs
  - Verification note (2026-11-11): owner-only bilingual user lifecycle, configurable role creation/assignment, granular permission catalog and role-grant replacement APIs are contract-pinned and route-backed; strict typecheck, all 521 tests with zero skips, and the production build pass.
- [x] T036 Enforce permissions server-side on all new APIs
  - Verification note (2026-11-11): operation-specific resolved grants now take precedence over the legacy role bridge across Accounts, reports, settings, access administration, parties/products, contract and shipment lines, fulfillment, invoices, product movement, and evidence; denial occurs before repositories, storage, or route dependencies. Strict typecheck, 27 focused evidence/security tests, the full 535-test suite with zero skips, and the production build pass.
  - Progress note (2026-11-11): added a fail-closed operation-permission policy with explicit resolved grants taking precedence over the legacy pilot-role bridge; Accounts, Reports, Settings, access administration, customer/supplier masters, contract lines, and sales-shipment lines now enforce operation-specific grants in domain services and HTTP routes. Sales- and supplier-shipment line services and HTTP routes, including multi-supplier consolidation, now enforce distinct list/create/get/summary grants before repository or dependency access. The supplier-container slice passed focused security/contract tests, strict typecheck, all 530 tests with zero skips, and the production build. Customer sales-invoice create/read/print and supplier-invoice creation now require their exact resolved grants in both domain services and HTTP routes before business/dependency access; focused invoice/security tests, strict typecheck, all 532 tests with zero skips, and the production build pass. Product movement traceability now also requires its exact resolved grant in both the service and HTTP route before repository/dependency access. Remaining evidence and other domain API seams must be migrated before completion.

## Phase 3 — Core UI and 360° navigation
- [x] T037 Multi-line sales contract form and detail page
  - Verification note (2026-11-11): bilingual EN/LTR and AR/RTL approved-line detail plus permission-aware amendment composition now support multiple product lines, exact-decimal quantity/value summaries, remaining quantities, add/remove draft behavior, and accessible status feedback. Focused unit/UI tests, strict typecheck, all 535 canonical tests, the production build, and four Chromium acceptance journeys pass.
- [x] T038 Multi-line purchase contract form and detail page
  - Verification note (2026-11-11): supplier-attributable approved and editable purchase-contract detail views now support multiple product lines, exact-decimal totals, remaining quantities, bilingual EN/LTR and AR/RTL composition, and permission-aware draft actions. Focused unit tests, strict typecheck, all 535 canonical tests, the production build, and four managed Chromium acceptance journeys pass.
- [x] T039 Multi-line sales shipment form and detail page
  - Verification note (2026-11-11): bilingual EN/LTR and AR/RTL sales-shipment detail now renders multiple exact approved-contract-line-version rows with remaining-after-shipment quantities and exact-decimal totals; draft mutation is permission-shaped and only permits approved lines with capacity. Focused unit tests, strict typecheck, all 535 canonical tests with zero skips, the production build, and managed Chromium acceptance journeys pass.
- [x] T040 Multi-supplier container/supplier shipment workspace
  - Verification note (2026-11-11): the bilingual EN/LTR and AR/RTL supplier-container workspace consolidates multiple suppliers and approved purchase-contract-line versions in one physical container while preserving per-line supplier/contract attribution, exact-decimal totals, draft-only mutation, and separate-supplier invoice guidance. Focused TDD tests, strict typecheck, all 535 canonical tests with zero skips, the production build, and seven managed Chromium workspace journeys pass.
- [x] T041 Partial fulfillment and remaining quantities visualization
  - Verification note (2026-11-11): sales-shipment detail now visualizes exact line-level prior fulfillment, current shipment quantity, cumulative progress, and remaining quantity with accessible bilingual EN/LTR and AR/RTL progress indicators. Exact-decimal unit tests, inconsistency/over-fulfillment guards, strict typecheck, all 535 canonical tests with zero skips, the production build, and seven managed Chromium acceptance journeys pass.
- [x] T042 Project 360° overview with linked record counts and actions
  - Verification note (2026-11-11): the bilingual project overview now consumes fail-closed authoritative linked-record counts and provides direct project-scoped actions for contracts, supplier containers, sales shipments, customer/supplier invoices, collections/payments, expenses, claims, attachments, and audit. Focused integration tests, strict typecheck, all 535 canonical tests, the production build, and six Chromium EN/LTR and AR/RTL journeys pass.
- [x] T043 Bidirectional breadcrumbs/related-record navigation
  - Verification note (2026-11-11): shared bilingual breadcrumbs and project-context related-record navigation now connect project overview, contracts, supplier containers, sales shipments, operational Accounts, expenses, claims, audit, closure/statements context, and reports; standalone shipment/container pages preserve exact project and record IDs. Focused TDD tests, strict typecheck, all 535 canonical tests, the production build, and three Chromium EN/LTR and AR/RTL journeys pass.
- [x] T044 Products master page
  - Verification note (2026-11-11): the bilingual EN/LTR and AR/RTL product master exposes searchable/filterable traded-product specifications, explicit ACTIVE/INACTIVE lifecycle controls, registration fields, and primary navigation while explicitly excluding free-stock and inventory-valuation semantics. Focused TDD tests, strict typecheck, all 535 canonical tests with zero skips, the production build, and three Chromium acceptance journeys pass.
- [x] T045 Product movement/history page
  - Verification note (2026-11-11): the bilingual EN/LTR and AR/RTL product movement page exposes cross-project inbound/outbound traceability, exact-decimal filtered summaries, project/direction/search filters, source-allocation context, and bidirectional links to products, projects, supplier containers, and sales shipments without stock-balance or inventory-valuation semantics. Focused TDD tests, strict typecheck, all 535 canonical tests with zero skips, the production build, and three managed Chromium journeys pass.
- [x] T046 Customers page and customer detail
  - Verification note (2026-11-11): the bilingual EN/LTR and AR/RTL customer directory now supports lifecycle and contact search/filtering, permission-shaped create/edit actions, and an independent customer 360 detail with project, sales-contract, sales-invoice, and collection links. Focused TDD tests, strict typecheck, all 535 canonical tests with zero skips, the production build, and three managed Chromium journeys pass.
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
