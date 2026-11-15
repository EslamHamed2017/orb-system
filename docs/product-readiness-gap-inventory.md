# ORB product-readiness gap inventory

**Observed:** 2026-11-15
**Canonical baseline for this increment:** `origin/main` at `713815995aba170e7bb29b8da8ca9949d15fa73f`
**Readiness:** **Not ready for owner acceptance.** Passing tests and merged task branches do not override Eslam’s product assessment.

This inventory is based on browser routes, rendered behavior, and their actual data paths—not `tasks.md` completion counts.

## Gaps observed on the canonical product

| Priority | Visible gap | Route / source evidence | Daily-use impact |
| --- | --- | --- | --- |
| P0 | No real production sign-in/session path | `/api/sessions` accepts local test auth only; several browser API exports use an authenticator that returns no user (`src/app/api/sessions/route.ts`, `src/app/api/projects/route.ts`) | A real user cannot reliably enter or leave the product. |
| P1 | Business data is fragmented between browser records and fixed presentation | Projects/Today read browser storage; customers, suppliers, reports, attachments, and settings still render fixed records (`ProjectsRegister.tsx`, `customer-fixtures.ts`, `supplier-fixtures.ts`, `AccountsOperationalReportPage.tsx`, `AttachmentsIndexPage.tsx`) | Screens do not represent one trustworthy operating dataset. |
| P1 | Customer and supplier forms are visibly inert | `/customers` and `/suppliers` forms have no submit operation; their canonical APIs cannot authenticate (`CustomersPage.tsx`, `SuppliersPage.tsx`, `src/app/api/customers/route.ts`) | Users can fill credible forms and receive no saved result. |
| P1 | Persistent shell controls over-promise | Search, help, notifications, account, and sign-out controls lack a complete action path (`AppNavigation.tsx`, `/api/sessions/current`) | Frequent navigation controls lead nowhere or fail. |
| P1 | Product master was fixed sample data with an inert save form | `/masters/coffee` used embedded `PROD-001…003` rows and no submit handler (`ProductsMasterPage.tsx` before this slice) | Products could not be registered, retained, or managed. |
| P2 | Locale and role affordances are URL-controlled | Shell behavior reads `locale`/`role` query parameters and initially emits an English/LTR root (`AppNavigation.tsx`, `layout.tsx`) | Arabic and permission affordances can disagree with session context. |


## Customer persistence foundation — truthful gap map (2026-11-15)

The customer API surface is not production-connected. `src/app/api/customers/route.ts` and its record route deliberately authenticate every request as `null`; the rendered directory still uses fixtures. The existing `Party` model is global, uses a globally unique reference, lacks the new customer contact and timestamp contract, and is already referenced by projects, contracts, shipments, claims, and invoices. The new tenant-owned `Customer` model is therefore a persistence foundation, not yet the canonical counterparty model.

This increment **does not claim a live customer workflow**. It adds the first safe server seam only:

- additive Prisma/PostgreSQL definitions for tenant-owned customers, tenant-scoped references, contacts, lifecycle status, optimistic versions, and timestamps;
- append-only, tenant-scoped audit events written atomically with mutations;
- strict server validation, tenant-scoped repository access, and role-controlled service operations;
- no fixture, `localStorage`, demo, or caller-supplied identity fallback. Customer routes remain fail-closed.

Authentication is not the sole blocker. The remaining work must be explicitly sequenced:

1. **Reconcile the Customer-versus-Party contract.** Decide and document whether `Customer` replaces `Party`, extends it, or maps one-to-one to it; define canonical identifiers, tenant ownership, supplier overlap, lifecycle rules, and audit responsibility before either model is treated as authoritative.
2. **Define legacy and fixture mapping.** Inventory existing `Party` rows and UI fixtures, establish deterministic tenant/customer mappings and reconciliation reports, and quarantine ambiguous records rather than silently assigning them.
3. **Migrate downstream linkage.** Move or bridge project, contract, shipment, claim, invoice, reporting, and attachment references to the reconciled canonical customer identity, with compatibility and rollback rules.
4. **Replace UI and API data paths.** Wire the customer pages and route handlers to the service/repository, remove fixture reads, and preserve loading, empty, validation, conflict, and unavailable states. This step must not introduce browser persistence or weaken fail-closed authentication.
5. **Connect authentication and tenant membership.** Derive actor, tenant, and permissions from a real server session plus durable membership/authorization data; never trust tenant or actor headers supplied by callers. Routes may become available only after this gate is enforced.
6. **Complete PostgreSQL acceptance.** On an isolated PostgreSQL database, deploy the full migration history and exercise tenant isolation, optimistic update races, uniqueness, constraints, transactional audit writes, and legacy reconciliation. `ORB_TEST_DATABASE_URL` was not available for this increment, so no PostgreSQL migration or acceptance execution is claimed.

## Remaining product-readiness gaps

1. Complete the six customer/counterparty gates above; the persistence model alone is not owner-ready.
2. Deliver real authenticated server sessions and sign-out across the product.
3. Establish one coherent server-backed dataset across suppliers, products, projects, shipments, finance, reports, attachments, and settings.
4. Make global project quick-find and shell actions functional and honest.
5. Bind locale and role context to the server session with server-rendered RTL/LTR.
6. Perform an owner-visible walkthrough and obtain explicit Eslam approval; automated checks alone cannot mark ORB ready.
