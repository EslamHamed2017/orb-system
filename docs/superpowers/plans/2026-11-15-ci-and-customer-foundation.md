# CI Stabilization and Customer Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore trustworthy exact-head CI, then deliver the first tenant-aware PostgreSQL-backed Customer vertical slice.

**Architecture:** First remove the deterministic Node/Web-Locks hang and serialize workflow runs without cancelling evidence. Canonical main already has additive Tenant/Customer/CustomerAuditEvent models, a transactionally audited repository/service, and a UI with no browser fallback; extend that foundation with membership-derived request context and activate the fail-closed Customer routes only after trusted authentication exists.

**Tech Stack:** Next.js 16, React 19, TypeScript 7, PostgreSQL, Prisma 7, Node test runner, Playwright, Material UI 9.

**Spec:** `docs/superpowers/specs/2026-11-15-orb-accounting-trade-foundation-design.md`

## Global Constraints

- Canonical base is `origin/main`; work only in isolated worktrees.
- Business records must not use `localStorage`, fixtures, demo IDs, or caller-supplied tenant authority.
- English/LTR and Arabic/RTL desktop/mobile are mandatory.
- Every mutation is tenant-scoped, role-controlled, server-validated, optimistic-versioned, and atomically audited.
- No completion claim without a completed successful exact-head GitHub Actions run and independent technical plus product/UX review.
- Owner-ready remains false until Eslam approves the workflow.

---

### Task 1: Stabilize exact-head CI

**Files:**
- Modify: `tests/unit/masters/browser-product-storage.test.ts`
- Modify: `src/modules/masters/browser-product-storage.ts`
- Create: `tests/contract/ci-concurrency.test.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Preserve product-storage public API.
- Produce workflow concurrency group keyed by workflow and ref with `cancel-in-progress: false`.

- [ ] Add a regression assertion that a valid mutation completes after a duplicate-reference rejection; run it and observe the existing hang/failure.
- [ ] Wrap the Web Locks callback in an async boundary so synchronous domain exceptions release the lock.
- [ ] Run the focused product-storage suite and observe all tests finish.
- [ ] Add a failing CI concurrency assertion for non-cancelling per-ref serialization.
- [ ] Add workflow-level concurrency with `cancel-in-progress: false`.
- [ ] Run focused concurrency/topology tests, typecheck, complete offline suites, and schema baseline verification.
- [ ] Obtain independent technical and product/UX reviews; commit and push only if approved.
- [ ] Wait for and record a completed exact-head Actions result; cancelled/failed is not success.

### Task 2: Tenant and request context foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_tenant_membership_context/migration.sql`
- Create: `src/modules/tenancy/request-context.ts`
- Create: `src/modules/tenancy/membership-repository.ts`
- Create: `tests/integration/tenancy/request-context.test.ts`

**Interfaces:**
- Produce `RequestContext { tenantId, actorId, sessionId, locale, permissions }` only from validated server session and active membership.

- [ ] Write failing real-PostgreSQL tenant isolation and inactive-membership tests.
- [ ] Add Membership relations/constraints/indexes to the existing Tenant model, with migration/rollback coverage.
- [ ] Implement session-to-context resolution without trusting request tenant headers.
- [ ] Verify focused and regression suites; independently review and commit.

### Task 3: Complete the existing Customer persistence and audit service

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/modules/customers/customer-service.ts`
- Modify: `src/modules/customers/customer-repository.ts`
- Modify: `tests/integration/customers/customer-foundation.test.ts`

**Interfaces:**
- Produce list/get/create/update/archive/reactivate operations scoped by `RequestContext`.

- [ ] Write failing tests for tenant uniqueness, validation, permission denial, optimistic conflict, archive/reactivate, and atomic audit.
- [ ] Extend the existing Customer/CustomerAuditEvent schema for bilingual names, addresses, tax and payment terms without weakening tenant uniqueness or append-only audit.
- [ ] Extend the existing repository/service transaction flow for archive/reactivate and the added fields.
- [ ] Verify real-PostgreSQL, type, schema baseline, and regression suites; independently review and commit.

### Task 4: Customer API and bilingual workspace

**Files:**
- Modify: `src/app/api/customers/route.ts`
- Modify: `src/app/api/customers/[customerId]/route.ts`
- Modify: `src/ui/features/masters/CustomersPage.tsx`
- Modify: `src/app/customers/[customerId]/page.tsx`
- Confirm absent: `src/modules/masters/browser-customer-storage.ts`
- Test: `tests/acceptance/a14-customers.spec.ts`

**Interfaces:**
- API returns tenant-scoped validated records/problem details; UI never falls back to fixtures/browser business data.

- [ ] Write failing API tests for authentication, authorization, validation, conflict, and tenant isolation.
- [ ] Connect handlers to trusted request context and Customer service.
- [ ] Write failing browser tests for create/reload/view/edit/archive/reactivate and second-context visibility.
- [ ] Implement responsive English/Arabic workspace with full states and server-enforced action shaping.
- [ ] Capture desktop/mobile English/Arabic screenshots from the exercised build.
- [ ] Run all focused/regression/build/browser checks and independent technical plus product/UX reviews.
- [ ] Commit, push, and require a completed successful exact-head Actions run.
