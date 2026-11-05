# Phase 1 Validation Guide: ORB Core Trade

This guide defines how a later implementation is proven against the approved design. It is not an implementation guide and creates no packages, migrations, deployment assets, or tests.

## Preconditions

- The independent Plan Gate has accepted `plan.md`, including the TypeScript 7 exact-version compatibility gate.
- A disposable acceptance environment runs the single modular-monolith build behind Traefik with PostgreSQL 18 and an S3-compatible versioned/object-locked test bucket.
- Seed/control data exists for authorized and restricted users, AED/USD/SAR, two customers, two suppliers, coffee specifications, all three Release 1 route profiles, and approval thresholds.
- The runner can execute the repository's future documented commands for unit/contract tests, Playwright acceptance, accessibility checks, performance checks, security scans, backup, and restore. Do not invent command names here; task/implementation phases must publish them.
- Record environment/build ID, exact dependency lock digest, database/object-store backup identifiers, browser versions, and UTC test window in the evidence report.

## Contract validation

1. Validate `contracts/openapi.yaml` as OpenAPI 3.1 and verify every non-2xx response resolves to `application/problem+json` as defined in `contracts/problem-details.md`.
2. Verify every mutation that can create a business effect requires both `Idempotency-Key` and, for an existing aggregate, `If-Match`.
3. Verify no Release 1 path exposes bank import/matching, tax packs, tax delivery, or historical migration.
4. Exercise permissions against response schemas: restricted roles receive no supplier-cost, margin, bank, identity, or tax fields.

Expected: schema validation has zero errors; stable problem codes/localization keys are present; Release 1 contract contains Core Trade only.

## End-to-end control population

Create Project A with a USD 100 MT independent sales contract and zero omitted tolerances, one customer, two supplier purchase contracts, and approved versions. Create Project B for a second independent contract from the same customer. Amend Project A's contract rather than creating another Project. Verify unique stable references, one sales contract per Project, multiple separated purchase contracts, and immutable approved versions.

Then execute 20/40/40 MT partial sales shipments. Source at least one shipment from two supplier shipments. Attempt concurrent allocations that would oversubscribe a supplier source.

Expected:

- Confirmed/cancelled/remaining quantities reconcile exactly, including contract amendment effects.
- At least one approved source exists per confirmed sale shipment and active source allocations equal its sourced quantity.
- One concurrent command succeeds; the stale/oversubscribing command returns 409 or 412 with no partial rows or silent overwrite.

## Tolerance and route matrix

For each route, run one passing shipment and one missing-requirement shipment:

| Route | Passing evidence | Deliberate blocker |
|---|---|---|
| Foreign-to-Foreign | origin/destination transport and delivery evidence | missing destination evidence |
| UAE Free Zone Re-export | free-zone entry, exit/re-export customs, outbound/delivery evidence | missing re-export evidence |
| UAE Import | import declaration, customs charge/clearance, release/delivery evidence | missing clearance evidence |

Attempt an over-shipment and weight variance first with zero/insufficient tolerance, then with an authorized exact-version exception and reason.

Expected: the first confirmation returns `OUTSIDE_TOLERANCE_APPROVAL_REQUIRED`; the approved exception succeeds and is audited. Route blockers prevent confirmation/final closure according to the versioned profile and never assert a tax/legal classification.

## Document integrity and bilingual parity

From one approved shipment dataset generate CINV and Packing List in English, Arabic, and bilingual modes. Compare every shared party, reference, quantity, bag, net/gross weight, Incoterm, and route field. Approve/send a revision, attempt direct mutation, then revise with a reason.

Expected: zero shared-field mismatch; language modes do not create another commercial business record; direct mutation returns `IMMUTABLE_REVISION`; revision N and N+1 retain different immutable evidence identities, SHA-256 values, actor/time/reason, and source dataset.

Run the same Project creation, shipment, document, allocation, claim, approval, and closure journeys in Arabic RTL and English LTR with keyboard-only navigation and automated accessibility checking.

Expected: functional parity, root direction/language correct, logical layout and direction-aware icons correct, bidi-safe codes/numbers, WCAG 2.2 AA automated checks with zero serious/critical violations, and no inaccessible dense-table action.

## Money and statement reconciliation

Record a USD 30,000 customer advance before any CINV. Allocate USD 20,000 to shipment one and USD 10,000 to shipment two. Record a supplier advance before its invoice. Attempt a one-cent over-allocation, reallocation, reversal, refund, and a different-currency receipt with a disclosed AED management conversion.

Expected:

- No invoice is created by an advance; available/outstanding values never go negative.
- Over-allocation fails atomically with `ALLOCATION_EXCEEDS_AVAILABLE`.
- Customer, contract, shipment, supplier, and Project statements reconcile to zero unexplained variance and keep currencies separate.
- AED views show rate, date, source, and rounding; history survives reversal/reallocation.
- Advances affect Cash Position but not Actual Operational Margin.

## Expenses, claims, profit, and closure

Record direct freight and customs expenses plus one shared expense allocated by quantity, value, and approved manual examples. Force a rounding remainder. Open supplier shortage and quality claims, resolve one by discount and one by replacement. Capture expected, committed, actual operational margin, and cash position.

Expected: every approved expense has proof/status/approver as policy requires; each shared allocation equals its source amount exactly with one deterministic remainder; profit figures reproduce disclosed formulas and drill to approved evidence.

Fully collect a shipment while leaving its claim/document open. Fully collect all Project sales shipments while leaving supplier obligation, expense, claim, and route evidence blockers. Attempt final close, approve a named justified exception, close, then reopen.

Expected: shipment and Project may become Financially Closed independently; Final Close is initially `CLOSURE_BLOCKED`; only exact named approvals clear eligible blockers; close/reopen reason, user, UTC time, and affected version appear in immutable audit history.

## Idempotency, hashing, and audit tamper evidence

Repeat document, money-movement, and allocation requests with the same idempotency key/payload, then with the same key and changed payload. Upload identical bytes as a retry and as a distinct legitimate occurrence; upload corrupted bytes/hash.

Expected: identical retry creates zero duplicate effect and returns the stored outcome; changed payload returns `IDEMPOTENCY_KEY_REUSED`; identical content has one verified byte identity where policy permits but all legitimate occurrence links remain; mismatch returns `FILE_HASH_MISMATCH`.

For a sampled aggregate, recompute the ordered audit hash chain and compare its daily signed head to retained object storage. Attempt audit/document update/delete using the application database role.

Expected: chain verifies; update/delete is denied; a compensating event is the only correction path.

## Concurrency and performance gates

Using representative data (10,000 rows in a dense view and the planned scale indexes), hold 50 concurrent interactive sessions and run 100 simultaneous conflicting allocation/version mutations.

Expected:

- p95 interactive reads <=500 ms; p95 mutations <=800 ms.
- Server-paginated/filter response for the 10,000-row view <=1 s p95.
- Document generation request accepted <=2 s and completed <=30 s.
- Exactly valid mutations commit; no lost update, duplicate effect, negative available balance, oversubscribed source, or partial transaction occurs. Bounded-retry exhaustion returns the documented conflict.

Capture query plans for slow cases, pool saturation, retry count, job age, and error rate. Averages alone do not pass the gate.

## Security validation

- Verify MFA for privileged roles; 15-minute idle and 12-hour absolute privileged session limits; disabled/role-changed session revocation <=15 minutes.
- Test server-side permission denial, direct-object-reference attempts, CSRF, upload type/size/corruption, rate limiting, export/download auditing, log redaction, and trusted-proxy handling behind Traefik.
- Verify TLS 1.2+ and encryption at rest/in backup; secrets are absent from repository, images, client bundles, errors, and logs.
- Run dependency/container scans. Expected: zero unaccepted Critical findings; every High finding fixed or explicitly risk-accepted before release.

## Backup, restore, RPO, and RTO gate

1. Record a cutoff, continue controlled mutations/documents for up to 15 minutes, and capture the database PITR/WAL plus immutable object versions.
2. Restore into an isolated environment from the logically separate encrypted copy; never overwrite the source environment.
3. Reconcile counts and samples for Projects, contract/document versions, allocations, claims, approvals, audit chains, hashes, and object links; open and hash sampled evidence.
4. Record detection/start/usable times and the latest recovered transaction.

Expected: latest loss is <=15 minutes (RPO); service is usable within 4 hours (RTO); zero missing/corrupt sampled evidence, broken object links, allocation variance, or audit-chain failure. Run a sampled restore monthly, full exercise quarterly, and a full exercise before production approval. Any failure blocks production and requires remediation plus rerun.

## Exit evidence

The validation report must map each result to the specification scenario, OpenAPI operation/problem code, UI workflow, data-model invariant, build ID, and immutable evidence location. Release 1 passes only with zero unexplained reconciliation variance, zero shared CINV/Packing List mismatch, successful bilingual core journeys, measured performance/security/restore gates, and an independently accepted Plan Gate. Deferred bank, tax-pack, and historical-migration behavior is neither required nor credited.
