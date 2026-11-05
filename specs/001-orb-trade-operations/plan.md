# Implementation Plan: ORB Trade Operations Core

**Branch**: `001-orb-trade-operations` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Clarified feature specification at `specs/001-orb-trade-operations/spec.md`

## Summary

Release 1 delivers Core Trade as a standalone bilingual modular monolith: one Project per independent sales contract, versioned sales/purchase contracts, partial shipments and supplier-source allocations, controlled commercial documents, advances and allocations, expenses, claims, approvals, operational profitability, independent financial/final closure, and immutable audit history. One Next.js application owns UI, server-side use cases, and APIs; PostgreSQL is the transactional authority and S3-compatible object storage holds immutable document bytes. Bank matching, tax packs, and historical migration are extension modules reserved in identifiers/evidence abstractions but are not Release 1 deliverables.

## Technical Context

**Language/Version**: Node.js 26 LTS; TypeScript 7, subject to the compatibility gate below  
**Primary Dependencies**: Next.js 16.4/React 19.3; Prisma 7.10.1 (exact pin, no Prisma 8 RC); Zod 4.6; MUI 9.5 accessible primitives behind an ORB Material Design 3 conformance layer; TanStack Table 9.3; Better Auth 1.7  
**Storage**: PostgreSQL 18 for transactional and audit metadata; S3-compatible versioned, retention-locked storage for immutable file objects  
**Testing**: Vitest 5.1 for unit/component/contract tests; Playwright 1.65 for bilingual workflow and accessibility acceptance  
**Target Platform**: Linux containers deployed with Docker behind existing Traefik; evergreen desktop browsers, responsive review/light-action support  
**Project Type**: Server-rendered web application and JSON API, packaged as a modular monolith  
**Performance Goals**: p95 interactive reads <=500 ms and mutations <=800 ms at 50 concurrent sessions; dense tables render/filter 10,000 records through server pagination with <=1 s p95 response; generated document request accepted <=2 s and completed <=30 s; no oversubscription or lost update under 100 simultaneous conflicting mutation attempts  
**Constraints**: WCAG 2.2 AA; equal Arabic RTL/English LTR journeys; exact decimal arithmetic; optimistic concurrency; immutable approved evidence and audit chain; TLS; least privilege; RPO <=15 minutes and RTO <=4 hours; quarterly restore proof and pre-production restore acceptance  
**Scale/Scope**: Initial ORB deployment, <=50 named users/50 concurrent sessions, <=100,000 projects, <=1 million transactional rows, <=2 million document revisions; three Release 1 routes and AED/USD/SAR initially

### Compatibility Gate

Before dependency installation, verify the exact TypeScript 7 release is supported by Next.js 16.4, Prisma 7.10.1, Zod 4.6, MUI 9.5, Better Auth 1.7, Vitest 5.1, and Playwright 1.65. If any package's published peer/runtime range excludes TypeScript 7, the Plan Gate is **BLOCKED** until an approved compatible TypeScript version is substituted in the spec/plan or the dependency publishes support. No `--force`, peer-dependency bypass, or Prisma 8 RC is permitted.

## Constitution Check

*GATE: evaluated before Phase 0 and re-checked after Phase 1.*

| Gate | Pre-research | Post-design evidence |
|---|---|---|
| Spec Kit sequence | PASS | Phase 0/1 only; no tasks or implementation created |
| Focused trade operations, no ERP | PASS | Core Trade boundaries and operational money model; no ledger/accounting concepts |
| MD3 + ORB identity | PASS WITH COMPATIBILITY CONTROL | UI contract requires ORB MD3 conformance over MUI primitives; Arabic RTL and English LTR parity |
| Evidence integrity/traceability | PASS | Immutable object versions, SHA-256 identity, idempotency keys, revisions, audit hash chain |
| Acceptance/test first | PASS | OpenAPI and UI/state contracts map validation scenarios; quickstart is an acceptance guide |
| Review-first external delivery | PASS | Release 1 external-output approval and exact-version controls are explicit; deferred tax delivery remains isolated |
| Product/security constraints | PASS | Least privilege, encryption, backup/restore, incident/audit controls and deferred integrations documented |
| Required plan artifacts | PASS | Data model, API/UI/state/security decisions and acceptance validation are present |

**Post-design gate result**: **CONDITIONAL PASS**. No constitutional violation was found. Task generation remains blocked on the independent Plan Gate and the exact TypeScript 7 dependency compatibility check above. This is an honest implementation-readiness condition, not permission to weaken dependency checks.

## Project Structure

### Documentation (this feature)

```text
specs/001-orb-trade-operations/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.yaml
│   ├── ui-workflows.md
│   └── problem-details.md
└── tasks.md                 # future Phase 2; deliberately absent
```

### Planned source code (not created by this workflow)

```text
src/
├── app/                     # Next.js routes, layouts, API adapters
├── modules/
│   ├── identity-access/
│   ├── parties/
│   ├── projects-contracts/
│   ├── shipments/
│   ├── documents-evidence/
│   ├── money-expenses/
│   ├── claims-approvals/
│   ├── profitability-closure/
│   └── audit/
├── platform/                # database, object store, auth, telemetry, i18n
└── ui/                      # ORB MD3 tokens/primitives/patterns

tests/
├── contract/
├── integration/
├── unit/
└── acceptance/
```

**Structure Decision**: One deployable Next.js modular monolith with explicit module boundaries and a single PostgreSQL transaction boundary. Internal modules communicate through typed application services/events in-process; no networked microservices, separate repositories, or distributed transactions. Deferred bank, tax, and migration capabilities attach later through stable Party, MoneyMovement, EvidenceObject, Approval, and AuditEvent identities.

## Complexity Tracking

No constitution violations require justification. Object storage is a second persistence technology, not a service split: it is required for immutable large-file bytes while PostgreSQL retains authoritative metadata, hashes, links, and audit evidence.
