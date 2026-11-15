# ORB live product-readiness gap inventory — 2026-11-15

**Status: not ready.** Eslam’s owner feedback is authoritative. Passing tests, green CI, completed task counts, and this slice do not establish product success or readiness.

## Evidence basis

The existing inventory on canonical `origin/main` was reviewed before selecting this slice. It was then refreshed from the production build of `f554356a09308b37ba2e491ea2e7ec136019365b` at `http://127.0.0.1:40655`, using a clean browser profile at 390×844 on 2026-11-15. The audit inspected visible copy, actions, direction, overflow, and bottom-navigation geometry for Today, Projects, Finance, Arabic Approvals, Products, Suppliers, Customers, Roles, and Project Backup. Machine-readable observations are in [`../../artifacts/product-review/customer-workspace-20261115/live-gap-audit.json`](../../artifacts/product-review/customer-workspace-20261115/live-gap-audit.json).

The shared Obsidian vault entry point `/home/hermesops/obsidian-vault/Home.md` could not be read because the operating system returned `PermissionError: [Errno 13] Permission denied`; no historical vault claims were inferred.

## Current live behavior

- **Today:** with clean storage, the page shows one contextual empty-state action, **Create project**, rather than a warning wall. It has no horizontal overflow and meets the mobile navigation boundary. A real multi-project daily queue still needs owner use and approval.
- **Projects:** the empty list is browser-persisted, fixture-free, actionable, and does not overlap mobile navigation. Project data is not connected to the customer and supplier browser directories.
- **Finance:** the hub now directs users to focused project tasks and shows no placeholder amounts or DEMO label. Its records remain browser-local, unsynchronized, and split across separate stores.
- **Arabic approvals:** business Arabic is visible; raw enums and hashes are not visible before opening technical details. The route is still a disconnected preview with fixed request metadata, unavailable attachments, and no decision action.
- **Products and suppliers:** both start empty, accept user-entered browser data, disclose local-only storage, and show no fixture rows.
- **Customers after the database-foundation correction:** the directory reads only from `/api/customers` and posts strict customer payloads there. It never reads or writes browser storage, never derives tenant/role identity in the client, and never substitutes fixtures. Because no trustworthy server session/tenant derivation is wired yet, the production route returns authentication-required and the bilingual UI fails closed with creation disabled. The screenshots under `artifacts/product-review/customer-workspace-20261115/` predate this correction and are historical browser-storage evidence, not current database-readiness proof.
- **Roles:** users can configure browser-local roles, but the page explicitly states they are not assigned to users and do not enforce access to server data.
- **Backup:** project export/restore is usable for browser-saved projects, but the file is unencrypted, access is not role-enforced on this evaluation page, and it excludes customer, supplier, product, and finance browser stores.
- **Runtime:** `/api/health/live` returned 200. `/api/health/ready` returned 503 because database, object storage, and audit-chain checks were down.

## Remaining visible readiness gaps, in priority order

1. **One coherent project lifecycle is still missing.** Customers, suppliers, contracts, shipments, invoices/payments, expenses, claims, and closure/reopen are not one persisted end-to-end project flow.
2. **Data planes remain fragmented.** Projects, products, suppliers, and finance records remain browser-local; Customers has a server-only UI seam but cannot load or save until trustworthy session/tenant derivation is integrated.
3. **Persisted parties are not connected to projects or 360 detail.** The Customer database foundation is not exposed to production users without trustworthy authentication, and customers/suppliers cannot yet be selected as project parties and opened into a real persisted lifecycle view.
4. **Approvals are preview-only.** The safe bilingual presentation does not compensate for the disconnected service, fixed metadata, unavailable attachments, or absent decisions.
5. **Administration is evaluation-only.** Browser roles are not enforced against real users/server data; project backup is not a complete or encrypted recovery mechanism.
6. **Operational dependencies are unavailable.** Database, object storage, and audit-chain readiness are down in the tested build.
7. **Owner acceptance is absent.** Eslam has not reviewed or approved this customer flow; screenshots and automated checks are evidence for review, not approval.

## Slice delivered in this run

The merged browser-only Customer workspace was removed. The current Customer directory is a server-only seam over `/api/customers`: it validates list/create response shapes, sends no client-supplied tenant or role identity, and shows explicit bilingual loading, empty, authentication, authorization, and server-failure states. It does **not** claim that Customer persistence is currently user-accessible: production remains intentionally fail-closed until a trustworthy server session can derive tenant and authorization context. Historical screenshots from the prior browser-storage slice are retained only as superseded review evidence and must not be cited as database readiness.
