# Release 1 Daily-Use Beta Validation Guide

This is an executable acceptance guide for the later implementation. It does not authorize or supply code/tasks.

## Blocking preconditions

1. Verify the retained compatibility spike hashes/log and exact pins in `plan.md`; rerun after any pin/lock change. This limited gate is PASS in retained evidence, but does not imply Plan Gate or runtime acceptance.
2. Deploy the exact immutable build behind TLS with PostgreSQL/object storage, three fixed roles, Arabic/English, and acceptance masters.
3. Record build/lock digest, environment, UTC window, browser versions, database/object backup IDs, and test identities.
4. Validate `contracts/openapi.yaml` as OpenAPI 3.1 and resolve every local `$ref`; fail on warning/error.

## Contract and deferred-surface rejection

- Exercise every operationId at least once with an allowed role and once with a denied/invalid condition; verify RFC 9457.
- Verify mutations require `Idempotency-Key`; existing-aggregate mutations require `If-Match`.
- Crawl API paths and UI routes/build manifests. Fail if any endpoint or interactive control exists for: bank import/matching, tax pack, historical migration, multi-source allocation, shared-expense allocation, approval designer, route designer, or advanced claim settlement.
- Probe representative forbidden paths such as `/bank-imports`, `/tax-packs`, `/migration-records`, `/source-allocations`, `/expense-allocations`, `/approval-policies`, and `/route-templates`; expect 404 and no schema/navigation discovery.

## Full daily-use beta scenario

1. Sign in as each fixed role; prove permission shaping and self-approval denial. Create essential masters. Run the same critical workflow in English LTR and Arabic RTL.
2. Operations creates Project A plus a 100 MT sales contract with omitted tolerances and adds two purchase contracts; Owner/Admin approves exact versions. Create Project B for a second independent sales contract; amend Project A instead of creating another Project for a same-contract change.
3. Create two supplier shipments; submit exact datasets, approve with different Owner/Admin, confirm, mark `IN_TRANSIT`, then `RECEIVED`. Create 20/40/40 MT sales shipments, assign exactly one confirmed source each, submit and obtain different Owner/Admin approval for each exact dataset/source binding, confirm, mark `IN_TRANSIT`, then `DELIVERED`. Exercise reasoned eligible `CANCELLED` and `REJECTED` examples on disposable shipments. Verify every command has version/idempotency/audit and prove a second-source field/endpoint does not exist.
4. Attempt outside-tolerance confirmation without approval; inspect detailed blocker. Request Owner/Admin exception for the exact dataset/reason, approve, and confirm. Revise both a supplier and sales dataset while eligible: preserve old revision, expire approval/exception, reset confirmation, reject stale `If-Match`, and require submit/approve/confirm again. Prove revision after `IN_TRANSIT` is rejected.
5. For each fixed route, complete the required milestone/evidence checklist; upload, view, download, and hash evidence. Leave one required item incomplete and prove final closure blocks. Prove there is no route-template editor.
6. Generate CINV and Packing List from the same exact dataset in English, Arabic, and bilingual modes; poll status to Ready and compare shared fields. Approve an exact output; revise it and prove old bytes/hash remain. Cancel a draft/new revision with reason.
7. Build an outbound manifest with channel, ordered To/Cc, exact output ID/version/hash, attachment IDs/versions/exact filenames/byte sizes/hashes, exact subject, and exact body bytes/media type/byte size/hash. Approve it. Separately revise recipient, attachment name/bytes, subject, body bytes, and output version; each creates a new manifest and makes old approval unusable. Reapprove, retrieve exact preview, explicitly send without a caller body, and byte-compare approved versus transport-captured body/attachments. Force missing object/hash mismatch/provider failure; each must fail closed and append immutable attempt/result/audit. Retry appends a new attempt. Prove no automatic send.
8. Confirm a supplier invoice against one supplier shipment. Prove an unallocated confirmed invoice can be reasoned-cancelled by Owner/Admin, an allocated invoice cannot be cancelled until allocations reverse, and a replacement confirmed invoice restores the closure prerequisite. Record a USD 30,000 customer advance before CINV, allocate USD 20,000 and USD 10,000 across CINV targets; record supplier advance/payment and allocate to supplier invoice. Attempt over-allocation, wrong party/currency, stale version, replay, reversal, and refund. Reverse one allocation explicitly; verify immutable original plus compensating row, exact movement availability/document outstanding/statement balances, shipment and Project financial reopening, and idempotent replay with no second reversal.
9. Record shipment freight and Project customs expenses, each directly scoped with proof. Approve exact versions. Correct one approved expense through exact cancellation/replacement submission, different Owner/Admin approval, and apply; verify old/new evidence remains immutable, direct edit/delete is absent, margin/statement/closure recompute, and replay is harmless. Prove neither multi-shipment/shared allocation nor allocation method is present.
10. Reconcile customer, supplier, sales-shipment, supplier-shipment, and Project statements by currency. Verify expected, committed, actual operational margin, and cash position formulas/source drill-down. Advances change cash only; AED conversions disclose rate/date/source.
11. Open two simple claims and move each under review. Attempt direct terminal transition and apply without approval; both fail. Submit exact proposed `RESOLVED` and `REJECTED` outcomes with reason/evidence; prove requester self-approval fails, Owner/Admin rejection leaves claim under review, dataset/version change expires applicability, and only approved apply reaches the proposed terminal state with audit. Prove open/under-review claim blocks final close and no discount/replacement/compensation/netting automation exists.
12. Prove zero invoice is not enough: a shipment without an approved non-cancelled CINV stays Open. Fully collect one shipment while document/claim items remain; it must become Financially Closed. Fully collect all shipments; Project becomes Financially Closed. Verify the assessment lists every remaining quantity/delivery/route/document/supplier/expense/claim/approval blocker. Approve one eligible named exception, prove it cannot cover another/version, clear all blockers, submit/approve/apply final close, then exercise each invalidator (allocation reversal/refund, document revision/cancel, approved-expense correction, new claim, eligible shipment cancel/reject) on controlled fixtures and verify stale assessment/exception invalidation plus Final Close reopening. Submit/approve/apply explicit reopen with reason and recomputed financial state.

Expected throughout: zero unexplained quantity/money/statement variance; no lost update; immutable approved evidence; stable references; complete actor/time/version/reason audit.

## ORB MD3 and bilingual acceptance

Follow the visual matrix in `contracts/ui-workflows.md` for every screen at 1440x900, 768x1024, and 390x844. Capture paired screenshots, keyboard traversal, screen-reader semantics, contrast, reduced motion, all component states, loading/empty/error/permission/stale states, dense-table containment, and bidi-safe references. Fail on any critical/serious accessibility issue, untranslated active control, clipped Arabic, wrong root direction, unmirrored directional action, raw non-token color, missing ORB identity, or journey divergence.

## Security, audit, performance, and recovery

- Test MFA for Owner/Admin, secure session/cookie/CSRF, authorization/IDOR, upload abuse, rate limiting, log redaction, audited downloads/sends, TLS and encryption. Require zero unaccepted Critical scan findings.
- Replay same idempotency key/payload (same outcome, no duplicate), then changed payload (`IDEMPOTENCY_KEY_REUSED`). Submit stale `If-Match` (`STALE_VERSION`). Recompute an audit chain and verify retained daily head; application role cannot update/delete audit or approved bytes.
- At 50 sessions require p95 reads <=500 ms, mutations <=800 ms; document accept <=2 s and render <=30 s. Concurrent settlement/tolerance/closure commands preserve all invariants.
- Perform an isolated pre-beta PITR/object restore from the separate encrypted copy. RPO <=15 minutes, RTO <=4 hours, with zero missing sampled Project/version/allocation/approval/audit/hash/object link.

## Milestone evidence and exit

- **2026-11-12**: deployment URL/build, full scenario result, restore report, and first real daily-use entry.
- **2026-11-12–18**: daily observation/correction log with severity, affected journey, fix build, regression evidence, and unresolved risk.
- **2026-11-19**: frozen stabilized build, full rerun, bilingual/visual evidence, reconciliation, security/restore evidence, and Owner acceptance.

The pilot passes only when all active acceptance above passes and deferred surfaces are absent. It remains blocked if the compatibility spike lacks clean install/typecheck evidence or the independent Plan Gate is not accepted.

## Requirement, invariant, and evidence matrix

Every row must have API contract evidence, UI evidence in both locales, and retained runtime evidence; a documentation assertion alone is a fail.

| Coverage | Executable API operationIds | UI route/action | Retained acceptance evidence |
|---|---|---|---|
| R1-001, A1 | `createMasterRecord`, `createProjectWithSalesContract`, `createPurchaseContract`, `createContractAmendment`, `submitContractForApproval`, `decideFixedApproval` | masters; Project wizard; Contracts; Approvals | steps 1–2: references, zero defaults, independent Project/amendment, self-approval denial |
| R1-002, A2, INV-01 | `createSupplierShipment`, `reviseSupplierShipmentDataset`, `submitSupplierShipmentConfirmation`, `confirmSupplierShipment`, `createSalesShipment`, `reviseSalesShipmentDataset`, `setPrimarySupplierSource`, `submitSalesShipmentConfirmation`, `requestToleranceException`, `confirmSalesShipment`, `transitionSupplierShipmentExecution`, `transitionSalesShipmentExecution` | Project Shipments and both workspaces: revision/history/confirm/transitions | steps 3–4: every state, stale/replay, approval expiry, quantities |
| R1-003, A3 | `getFixedRouteChecklist`, `updateRouteEvidenceOrMilestone`, `uploadEvidence`, `viewOrDownloadEvidence` | Route/Evidence tabs | step 5: all three fixed routes, hashes, audited access, close blocker |
| R1-004, A4, INV-06 | `generateShipmentDocument`, `getDocumentGenerationStatus`, `reviseDocument`, `submitDocumentForApproval`, `cancelDocumentRevision`, `createOutboundManifest`, `reviseOutboundManifest`, `getOutboundManifestExactPreview`, `submitOutboundManifestForApproval`, `sendApprovedOutboundManifest`, `listOutboundSendAttempts` | Document workspace exact preview/approval/send | steps 6–7: byte comparison, drift matrix, fail-closed attempts |
| R1-005, A5, INV-02 | `createSupplierInvoice`, `submitSupplierInvoice`, `confirmSupplierInvoice`, `cancelUnallocatedSupplierInvoice`, `recordMoneyMovement`, `allocateMoneyMovement`, `reverseSettlementAllocation`, `reverseMoneyMovement` | Supplier invoice; Money allocation/reversal | step 8: advance, allocations, compensating history, exact closure/balance recalculation |
| R1-006, A6, INV-03 | `createDirectExpense`, `submitDirectExpense`, `submitApprovedExpenseCorrection`, `applyApprovedExpenseCorrection` | Expenses: no edit/delete; Correct old/new pair | step 9: immutable evidence, approval, recomputation |
| R1-007, A7 | `getOperationalStatement`, `getProjectMarginAndCash` | Statements; Profit and cash | step 10: source drill-down, currency partitions, four formulas, zero variance |
| R1-008, A8, INV-04 | `openSimpleClaim`, `moveClaimUnderReview`, `submitClaimOutcomeForApproval`, `decideFixedApproval`, `applyApprovedClaimOutcome` | Claims; Approvals | step 11: bypass denial, self-approval denial, exact apply and blockers |
| R1-009, R1-012, A9, INV-05 | `assessProjectClosure`, `requestClosureException`, `submitFinalCloseForApproval`, `finalCloseProject`, `submitReopenForApproval`, `reopenProject`, plus reversal/cancel/revision invalidators | Closure grouped blockers/exceptions/reopen | step 12: reachable prerequisites, non-exceptionable blockers, invalidation/reopening |
| R1-010, R1-013, A10 | `signIn`, `signOutCurrentSession`, `listPilotUsers`, `assignFixedPilotRoles`, `revokePilotUserSession`; all business operationIds with role/locale; evidence/audit reads; `getBackupRecoveryStatus`, `startIsolatedRestoreTest`, `getIsolatedRestoreTest` | every screen at three viewports in AR/EN | MD3/bilingual and security sections: parity, WCAG, permission shaping |
| R1-011 | claim and closure operationIds | Claims/Closure | steps 11–12: simple outcome only; no automated settlement |
| R1-014–R1-016 | all mutations; evidence/audit; RFC 9457 defaults | stale/replay/error/evidence states | contract sweep, immutable hashes, exact decimals, transition negatives |
| R1-017–R1-020, INV-07 | all 74 operations; forbidden-path probes | all 21 screen routes; route/navigation crawl | operation sweep; header checks; 404 deferred surface; no hidden control/schema |

## Milestone evidence realism

- **2026-11-12 (day 7 / beta entry):** retain deployment/build/contract digest, pre-beta restore, full controlled scenario result, bilingual critical-path evidence, first real ORB entry, defects found, owners, and explicit unresolved risks. This proves deployment and entry readiness only; it cannot contain seven elapsed days of usage.
- **2026-11-12–18:** one signed UTC log per actual day with actor, real journey/record references, defects/near misses, severity, fix build, focused regression and impact sweep, send attempts, reconciliation variance, and open risk. Missing days are reported, never backfilled as observation.
- **2026-11-19 (day 14 / stabilization):** freeze exact build and contract digest; rerun every matrix row, bilingual/MD3/accessibility, security, performance, reconciliation and isolated restore; attach the complete seven-day log and disposition of every Critical/High risk. Any integrity/security failure, unexplained variance, missing required observation, or active blocker keeps the pilot not ready regardless of date.
