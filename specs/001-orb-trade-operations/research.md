# Phase 0 Research: ORB Limited Daily-Use Operational Beta

Each decision below is authoritative for Release 1 design. Exact ecosystem compatibility passed the retained limited spike in `plan.md`; functional completeness and independent Plan Gate acceptance remain separate and pending.

## Architecture

**Decision**: one Next.js modular monolith, PostgreSQL transaction boundary, and S3-compatible immutable object store.
**Rationale**: the small user population and cross-cutting settlement/closure invariants benefit from atomic transactions and one deployable.
**Alternatives**: microservices, ERP customization, and separate frontend/API deployments add operational or scope cost.

## Exact pins and compatibility

**Decision**: use only the exact proposed pins in `plan.md`, conditional on a clean install/generate/typecheck spike.
**Rationale**: reproducibility is necessary, but planning-time version selection is not compatibility evidence.
**Alternatives**: loose ranges and peer-dependency bypasses are rejected. Node 26.13.0 was rejected after Prisma 7.10.1 emitted an unsupported-runtime warning. Node 24.22.2 and TypeScript 7.0.2 passed the retained clean-install, generation, typecheck, and Next production-build spike.

## Fixed pilot authorization and approvals

**Decision**: three fixed composable roles and the fixed matrix in `spec.md`; prevent self-approval and bind every decision to exact subject version.
**Rationale**: this is executable in the deadline and preserves segregation/review.
**Alternatives**: configurable policy design is deferred; blanket approval of routine edits is unnecessary.

## Primary supplier source

**Decision**: one and only one confirmed supplier shipment is the primary source of each Release 1 sales shipment.
**Rationale**: it supports traceable costing without allocation design.
**Alternatives**: multiple sources and quantitative allocation are future features.

## Fixed route controls

**Decision**: snapshot one of three versioned, code-defined checklist templates onto each sales shipment; record evidence and milestone completion.
**Rationale**: fixed content is auditable and sufficient for the pilot.
**Alternatives**: dynamic rules/designers and tax/legal inference are deferred/rejected.

## Documents, evidence, and outbound control

**Decision**: stream evidence to object storage, calculate/verify SHA-256, retain immutable version metadata, and audit view/download. Generate CINV and Packing List from the same approved shipment dataset. Bind approval to an immutable canonical send manifest containing channel, output ID/version/hash, ordered To/Cc, attachment IDs/versions/exact filenames/byte sizes/hashes, exact subject, and exact body bytes/media type/byte size/hash. Send reads only approved stored bytes, re-verifies all bindings, fails closed, and appends attempts/results.
**Rationale**: this makes “approve what is sent” testable and prevents recipient/attachment substitution.
**Alternatives**: mutable files, approval by document ID alone, or automatic sending are rejected.

## Money, statements, margin, and direct expense

**Decision**: operational movements and allocations, not accounting entries; same-party/same-currency allocation with locked total checks. Allocation reversal is a compensating append-only row that atomically recalculates available/outstanding balances and closure. Approved expenses are corrected only by exact-approved cancellation/replacement. Direct expense has exactly one Project or shipment scope. Keep four margin/cash measures separate and source-drillable.
**Rationale**: supports normal advance-before-invoice behavior and avoids false profit/cash equivalence.
**Alternatives**: ledger design and shared-expense allocation are outside Release 1.

## Claims and closure

**Decision**: simple claim lifecycle records outcome/evidence only; Operations proposes a terminal outcome and a different Owner/Admin approves the exact version before a separate apply command can reach it. No direct terminal transition exists. Financial closure is computed from customer outstanding balance independently from final-closure dimensions. Final closure uses a persisted assessment and blocker-specific exact-version exceptions.
**Rationale**: ORB can see commercial risk without implementing advanced settlement.
**Alternatives**: automatic discount/replacement/compensation/netting is deferred.

## UI and bidi

**Decision**: MUI is accessible plumbing only; an ORB MD3 layer controls semantic color, typography, shape, elevation, spacing, state layers, motion, form/table patterns, and responsive navigation. Set `dir` at document root, use logical CSS, isolate references/numbers, mirror directional icons, and test both languages.
**Rationale**: MUI primitives alone do not establish ORB MD3 or RTL parity.
**Alternatives**: raw MUI styling and duplicated Arabic business records are rejected.

## Integrity, concurrency, and recovery

**Decision**: numeric database types, `If-Match`, locked/serializable allocation and closure commands, idempotency records, append-only transactional audit hash chain, encrypted PITR plus versioned objects, and pre-beta restore proof.
**Rationale**: retry, concurrency, tampering, and cross-store recovery are material operational risks.
**Alternatives**: last-write-wins, application logs alone, nightly untested backup, and mutable object keys are rejected.

## Deferred boundary

**Decision**: no Release 1 schema/API/UI/acceptance for bank import, tax pack, migration, multi-source, shared expenses, configurable approvals, dynamic routes, or advanced claim settlements.
**Rationale**: ADR-001 fixes the release cut.
**Alternatives**: speculative placeholders risk scope leakage and false acceptance.

## Resolved unknowns

Business scope and rules are resolved by `spec.md`. No business-rule unknown is deliberately left open. The compatibility spike passed only the documented dependency/toolchain checks. Independent Plan Gate review, implementation, deployed integration, security, recovery, and real-use acceptance remain unperformed.
