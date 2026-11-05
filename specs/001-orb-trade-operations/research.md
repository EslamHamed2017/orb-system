# Phase 0 Research: ORB Trade Operations Core

## Release architecture

**Decision**: Use a simple modular monolith: one Next.js deployment, one PostgreSQL database, one object-store boundary, cohesive domain modules, and synchronous database transactions.  
**Rationale**: ORB's workflows are transaction-heavy and cross-cut projects, shipments, allocations, approvals, and audit events. A single transaction boundary prevents partial settlement/allocation and avoids distributed operational burden for a small user population.  
**Alternatives considered**: Microservices were rejected as unjustified complexity; separate frontend/API deployments were rejected because they add versioning and operations without isolation benefit; a generic ERP was rejected by constitution.

## Runtime and framework baseline

**Decision**: Adopt Node.js 26 LTS and Next.js 16.4 with React 19.3, exact-pinned after a clean compatibility spike. Treat TypeScript 7 as conditional until every exact dependency declares/supports it.  
**Rationale**: Node 26 entered LTS in October 2026 and has support through April 2029. The full-stack framework supports server-rendered bilingual screens and colocated APIs without a second service. Exact pins make the acceptance baseline reproducible.  
**Alternatives considered**: Node 24 LTS is the fallback if a native dependency is not certified on 26; TypeScript 5.9 is the fallback only through formal plan/spec approval if TS7 peer ranges fail. Bypassing peer checks is rejected.

## Database and ORM

**Decision**: PostgreSQL 18 plus Prisma 7.10.1, exact-pinned, with reviewed SQL constraints/triggers where Prisma cannot express invariant enforcement. Use `numeric`, never floating point, for quantity, weight, money, and FX.  
**Rationale**: PostgreSQL provides transactional constraints, row locking, JSON only where variability is genuine, and mature backup/PITR. Prisma 7 supports PostgreSQL 18 and remains supported while Prisma 8 is a release candidate. The service layer plus database constraints protects allocations and state transitions.  
**Alternatives considered**: Prisma 8 RC is rejected for production stability; direct SQL everywhere increases routine development cost; document databases make reconciliation and relational invariants harder.

## Validation and API

**Decision**: Zod 4.6 schemas validate external inputs and emit consistent field errors; OpenAPI 3.1 is the acceptance contract. Domain invariants remain in domain services/database constraints rather than Zod alone.  
**Rationale**: Schema validation improves TypeScript/API alignment but cannot safely enforce concurrent aggregate totals.  
**Alternatives considered**: Framework-only validation was rejected as inconsistent; GraphQL adds query/security complexity unnecessary for controlled screens; tRPC alone would not provide a language-neutral acceptance contract.

## UI, Material Design 3, tables, and directionality

**Decision**: Use MUI 9.5 only as accessible React primitives. Create an explicit ORB MD3 layer containing semantic color roles, typography, elevation, shape, density, focus/hover/pressed/disabled/error states, motion, icons, form/table patterns, and automated conformance checks. TanStack Table 9.3 supplies headless state for server-paginated dense grids. Locale is a user preference; `dir=rtl` is applied at the document root for Arabic and `dir=ltr` for English. Logical CSS properties, direction-aware icons, bidi isolation for references/numbers, and locale-aware formatting are mandatory. Business records are single; print mode chooses Arabic, English, or bilingual templates.  
**Rationale**: MUI 9 is stable but its own documentation says Material UI still adopts MD2, so raw MUI cannot satisfy the constitution. A controlled layer delivers MD3 behavior and ORB branding while preserving accessible primitives. Headless tables prevent a second conflicting visual system.  
**Alternatives considered**: Raw MUI was rejected for MD3 nonconformance; a bespoke component library from DOM primitives was rejected for accessibility cost; Data Grid was not selected because TanStack provides enough table behavior without visual coupling.

## Authentication and authorization

**Decision**: Better Auth 1.7 handles secure sessions; application RBAC composes roles and granular permissions, with server-side authorization on every use case and field-level response shaping for supplier cost, margins, bank, identity, and tax data. Require MFA for privileged roles, 15-minute idle/12-hour absolute privileged sessions, secure HttpOnly/SameSite cookies, CSRF protection, rate limiting, and immediate session revocation on disable/role change.  
**Rationale**: Authentication library concerns remain separate from ORB-specific authorization and segregation.  
**Alternatives considered**: Home-grown auth was rejected; an external identity provider may be added later but is not required for Release 1.

## Evidence storage, hashes, and idempotency

**Decision**: Store bytes in an S3-compatible bucket with versioning and object-lock retention; store immutable `EvidenceObject` metadata in PostgreSQL. Calculate SHA-256 while streaming before acceptance, verify after upload, use a server-generated immutable object key, and record size/media type. Mutations that create money movements, allocations, documents, or imports accept an `Idempotency-Key`; persist key + actor + route + canonical request hash + response for 24 hours minimum. Same key/different payload returns 409. Business duplicate rules remain independent of request idempotency.  
**Rationale**: A content hash establishes byte identity and detects corruption; object lock prevents overwrite; idempotency protects retry paths. Hash equality alone must not merge distinct legitimate evidence occurrences.  
**Alternatives considered**: Filesystem storage lacks durable immutability/scale; mutable object keys are rejected; MD5 is rejected as the authoritative integrity hash.

## Audit immutability

**Decision**: Audit events are append-only, written in the same database transaction as the business mutation. Each includes aggregate identity/version, actor/session, action, UTC time, reason, correlation/idempotency IDs, before/after canonical hashes, and `previous_event_hash`; database roles deny UPDATE/DELETE. Daily signed chain heads are copied to retention-locked object storage. Corrections are compensating events.  
**Rationale**: Transactional append prevents unaudited state, while a hash chain and external retained anchor make tampering evident.  
**Alternatives considered**: Mutable history tables and application logs alone were rejected; event sourcing the entire product was rejected as excessive complexity.

## Concurrency and transactions

**Decision**: Every mutable aggregate has an integer `version`. APIs require `If-Match`; mismatches return 412 with current version. Allocation, tolerance, reference, closure, and approval commands execute in serializable or explicitly locked transactions with database constraints and bounded retry (maximum three attempts with jitter).  
**Rationale**: Optimistic concurrency gives clear user conflict handling; locks/serializable isolation protect cross-row sums that a version column alone cannot.  
**Alternatives considered**: Last-write-wins violates FR-056; pessimistic locks for all edits harm usability; distributed locks are unnecessary.

## Security controls and measurable objectives

**Decision**: TLS 1.2+ externally and to storage/database; encrypted volumes/object storage; secrets injected from the deployment secret facility and rotated at least every 90 days; no secrets or sensitive document contents in logs. Privileged actions, export/download, authorization failures, and config changes are incident/audit events. Dependency/container scanning blocks Critical known vulnerabilities and requires High findings to be fixed or risk-accepted before release. Access review is quarterly; disabled-user revocation is <=15 minutes.  
**Rationale**: These controls make least privilege and secure operations testable.  
**Alternatives considered**: Client-only authorization and shared credentials are rejected.

## Availability, backup, and disaster recovery

**Decision**: Target RPO <=15 minutes and RTO <=4 hours. Use daily full backups plus continuous WAL archiving/PITR, retained 35 daily and 12 monthly copies; object versioning/lock retention must cover the business retention policy. Encrypt backups with a separate key and keep a logically separate copy. Run automated backup checks daily, a sampled restore monthly, and a full isolated database/object-link restore quarterly and before production approval. Restore success requires zero missing sampled rows, revisions, audit events, hashes, allocations, or object links and documented time within RTO.  
**Rationale**: Backups are not controls until restoration and cross-store referential integrity are proven.  
**Alternatives considered**: Nightly-only backups miss the RPO; untested snapshots are rejected.

## Performance and observability

**Decision**: Enforce server-side pagination/filtering, indexed reference/status/date/party foreign keys, bounded exports, and asynchronous document rendering through an in-process job table/worker mode in the same deployable. Measure p50/p95/p99 latency, error/lock-retry rates, job age, DB pool saturation, and object-store failures with correlation IDs. Performance gates are those in plan.md and are tested on representative 10k-row views.  
**Rationale**: Dense operational tables need predictable queries; durable jobs avoid request timeouts without introducing a service architecture.  
**Alternatives considered**: Browser-loading full datasets and a separate message-broker/microservice estate were rejected.

## Route-specific controls

**Decision**: Versioned requirement profiles combine route, destination, customer/product flags, and Incoterm. Foreign-to-Foreign requires origin/destination transport evidence and no UAE import milestone; UAE Free Zone Re-export requires free-zone entry/exit/re-export milestones and related customs evidence; UAE Import requires import declaration, customs clearance/charges, and delivery milestones. Requirement satisfaction is explicit, never inferred as legal/tax classification.  
**Rationale**: Data-driven requirements preserve one workflow while making completeness and final-closure blockers route-specific.  
**Alternatives considered**: Hard-coded screens per route duplicate logic; one generic unchecked list fails FR-014.

## Release extension points

**Decision**: Reserve stable module boundaries and generic evidence/movement/allocation primitives for later bank matching, tax pack, and migration, but do not build their tables/endpoints/UI in Release 1 except fields needed by Core Trade provenance.  
**Rationale**: Clean identities prevent redesign while honoring the approved cut.  
**Alternatives considered**: Building speculative subsequent-release workflows now violates scope; ignoring provenance would force unsafe retrofits.

## Testing tools and deployment

**Decision**: Vitest 5.1 covers pure rules, component behavior, and API schema tests; Playwright 1.65 covers English/Arabic parity, keyboard/accessibility, concurrency conflicts, and end-to-end acceptance. Deploy immutable Docker images behind existing Traefik; Traefik terminates TLS and forwards trusted headers from its network only. Health/readiness checks cover database and object-store dependencies without leaking details.  
**Rationale**: This is the smallest test/deploy stack matching the full-stack TypeScript monolith and existing infrastructure.  
**Alternatives considered**: A second test runner or Kubernetes is unnecessary at this scale.

## Resolved unknowns

No business-rule `NEEDS CLARIFICATION` remains. Exact TypeScript 7 ecosystem support is deliberately a pre-install compatibility gate rather than an assumed fact; the approved functional design does not depend on it.

## Primary references checked (2026-11-05)

- Node.js 26 LTS schedule/release: <https://nodejs.org/uk/blog/announcements/evolving-the-nodejs-release-schedule> and <https://nodejs.org/uk/blog/release/v26.13.0>
- Prisma v7 PostgreSQL guidance and supported database versions: <https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql> and <https://docs.prisma.io/docs/orm/reference/supported-databases>
- Prisma 8 release status (RC) and v7 support path: <https://www.prisma.io/docs/orm>
- MUI stable-version status and its stated MD2 baseline: <https://mui.com/material-ui/getting-started/versions/> and <https://mui.com/material-ui/>

Exact package manifests/peer ranges remain the authoritative compatibility evidence at implementation lock time; the URLs above support the architectural decisions but do not waive that gate.
