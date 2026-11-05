# Release 1 Daily-Use Beta Validation Guide

This is an executable acceptance guide for the later implementation. It does not authorize or supply code/tasks.

## Blocking preconditions

1. Retain clean-install and `tsc --noEmit` evidence for every exact pin in `plan.md`. Until then record **BLOCKED**, not pass.
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
3. Create and approve/confirm two supplier shipments. Create 20/40/40 MT sales shipments. Assign exactly one primary supplier shipment to each. Prove a second-source field/endpoint does not exist.
4. Attempt outside-tolerance confirmation without approval; inspect detailed blocker. Request Owner/Admin exception for the exact dataset/reason, approve, and confirm. Change the dataset and verify old approval no longer applies.
5. For each fixed route, complete the required milestone/evidence checklist; upload, view, download, and hash evidence. Leave one required item incomplete and prove final closure blocks. Prove there is no route-template editor.
6. Generate CINV and Packing List from the same exact dataset in English, Arabic, and bilingual modes; poll status to Ready and compare shared fields. Approve an exact output; revise it and prove old bytes/hash remain. Cancel a draft/new revision with reason.
7. Build an outbound manifest with To/Cc and attachments. Approve it, then change each of recipient, attachment, subject/body, and output version in separate checks; every change must invalidate approval. Reapprove, preview, explicitly send, and verify immutable delivery/audit. Prove no automatic send.
8. Confirm a supplier invoice against one supplier shipment. Record a USD 30,000 customer advance before CINV, allocate USD 20,000 and USD 10,000 across CINV targets; record supplier advance/payment and allocate to supplier invoice. Attempt over-allocation, wrong party/currency, stale version, replay, reversal, and refund.
9. Record shipment freight and Project customs expenses, each directly scoped with proof. Approve exact versions; prove neither multi-shipment/shared allocation nor allocation method is present.
10. Reconcile customer, supplier, sales-shipment, supplier-shipment, and Project statements by currency. Verify expected, committed, actual operational margin, and cash position formulas/source drill-down. Advances change cash only; AED conversions disclose rate/date/source.
11. Open a simple quality claim, move it under review, and resolve/reject with reason/evidence. Prove open claim blocks final close and that no discount/replacement/compensation/netting automation exists.
12. Fully collect one shipment while document/claim items remain; it must become Financially Closed. Fully collect all shipments; Project becomes Financially Closed. Verify the assessment lists every remaining quantity/delivery/route/document/supplier/expense/claim/approval blocker. Approve one eligible named exception, prove it cannot cover another/version, clear all blockers, final close, then reopen with reason and recomputed state.

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
