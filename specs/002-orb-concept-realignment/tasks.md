# ORB Concept Realignment — Execution Tasks

## Phase 0 — Safety and baseline
- [ ] T001 Preserve and verify current uncommitted accessibility/navigation fixes
- [ ] T002 Run baseline typecheck, unit/contract tests, build, and focused E2E
- [ ] T003 Record current database schema and seed counts
- [ ] T004 Freeze approved domain terminology in Arabic and English
- [ ] T005 Confirm customer-invoice vs supplier-invoice grouping rule in spec
- [ ] T006 Create isolated migration/restore test database

## Phase 1 — Schema foundation
- [ ] T007 Add ContractLine and version relationship without dropping legacy fields
- [ ] T008 Add SalesShipmentLine linked to ContractLine
- [ ] T009 Add SupplierShipmentLine linked to purchase ContractLine
- [ ] T010 Add physical Container/Consolidation entity for multi-supplier loads
- [ ] T011 Add fulfillment/allocation constraints and tolerance rules
- [ ] T012 Add customer invoice header/lines for one sales-shipment invoice
- [ ] T013 Preserve supplier-attributable invoices and add invoice lines
- [ ] T014 Add generic transaction serial registry and uniqueness rules
- [ ] T015 Add generic attachment link model with parent authorization metadata
- [ ] T016 Add Permission, Role, RolePermission and user assignment models
- [ ] T017 Generate expand migration and rollback instructions
- [ ] T018 Migrate seed/legacy records and verify row-level integrity

## Phase 2 — Domain APIs
- [ ] T019 Contract line create/read/update/version APIs
- [ ] T020 Contract line approval and amendment validation
- [ ] T021 Sales shipment line APIs with contract-line validation
- [ ] T022 Supplier shipment line APIs with purchase-line validation
- [ ] T023 Partial fulfillment and remaining-quantity query
- [ ] T024 Multi-supplier container consolidation APIs
- [ ] T025 Product master CRUD and status controls
- [ ] T026 Product movement/traceability query across projects
- [ ] T027 Customer and supplier UI-ready CRUD contracts
- [ ] T028 Customer invoice create/read/print data APIs
- [ ] T029 Supplier invoice line and supplier-attribution APIs
- [ ] T030 Global Accounts summary/list APIs with project filters
- [ ] T031 Transaction serial generation service for all core movements
- [ ] T032 Generic attachment upload/list/download authorization service
- [ ] T033 Reports query layer for operational pilot reports
- [ ] T034 Settings read/update APIs with audit trail
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
- [ ] T059 Professional ORB sign-in redesign in EN/LTR
- [ ] T060 Professional ORB sign-in redesign in AR/RTL
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
- [ ] T081 Full pilot lifecycle E2E on Chromium
- [ ] T082 Firefox and WebKit smoke/regression runs
- [ ] T083 Security audit and dependency review
- [ ] T084 Backup plus isolated restore rehearsal with integrity comparison
- [ ] T085 Production build, health checks and signed release candidate
- [ ] T086 Controlled pilot deployment and rollback verification
- [ ] T087 First real-data transaction walkthrough with owner review

## Definition of done
A task is complete only after implementation, relevant automated test, successful verification output, and a focused Git commit. No checkbox may be marked from documentation alone.
