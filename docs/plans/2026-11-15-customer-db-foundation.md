# Customer DB foundation implementation plan

**Baseline:** `origin/main` `713815995aba170e7bb29b8da8ca9949d15fa73f`  
**Scope:** first truthful, tenant-aware customer persistence seam; no production-route activation without real authentication and tenant membership.

## Integrity decisions

1. Add new `Tenant`, `Customer`, and `CustomerAuditEvent` models rather than reinterpret the existing global `Party` rows. This is additive and does not assign legacy records to invented tenants.
2. Enforce `(tenant_id, reference)` uniqueness and include `tenant_id` in every repository selector. Tenant identity comes only from the authenticated service principal, never request payloads.
3. Create/update and audit insertion occur in one database transaction. Audit rows are append-only through a database trigger and application-role revocation.
4. Use optimistic `version` checks for updates. The database constrains valid status/version/contact shape in addition to strict server validation.
5. Permit reads to `OWNER_ADMIN`, `OPERATIONS`, and `FINANCE_VIEWER`; permit mutations only to `OWNER_ADMIN` and `OPERATIONS`.
6. Keep current route exports fail-closed. Production auth currently returns no principal and no durable tenant membership source exists.

## TDD sequence

1. Add failing schema/migration contract tests for tenant ownership, scoped uniqueness, timestamps, constraints, and append-only audit.
2. Add failing service/repository tests for strict validation, role denial, tenant isolation, duplicate references, atomic audit, and stale versions.
3. Add the additive Prisma models and hand-reviewed PostgreSQL migration.
4. Implement customer domain validation, service, and Prisma repository seam.
5. Run focused tests, Prisma formatting/validation, full typecheck, and inspect the final diff/status.

## Explicit non-goals / follow-up

- No fake session, tenant header, local-storage fallback, fixture migration, or route activation.
- No destructive conversion of `Party` data. A future migration needs an approved tenant mapping and compatibility plan.
- No UI integration until production authentication can supply a server-verified actor and tenant.
