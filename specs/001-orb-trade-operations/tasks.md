# Implementation Task Graph: ORB Release 1

**Branch/accepted baseline**: `001-orb-trade-operations` at `6ca9ce4323a986556e4b83639df1f64eb0e6dc02`
**Authority**: `spec.md`, ADR-001, accepted `plan.md`, `data-model.md`, `research.md`, `quickstart.md`, `contracts/openapi.yaml`, `contracts/ui-workflows.md`, and `contracts/problem-details.md`.
**Rule**: tasks are intentionally unchecked. Implementation must be test-first: a task that creates a test must be run and retained failing for the expected missing behavior before its dependent implementation begins. No deadline waives a failed security, integrity, recovery, or acceptance gate.

## Scope guard

Release 1 contains exactly three fixed composable roles (`OWNER_ADMIN`, `OPERATIONS`, `FINANCE_VIEWER`), exactly one Project per independent sales contract, and exactly one primary supplier shipment per sales shipment. Bank ingestion/integration, tax engine or pack, historical migration, multiple supplier sources, shared-expense allocation, configurable approval rules/designer, dynamic route design, advanced claim settlement, general ledger and speculative placeholders are absent from schema, API, UI, fixtures, navigation, acceptance and closure rules.

## Task field contract

Every task below has a stable ID, exact output file paths, explicit prerequisites, output, acceptance evidence, and requirement/API/UI/evidence trace. `[P]` means parallel-safe only after all listed prerequisites complete and only because its files do not overlap another concurrently marked task. `Operations: none` means infrastructure with no direct endpoint; `ALL79` is expanded in the canonical mapping appendix. For the initial graph and every later-created file, each literal path in **Exact files** creates the immutable **primary historical ownership** relation `primary[path] = task`: exactly one task is the primary owner for each path, and that owner is never transferred, replaced or duplicated. An ordinary task may create or edit only its listed exact primary-owned files. No unlisted page, registry, composition, fixture, migration, deployment, evidence, or integration edit is permitted.

A future correction is the sole exception for editing an already primary-owned path, and is represented by a separate reviewed **correction edit overlay** relation, never by a second primary owner. It is executable only as a concrete `ORB-R1-CORR-NNNN` row added by reviewed graph amendment after branch selection; `ORB-R1-CORR-NNNN` in this document and its template is a non-executable schema token, not a task. The row must declare: **Corrects files** as a comma-separated list of literal existing paths; **Primary owner** as an exact one-to-one `` `path` -> `ORB-R1-NNNN` `` mapping for every corrected path; and **Supersedes** as an exact per-path mapping to `none` for the first overlay or to the immediately prior concrete correction ID. It must also declare the defect/reason ID, exact retained failing-test paths and fail-before-edit evidence, focused regression and impact scope, security/integrity/contract review dispositions, and named explicit reviewer approval recorded before any edit. Its prerequisites must include `ORB-R1-1316` (or a concrete reviewed replacement branch-selection gate), every mapped primary-owner task, and every correction it supersedes. Corrected test files are overlay targets too and therefore appear in both **Corrects files** and **Primary owner**; a test newly created by a correction instead appears once in **Exact files**, making that correction its immutable primary owner. Directories, globs, wildcard paths, inferred owners, inferred targets and undeclared edits are forbidden and fail closed.

`Trace: ... evidence Exx` is coverage intent only. Static, unit, contract, integration, local browser, pre-deployment, mocked, or harness-construction work never earns numbered E01–E17 evidence. Numbered evidence is earned only by the deployed-runtime tasks in P13 against the recorded immutable artifact digest and environment identity.

## P0 Gate and traceability

- [ ] **ORB-R1-0001** **[FOUND] Create executable contract and traceability guard tests**
  - **Prerequisites**: none; gate starts from accepted planning commit.
  - **Exact files**: `tests/contract/openapi-contract.test.ts`, `tests/contract/traceability.test.ts`, `tests/contract/deferred-surface.test.ts`.
  - **Output**: Failing tests that parse OpenAPI 3.1, resolve local refs, assert exactly 79 unique operationIds and fixed role extensions, and reject any bank/tax/migration/multi-source/shared-expense/configurable-rule/dynamic-route/advanced-claim surface.
  - **Tests / acceptance evidence**: Before implementation, retain failing output caused only by absent application/build artifacts; after each phase, 75 paths/79 operations and zero deferred surfaces pass.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E01, E02, E17.

- [ ] **ORB-R1-0002** **[FOUND] Create task-to-acceptance coverage verifier**
  - **Prerequisites**: `ORB-R1-0001`.
  - **Exact files**: `scripts/verify-r1-task-coverage.mjs`, `tests/contract/task-coverage.test.ts`.
  - **Output**: A checker that reads tasks.md and authoritative artifacts and fails on missing/duplicate operationId, R1/INV, UI route or actual page file, duplicate/missing primary exact-file owner, E01-E17, unknown or forward prerequisite, cycle, incomplete Today source prerequisites, acceptance-before-deployment, evidence without frozen digest/environment identity, or any task marked complete. Parse primary ownership and correction overlays as separate relations: ordinary and correction-created new-file primary ownership stays globally unique; every overlay target must already exist in the primary map; every declared mapped owner must equal that map; and every actual changed path must be authorized either by the task's primary list or its reviewed overlay list. Reject non-concrete correction IDs, placeholders treated as executable tasks, directory/glob/wildcard paths, inferred ownership, unknown targets, missing correction metadata/approval/test evidence/review/prerequisites, overlay-only new files, and undeclared edits. For repeated overlays on a target, require a total prerequisite order and exact per-target **Supersedes** chain to the immediately prior overlay; reject parallel or skipped/unordered overlapping editors.
  - **Tests / acceptance evidence**: Run checker against this graph; expect 85 unique tasks/196 edges, 415 unique primary file entries, zero correction overlays, 79/79 operations, 20/20 requirements, 7/7 invariants, 21/21 contract routes backed by 22 actual page files (two admin pages), 17/17 evidence steps, full coverage, topological order, no cycles, and all tasks unchecked. In `tests/contract/task-coverage.test.ts`, add a synthetic in-memory verifier fixture (not an executable correction task and not another owned file) that accepts a correctly mapped, approved, retained-failing-test correction plus a strictly ordered superseding overlay, and separately rejects wrong primary owner, wildcard/directory path, missing approval, missing retained failing test or exact test path, unknown target, unordered overlapping overlays, broken supersession, overlay-only new file and any undeclared edit.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E01, E02, E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17.

## P1 Scaffolding

- [ ] **ORB-R1-0101** [P] **[FOUND] Pin the accepted runtime and dependency baseline**
  - **Prerequisites**: `ORB-R1-0001`.
  - **Exact files**: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`, `.node-version`.
  - **Output**: Exact plan pins, strict peer policy, only Prisma build scripts allowed, and commands for generate/typecheck/test/build.
  - **Tests / acceptance evidence**: Frozen clean install, prisma generate, typecheck, test harness and production build reproduce compatibility evidence hashes or document an authorized lock change.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations none; UI none; evidence E01.

- [ ] **ORB-R1-0102** [P] **[FOUND] Configure strict TypeScript, Next, Vitest and Playwright**
  - **Prerequisites**: `ORB-R1-0101`.
  - **Exact files**: `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `src/test/setup.ts`.
  - **Output**: Strict application compilation, isolated test projects, browser matrix and no implicit network access in unit tests.
  - **Tests / acceptance evidence**: A deliberately invalid fixture fails typecheck; empty harness runs; Next production build succeeds.
  - **Trace**: requirements R1-014, R1-017; operations none; UI none; evidence E01.

- [ ] **ORB-R1-0103** **[FOUND] Create modular-monolith boundaries and dependency test**
  - **Prerequisites**: `ORB-R1-0102`.
  - **Exact files**: `src/modules/README.md`, `src/platform/README.md`, `src/ui/README.md`, `tests/architecture/module-boundaries.test.ts`.
  - **Output**: Documented boundaries for access/masters, projects/contracts, shipments/routes, evidence/documents/outbound, invoices/money/statements, expenses/claims, profit/closure, audit/recovery.
  - **Tests / acceptance evidence**: Architecture test rejects reverse imports and any deferred module name.
  - **Trace**: requirements R1-017, R1-020, INV-07; operations none; UI none; evidence E02.

- [ ] **ORB-R1-0104** **[FOUND] Define validated runtime configuration and secret redaction**
  - **Prerequisites**: `ORB-R1-0102`.
  - **Exact files**: `src/platform/config/schema.ts`, `src/platform/config/index.ts`, `src/platform/logging/redaction.ts`, `tests/unit/platform/config.test.ts`, `.env.example`.
  - **Output**: Fail-fast typed configuration for PostgreSQL, immutable object storage, TLS origins, auth expiry, encryption, telemetry and backup endpoints, without secret values in logs.
  - **Tests / acceptance evidence**: Tests reject missing/unsafe production settings and prove secrets and identity payloads are redacted.
  - **Trace**: requirements R1-014; operations none; UI /sign-in, /admin/backup; evidence E01, E16.

- [ ] **ORB-R1-0105** **[FOUND] Create CI quality and immutable-build pipeline**
  - **Prerequisites**: `ORB-R1-0101`, `ORB-R1-0102`, `ORB-R1-0002`.
  - **Exact files**: `.github/workflows/ci.yml`, `scripts/verify-build-manifest.mjs`, `tests/contract/build-manifest.test.ts`.
  - **Output**: Pipeline for frozen install, generate, typecheck, unit/contract/integration/acceptance, OpenAPI, coverage, security scan and immutable build digest.
  - **Tests / acceptance evidence**: CI fails for contract drift, deferred route, dependency drift, failing tests, Critical scan result or uncommitted generated artifact.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E01, E02, E16, E17.

## P2 Integrity foundation

- [ ] **ORB-R1-0201** **[FOUND] Write schema invariant and migration tests first**
  - **Prerequisites**: `ORB-R1-0102`.
  - **Exact files**: `tests/integration/database/schema-invariants.test.ts`, `tests/integration/database/migrations.test.ts`.
  - **Output**: Failing tests for UUIDv7/scoped uniqueness, exact numeric columns, XORs, immutable records, fixed enums, one sales contract per Project, one sales primary source, and explicit absence of deferred entities.
  - **Tests / acceptance evidence**: Tests fail before schema exists and enumerate every data-model invariant and forbidden table.
  - **Trace**: requirements R1-015, R1-019, R1-020, INV-01, INV-02, INV-03, INV-07; operations none; UI none; evidence E02, E04, E05, E10, E11.

- [ ] **ORB-R1-0202** **[FOUND] Implement the complete Release 1 Prisma schema and initial migration**
  - **Prerequisites**: `ORB-R1-0201`.
  - **Exact files**: `prisma/schema.prisma`, `prisma/migrations/202611050001_r1_initial/migration.sql`, `prisma/migrations/migration_lock.toml`.
  - **Output**: All entities, fixed enums, foreign keys, checks, unique/index constraints and append-only storage from data-model.md; no deferred table or placeholder.
  - **Tests / acceptance evidence**: Fresh migrate and rollback rehearsal pass schema tests; SQL inspection proves numeric precision, immutable/history tables and forbidden-table absence.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations none; UI none; evidence E01, E02, E16.

- [ ] **ORB-R1-0203** **[FOUND] Write request-integrity and transaction tests first**
  - **Prerequisites**: `ORB-R1-0202`.
  - **Exact files**: `tests/integration/platform/idempotency-concurrency.test.ts`, `tests/integration/platform/decimal-transaction.test.ts`, `tests/contract/problem-details.test.ts`.
  - **Output**: Failing tests for Idempotency-Key replay/conflict, quoted If-Match, CSRF hook, serializable retry, exact decimals, currency separation and localized RFC 9457.
  - **Tests / acceptance evidence**: Concurrent fixtures demonstrate stale write and duplicate effect before middleware exists; expected stable error codes are asserted.
  - **Trace**: requirements R1-016, R1-018, R1-019, INV-01, INV-02; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI none; evidence E02, E16.

- [ ] **ORB-R1-0204** **[FOUND] Implement shared command, idempotency, decimal and RFC 9457 platform**
  - **Prerequisites**: `ORB-R1-0203`.
  - **Exact files**: `src/platform/http/command.ts`, `src/platform/http/problem.ts`, `src/platform/idempotency/store.ts`, `src/platform/database/transaction.ts`, `src/platform/decimal/index.ts`, `src/platform/i18n/problems.ts`.
  - **Output**: Reusable mutation envelope enforcing idempotency, current aggregate version, serializable retry, exact decimal arithmetic, correlation ID and localized safe failures.
  - **Tests / acceptance evidence**: Request-integrity suite passes; changed replay returns IDEMPOTENCY_KEY_REUSED, stale writes return STALE_VERSION, and unlike currencies cannot sum.
  - **Trace**: requirements R1-016, R1-018, R1-019; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI none; evidence E02, E16.

- [ ] **ORB-R1-0205** **[FOUND] Write immutable audit-chain tests first**
  - **Prerequisites**: `ORB-R1-0202`.
  - **Exact files**: `tests/integration/audit/audit-chain.test.ts`, `tests/contract/audit-page.test.ts`.
  - **Output**: Failing tests for transactional append, exact RFC8785 payload keys/nulls, per-Project sequence, genesis/link hashes, cursor anchors, actor/session snapshots and write denial.
  - **Tests / acceptance evidence**: Independent hash recomputation fails until audit writer exists; update/delete attempts are denied.
  - **Trace**: requirements R1-014, R1-015, INV-01; operations listProjectAuditEvents; UI /projects/{id}/audit; evidence E16.

- [ ] **ORB-R1-0206** **[FOUND] Implement transactional immutable audit and daily signed heads**
  - **Prerequisites**: `ORB-R1-0205`, `ORB-R1-0204`.
  - **Exact files**: `src/modules/audit/audit-service.ts`, `src/modules/audit/audit-repository.ts`, `src/modules/audit/audit-query.ts`, `src/platform/canonical-json/rfc8785.ts`, `src/app/api/projects/[projectId]/audit-events/route.ts`, `src/modules/audit/daily-head-job.ts`.
  - **Output**: Append-only audit in the business transaction, exact SHA-256 chain, paged continuity anchors, authorized read API and retained signed daily head object.
  - **Tests / acceptance evidence**: Audit tests pass across cursor pages and concurrent commands; database role cannot update/delete and stored head matches latest chain hash.
  - **Trace**: requirements R1-014, R1-015, R1-017, INV-01; operations listProjectAuditEvents; UI /projects/{id}/audit; evidence E02, E16.

- [ ] **ORB-R1-0207** **[FOUND] Write evidence immutability and authorization tests first**
  - **Prerequisites**: `ORB-R1-0202`.
  - **Exact files**: `tests/integration/evidence/evidence-storage.test.ts`, `tests/contract/evidence-api.test.ts`, `tests/security/evidence-idor.test.ts`.
  - **Output**: Failing stream/hash/object-version, PENDING/VERIFIED conditional, source-link, retention, malware/type/size, authorized view/download and audited access tests.
  - **Tests / acceptance evidence**: Hash mismatch, malformed VERIFIED metadata, unauthorized object key access and mutation/delete all fail closed.
  - **Trace**: requirements R1-003, R1-014, R1-015; operations uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence; UI /evidence/{id}; evidence E07, E16.

- [ ] **ORB-R1-0208** **[FOUND] Implement immutable evidence object storage**
  - **Prerequisites**: `ORB-R1-0207`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/evidence/evidence-service.ts`, `src/modules/evidence/evidence-repository.ts`, `src/platform/object-store/client.ts`, `src/platform/object-store/hash-stream.ts`, `src/app/api/evidence/route.ts`, `src/app/api/evidence/[evidenceId]/route.ts`, `src/app/api/evidence/[evidenceId]/content/route.ts`.
  - **Output**: Streaming upload to retention/version locked object storage, immutable metadata/source links, verification state and permission-checked audited content access.
  - **Tests / acceptance evidence**: Evidence suites pass byte/hash comparison, conditional schemas, IDOR checks and append-only audit for view/download.
  - **Trace**: requirements R1-003, R1-014, R1-015; operations uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence; UI /evidence/{id}; evidence E02, E07, E16.

- [ ] **ORB-R1-0209** **[FOUND] Write fixed-role session, CSRF and self-approval security tests first**
  - **Prerequisites**: `ORB-R1-0202`.
  - **Exact files**: `tests/security/auth-rbac-csrf.test.ts`, `tests/contract/access-api.test.ts`, `tests/integration/access/session-lifecycle.test.ts`, `tests/acceptance/auth/sign-in.spec.ts`, `tests/contract/access-administration-api.test.ts`.
  - **Output**: Failing tests for exactly three composable roles, server permission shaping, Owner MFA, cookie flags, rotation, 30m idle/12h absolute expiry, Origin/Referer plus CSRF, session conditionals/revoke, requester-approver separation, and the bilingual `/sign-in` page workflow.
  - **Tests / acceptance evidence**: Each role gets allowed/denied matrix; missing/mismatch/revoked/expired requests fail; self-approval always fails.
  - **Trace**: requirements R1-001, R1-014, R1-018; operations signIn, signOutCurrentSession, getCurrentSession, changeOwnPassword, resetUserPassword, listPilotUsers, assignFixedPilotRoles, listPilotUserSessions, revokePilotUserSession, createUser, updateUser, listRoles, createRole, replaceRolePermissions, listPermissions, decideFixedApproval; UI /sign-in, /admin/users, /approvals; evidence E03, E16.

- [ ] **ORB-R1-0210** **[FOUND] Implement authentication, fixed RBAC, sessions and CSRF**
  - **Prerequisites**: `ORB-R1-0209`, `ORB-R1-0204`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/access/auth.ts`, `src/modules/access/roles.ts`, `src/modules/access/session-service.ts`, `src/platform/http/csrf.ts`, `src/platform/http/authorize.ts`, `src/app/api/sessions/route.ts`, `src/app/api/sessions/current/route.ts`, `src/app/api/sessions/current/password/route.ts`, `src/app/api/users/[userId]/password/route.ts`, `src/modules/access/password.ts`, `src/modules/access/access-store.ts`, `src/modules/access/access-service.ts`, `src/modules/access/access-runtime.ts`, `src/modules/access/role-catalog.ts`, `src/app/api/users/route.ts`, `src/app/api/users/[userId]/roles/route.ts`, `src/app/api/users/[userId]/sessions/route.ts`, `src/app/api/users/[userId]/sessions/[sessionId]/revoke/route.ts`, `src/app/sign-in/page.tsx`, `src/ui/features/auth/SignInForm.tsx`, `src/modules/access/administration-service.ts`, `src/modules/access/administration-http.ts`, `src/app/api/permissions/route.ts`, `src/app/api/roles/route.ts`, `src/app/api/roles/[roleId]/permissions/route.ts`, `src/app/api/users/[userId]/route.ts`.
  - **Output**: Better Auth integration with exact cookie/session policy, MFA gate, fixed composable roles, field-shaped reads, privilege/token rotation, own sign-out and Owner exact-session revoke, plus the actual bilingual `/sign-in` page and form tested by ORB-R1-0209.
  - **Tests / acceptance evidence**: Security/access suites pass all three roles and session conditional schemas; every authenticated mutation goes through CSRF/origin/version/idempotency middleware.
  - **Trace**: requirements R1-001, R1-014, R1-017, R1-018; operations signIn, signOutCurrentSession, getCurrentSession, changeOwnPassword, resetUserPassword, listPilotUsers, assignFixedPilotRoles, listPilotUserSessions, revokePilotUserSession, createUser, updateUser, listRoles, createRole, replaceRolePermissions, listPermissions; UI /sign-in, /admin/users; evidence E02, E03, E16.

- [ ] **ORB-R1-0211** **[FOUND] Write fixed approval matrix and inbox projection tests first**
  - **Prerequisites**: `ORB-R1-0210`, `ORB-R1-0208`.
  - **Exact files**: `tests/integration/approvals/fixed-matrix.test.ts`, `tests/contract/approval-inbox.test.ts`.
  - **Output**: Failing tests for exact fixed action codes, requester/approver matrix, version/hash binding, expiry, immutable decision and fully typed inbox item without untyped refetch.
  - **Tests / acceptance evidence**: Every matrix action fixture renders exact subject/diff/evidence/conflict/requester/role/context; stale or self decision fails.
  - **Trace**: requirements R1-001, R1-004, R1-005, R1-006, R1-008, R1-009, R1-014, INV-04, INV-05, INV-06; operations listFixedApprovalInbox, decideFixedApproval; UI /approvals; evidence E03, E04, E06, E09, E10, E11, E13, E14.

- [ ] **ORB-R1-0212** **[FOUND] Implement fixed approvals and typed inbox**
  - **Prerequisites**: `ORB-R1-0211`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/approvals/action-codes.ts`, `src/modules/approvals/approval-service.ts`, `src/modules/approvals/approval-query.ts`, `src/app/api/approvals/route.ts`, `src/app/api/approvals/[approvalId]/decision/route.ts`.
  - **Output**: Immutable exact-version/hash approval request/decision/expiry service and Owner-only typed inbox; no configurable approval policy entity.
  - **Tests / acceptance evidence**: Approval suites pass every fixed action, stale/expired/self denial and immutable decisions with audit.
  - **Trace**: requirements R1-001, R1-004, R1-005, R1-006, R1-008, R1-009, R1-014, R1-020, INV-04, INV-05, INV-06, INV-07; operations listFixedApprovalInbox, decideFixedApproval; UI /approvals; evidence E02, E03, E13.

- [ ] **ORB-R1-0213** **[FOUND] Write ORB MD3 shell and bilingual accessibility tests first**
  - **Prerequisites**: `ORB-R1-0102`.
  - **Exact files**: `tests/unit/ui/tokens.test.ts`, `tests/acceptance/ui/shell-bidi.spec.ts`, `tests/acceptance/ui/navigation-scope.spec.ts`.
  - **Output**: Failing tests for ORB tokens/logo, root lang/dir, logical CSS, bidi isolation, mirrored icons, keyboard/focus, responsive rail/bottom nav and absence of deferred navigation.
  - **Tests / acceptance evidence**: Paired EN/AR checks at 1440x900, 768x1024, 390x844 and 320px fail until shell exists; no raw color or Google branding accepted.
  - **Trace**: requirements R1-013, R1-014, R1-020, INV-07; operations none; UI /, ALL_UI_ROUTES; evidence E15.

- [ ] **ORB-R1-0214** **[FOUND] Implement ORB MD3 bilingual application shell**
  - **Prerequisites**: `ORB-R1-0213`, `ORB-R1-0210`.
  - **Exact files**: `src/app/layout.tsx`, `src/app/loading.tsx`, `src/ui/theme/orb-theme.ts`, `src/ui/theme/tokens.css`, `src/ui/i18n/ar.ts`, `src/ui/i18n/en.ts`, `src/ui/navigation/AppNavigation.tsx`, `src/ui/components/AsyncState.tsx`, `public/orb-logo.svg`.
  - **Output**: ORB-branded MD3 semantic theme, bilingual root direction, route-neutral responsive accessible navigation and reusable loading/empty/error/permission/offline/stale states. The actual Today page is deliberately owned later by ORB-R1-1212 after every promised data source exists.
  - **Tests / acceptance evidence**: Shell tests pass with WCAG 2.2 AA semantics, touch targets, keyboard order, reduced motion and no deferred link.
  - **Trace**: requirements R1-013, R1-014, R1-020, INV-07; operations none; UI /, ALL_UI_ROUTES; evidence E03, E15.

## P3 A1 Masters and contracts

- [ ] **ORB-R1-0301** **[A1] Write essential-master API/domain tests first**
  - **Prerequisites**: `ORB-R1-0212`.
  - **Exact files**: `tests/contract/masters-api.test.ts`, `tests/integration/masters/master-service.test.ts`.
  - **Output**: Failing tests for customer/supplier, coffee, AED/USD/SAR, expense category list/create/update/archive, scoped duplicate references, role shaping and audit.
  - **Tests / acceptance evidence**: Allowed and denied role cases plus stale/replay and localized errors fail before implementation.
  - **Trace**: requirements R1-001, R1-015, R1-018; operations listMasterRecords, createMasterRecord, updateMasterRecord; UI /masters/{customers|suppliers|coffee|currencies|expense-categories}; evidence E02, E03.

- [ ] **ORB-R1-0302** **[A1] Implement essential masters**
  - **Prerequisites**: `ORB-R1-0301`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/masters/master-service.ts`, `src/modules/masters/master-query.ts`, `src/modules/masters/schemas.ts`, `src/app/api/masters/[masterType]/route.ts`, `src/app/api/masters/[masterType]/[recordId]/route.ts`.
  - **Output**: Server-authorized master CRUD/archive restricted to fixed master types with uniqueness, encryption for identity fields, optimistic concurrency and audit.
  - **Tests / acceptance evidence**: Master contract/domain tests pass with exact role and replay/stale evidence.
  - **Trace**: requirements R1-001, R1-014, R1-015, R1-018; operations listMasterRecords, createMasterRecord, updateMasterRecord; UI /masters/{customers|suppliers|coffee|currencies|expense-categories}; evidence E02, E03.

- [ ] **ORB-R1-0303** **[A1] Write Project/contract lifecycle tests first**
  - **Prerequisites**: `ORB-R1-0302`.
  - **Exact files**: `tests/integration/projects/project-contract.test.ts`, `tests/contract/projects-contracts-api.test.ts`.
  - **Output**: Failing atomic Project+one sales draft, independent-contract Project, amendment version, zero-tolerance default, purchase contract, exact approval, safe cancellation and duplicate-reference tests.
  - **Tests / acceptance evidence**: Rollback proves no orphan Project; approved versions reject edits; second SALES contract in one Project and cancellation after execution fail.
  - **Trace**: requirements R1-002, R1-015, R1-016, R1-018; operations listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, cancelUnexecutedProject; UI /projects, /projects/new, /projects/{id}/overview, /projects/{id}/contracts; evidence E04, E14.

- [ ] **ORB-R1-0304** **[A1] Implement Project and immutable contract versions**
  - **Prerequisites**: `ORB-R1-0303`, `ORB-R1-0212`.
  - **Exact files**: `src/modules/projects/project-service.ts`, `src/modules/projects/project-query.ts`, `src/modules/contracts/contract-service.ts`, `src/modules/contracts/schemas.ts`, `src/app/api/projects/route.ts`, `src/app/api/projects/[projectId]/route.ts`, `src/app/api/projects/[projectId]/purchase-contracts/route.ts`, `src/app/api/projects/[projectId]/cancel/route.ts`, `src/app/api/contracts/[contractId]/amendments/route.ts`, `src/app/api/contracts/[contractId]/submit/route.ts`.
  - **Output**: Atomic project/primary contract creation, purchase versions, amendment/supersession, fixed approval activation and guarded pre-execution cancellation.
  - **Tests / acceptance evidence**: A1 integration/contract suite passes exact versions, approval, default zero tolerances, one Project per independent contract and audit.
  - **Trace**: requirements R1-002, R1-015, R1-016, R1-017, R1-018; operations listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, cancelUnexecutedProject, listContractLines, createContractLine, getContractLine, updateContractLine, listContractLineVersions; UI /projects, /projects/new, /projects/{id}/overview, /projects/{id}/contracts; evidence E02, E04, E14.

- [ ] **ORB-R1-0305** **[A1] Write and implement master/Project/contract UI acceptance**
  - **Prerequisites**: `ORB-R1-0302`, `ORB-R1-0304`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a1-project-contracts.spec.ts`, `src/app/masters/[masterType]/page.tsx`, `src/app/projects/page.tsx`, `src/app/projects/new/page.tsx`, `src/app/projects/[id]/contracts/page.tsx`, `src/ui/features/contracts/ContractVersionDiff.tsx`.
  - **Output**: Test-first UI journey then accessible pages for master operations, <=5 minute atomic wizard, visible zero tolerances, immutable approved views, amendment diff and Owner cancellation consequences. The multi-source Project overview page is owned by ORB-R1-1212, not edited here.
  - **Tests / acceptance evidence**: Pre-deployment UI harness mirrors E03-E04 in EN/AR with keyboard-only use, stale compare/reload and server 403 handling; only ORB-R1-1309/1315 may earn those E results.
  - **Trace**: requirements R1-001, R1-002, R1-013, R1-014; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, cancelUnexecutedProject; UI /masters/{customers|suppliers|coffee|currencies|expense-categories}, /projects, /projects/new, /projects/{id}/overview, /projects/{id}/contracts; evidence E03, E04, E15.

## P4 A2 Shipments

- [ ] **ORB-R1-0401** **[A2] Write typed shipment dataset/schema tests first**
  - **Prerequisites**: `ORB-R1-0304`.
  - **Exact files**: `tests/contract/shipment-datasets.test.ts`, `tests/integration/shipments/shipment-constraints.test.ts`.
  - **Output**: Failing separate supplier/sales schemas, all strict fields, reference outside dataset, required shipmentId/invalidatedApprovalIds, one primary source, same Project/compatible facts and quantity summary tests.
  - **Tests / acceptance evidence**: Unknown/identity/linkage injection and second source fail; cancelled/rejected remain visible but excluded from active remaining formulas.
  - **Trace**: requirements R1-002, R1-015, R1-019, INV-01, INV-07; operations createSupplierShipment, getSupplierShipmentWorkspace, listSupplierShipmentDatasetHistory, createSalesShipment, getSalesShipmentWorkspace, listSalesShipmentDatasetHistory, setPrimarySupplierSource; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E05, E06.

- [ ] **ORB-R1-0402** **[A2] Implement shipment repositories, typed workspaces and source binding**
  - **Prerequisites**: `ORB-R1-0401`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/shipments/supplier-schema.ts`, `src/modules/shipments/sales-schema.ts`, `src/modules/shipments/shipment-repository.ts`, `src/modules/shipments/shipment-query.ts`, `src/app/api/projects/[projectId]/supplier-shipments/route.ts`, `src/app/api/projects/[projectId]/sales-shipments/route.ts`, `src/app/api/supplier-shipments/[shipmentId]/route.ts`, `src/app/api/supplier-shipments/[shipmentId]/datasets/route.ts`, `src/app/api/sales-shipments/[shipmentId]/route.ts`, `src/app/api/sales-shipments/[shipmentId]/datasets/route.ts`, `src/app/api/sales-shipments/[shipmentId]/primary-source/route.ts`.
  - **Output**: Distinct immutable dataset storage/history, aggregate workspace reads, exact quantity summary and exactly-one confirmed compatible primary supplier shipment.
  - **Tests / acceptance evidence**: Schema/constraint tests pass and workspaces/history preserve ascending revisions and aggregate identity separation.
  - **Trace**: requirements R1-002, R1-015, R1-017, R1-018, R1-019, INV-01; operations createSupplierShipment, getSupplierShipmentWorkspace, listSupplierShipmentDatasetHistory, createSalesShipment, getSalesShipmentWorkspace, listSalesShipmentDatasetHistory, setPrimarySupplierSource; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E02, E05.

- [ ] **ORB-R1-0403** **[A2] Write shipment submit/approval/tolerance/confirmation tests first**
  - **Prerequisites**: `ORB-R1-0402`, `ORB-R1-0212`.
  - **Exact files**: `tests/integration/shipments/confirmation-approval.test.ts`, `tests/integration/shipments/tolerance.test.ts`, `tests/contract/shipment-commands.test.ts`.
  - **Output**: Failing exact dataset/source approval, requester separation, contracted/confirmed/delivered/cancelled/rejected/remaining totals and outside-tolerance blocker/exception tests.
  - **Tests / acceptance evidence**: Confirm without current approval/source and outside tolerance fails; exact exception succeeds only for bound breached values/reason.
  - **Trace**: requirements R1-002, R1-014, R1-016, R1-018, R1-019, INV-01; operations submitSupplierShipmentConfirmation, confirmSupplierShipment, submitSalesShipmentConfirmation, requestToleranceException, confirmSalesShipment; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}, /approvals; evidence E05, E06.

- [ ] **ORB-R1-0404** **[A2] Implement shipment submit, exact approval, tolerance and confirmation**
  - **Prerequisites**: `ORB-R1-0403`, `ORB-R1-0204`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/shipments/confirmation-service.ts`, `src/modules/shipments/tolerance.ts`, `src/app/api/supplier-shipments/[shipmentId]/submit/route.ts`, `src/app/api/supplier-shipments/[shipmentId]/confirm/route.ts`, `src/app/api/sales-shipments/[shipmentId]/submit/route.ts`, `src/app/api/sales-shipments/[shipmentId]/tolerance-exceptions/route.ts`, `src/app/api/sales-shipments/[shipmentId]/confirm/route.ts`.
  - **Output**: Idempotent exact-version approval requests and locked confirmations with source, tolerance, totals and audit enforcement.
  - **Tests / acceptance evidence**: Confirmation/tolerance suites pass concurrent confirm, stale/replay, self-approval denial and quantity reconciliation.
  - **Trace**: requirements R1-002, R1-014, R1-016, R1-017, R1-018, R1-019, INV-01; operations submitSupplierShipmentConfirmation, confirmSupplierShipment, submitSalesShipmentConfirmation, requestToleranceException, confirmSalesShipment; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}, /approvals; evidence E02, E05, E06.

- [ ] **ORB-R1-0405** **[A2] Write immutable revision and execution graph tests first**
  - **Prerequisites**: `ORB-R1-0404`.
  - **Exact files**: `tests/integration/shipments/dataset-revision.test.ts`, `tests/integration/shipments/execution-graph.test.ts`.
  - **Output**: Failing pre-transit-only revision, supersession, approval/exception expiry, CONFIRMED reset, strict payload, append-only event and declared supplier/sales transition graph tests.
  - **Tests / acceptance evidence**: Each legal/illegal edge, reason/evidence, stale/replay and post-transit revision is asserted; no history row changes.
  - **Trace**: requirements R1-002, R1-016, R1-018, INV-01; operations reviseSupplierShipmentDataset, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E05, E06.

- [ ] **ORB-R1-0406** **[A2] Implement immutable dataset revisions and execution events**
  - **Prerequisites**: `ORB-R1-0405`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/shipments/revision-service.ts`, `src/modules/shipments/execution-service.ts`, `src/app/api/supplier-shipments/[shipmentId]/execution-transitions/route.ts`, `src/app/api/sales-shipments/[shipmentId]/execution-transitions/route.ts`.
  - **Output**: Serializable revision and graph commands preserving old datasets, expiring approvals, resetting confirmation, and appending actor/time/reason/evidence execution events.
  - **Tests / acceptance evidence**: Revision/graph suite passes all edges, identity injection rejection, immutable history, stale/replay and audit evidence.
  - **Trace**: requirements R1-002, R1-015, R1-016, R1-017, R1-018, INV-01; operations reviseSupplierShipmentDataset, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E02, E05, E06.

- [ ] **ORB-R1-0407** **[A2] Write and implement shipment workspaces**
  - **Prerequisites**: `ORB-R1-0402`, `ORB-R1-0404`, `ORB-R1-0406`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a2-shipments.spec.ts`, `src/app/projects/[id]/shipments/page.tsx`, `src/ui/features/shipments/ShipmentWorkspaceCore.tsx`, `src/ui/features/shipments/DatasetHistory.tsx`, `src/ui/features/shipments/ExecutionActions.tsx`, `src/ui/features/shipments/QuantitySummary.tsx`.
  - **Output**: Test-first bilingual shipment list/actions and reusable typed workspace core with immutable history/diffs, source picker, graph-valid actions, tolerance details, approval invalidation and no second-source or forbidden revision controls. It does not create or edit the two final workspace pages; ORB-R1-1210 composes those once all tabs exist.
  - **Tests / acceptance evidence**: Pre-deployment UI harness mirrors E05-E06 for supplier and sales datasets, all transitions, stale/replay and post-transit denial in EN/AR; only ORB-R1-1309/1315 may earn those E results.
  - **Trace**: requirements R1-002, R1-013, R1-014, R1-016, INV-01, INV-07; operations createSupplierShipment, getSupplierShipmentWorkspace, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, submitSupplierShipmentConfirmation, confirmSupplierShipment, transitionSupplierShipmentExecution, createSalesShipment, getSalesShipmentWorkspace, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, setPrimarySupplierSource, submitSalesShipmentConfirmation, requestToleranceException, confirmSalesShipment, transitionSalesShipmentExecution; UI /projects/{id}/shipments, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E05, E06, E15.

## P5 A3 Routes and evidence

- [ ] **ORB-R1-0501** **[A3] Write fixed-route snapshot and closure-item tests first**
  - **Prerequisites**: `ORB-R1-0402`, `ORB-R1-0208`.
  - **Exact files**: `tests/integration/routes/fixed-checklists.test.ts`, `tests/contract/routes-api.test.ts`.
  - **Output**: Failing exact three template/version snapshot, required item content, rule-only N/A, evidence/milestone completion, version concurrency and closure-blocking tests.
  - **Tests / acceptance evidence**: Every route fixture proves required items; template mutation/editor path and incomplete closure pass are rejected.
  - **Trace**: requirements R1-003, R1-009, R1-020, INV-05, INV-07; operations getFixedRouteChecklist, updateRouteEvidenceOrMilestone; UI /sales-shipments/{id}; evidence E07, E14.

- [ ] **ORB-R1-0502** **[A3] Implement fixed route checklist service and API**
  - **Prerequisites**: `ORB-R1-0501`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/routes/templates.ts`, `src/modules/routes/route-service.ts`, `src/modules/routes/route-query.ts`, `src/app/api/sales-shipments/[shipmentId]/route-checklist/route.ts`, `src/app/api/sales-shipments/[shipmentId]/route-items/[itemId]/route.ts`.
  - **Output**: Code-defined immutable route snapshots, authorized item/milestone/evidence updates, bidirectional closure links and no classification inference/editor.
  - **Tests / acceptance evidence**: Route tests pass all templates, evidence linking, stale/replay and incomplete blockers.
  - **Trace**: requirements R1-003, R1-009, R1-017, R1-018, R1-020, INV-05, INV-07; operations getFixedRouteChecklist, updateRouteEvidenceOrMilestone; UI /sales-shipments/{id}; evidence E02, E07, E14.

- [ ] **ORB-R1-0503** **[A3] Write and implement Route/Evidence UI**
  - **Prerequisites**: `ORB-R1-0502`, `ORB-R1-0208`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a3-routes-evidence.spec.ts`, `src/ui/features/routes/RouteChecklist.tsx`, `src/ui/features/routes/SalesShipmentRouteEvidencePanel.tsx`, `src/app/evidence/[id]/page.tsx`, `src/ui/features/evidence/EvidenceUploader.tsx`, `src/ui/features/evidence/EvidenceViewer.tsx`.
  - **Output**: Test-first bilingual route/evidence panel and viewer showing read-only template/version, states, verified metadata/hash/source links, upload/view/download audit and closure blocker links. The panel is a stable input to ORB-R1-1210; this task does not edit a shipment page or composition registry.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E07 for all routes, pending/verified conditionals and byte hash and proves no route editor; only ORB-R1-1309/1315 may earn E07.
  - **Trace**: requirements R1-003, R1-013, R1-014, R1-015, R1-020, INV-07; operations getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence; UI /sales-shipments/{id}, /evidence/{id}; evidence E07, E15.

## P6 A4 Documents and outbound

- [ ] **ORB-R1-0601** **[A4] Write shared-dataset document generation/revision tests first**
  - **Prerequisites**: `ORB-R1-0404`, `ORB-R1-0208`.
  - **Exact files**: `tests/integration/documents/generation.test.ts`, `tests/contract/documents-api.test.ts`, `tests/acceptance/documents/render-parity.test.ts`.
  - **Output**: Failing async status, exact approved dataset, CINV/Packing shared-field parity, AR/EN/bilingual bytes, exact approval, immutable revision and reasoned cancel tests.
  - **Tests / acceptance evidence**: Render fixtures prove zero shared mismatch; approved/sent bytes reject mutation; revision preserves prior hash/bytes.
  - **Trace**: requirements R1-004, R1-013, R1-015, R1-018, INV-06; operations generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision; UI /documents/{id}, /sales-shipments/{id}; evidence E08.

- [ ] **ORB-R1-0602** **[A4] Implement durable CINV/Packing generation and lifecycle**
  - **Prerequisites**: `ORB-R1-0601`, `ORB-R1-0212`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/documents/document-service.ts`, `src/modules/documents/document-worker.ts`, `src/modules/documents/render/cinv.tsx`, `src/modules/documents/render/packing-list.tsx`, `src/modules/documents/render/bilingual.ts`, `src/app/api/sales-shipments/[shipmentId]/documents/route.ts`, `src/app/api/documents/[documentId]/status/route.ts`, `src/app/api/documents/[documentId]/revisions/route.ts`, `src/app/api/documents/[documentId]/submit/route.ts`, `src/app/api/documents/[documentId]/cancel/route.ts`.
  - **Output**: In-process durable queued renderer using one exact dataset, immutable object bytes/hashes, language modes, approval-bound lifecycle, revision and cancellation.
  - **Tests / acceptance evidence**: Document tests pass status timing, parity, immutable bytes, approval invalidation, stale/replay and cancellation audit.
  - **Trace**: requirements R1-004, R1-013, R1-015, R1-017, R1-018, INV-06; operations generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision; UI /documents/{id}, /sales-shipments/{id}; evidence E02, E08, E16.

- [ ] **ORB-R1-0603** **[A4] Write exact outbound manifest/send tests first**
  - **Prerequisites**: `ORB-R1-0602`.
  - **Exact files**: `tests/integration/outbound/exact-manifest.test.ts`, `tests/integration/outbound/send-fail-closed.test.ts`, `tests/contract/outbound-api.test.ts`.
  - **Output**: Failing canonical complete manifest, immutable body/attachments, approval binding, supersession for every controlled change, exact preview, stored-byte-only send, mismatch/unavailable/provider outcomes and append-only attempts tests.
  - **Tests / acceptance evidence**: Byte-compare approved and transport-captured snapshots; each changed recipient/name/bytes/subject/body/output invalidates approval; failure still records attempt/audit.
  - **Trace**: requirements R1-004, R1-014, R1-015, R1-018, INV-06; operations createOutboundManifest, getOutboundManifestExactPreview, reviseOutboundManifest, submitOutboundManifestForApproval, cancelOutboundManifest, sendApprovedOutboundManifest, listOutboundSendAttempts; UI /documents/{id}, /approvals; evidence E09.

- [ ] **ORB-R1-0604** **[A4] Implement exact manifest approval and human-only send**
  - **Prerequisites**: `ORB-R1-0603`, `ORB-R1-0212`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/outbound/manifest-service.ts`, `src/modules/outbound/manifest-hash.ts`, `src/modules/outbound/send-service.ts`, `src/modules/outbound/transport.ts`, `src/app/api/documents/[documentId]/outbound-manifests/route.ts`, `src/app/api/outbound-manifests/[manifestId]/route.ts`, `src/app/api/outbound-manifests/[manifestId]/revisions/route.ts`, `src/app/api/outbound-manifests/[manifestId]/submit/route.ts`, `src/app/api/outbound-manifests/[manifestId]/cancel/route.ts`, `src/app/api/outbound-manifests/[manifestId]/send/route.ts`, `src/app/api/outbound-manifests/[manifestId]/send-attempts/route.ts`.
  - **Output**: Canonical exact metadata/body/attachment manifest, immutable superseding revisions, exact approval, explicit send from verified stored bytes only, approved/sent snapshots and append-only attempts.
  - **Tests / acceptance evidence**: Outbound tests pass every drift/failure/retry case; no request body replacement and no scheduler/automatic send exists.
  - **Trace**: requirements R1-004, R1-014, R1-015, R1-017, R1-018, INV-06; operations createOutboundManifest, getOutboundManifestExactPreview, reviseOutboundManifest, submitOutboundManifestForApproval, cancelOutboundManifest, sendApprovedOutboundManifest, listOutboundSendAttempts; UI /documents/{id}, /approvals; evidence E02, E09, E16.

- [ ] **ORB-R1-0605** **[A4] Write and implement document/outbound workspace**
  - **Prerequisites**: `ORB-R1-0602`, `ORB-R1-0604`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a4-documents-outbound.spec.ts`, `src/app/documents/[id]/page.tsx`, `src/ui/features/documents/GenerationStatus.tsx`, `src/ui/features/documents/SharedFieldComparison.tsx`, `src/ui/features/documents/SalesShipmentDocumentsPanel.tsx`, `src/ui/features/outbound/ExactManifestPreview.tsx`, `src/ui/features/outbound/ApprovedSentComparison.tsx`, `src/ui/features/outbound/SendAttempts.tsx`.
  - **Output**: Test-first bilingual document workspace and stable sales-shipment Documents panel for generation/status/preview/revise/approve/cancel and exact manifest preview/send, with read-only approved fields, explicit Send now, no caller payload and side-by-side approved/sent bytes evidence. ORB-R1-1210 alone integrates the panel into the shipment page.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E08-E09 in all languages; every controlled drift requires reapproval, retries append and no automatic-send control exists. Only ORB-R1-1309/1315 may earn E08-E09.
  - **Trace**: requirements R1-004, R1-013, R1-014, INV-06; operations generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, getOutboundManifestExactPreview, reviseOutboundManifest, submitOutboundManifestForApproval, cancelOutboundManifest, sendApprovedOutboundManifest, listOutboundSendAttempts; UI /documents/{id}, /sales-shipments/{id}, /approvals; evidence E08, E09, E15.

## P7 A5 Invoices and settlement

- [ ] **ORB-R1-0701** **[A5] Write supplier invoice lifecycle tests first**
  - **Prerequisites**: `ORB-R1-0406`, `ORB-R1-0212`.
  - **Exact files**: `tests/integration/invoices/supplier-invoice.test.ts`, `tests/contract/supplier-invoices-api.test.ts`.
  - **Output**: Failing one-shipment invoice, evidence, exact approval/confirmation, immutable confirmed invoice, unallocated Owner reasoned cancel and allocated cancellation denial tests.
  - **Tests / acceptance evidence**: Invoice balance and supplier/Project projections are asserted; replacement confirmed invoice restores closure prerequisite.
  - **Trace**: requirements R1-005, R1-009, R1-015, R1-018, INV-02, INV-05; operations createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, cancelUnallocatedSupplierInvoice; UI /supplier-shipments/{id}; evidence E10, E14.

- [ ] **ORB-R1-0702** **[A5] Implement supplier invoices**
  - **Prerequisites**: `ORB-R1-0701`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/invoices/supplier-invoice-service.ts`, `src/modules/invoices/supplier-invoice-query.ts`, `src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts`, `src/app/api/supplier-invoices/[invoiceId]/submit/route.ts`, `src/app/api/supplier-invoices/[invoiceId]/confirm/route.ts`, `src/app/api/supplier-invoices/[invoiceId]/cancel/route.ts`.
  - **Output**: Evidence-backed immutable invoice, fixed approval/confirmation, exact outstanding balance and guarded cancellation with recomputation/audit.
  - **Tests / acceptance evidence**: Invoice tests pass approval, stale/replay, cancellation denial and closure projection cases.
  - **Trace**: requirements R1-005, R1-009, R1-015, R1-017, R1-018, INV-02, INV-05; operations createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, cancelUnallocatedSupplierInvoice; UI /supplier-shipments/{id}; evidence E02, E10, E14.

- [ ] **ORB-R1-0703** **[A5] Write money/allocation/reversal serializable tests first**
  - **Prerequisites**: `ORB-R1-0702`, `ORB-R1-0602`.
  - **Exact files**: `tests/integration/money/settlement.test.ts`, `tests/integration/money/concurrent-allocation.test.ts`, `tests/contract/money-api.test.ts`.
  - **Output**: Failing before/after invoice movements, same-party/currency partial many-to-many allocation, exact availability/outstanding, over-allocation, append-only compensating reversal, movement reversal and atomic statement/finance/final-close recalculation tests.
  - **Tests / acceptance evidence**: Concurrent allocations cannot overspend; one-active-reversal and idempotent replay prevent duplicates; original allocation remains immutable.
  - **Trace**: requirements R1-005, R1-007, R1-009, R1-018, R1-019, INV-02, INV-05; operations recordMoneyMovement, allocateMoneyMovement, reverseSettlementAllocation, reverseMoneyMovement; UI /projects/{id}/money, /supplier-shipments/{id}, /sales-shipments/{id}; evidence E10, E14, E16.

- [ ] **ORB-R1-0704** **[A5] Implement money movements, allocations and reversals**
  - **Prerequisites**: `ORB-R1-0703`, `ORB-R1-0204`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/money/movement-service.ts`, `src/modules/money/allocation-service.ts`, `src/modules/money/settlement-repository.ts`, `src/modules/money/financial-state.ts`, `src/app/api/projects/[projectId]/money-movements/route.ts`, `src/app/api/money-movements/[movementId]/allocations/route.ts`, `src/app/api/money-movements/[movementId]/reverse/route.ts`, `src/app/api/allocations/[allocationId]/reverse/route.ts`.
  - **Output**: Serializable exact-decimal movement/allocation commands, compensating reversal, movement reversal with all active allocations or fail closed, and atomic availability/outstanding/statement/financial/final-state invalidation.
  - **Tests / acceptance evidence**: Settlement suites pass concurrency, same-party/currency, partial/split, replay/stale, reopening and zero-variance reconciliation.
  - **Trace**: requirements R1-005, R1-007, R1-009, R1-017, R1-018, R1-019, INV-02, INV-05; operations recordMoneyMovement, allocateMoneyMovement, reverseSettlementAllocation, reverseMoneyMovement; UI /projects/{id}/money, /supplier-shipments/{id}, /sales-shipments/{id}; evidence E02, E10, E14, E16.

- [ ] **ORB-R1-0705** **[A5] Write and implement supplier invoice and money UI**
  - **Prerequisites**: `ORB-R1-0702`, `ORB-R1-0704`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a5-invoices-settlement.spec.ts`, `src/app/projects/[id]/money/page.tsx`, `src/ui/features/invoices/SupplierInvoicePanel.tsx`, `src/ui/features/invoices/SupplierShipmentInvoicePaymentPanel.tsx`, `src/ui/features/money/SalesShipmentSettlementPanel.tsx`, `src/ui/features/money/MovementForm.tsx`, `src/ui/features/money/AllocationPanel.tsx`, `src/ui/features/money/ReversalDialog.tsx`.
  - **Output**: Test-first bilingual invoice lifecycle and money workspace with stable supplier Invoice/Payment and sales Settlement panels, before-invoice advances, availability/outstanding preview, original/compensating rows, reasoned reversal and immediate financial/final-close impact. ORB-R1-1210 alone integrates the panels.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E10 advance/partial/split/error/reversal/refund cases with zero variance and no destructive allocation edit; only ORB-R1-1309/1315 may earn E10.
  - **Trace**: requirements R1-005, R1-007, R1-009, R1-013, INV-02; operations createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, cancelUnallocatedSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseSettlementAllocation, reverseMoneyMovement; UI /projects/{id}/money, /supplier-shipments/{id}, /sales-shipments/{id}; evidence E10, E15.

## P8 A6 Expenses

- [ ] **ORB-R1-0801** **[A6] Write direct-expense and correction tests first**
  - **Prerequisites**: `ORB-R1-0704`, `ORB-R1-0212`.
  - **Exact files**: `tests/integration/expenses/direct-expense.test.ts`, `tests/integration/expenses/correction.test.ts`, `tests/contract/expenses-api.test.ts`.
  - **Output**: Failing exact-one Project-or-shipment scope, proof, exact approval, immutable approved fields, correction pair approval/apply, atomic cancel/replace, bidirectional links and recomputation/invalidation tests.
  - **Tests / acceptance evidence**: Direct update/delete and shared/multi-shipment allocation fail; replay creates no second replacement.
  - **Trace**: requirements R1-006, R1-007, R1-009, R1-015, R1-018, INV-03, INV-05, INV-07; operations createDirectExpense, submitDirectExpense, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection; UI /projects/{id}/expenses, /sales-shipments/{id}; evidence E11, E14.

- [ ] **ORB-R1-0802** **[A6] Implement direct expenses and approved correction apply**
  - **Prerequisites**: `ORB-R1-0801`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/expenses/expense-service.ts`, `src/modules/expenses/correction-service.ts`, `src/modules/expenses/expense-query.ts`, `src/app/api/projects/[projectId]/expenses/route.ts`, `src/app/api/expenses/[expenseId]/submit/route.ts`, `src/app/api/expenses/[expenseId]/corrections/submit/route.ts`, `src/app/api/expenses/[expenseId]/corrections/apply/route.ts`.
  - **Output**: Direct immutable expense approval and exact old/new correction whose apply atomically cancels original, approves replacement, preserves evidence and recomputes statement/margin/closure.
  - **Tests / acceptance evidence**: Expense suites pass scope XOR, approval separation, immutability, stale/replay, links and final-close invalidation.
  - **Trace**: requirements R1-006, R1-007, R1-009, R1-015, R1-017, R1-018, INV-03, INV-05; operations createDirectExpense, submitDirectExpense, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection; UI /projects/{id}/expenses, /sales-shipments/{id}; evidence E02, E11, E14.

- [ ] **ORB-R1-0803** **[A6] Write and implement immutable expense UI**
  - **Prerequisites**: `ORB-R1-0802`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a6-expenses.spec.ts`, `src/app/projects/[id]/expenses/page.tsx`, `src/ui/features/expenses/ExpenseForm.tsx`, `src/ui/features/expenses/ExpenseCorrectionDialog.tsx`, `src/ui/features/expenses/ExpenseHistory.tsx`, `src/ui/features/expenses/SalesShipmentExpensePanel.tsx`.
  - **Output**: Test-first bilingual direct scope/proof/approval workspace and stable sales-shipment Expense panel; approved rows expose Correct not Edit/Delete, exact old/new diff and immutable paired evidence; no allocation controls. ORB-R1-1210 alone integrates the panel.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E11 Project/shipment expenses and approved correction with statement/margin/closure recomputation; only ORB-R1-1309/1315 may earn E11.
  - **Trace**: requirements R1-006, R1-007, R1-009, R1-013, INV-03, INV-07; operations createDirectExpense, submitDirectExpense, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection; UI /projects/{id}/expenses, /sales-shipments/{id}; evidence E11, E15.

## P9 A7 Statements and profit

- [ ] **ORB-R1-0901** **[A7] Write five statement and four-measure reconciliation tests first**
  - **Prerequisites**: `ORB-R1-0704`, `ORB-R1-0802`.
  - **Exact files**: `tests/integration/statements/operational-statements.test.ts`, `tests/integration/profit/margin-cash.test.ts`, `tests/contract/statements-api.test.ts`.
  - **Output**: Failing customer/supplier/sales-shipment/supplier-shipment/Project line/source/running-balance tests and expected/committed/actual/cash formula/source snapshot tests partitioned by currency.
  - **Tests / acceptance evidence**: Advance affects cash only; AED equivalent always includes recorded rate/date/source; zero unexplained variance required.
  - **Trace**: requirements R1-007, R1-019; operations getOperationalStatement, getProjectMarginAndCash; UI /projects/{id}/statements, /projects/{id}/profit, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E12.

- [ ] **ORB-R1-0902** **[A7] Implement operational statement and profit/cash projections**
  - **Prerequisites**: `ORB-R1-0901`.
  - **Exact files**: `src/modules/statements/statement-query.ts`, `src/modules/profit/profit-service.ts`, `src/modules/profit/formulas.ts`, `src/app/api/statements/[statementType]/[subjectId]/route.ts`, `src/app/api/projects/[projectId]/profit/route.ts`.
  - **Output**: Source-drillable read models partitioned by original currency and immutable formula-version/input-hash snapshots for four separate measures with sensitive field shaping.
  - **Tests / acceptance evidence**: Statement/profit suites reconcile every fixture and prove no silent currency sum or advance-as-revenue.
  - **Trace**: requirements R1-007, R1-014, R1-017, R1-019; operations getOperationalStatement, getProjectMarginAndCash; UI /projects/{id}/statements, /projects/{id}/profit, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E02, E12.

- [ ] **ORB-R1-0903** **[A7] Write and implement statements and Profit/Cash UI**
  - **Prerequisites**: `ORB-R1-0902`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a7-statements-profit.spec.ts`, `src/app/projects/[id]/statements/page.tsx`, `src/app/projects/[id]/profit/page.tsx`, `src/ui/features/statements/StatementTable.tsx`, `src/ui/features/statements/SupplierShipmentStatementPanel.tsx`, `src/ui/features/profit/ProfitCards.tsx`, `src/ui/features/profit/SourceDrilldown.tsx`.
  - **Output**: Test-first bilingual fixed statement tabs/currency sections/source links, a stable supplier-shipment Statement panel, and four distinct cards with as-of, disclosed formula, source drill-down and permission-shaped cost/margin. ORB-R1-1210 alone integrates the panel.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E12 statement/formula fixtures in EN/AR at all viewport sizes; only ORB-R1-1309/1315 may earn E12.
  - **Trace**: requirements R1-007, R1-013, R1-014, R1-019; operations getOperationalStatement, getProjectMarginAndCash; UI /projects/{id}/statements, /projects/{id}/profit, /sales-shipments/{id}, /supplier-shipments/{id}; evidence E12, E15.

## P10 A8 Claims

- [ ] **ORB-R1-1001** **[A8] Write simple claim proposal/approval/apply tests first**
  - **Prerequisites**: `ORB-R1-0406`, `ORB-R1-0212`.
  - **Exact files**: `tests/integration/claims/claim-lifecycle.test.ts`, `tests/contract/claims-api.test.ts`.
  - **Output**: Failing fixed claim types/party/shipment/evidence, OPEN to UNDER_REVIEW, immutable exact outcome proposal, approval rejection semantics, expiry, self-denial and sole terminal apply tests.
  - **Tests / acceptance evidence**: Direct terminal/apply without current approval fail; rejected approval leaves claim under review; apply adds no discount/logistics/compensation/netting record.
  - **Trace**: requirements R1-008, R1-011, R1-016, R1-018, R1-020, INV-04, INV-07; operations openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, decideFixedApproval, applyApprovedClaimOutcome; UI /projects/{id}/claims, /sales-shipments/{id}, /approvals; evidence E13.

- [ ] **ORB-R1-1002** **[A8] Implement simple claim outcome sequence**
  - **Prerequisites**: `ORB-R1-1001`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/claims/claim-service.ts`, `src/modules/claims/outcome-service.ts`, `src/modules/claims/claim-query.ts`, `src/app/api/projects/[projectId]/claims/route.ts`, `src/app/api/claims/[claimId]/transition/route.ts`, `src/app/api/claims/[claimId]/submit-outcome/route.ts`, `src/app/api/claims/[claimId]/apply-outcome/route.ts`.
  - **Output**: Simple claim lifecycle with exact hash/version outcome proposal, fixed different-Owner approval and idempotent approved apply as only terminal command; outcome recording only.
  - **Tests / acceptance evidence**: Claim suites pass all bypass/expiry/rejection/replay/audit cases and schema confirms no advanced settlement entity.
  - **Trace**: requirements R1-008, R1-011, R1-016, R1-017, R1-018, R1-020, INV-04, INV-07; operations openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, applyApprovedClaimOutcome; UI /projects/{id}/claims, /sales-shipments/{id}, /approvals; evidence E02, E13.

- [ ] **ORB-R1-1003** **[A8] Write and implement claims UI**
  - **Prerequisites**: `ORB-R1-1002`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a8-claims.spec.ts`, `src/app/projects/[id]/claims/page.tsx`, `src/ui/features/claims/ClaimWorkspace.tsx`, `src/ui/features/claims/OutcomeProposalDialog.tsx`, `src/ui/features/claims/SalesShipmentClaimsPanel.tsx`.
  - **Output**: Test-first bilingual simple lifecycle UI and stable sales-shipment Claims panel with no terminal buttons, exact proposal reason/evidence, approval status and Apply only after current approval; no advanced settlement controls. ORB-R1-1210 alone integrates the panel.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E13 resolved/rejected proposals, rejection-under-review, bypass denial and closure blockers; only ORB-R1-1309/1315 may earn E13.
  - **Trace**: requirements R1-008, R1-011, R1-013, INV-04, INV-07; operations openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, applyApprovedClaimOutcome, decideFixedApproval; UI /projects/{id}/claims, /sales-shipments/{id}, /approvals; evidence E13, E15.

## P11 A9 Closure

- [ ] **ORB-R1-1101** **[A9] Write financial-state and complete closure-blocker tests first**
  - **Prerequisites**: `ORB-R1-0502`, `ORB-R1-0604`, `ORB-R1-0704`, `ORB-R1-0802`, `ORB-R1-1002`.
  - **Exact files**: `tests/integration/closure/financial-state.test.ts`, `tests/integration/closure/assessment.test.ts`, `tests/contract/closure-api.test.ts`.
  - **Output**: Failing approved-CINV-plus-zero financial rule, all reachable final blockers, immutable versioned assessment, eligibility matrix, exact exception, pending/stale approval and every basis invalidator tests.
  - **Tests / acceptance evidence**: Zero without approved CINV stays open; assessment returns every blocker; noneligible balance/integrity/approval/security blockers cannot be excepted.
  - **Trace**: requirements R1-009, R1-012, R1-016, R1-018, INV-05; operations assessProjectClosure, requestClosureException, submitFinalCloseForApproval, finalCloseProject, submitReopenForApproval, reopenProject; UI /projects/{id}/closure, /projects/{id}/overview; evidence E14.

- [ ] **ORB-R1-1102** **[A9] Implement closure assessment, exception, final-close and reopen**
  - **Prerequisites**: `ORB-R1-1101`, `ORB-R1-0212`, `ORB-R1-0206`.
  - **Exact files**: `src/modules/closure/blocker-codes.ts`, `src/modules/closure/assessment-service.ts`, `src/modules/closure/closure-service.ts`, `src/modules/closure/invalidation.ts`, `src/app/api/projects/[projectId]/closure-assessment/route.ts`, `src/app/api/projects/[projectId]/closure-exceptions/route.ts`, `src/app/api/projects/[projectId]/final-close/submit/route.ts`, `src/app/api/projects/[projectId]/final-close/route.ts`, `src/app/api/projects/[projectId]/reopen/submit/route.ts`, `src/app/api/projects/[projectId]/reopen/route.ts`.
  - **Output**: Fresh complete versioned assessments, named exact eligible exceptions, submit/approve/apply final close and reasoned reopen, with atomic invalidation and independent financial recomputation.
  - **Tests / acceptance evidence**: Closure suite passes full blocker list, exception confinement, concurrent stale assessment, every invalidator and audit.
  - **Trace**: requirements R1-009, R1-012, R1-015, R1-016, R1-017, R1-018, INV-05; operations assessProjectClosure, requestClosureException, submitFinalCloseForApproval, finalCloseProject, submitReopenForApproval, reopenProject; UI /projects/{id}/closure, /projects/{id}/overview; evidence E02, E14, E16.

- [ ] **ORB-R1-1103** **[A9] Write and implement closure workspace**
  - **Prerequisites**: `ORB-R1-1102`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a9-closure.spec.ts`, `src/app/projects/[id]/closure/page.tsx`, `src/ui/features/closure/AssessmentPanel.tsx`, `src/ui/features/closure/BlockerGroup.tsx`, `src/ui/features/closure/CloseReopenDialog.tsx`, `src/ui/features/closure/SalesShipmentClosurePanel.tsx`.
  - **Output**: Test-first bilingual fresh-assessment UI and stable sales-shipment Closure panel grouping every blocker, exception controls only when eligible, exact Project version/reason and immediate stale/reopened outcome links. ORB-R1-1210 alone integrates the panel.
  - **Tests / acceptance evidence**: Pre-deployment harness mirrors E14 financial/final close, exact exception, all invalidators and explicit reopen in EN/AR; only ORB-R1-1309/1315 may earn E14.
  - **Trace**: requirements R1-009, R1-012, R1-013, INV-05; operations assessProjectClosure, requestClosureException, submitFinalCloseForApproval, finalCloseProject, submitReopenForApproval, reopenProject; UI /projects/{id}/closure, /projects/{id}/overview; evidence E14, E15.

## P12 A10 UI, admin and recovery

- [ ] **ORB-R1-1201** **[A10] Write backup/restore contract and isolated integrity tests first**
  - **Prerequisites**: `ORB-R1-0208`, `ORB-R1-0206`.
  - **Exact files**: `tests/integration/recovery/backup-restore.test.ts`, `tests/contract/recovery-api.test.ts`.
  - **Output**: Failing encrypted separate-copy PITR/object snapshot, status, isolated restore lifecycle and sampled row/version/hash/allocation/approval/audit/object-link verification tests.
  - **Tests / acceptance evidence**: Restore cannot target production; PASS requires RPO<=15m, RTO<=4h and zero missing sampled links.
  - **Trace**: requirements R1-010, R1-014; operations getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest; UI /admin/backup; evidence E16, E17.

- [ ] **ORB-R1-1202** **[A10] Implement backup status and isolated restore orchestration**
  - **Prerequisites**: `ORB-R1-1201`, `ORB-R1-0204`.
  - **Exact files**: `src/modules/recovery/backup-service.ts`, `src/modules/recovery/restore-service.ts`, `src/modules/recovery/integrity-check.ts`, `src/app/api/recovery/backup-status/route.ts`, `src/app/api/recovery/restore-tests/route.ts`, `src/app/api/recovery/restore-tests/[restoreTestId]/route.ts`, `ops/backup/backup.sh`, `ops/backup/restore-isolated.sh`.
  - **Output**: Owner-only status and durable isolated restore test with encrypted separate database/object snapshots and evidence-backed integrity/RPO/RTO result; credentials never exposed.
  - **Tests / acceptance evidence**: Recovery tests pass a real disposable restore and fail on missing object/hash/link or production target.
  - **Trace**: requirements R1-010, R1-014, R1-017; operations getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest; UI /admin/backup; evidence E02, E16, E17.

- [ ] **ORB-R1-1203** **Write and implement approvals/audit/admin pages**
  - **Prerequisites**: `ORB-R1-0212`, `ORB-R1-0206`, `ORB-R1-1202`, `ORB-R1-0214`.
  - **Exact files**: `tests/acceptance/a10-admin-approvals-audit.spec.ts`, `src/app/approvals/page.tsx`, `src/app/projects/[id]/audit/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/backup/page.tsx`, `src/ui/features/approvals/ApprovalDialog.tsx`, `src/ui/features/admin/SessionList.tsx`, `src/ui/features/audit/AuditTimeline.tsx`.
  - **Output**: Test-first typed exact approval dialog, audit continuity timeline, fixed-role/session administration and backup evidence pages. It does not own or claim the Today page/aggregation, which waits for every source in ORB-R1-1211/1212.
  - **Tests / acceptance evidence**: Pre-deployment tests mirror E03/E16 controls for typed approval data, exact revoke metadata/version, self-denial, audit hashes and Owner-only recovery. Only deployed tasks ORB-R1-1309/1310/1315 may earn E evidence.
  - **Trace**: requirements R1-010, R1-013, R1-014, R1-015; operations listFixedApprovalInbox, decideFixedApproval, listProjectAuditEvents, listPilotUsers, assignFixedPilotRoles, listPilotUserSessions, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest; UI /, /approvals, /projects/{id}/audit, /admin/users, /admin/backup; evidence E03, E15, E16.

- [ ] **ORB-R1-1210** **[A10] Compose the complete multi-stage shipment workspaces without hidden edits**
  - **Prerequisites**: `ORB-R1-0407`, `ORB-R1-0503`, `ORB-R1-0605`, `ORB-R1-0705`, `ORB-R1-0803`, `ORB-R1-0903`, `ORB-R1-1003`, `ORB-R1-1103`.
  - **Exact files**: `tests/acceptance/a10-shipment-workspace-composition.spec.ts`, `src/app/sales-shipments/[id]/page.tsx`, `src/app/supplier-shipments/[id]/page.tsx`, `src/ui/features/shipments/SalesShipmentWorkspace.tsx`, `src/ui/features/shipments/SupplierShipmentWorkspace.tsx`, `src/ui/features/shipments/workspace-tabs.ts`.
  - **Output**: One stable final composition point imports the already-owned core and feature panels. Sales exposes exactly Dataset, Route checklist, Evidence, Documents, Settlement, Expense, Claims and Closure; supplier exposes dataset/actions, evidence, invoice, payment and statement. Later tasks may not edit these pages/registry; any future extension requires a new explicit integration task and prerequisite.
  - **Tests / acceptance evidence**: Retain the composition test failing before these files exist, then prove every contracted tab/action is reachable once, role-shaped and wired to its implemented backend; reject duplicate/missing tabs, placeholder controls, deferred tabs and unlisted page edits. This is pre-deployment readiness only and earns no E evidence.
  - **Trace**: requirements R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-013, R1-017, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations getSupplierShipmentWorkspace, getSalesShipmentWorkspace; UI /sales-shipments/{id}, /supplier-shipments/{id}; evidence E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15.

- [ ] **ORB-R1-1211** **[A10] Write Project overview and Today aggregation tests first**
  - **Prerequisites**: `ORB-R1-0206`, `ORB-R1-0212`, `ORB-R1-0304`, `ORB-R1-0502`, `ORB-R1-0604`, `ORB-R1-0704`, `ORB-R1-0802`, `ORB-R1-0902`, `ORB-R1-1002`, `ORB-R1-1102`, `ORB-R1-1202`.
  - **Exact files**: `tests/integration/dashboard/today-query.test.ts`, `tests/integration/projects/project-overview-query.test.ts`, `tests/acceptance/a10-today-overview.spec.ts`.
  - **Output**: Failing tests for assigned exact approvals, recent Projects, route/evidence, document/outbound, invoice/settlement, expense, claim, closure, audit and recovery blockers; Project overview states/quantities/money/blockers/audit summary; role shaping; source links; stable ordering; and no deferred or fabricated aggregate.
  - **Tests / acceptance evidence**: Tests must fail for missing query/page implementation and for each omitted source adapter. Fixtures include every blocker family and prove stale/resolved items disappear only after authoritative state changes. This is pre-deployment readiness only and earns no E evidence.
  - **Trace**: requirements R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-013, R1-014, R1-017, R1-020, INV-05, INV-06, INV-07; operations listProjects, getProject, listFixedApprovalInbox, getFixedRouteChecklist, getDocumentGenerationStatus, getOperationalStatement, getProjectMarginAndCash, assessProjectClosure, getBackupRecoveryStatus, listProjectAuditEvents; UI /, /projects/{id}/overview; evidence E03, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16.

- [ ] **ORB-R1-1212** **[A10] Implement source-complete Project overview and Today pages**
  - **Prerequisites**: `ORB-R1-1211`, `ORB-R1-0214`.
  - **Exact files**: `src/modules/dashboard/today-query.ts`, `src/modules/dashboard/blocker-aggregation.ts`, `src/modules/projects/project-overview-query.ts`, `src/app/page.tsx`, `src/app/projects/[id]/overview/page.tsx`, `src/ui/features/dashboard/TodayBlockers.tsx`, `src/ui/features/projects/ProjectOverviewSummary.tsx`.
  - **Output**: Actual `/` and `/projects/{id}/overview` pages backed only by authoritative implemented queries, aggregating assigned approvals and route/evidence, document/outbound, invoice/settlement, expense, claim, closure, audit and recovery state with permission shaping and direct source links.
  - **Tests / acceptance evidence**: ORB-R1-1211 passes with no mock-only adapter, no source omitted, no sensitive leakage, no stale blocker hidden, and no page/registry edit outside this exact list. This is pre-deployment readiness only and earns no E evidence.
  - **Trace**: requirements R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-013, R1-014, R1-017, R1-020, INV-05, INV-06, INV-07; operations listProjects, getProject, listFixedApprovalInbox, getFixedRouteChecklist, getDocumentGenerationStatus, getOperationalStatement, getProjectMarginAndCash, assessProjectClosure, getBackupRecoveryStatus, listProjectAuditEvents; UI /, /projects/{id}/overview; evidence E03, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16.

- [ ] **ORB-R1-1204** **[A10] Create complete route/action parity acceptance test**
  - **Prerequisites**: `ORB-R1-0305`, `ORB-R1-0407`, `ORB-R1-0503`, `ORB-R1-0605`, `ORB-R1-0705`, `ORB-R1-0803`, `ORB-R1-0903`, `ORB-R1-1003`, `ORB-R1-1103`, `ORB-R1-1203`, `ORB-R1-1210`, `ORB-R1-1212`.
  - **Exact files**: `tests/acceptance/ui/all-routes-actions.spec.ts`, `tests/acceptance/ui/rbac-action-visibility.spec.ts`.
  - **Output**: Tests enumerating every exact UI route/action, all 79 operationIds, allowed/denied server outcomes, role-shaped controls and every loading/empty/error/permission/offline/stale state.
  - **Tests / acceptance evidence**: All routes render in EN/AR, every named action reaches its contract operation, unauthorized actions hide and direct server calls return safe 403.
  - **Trace**: requirements R1-013, R1-014, R1-017, R1-020, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E02, E15.

- [ ] **ORB-R1-1205** **Create bilingual MD3/WCAG deployed-target visual harness**
  - **Prerequisites**: `ORB-R1-1204`.
  - **Exact files**: `tests/acceptance/ui/md3-visual.spec.ts`, `tests/acceptance/ui/accessibility.spec.ts`, `tests/acceptance/ui/keyboard.spec.ts`, `tests/acceptance/ui/bidi.spec.ts`, `artifacts/predeployment/e15-harness/README.md`.
  - **Output**: Automated and manual-capture harness definition for every screen at 1440x900, 768x1024 and 390x844, plus 320px reflow, keyboard, screen reader, contrast and reduced motion. Local captures are diagnostic only; E15 is earned only by ORB-R1-1309/1315 against a deployed frozen build.
  - **Tests / acceptance evidence**: Paired screenshots and reports show zero critical/serious findings, untranslated controls, clipped Arabic, direction errors, raw colors or journey divergence.
  - **Trace**: requirements R1-013, R1-014, R1-017; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E15.

- [ ] **ORB-R1-1206** **[A10] Write and pass full security abuse and hardening suite**
  - **Prerequisites**: `ORB-R1-1204`, `ORB-R1-1202`.
  - **Exact files**: `tests/security/idor.test.ts`, `tests/security/upload-abuse.test.ts`, `tests/security/rate-limit.test.ts`, `tests/security/log-redaction.test.ts`, `tests/security/tls-encryption.test.ts`, `tests/security/immutable-storage.test.ts`, `src/platform/http/rate-limit.ts`, `src/platform/security/headers.ts`, `ops/security/scan.sh`.
  - **Output**: Test-first authorization/IDOR, upload, CSRF/origin, session/MFA, rate limit, secrets/logs, TLS1.2+, encryption and database/object immutability hardening.
  - **Tests / acceptance evidence**: All abuse tests pass, role cannot update/delete audit or approved bytes, and scan has zero unaccepted Critical findings.
  - **Trace**: requirements R1-014, R1-015, R1-018; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E16.

- [ ] **ORB-R1-1207** **[A10] Implement structured observability and incident evidence**
  - **Prerequisites**: `ORB-R1-0104`, `ORB-R1-0206`.
  - **Exact files**: `src/platform/observability/metrics.ts`, `src/platform/observability/tracing.ts`, `src/platform/observability/incident-log.ts`, `src/app/api/health/live/route.ts`, `src/app/api/health/ready/route.ts`, `ops/observability/alerts.yml`, `tests/integration/observability/telemetry.test.ts`.
  - **Output**: Correlation-linked safe logs/traces/metrics and incident records for mutation latency, jobs, send failures, backup lag, restore, audit-chain and dependency health without sensitive values.
  - **Tests / acceptance evidence**: Telemetry tests prove correlation/audit IDs, redaction and alert thresholds for RPO, job failure and dependency outage.
  - **Trace**: requirements R1-014; operations none; UI /, /admin/backup; evidence E16, E17.

## P13 Fixtures and release evidence

- [ ] **ORB-R1-1301** **[REL] Create deterministic Release 1 fixtures only**
  - **Prerequisites**: `ORB-R1-1102`, `ORB-R1-1202`.
  - **Exact files**: `prisma/seed.ts`, `tests/fixtures/r1-masters.ts`, `tests/fixtures/r1-project-cycle.ts`, `tests/fixtures/r1-security-users.ts`, `tests/fixtures/r1-outbound.ts`.
  - **Output**: Deterministic three-role, essential-master, Project A/B, 100MT contracts, supplier/sales shipment, route, document, invoice, movement, expense, claim, closure and invalidator fixtures; no deferred record/control.
  - **Tests / acceptance evidence**: Seed twice is idempotent, references/hashes stable, exact currencies preserved and deferred-scope scan finds zero fixture/schema surface.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14.

- [ ] **ORB-R1-1302** **[REL] Implement complete 79-operation allowed/denied contract sweep**
  - **Prerequisites**: `ORB-R1-1301`, `ORB-R1-1204`, `ORB-R1-1206`.
  - **Exact files**: `tests/acceptance/e02-operation-sweep.spec.ts`, `tests/acceptance/e02-forbidden-paths.spec.ts`, `artifacts/predeployment/e02-harness/README.md`.
  - **Output**: Create (but do not award evidence from) a data-driven harness that invokes every operationId once allowed and once denied/invalid, verifies role extension, RFC9457, mutation headers and representative forbidden paths/schema/nav/build absence. E02 is earned only when ORB-R1-1309/1315 executes it against a deployed frozen build.
  - **Tests / acceptance evidence**: Retained report records exactly 79/79 allowed and 79/79 denied/invalid outcomes, 58/58 idempotency, 57/57 CSRF, 53 existing-aggregate If-Match and all forbidden paths 404.
  - **Trace**: requirements R1-014, R1-016, R1-017, R1-018, R1-020, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E02.

- [ ] **ORB-R1-1303** **[REL] Automate the complete E03-E14 daily-use scenario**
  - **Prerequisites**: `ORB-R1-1301`, `ORB-R1-1205`, `ORB-R1-1302`.
  - **Exact files**: `tests/acceptance/e03-e14-daily-use.spec.ts`, `artifacts/predeployment/e03-e14-harness/README.md`.
  - **Output**: Create (but do not award evidence from) one ordered deployed-target scenario covering roles/masters, Project/contracts, strict shipments/revisions/transitions, routes/evidence, documents/outbound, invoices/settlement/reversals, expenses, statements/profit, claims and closure/reopen. E03-E14 are earned only by ORB-R1-1309/1315.
  - **Tests / acceptance evidence**: Scenario passes in EN and AR with zero quantity/money/statement mismatch, stale overwrite, duplicate effect or immutable evidence mutation.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14.

- [ ] **ORB-R1-1304** **Create concurrency and performance deployed-target harness**
  - **Prerequisites**: `ORB-R1-1303`, `ORB-R1-1207`.
  - **Exact files**: `tests/performance/r1-load.ts`, `tests/integration/concurrency/tolerance-settlement-closure.test.ts`, `artifacts/predeployment/e16-performance-harness/README.md`.
  - **Output**: Create concurrency/performance harnesses for 50-session load and adversarial settlement/tolerance/closure/document-send commands with measurable read/mutation/render timing. Local runs are diagnostic; E16 is earned only by ORB-R1-1310/1315 against the deployed frozen build.
  - **Tests / acceptance evidence**: Harness dry-run proves load generation, metric collection and invariant assertions are functional, but its local timings are diagnostic and cannot satisfy release thresholds or E16.
  - **Trace**: requirements R1-004, R1-014, R1-018, R1-019, INV-01, INV-02, INV-05, INV-06; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E16.

- [ ] **ORB-R1-1305** **[REL] Create production deployment and rollback manifests**
  - **Prerequisites**: `ORB-R1-0105`, `ORB-R1-1204`, `ORB-R1-1206`, `ORB-R1-1207`.
  - **Exact files**: `Dockerfile`, `compose.acceptance.yml`, `ops/deploy/deploy.sh`, `ops/deploy/rollback.sh`, `ops/deploy/run-migrations.sh`, `ops/deploy/README.md`.
  - **Output**: Immutable TLS deployment with separate app/migration roles, PostgreSQL/object store, health gates, zero-downtime migration order, rollback and build/lock digest capture.
  - **Tests / acceptance evidence**: Lint/render manifests, build the immutable image, rehearse migration/rollback only in an ephemeral environment and retain digests. This task does not deploy the acceptance candidate and earns no E01/E17 evidence.
  - **Trace**: requirements R1-010, R1-014, R1-017; operations listMasterRecords, createMasterRecord, updateMasterRecord, listProjects, createProjectWithSalesContract, getProject, createPurchaseContract, createContractAmendment, submitContractForApproval, createSupplierShipment, submitSupplierShipmentConfirmation, confirmSupplierShipment, createSalesShipment, setPrimarySupplierSource, requestToleranceException, confirmSalesShipment, getFixedRouteChecklist, updateRouteEvidenceOrMilestone, uploadEvidence, getEvidenceMetadata, viewOrDownloadEvidence, generateShipmentDocument, getDocumentGenerationStatus, reviseDocument, submitDocumentForApproval, cancelDocumentRevision, createOutboundManifest, submitOutboundManifestForApproval, sendApprovedOutboundManifest, cancelOutboundManifest, listFixedApprovalInbox, decideFixedApproval, createSupplierInvoice, submitSupplierInvoice, confirmSupplierInvoice, recordMoneyMovement, allocateMoneyMovement, reverseMoneyMovement, createDirectExpense, submitDirectExpense, getOperationalStatement, getProjectMarginAndCash, openSimpleClaim, moveClaimUnderReview, submitClaimOutcomeForApproval, assessProjectClosure, requestClosureException, finalCloseProject, submitFinalCloseForApproval, reopenProject, submitReopenForApproval, listProjectAuditEvents, listSupplierShipmentDatasetHistory, reviseSupplierShipmentDataset, listSalesShipmentDatasetHistory, reviseSalesShipmentDataset, transitionSupplierShipmentExecution, transitionSalesShipmentExecution, reverseSettlementAllocation, submitApprovedExpenseCorrection, applyApprovedExpenseCorrection, cancelUnexecutedProject, applyApprovedClaimOutcome, getOutboundManifestExactPreview, reviseOutboundManifest, listOutboundSendAttempts, submitSalesShipmentConfirmation, cancelUnallocatedSupplierInvoice, signIn, signOutCurrentSession, listPilotUsers, assignFixedPilotRoles, revokePilotUserSession, getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, getSupplierShipmentWorkspace, getSalesShipmentWorkspace, listPilotUserSessions; UI ALL_UI_ROUTES; evidence E01, E17.

- [ ] **ORB-R1-1306** **Create pre-beta security and isolated-restore deployed-target harness**
  - **Prerequisites**: `ORB-R1-1202`, `ORB-R1-1206`, `ORB-R1-1305`.
  - **Exact files**: `ops/acceptance/run-prebeta-gates.sh`, `artifacts/predeployment/e16-security-harness/README.md`, `artifacts/predeployment/e16-restore-harness/README.md`.
  - **Output**: Create repeatable deployed-target gates for scan, session/CSRF/IDOR, audit hash recomputation and real isolated database/object restore. Construction/local runs earn no E16; ORB-R1-1310/1315 executes them against a deployed frozen build.
  - **Tests / acceptance evidence**: Harness self-tests against disposable failing/passing fixtures prove scan, audit, backup and restore assertions fail closed. Results are diagnostic only and earn no E16/E17 evidence.
  - **Trace**: requirements R1-010, R1-014, R1-015, R1-018; operations getBackupRecoveryStatus, startIsolatedRestoreTest, getIsolatedRestoreTest, listProjectAuditEvents; UI /admin/backup, /projects/{id}/audit; evidence E16, E17.

- [ ] **ORB-R1-1307** **[REL] Freeze the immutable beta candidate after all implementation and integration**
  - **Prerequisites**: `ORB-R1-0103`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`.
  - **Exact files**: `ops/release/freeze-candidate.sh`, `artifacts/candidates/beta/manifest.json`, `artifacts/candidates/beta/README.md`.
  - **Output**: One immutable application/container artifact after all implementation, page composition, fixtures and pre-deployment harnesses; manifest binds Git commit, source/lock/OpenAPI/build/container/SBOM digests and UTC freeze time. No code or generated artifact may change under that candidate identity.
  - **Tests / acceptance evidence**: Verify reproducible digest, clean tree, signed manifest, exact 79-operation contract digest and build-manifest/deferred-surface checks. Candidate creation earns no E evidence and performs no deployment.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E01, E17.

- [ ] **ORB-R1-1308** **[REL] Deploy the exact beta candidate and satisfy blocking E01**
  - **Prerequisites**: `ORB-R1-1307`.
  - **Exact files**: `ops/acceptance/run-e01.sh`, `artifacts/deployed/beta/environment-identity.json`, `artifacts/deployed/beta/e01/README.md`.
  - **Output**: Deploy only the ORB-R1-1307 digest behind TLS with PostgreSQL and retention/version-locked object storage; record immutable artifact/container/lock/OpenAPI digests, deployment URL/environment ID, database cluster/schema migration ID, object-store bucket/versioning/retention identity, backup IDs, UTC window, browser versions and test identities.
  - **Tests / acceptance evidence**: E01 is a blocking deployed-runtime PASS: health/readiness, TLS, migration, PostgreSQL/object linkage, three fixed roles, AR/EN, masters and resolved OpenAPI all match the manifest. Any mismatch destroys candidate identity and returns to ORB-R1-1307; E02-E17 may not start. Deployment does not depend on acceptance.
  - **Trace**: requirements R1-001, R1-010, R1-013, R1-014, R1-015, R1-017, R1-020, INV-07; operations signIn, listMasterRecords, getBackupRecoveryStatus; UI /sign-in, /, /admin/backup; evidence E01.

- [ ] **ORB-R1-1309** **[REL] Execute deployed E02-E15 against the frozen beta candidate**
  - **Prerequisites**: `ORB-R1-1308`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1205`.
  - **Exact files**: `ops/acceptance/run-deployed-e02-e15.sh`, `artifacts/deployed/beta/e02-e15/README.md`, `artifacts/deployed/beta/e02-e15/result-manifest.json`.
  - **Output**: Execute the 79-operation allowed/denied sweep, forbidden-surface crawl, complete E03-E14 scenario and full bilingual MD3/WCAG E15 matrix through the recorded deployment URL, always recording the ORB-R1-1307 artifact digest and ORB-R1-1308 environment identity.
  - **Tests / acceptance evidence**: E02-E15 require deployed runtime/object/database/provider evidence; no localhost, mocks, unit results or substituted build earns credit. Result manifest binds every log/screenshot/object/transport capture to the candidate/environment and fails closed on any missing check.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E02, E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15.

- [ ] **ORB-R1-1310** **[REL] Execute deployed E16 security, concurrency, performance and recovery**
  - **Prerequisites**: `ORB-R1-1308`, `ORB-R1-1304`, `ORB-R1-1306`.
  - **Exact files**: `ops/acceptance/run-deployed-e16.sh`, `artifacts/deployed/beta/e16/README.md`, `artifacts/deployed/beta/e16/result-manifest.json`.
  - **Output**: Against the same ORB-R1-1307 digest/environment, execute MFA/session/CSRF/IDOR/upload/rate-limit/redaction/TLS/encryption/immutability scans, 50-session timings, adversarial concurrency, audit-chain recomputation, PITR/object backup and isolated restore.
  - **Tests / acceptance evidence**: E16 fails on any unaccepted Critical, timing/invariant failure, RPO >15m, RTO >4h, missing row/version/allocation/approval/audit/hash/object link, digest/environment drift or local/mock evidence. Retain backup/restore IDs and cryptographic proof under the same result manifest.
  - **Trace**: requirements R1-010, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-05, INV-06, INV-07; operations ALL79; UI /sign-in, /admin/users, /admin/backup, /projects/{id}/audit; evidence E16.

- [ ] **ORB-R1-1311** **[REL] Make the conditional 2026-11-12 beta-entry go/no-go decision**
  - **Prerequisites**: `ORB-R1-1309`, `ORB-R1-1310`.
  - **Exact files**: `ops/acceptance/run-day7-go-no-go.sh`, `artifacts/milestones/2026-11-12/README.md`, `artifacts/milestones/2026-11-12/unresolved-risks.md`, `artifacts/milestones/2026-11-12/go-no-go.json`.
  - **Output**: Exact prerequisite cut is ORB-R1-0001 through ORB-R1-1310 as represented by this DAG. Record first controlled real ORB entry only after E01-E16 all pass on the beta candidate; emit a binary GO or NO-GO with digest/environment, defects/owners and unresolved risks.
  - **Tests / acceptance evidence**: The accepted full active R1 scope is mandatory. The date is conditional: if any prerequisite, deployed check, security/recovery control or active journey is incomplete, record NO-GO and do not claim daily-use beta, partial acceptance or local substitution. GO is the 2026-11-12 E17 beta-entry evidence, not seven elapsed days.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E17.

- [ ] **ORB-R1-1312** **[REL] Record genuine 2026-11-12 through 2026-11-18 daily observations**
  - **Prerequisites**: `ORB-R1-1311` with `GO`.
  - **Exact files**: `ops/acceptance/record-daily-observation.sh`, `artifacts/milestones/2026-11-12-to-18/README.md`, `artifacts/milestones/2026-11-12-to-18/correction-log.csv`.
  - **Output**: One signed UTC entry on each actual calendar day containing actor, real journey/record refs, currently deployed candidate digest/environment, defects/near misses, severity, focused regression/impact sweep, send attempts, reconciliation variance and open risk. This observation task never edits implementation files.
  - **Tests / acceptance evidence**: Entries are append-only and timestamp-attested; no pre-dating, retrospective reconstruction, duplicated day or backfill is accepted. A missing day remains explicitly missing and makes day-14 NO-GO. Any observed defect that requires code change blocks stabilization and enters ORB-R1-1316/1317; neither this observation task nor a wildcard correction may edit code, freeze a candidate or deploy one.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E17.

- [ ] **ORB-R1-1316** **[REL] Select and attest the stabilization branch**
  - **Prerequisites**: `ORB-R1-1312`.
  - **Exact files**: `ops/release/classify-stabilization-branch.sh`, `artifacts/milestones/2026-11-19/stabilization-branch.json`, `artifacts/milestones/2026-11-19/correction-task-template.md`.
  - **Output**: Record exactly one branch. **A — no code correction** records signed observation and repository evidence that no implementation, test, generated contract, dependency-lock or build-input file changed after ORB-R1-1307. **B — correction required** records each defect and stops stabilization while the graph is amended with one or more separately scoped concrete `ORB-R1-CORR-NNNN` tasks. The template requires the schema defined by the canonical ownership model: literal **Corrects files**, exact **Primary owner** mapping, per-target **Supersedes**, explicit prerequisites on this gate/every mapped primary owner/prior overlay, defect/reason ID, retained failing-test evidence and exact test paths, focused regression/impact scope, security/integrity/contract dispositions, and named reviewer approval timestamped before edits. New files use literal **Exact files** and receive one immutable primary owner; they may not be overlay-only. The template is governance only, its `ORB-R1-CORR-NNNN` token is not executable, and it owns or overlays no correction file.
  - **Tests / acceptance evidence**: Branch selection is signed and agrees with all genuine ORB-R1-1312 entries. Branch B cannot proceed on a generic, placeholder, inferred or wildcard fix: each concrete correction row and any accepted contract/lock change must be reviewed first. Reject unknown primary targets, mismatched owners, missing fields or approval, parallel overlaps, broken supersession and undeclared changes; unknown files or behavior remain unresolved rather than guessed. This task performs no correction, freeze, deployment or E check.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E17.

- [ ] **ORB-R1-1317** **[REL] Close the stabilization correction-control gate**
  - **Prerequisites**: `ORB-R1-1316`; on branch B, every separately reviewed `ORB-R1-CORR-NNNN` task inserted immediately before this gate is also an explicit prerequisite after the reviewed graph amendment.
  - **Exact files**: `ops/release/verify-stabilization-corrections.sh`, `artifacts/milestones/2026-11-19/correction-review.md`, `artifacts/milestones/2026-11-19/correction-gate.json`.
  - **Output**: On branch A, attest that no correction task exists or ran and preserve the no-code evidence. On branch B, enumerate each concrete correction ID, defect/reason, literal primary-owned new files, literal overlay targets and exact mapped historical owners, per-target supersession, approvals/timestamps, commits, retained fail-then-pass tests with exact paths, focused regressions/impact scope and security/integrity/contract dispositions. Recompute the immutable primary map and separate overlay relation, compare them to the actual diff, and emit gate PASS only when every inserted prerequisite is complete and every changed file is declared by exactly one applicable relation. This verifier may not implement or auto-approve a correction.
  - **Tests / acceptance evidence**: Fail closed for an unreviewed or placeholder correction, wrong/unknown/inferred owner or target, directory/glob/wildcard, missing approval/test/review/reason, overlay-only new file, parallel or unordered overlap, broken supersession, contract or lock identity without explicit acceptance, hidden generated or undeclared change, incomplete correction prerequisite or observation backfill. Primary provenance remains unchanged. Gate PASS authorizes only ORB-R1-1313 to freeze; it does not require or perform deployment and earns no E evidence.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E17.

- [ ] **ORB-R1-1313** **[REL] Freeze the immutable 2026-11-19 stabilization candidate**
  - **Prerequisites**: `ORB-R1-1317` with correction-control gate `PASS`.
  - **Exact files**: `ops/release/freeze-stabilization-candidate.sh`, `artifacts/candidates/stabilization/manifest.json`, `artifacts/candidates/stabilization/README.md`.
  - **Output**: Freeze exactly one immutable, not-yet-required-to-be-deployed candidate and bind the complete unbackfilled observation-log digest. On branch A, re-attest/reuse the exact ORB-R1-1307 Git/source/lock/OpenAPI/build/container/SBOM digests. On branch B, after every separately reviewed correction task and gate passes, calculate and record new Git/source/build/container/SBOM digests for the corrected candidate plus the explicit accepted OpenAPI and lock identities; bind the verified immutable primary map, correction-overlay/supersession chain and actual changed-file manifest. Corrected identities are not required to equal beta identities.
  - **Tests / acceptance evidence**: Reproducibility, clean tree, contract/deferred checks, observation signatures and ORB-R1-1317 pass. Branch A additionally proves byte/digest identity and no code change; branch B proves every changed file is either a uniquely primary-owned new file or an exact approved overlay target of a completed correction, with mapped historical owner unchanged, full prerequisite/supersession order and every review/test gate passed. Any mismatch or undeclared edit fails closed. Freezing earns no E evidence, performs no deployment, cannot cure a missing observation and cannot silently absorb an unowned edit.
  - **Trace**: requirements R1-014, R1-017, R1-020, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E17.

- [ ] **ORB-R1-1314** **[REL] Deploy the exact frozen stabilization candidate and re-satisfy blocking E01**
  - **Prerequisites**: `ORB-R1-1313`.
  - **Exact files**: `ops/acceptance/run-stabilization-e01.sh`, `artifacts/deployed/stabilization/environment-identity.json`, `artifacts/deployed/stabilization/e01/README.md`.
  - **Output**: This task alone deploys whichever exact branch-A or branch-B candidate ORB-R1-1313 froze. Record its immutable Git/source/lock/OpenAPI/build/container/SBOM identities and the new deployment URL/environment ID, database cluster/schema migration ID, object-store bucket/versioning/retention identity, backup IDs and UTC window using the same controls as ORB-R1-1308.
  - **Tests / acceptance evidence**: Blocking E01 passes anew against that exact digest/environment before any stabilization E02-E17 check. Any manifest, digest or environment drift invalidates this deployment and returns to ORB-R1-1313; deployment has no dependency on later acceptance.
  - **Trace**: requirements R1-001, R1-010, R1-013, R1-014, R1-015, R1-017, R1-020, INV-07; operations signIn, listMasterRecords, getBackupRecoveryStatus; UI /sign-in, /, /admin/backup; evidence E01.

- [ ] **ORB-R1-1315** **[REL] Execute 2026-11-19 deployed E02-E17 stabilization and go/no-go**
  - **Prerequisites**: `ORB-R1-1314` with blocking E01 `PASS`.
  - **Exact files**: `ops/acceptance/run-day14.sh`, `artifacts/milestones/2026-11-19/README.md`, `artifacts/milestones/2026-11-19/owner-acceptance.md`, `artifacts/milestones/2026-11-19/result-manifest.json`.
  - **Output**: Against only the exact ORB-R1-1313 candidate digest and ORB-R1-1314 deployed environment identity, rerun deployed E02-E16, verify the genuine signed 2026-11-12..18 observations, and issue binary offer-pilot GO/NO-GO with Owner acceptance and every Critical/High disposition.
  - **Tests / acceptance evidence**: E02-E17 and the fresh isolated restore all pass with bound logs/screenshots/provider/object/backup evidence. Any missing observation, scope/security/integrity/recovery failure, unexplained variance, unresolved blocking risk, candidate/environment drift or local evidence forces NO-GO; dates never waive controls and no result from another candidate/environment may substitute.
  - **Trace**: requirements R1-001, R1-002, R1-003, R1-004, R1-005, R1-006, R1-007, R1-008, R1-009, R1-010, R1-011, R1-012, R1-013, R1-014, R1-015, R1-016, R1-017, R1-018, R1-019, R1-020, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07; operations ALL79; UI ALL_UI_ROUTES; evidence E02, E03, E04, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17.


## Canonical ownership and correction-overlay rules

1. The 85 current tasks define 408 literal-path primary entries and zero overlays. `primary[path] = task` is globally unique and immutable historical provenance; a future file, including a correction-created test, receives exactly one primary owner through **Exact files**.
2. `overlay[correction, path] = primary[path]` is a separate edit authorization available only to a reviewed concrete correction row. **Corrects files** and **Primary owner** must have identical literal-path key sets, and the declared owner must match `primary`; an overlay neither transfers nor duplicates primary ownership.
3. A correction is non-executable until its concrete ID, defect/reason, exact targets and test paths, retained failing result, prerequisites, impact/security/integrity/contract dispositions and explicit pre-edit reviewer approval are present. The schema token in the template creates no task or edge.
4. For each target, overlays form one strict chain: the first maps **Supersedes** to `none`; each later overlay maps it to the immediately prior concrete correction and depends on that correction. Thus overlapping corrections cannot execute in parallel. New files cannot enter through the overlay relation.
5. Verification compares actual edits to the union of that task's unique primary authorization and reviewed overlay authorization. Literal exact files only: directories, globs, wildcards, owner inference, target inference and all undeclared edits fail closed.

## Canonical traceability mappings

These tables are validation input, not additional tasks. Every mapped task carries the corresponding trace above.

### OperationId to implementation/verification tasks (117/117)

| operationId | Tasks |
|---|---|
| `getSettings` | `ORB-R1-0205`, `ORB-R1-0206` |
| `updateSettings` | `ORB-R1-0205`, `ORB-R1-0206` |
| `runOperationalReport` | `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903` |
| `getAccountsSummary` | `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903` |
| `listAccountRecords` | `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903` |
| `listProductMovements` | `ORB-R1-0301`, `ORB-R1-0302` |
| `listCustomers` | `ORB-R1-0301`, `ORB-R1-0302` |
| `createCustomer` | `ORB-R1-0301`, `ORB-R1-0302` |
| `getCustomer` | `ORB-R1-0301`, `ORB-R1-0302` |
| `updateCustomer` | `ORB-R1-0301`, `ORB-R1-0302` |
| `listSuppliers` | `ORB-R1-0301`, `ORB-R1-0302` |
| `createSupplier` | `ORB-R1-0301`, `ORB-R1-0302` |
| `getSupplier` | `ORB-R1-0301`, `ORB-R1-0302` |
| `updateSupplier` | `ORB-R1-0301`, `ORB-R1-0302` |
| `listProducts` | `ORB-R1-0301`, `ORB-R1-0302` |
| `createProduct` | `ORB-R1-0301`, `ORB-R1-0302` |
| `getProduct` | `ORB-R1-0301`, `ORB-R1-0302` |
| `updateProduct` | `ORB-R1-0301`, `ORB-R1-0302` |
| `listMasterRecords` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createMasterRecord` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `updateMasterRecord` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listProjects` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createProjectWithSalesContract` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getProject` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createPurchaseContract` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `activateProject` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createContractAmendment` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitContractForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `allocateShipmentLineSource` | `ORB-R1-0404` |
| `getContractLineFulfillment` | `ORB-R1-0304`, `ORB-R1-0404` |
| `listContractLines` | `ORB-R1-0304` |
| `createContractLine` | `ORB-R1-0304` |
| `getContractLine` | `ORB-R1-0304` |
| `updateContractLine` | `ORB-R1-0304` |
| `listContractLineVersions` | `ORB-R1-0304` |
| `createSupplierShipment` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getSupplierContainerConsolidation` | `ORB-R1-0404` |
| `listSupplierShipmentLines` | `ORB-R1-0404` |
| `createSupplierShipmentLine` | `ORB-R1-0404` |
| `getSupplierShipmentLine` | `ORB-R1-0404` |
| `submitSupplierShipmentConfirmation` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `confirmSupplierShipment` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createSalesShipment` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listSalesShipmentLines` | `ORB-R1-0402` |
| `createSalesShipmentLine` | `ORB-R1-0402` |
| `getSalesShipmentLine` | `ORB-R1-0402` |
| `setPrimarySupplierSource` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `requestToleranceException` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `confirmSalesShipment` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getFixedRouteChecklist` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `updateRouteEvidenceOrMilestone` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `uploadEvidence` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listEvidence` | `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getEvidenceMetadata` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `viewOrDownloadEvidence` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0503`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `generateShipmentDocument` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getDocumentGenerationStatus` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reviseDocument` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitDocumentForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelDocumentRevision` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createOutboundManifest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitOutboundManifestForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `sendApprovedOutboundManifest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelOutboundManifest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listFixedApprovalInbox` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `decideFixedApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-1001`, `ORB-R1-1003`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createSalesInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getSalesInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getSalesInvoicePrintData` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelUnallocatedSalesInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createSupplierInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitSupplierInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `confirmSupplierInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `recordMoneyMovement` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getProjectMoney` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `allocateMoneyMovement` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reverseMoneyMovement` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createDirectExpense` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitDirectExpense` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelDirectExpense` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getOperationalStatement` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getProjectMarginAndCash` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listShipments` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `openSimpleClaim` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getProjectClaims` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `moveClaimUnderReview` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitClaimOutcomeForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `assessProjectClosure` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getProjectClosure` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `requestClosureException` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `finalCloseProject` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitFinalCloseForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reopenProject` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitReopenForApproval` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listProjectAuditEvents` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0205`, `ORB-R1-0206`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listSupplierShipmentDatasetHistory` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reviseSupplierShipmentDataset` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listSalesShipmentDatasetHistory` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reviseSalesShipmentDataset` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `transitionSupplierShipmentExecution` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `transitionSalesShipmentExecution` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reverseSettlementAllocation` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitApprovedExpenseCorrection` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `applyApprovedExpenseCorrection` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelUnexecutedProject` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `applyApprovedClaimOutcome` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getOutboundManifestExactPreview` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `reviseOutboundManifest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listOutboundSendAttempts` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `submitSalesShipmentConfirmation` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `cancelUnallocatedSupplierInvoice` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0705`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `signIn` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `signOutCurrentSession` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getCurrentSession` | `ORB-R1-0209`, `ORB-R1-0210` |
| `changeOwnPassword` | `ORB-R1-0209`, `ORB-R1-0210` |
| `resetUserPassword` | `ORB-R1-0209`, `ORB-R1-0210` |
| `listPilotUsers` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `createUser` | `ORB-R1-0209`, `ORB-R1-0210` |
| `updateUser` | `ORB-R1-0209`, `ORB-R1-0210` |
| `listRoles` | `ORB-R1-0209`, `ORB-R1-0210` |
| `createRole` | `ORB-R1-0209`, `ORB-R1-0210` |
| `replaceRolePermissions` | `ORB-R1-0209`, `ORB-R1-0210` |
| `listPermissions` | `ORB-R1-0209`, `ORB-R1-0210` |
| `assignFixedPilotRoles` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `revokePilotUserSession` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getBackupRecoveryStatus` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1201`, `ORB-R1-1202`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| `startIsolatedRestoreTest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1201`, `ORB-R1-1202`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getIsolatedRestoreTest` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-1201`, `ORB-R1-1202`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getSupplierShipmentWorkspace` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `getSalesShipmentWorkspace` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0407`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| `listPilotUserSessions` | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0105`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |

### Requirement/invariant mapping (20/20 + 7/7)

| ID | Tasks |
|---|---|
| R1-001 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0305`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-002 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0305`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-003 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0503`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-004 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-005 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-006 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-007 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-008 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-009 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-010 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-1201`, `ORB-R1-1202`, `ORB-R1-1203`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-011 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-012 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-013 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0213`, `ORB-R1-0214`, `ORB-R1-0305`, `ORB-R1-0407`, `ORB-R1-0503`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0605`, `ORB-R1-0705`, `ORB-R1-0803`, `ORB-R1-0903`, `ORB-R1-1003`, `ORB-R1-1103`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-014 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0101`, `ORB-R1-0102`, `ORB-R1-0104`, `ORB-R1-0105`, `ORB-R1-0202`, `ORB-R1-0205`, `ORB-R1-0206`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0213`, `ORB-R1-0214`, `ORB-R1-0302`, `ORB-R1-0305`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0407`, `ORB-R1-0503`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1201`, `ORB-R1-1202`, `ORB-R1-1203`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1206`, `ORB-R1-1207`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1305`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-015 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0205`, `ORB-R1-0206`, `ORB-R1-0207`, `ORB-R1-0208`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0406`, `ORB-R1-0503`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-1102`, `ORB-R1-1203`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-016 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-017 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0101`, `ORB-R1-0102`, `ORB-R1-0103`, `ORB-R1-0105`, `ORB-R1-0202`, `ORB-R1-0206`, `ORB-R1-0210`, `ORB-R1-0304`, `ORB-R1-0402`, `ORB-R1-0404`, `ORB-R1-0406`, `ORB-R1-0502`, `ORB-R1-0602`, `ORB-R1-0604`, `ORB-R1-0702`, `ORB-R1-0704`, `ORB-R1-0802`, `ORB-R1-0902`, `ORB-R1-1002`, `ORB-R1-1102`, `ORB-R1-1202`, `ORB-R1-1204`, `ORB-R1-1205`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1305`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-018 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0209`, `ORB-R1-0210`, `ORB-R1-0301`, `ORB-R1-0302`, `ORB-R1-0303`, `ORB-R1-0304`, `ORB-R1-0402`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0502`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1206`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1306`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-019 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0203`, `ORB-R1-0204`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0901`, `ORB-R1-0902`, `ORB-R1-0903`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| R1-020 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0101`, `ORB-R1-0103`, `ORB-R1-0105`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0212`, `ORB-R1-0213`, `ORB-R1-0214`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0503`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1204`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-01 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0203`, `ORB-R1-0205`, `ORB-R1-0206`, `ORB-R1-0401`, `ORB-R1-0402`, `ORB-R1-0403`, `ORB-R1-0404`, `ORB-R1-0405`, `ORB-R1-0406`, `ORB-R1-0407`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-02 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0203`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0705`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-03 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-0803`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-04 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-05 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0701`, `ORB-R1-0702`, `ORB-R1-0703`, `ORB-R1-0704`, `ORB-R1-0801`, `ORB-R1-0802`, `ORB-R1-1101`, `ORB-R1-1102`, `ORB-R1-1103`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-06 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0202`, `ORB-R1-0211`, `ORB-R1-0212`, `ORB-R1-0601`, `ORB-R1-0602`, `ORB-R1-0603`, `ORB-R1-0604`, `ORB-R1-0605`, `ORB-R1-1301`, `ORB-R1-1303`, `ORB-R1-1304`, `ORB-R1-1309`, `ORB-R1-1315` |
| INV-07 | `ORB-R1-0001`, `ORB-R1-0002`, `ORB-R1-0101`, `ORB-R1-0103`, `ORB-R1-0105`, `ORB-R1-0201`, `ORB-R1-0202`, `ORB-R1-0212`, `ORB-R1-0213`, `ORB-R1-0214`, `ORB-R1-0401`, `ORB-R1-0407`, `ORB-R1-0501`, `ORB-R1-0502`, `ORB-R1-0503`, `ORB-R1-0801`, `ORB-R1-0803`, `ORB-R1-1001`, `ORB-R1-1002`, `ORB-R1-1003`, `ORB-R1-1204`, `ORB-R1-1301`, `ORB-R1-1302`, `ORB-R1-1303`, `ORB-R1-1309`, `ORB-R1-1315` |

### UI route mapping and actual page ownership (21/21)

Each contract route below has one actual Next.js page file. Trace labels without the listed file do not count. Dynamic/grouped patterns intentionally map to one parameterized page, except `/admin/{users|backup}`, whose two concrete routes have two exact files.

| # | Contract route | Actual page file(s) | Sole page owner | Integration/verification tasks |
|---:|---|---|---|---|
| 1 | `/sign-in` | `src/app/sign-in/page.tsx` | `ORB-R1-0210` | `ORB-R1-0209`, `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 2 | `/` | `src/app/page.tsx` | `ORB-R1-1212` | `ORB-R1-1211`, `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 3 | `/masters/{customers|suppliers|coffee|currencies|expense-categories}` | `src/app/masters/[masterType]/page.tsx` | `ORB-R1-0305` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 4 | `/projects` | `src/app/projects/page.tsx` | `ORB-R1-0305` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 5 | `/projects/new` | `src/app/projects/new/page.tsx` | `ORB-R1-0305` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 6 | `/projects/{id}/overview` | `src/app/projects/[id]/overview/page.tsx` | `ORB-R1-1212` | `ORB-R1-1211`, `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 7 | `/projects/{id}/contracts` | `src/app/projects/[id]/contracts/page.tsx` | `ORB-R1-0305` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 8 | `/projects/{id}/shipments` | `src/app/projects/[id]/shipments/page.tsx` | `ORB-R1-0407` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 9 | `/sales-shipments/{id}` | `src/app/sales-shipments/[id]/page.tsx` | `ORB-R1-1210` | `ORB-R1-0503`, `ORB-R1-0605`, `ORB-R1-0705`, `ORB-R1-0803`, `ORB-R1-1003`, `ORB-R1-1103`, `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 10 | `/supplier-shipments/{id}` | `src/app/supplier-shipments/[id]/page.tsx` | `ORB-R1-1210` | `ORB-R1-0705`, `ORB-R1-0903`, `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 11 | `/projects/{id}/money` | `src/app/projects/[id]/money/page.tsx` | `ORB-R1-0705` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 12 | `/projects/{id}/expenses` | `src/app/projects/[id]/expenses/page.tsx` | `ORB-R1-0803` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 13 | `/projects/{id}/statements` | `src/app/projects/[id]/statements/page.tsx` | `ORB-R1-0903` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 14 | `/projects/{id}/profit` | `src/app/projects/[id]/profit/page.tsx` | `ORB-R1-0903` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 15 | `/projects/{id}/claims` | `src/app/projects/[id]/claims/page.tsx` | `ORB-R1-1003` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 16 | `/projects/{id}/closure` | `src/app/projects/[id]/closure/page.tsx` | `ORB-R1-1103` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 17 | `/approvals` | `src/app/approvals/page.tsx` | `ORB-R1-1203` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 18 | `/documents/{id}` | `src/app/documents/[id]/page.tsx` | `ORB-R1-0605` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 19 | `/evidence/{id}` | `src/app/evidence/[id]/page.tsx` | `ORB-R1-0503` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 20 | `/projects/{id}/audit` | `src/app/projects/[id]/audit/page.tsx` | `ORB-R1-1203` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |
| 21 | `/admin/{users|backup}` | `src/app/admin/users/page.tsx`; `src/app/admin/backup/page.tsx` | `ORB-R1-1203` | `ORB-R1-1204`, `ORB-R1-1309`, `ORB-R1-1315` |

### Numbered evidence mapping (17/17; deployed runtime only)

Pre-deployment tasks define implementations and harnesses but cannot earn an E number. Every evidence row below starts only after the exact candidate deployment has passed E01; all retained proof binds artifact digest plus environment identity.

| Evidence | Beta deployed owner(s) | Stabilization deployed owner | Ordering assertion |
|---|---|---|---|
| E01 | `ORB-R1-1308` | `ORB-R1-1314` | Freeze -> deploy -> E01; no later E starts before PASS |
| E02 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E03 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E04 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E05 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E06 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E07 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E08 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E09 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E10 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E11 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E12 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E13 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E14 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01 |
| E15 | `ORB-R1-1309` | `ORB-R1-1315` | Same frozen build/environment as its E01; deployed screenshots/a11y only |
| E16 | `ORB-R1-1310` | `ORB-R1-1315` | Same frozen build/environment as its E01; deployed security/performance/concurrency/restore only |
| E17 | `ORB-R1-1311`, `ORB-R1-1312` | `ORB-R1-1315` | Day-7 GO after E01-E16; genuine daily 2026-11-12..18 observations; branch gate/corrections (if any), freeze, deploy/E01, then day-14 deployed E02-E17 rerun |

## Dependency and parallel execution rules

1. P0 contract/coverage guards precede scaffolding; P1 precedes all database/application work.
2. P2 is the blocking integrity foundation. Within it, audit, evidence, access, approvals and MD3 tests are independently writable where prerequisites allow; implementation always waits for its own retained failing tests.
3. A1 masters/contracts unlocks A2 shipments. A3 routes and A4 documents follow shipment datasets. A5 settlement follows supplier invoices plus documents. A6 expenses follows settlement foundations. A7 read models follows money/expenses. A8 claims follows shipments/approvals. A9 closure waits for routes, documents/outbound, settlement, expenses and claims.
4. ORB-R1-1210 is the sole final composition owner for both multi-stage shipment pages. ORB-R1-1211/1212 wait for every promised Today/overview backend source. ORB-R1-1204 and every release task wait for these integrations; no feature task may make an unlisted page/registry edit.
5. P13 constructs fixtures and harnesses before freezing. ORB-R1-1307 freezes, ORB-R1-1308 deploys, and E01 blocks deployed E02-E16. Deployment never depends on acceptance. Every E result binds the exact immutable artifact digest and environment identity; local/pre-deployment output earns no E credit.
6. Day-7 GO requires the complete active R1 prerequisite cut through ORB-R1-1310. Day-14 requires actual signed observations on 2026-11-12 through 2026-11-18, ORB-R1-1316/1317 branch control and any separately reviewed correction tasks, ORB-R1-1313 freeze, ORB-R1-1314 deploy/E01, then ORB-R1-1315 deployed E02-E17; observations cannot be backfilled, and correction deployment never precedes freeze.
7. Parallel work may never edit the same exact file, weaken a prerequisite, introduce a deferred surface, or treat a mocked dependency as acceptance evidence. A future correction overlay does not weaken this rule: overlapping targets require the explicit total prerequisite and per-target supersession chain above, so no overlapping editors are parallel-safe.

### Critical path

`ORB-R1-0001 -> ORB-R1-0101 -> ORB-R1-0102 -> ORB-R1-0201 -> ORB-R1-0202 -> ORB-R1-0203 -> ORB-R1-0204 -> ORB-R1-0206 -> ORB-R1-0210 -> ORB-R1-0211 -> ORB-R1-0212 -> ORB-R1-0301 -> ORB-R1-0302 -> ORB-R1-0303 -> ORB-R1-0304 -> ORB-R1-0401 -> ORB-R1-0402 -> ORB-R1-0403 -> ORB-R1-0404 -> ORB-R1-0405 -> ORB-R1-0406 -> ORB-R1-0701 -> ORB-R1-0702 -> ORB-R1-0703 -> ORB-R1-0704 -> ORB-R1-0801 -> ORB-R1-0802 -> ORB-R1-0901 -> ORB-R1-0902 -> ORB-R1-0903 -> ORB-R1-1210 -> ORB-R1-1204 -> ORB-R1-1206 -> ORB-R1-1302 -> ORB-R1-1303 -> ORB-R1-1304 -> ORB-R1-1307 -> ORB-R1-1308 -> ORB-R1-1309 -> ORB-R1-1311 -> ORB-R1-1312 -> ORB-R1-1316 -> ORB-R1-1317 -> ORB-R1-1313 -> ORB-R1-1314 -> ORB-R1-1315`

This is the 46-task longest prerequisite chain on the currently knowable no-code-correction branch; the graph has 85 tasks and 196 static edges. A branch-B reviewed amendment inserts its concrete correction tasks before ORB-R1-1317 and lengthens the critical path by those tasks, so no fixed branch-B count is invented here. Converging branches not visible in that single chain—sign-in/UI shell, route/evidence, documents/outbound, claims/closure, complete workspace composition, visual/security/recovery harnesses and ORB-R1-1310 deployed E16—remain mandatory at the day-7 cut. The 2026-11-12 date is claimable only if both deployed branches pass; it does not shorten the graph.

## Release stop conditions and remaining implementation risks

- Object-store retention lock, database append-only roles, SMTP/provider transport capture, MFA, TLS, encryption and PITR must be proven in the deployed environment; local mocks earn no acceptance credit.
- Cross-module serializable transactions for settlement, closure invalidation, document/outbound binding and audit may create contention; ORB-R1-1310 and ORB-R1-1315 must prove correctness and timing at 50 sessions on their frozen deployed candidates before GO.
- Arabic fonts/rendering, PDF byte stability and bidi references are deployment-sensitive; ORB-R1-1205 only builds the harness; ORB-R1-1309 and ORB-R1-1315 must capture E08/E15 on their frozen deployed builds.
- The calendar cannot manufacture evidence: ORB-R1-1312 requires actual 2026-11-12 through 2026-11-18 observations, and missing days remain missing.
- Any contract change requires renewed accepted specification/plan review and regeneration of this graph; tasks may not invent or resolve policy during implementation.
