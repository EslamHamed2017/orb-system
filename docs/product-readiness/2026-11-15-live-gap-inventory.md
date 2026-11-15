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
- **Customers after this slice:** the directory starts empty, persists entered bilingual customer/contact data, reloads and synchronizes it across tabs, supports search/edit/archive/reactivate, preserves permission-role query context, fails closed on corrupt/unavailable storage, and never substitutes fixtures. EN/LTR and AR/RTL desktop/mobile captures have zero horizontal overflow; mobile content ends at the navigation boundary.
- **Roles:** users can configure browser-local roles, but the page explicitly states they are not assigned to users and do not enforce access to server data.
- **Backup:** project export/restore is usable for browser-saved projects, but the file is unencrypted, access is not role-enforced on this evaluation page, and it excludes customer, supplier, product, and finance browser stores.
- **Runtime:** `/api/health/live` returned 200. `/api/health/ready` returned 503 because database, object storage, and audit-chain checks were down.

## Remaining visible readiness gaps, in priority order

1. **One coherent project lifecycle is still missing.** Customers, suppliers, contracts, shipments, invoices/payments, expenses, claims, and closure/reopen are not one persisted end-to-end project flow.
2. **Browser-local data is fragmented.** Projects, products, customers, suppliers, and finance records do not share a durable data plane or a complete backup/restore boundary.
3. **Persisted parties are not connected to projects or 360 detail.** Newly entered customers and suppliers cannot yet be selected as project parties and opened into a real persisted lifecycle view.
4. **Approvals are preview-only.** The safe bilingual presentation does not compensate for the disconnected service, fixed metadata, unavailable attachments, or absent decisions.
5. **Administration is evaluation-only.** Browser roles are not enforced against real users/server data; project backup is not a complete or encrypted recovery mechanism.
6. **Operational dependencies are unavailable.** Database, object storage, and audit-chain readiness are down in the tested build.
7. **Owner acceptance is absent.** Eslam has not reviewed or approved this customer flow; screenshots and automated checks are evidence for review, not approval.

## Slice delivered in this run

The customer directory was the smallest unowned visible gap on current main: it showed three fixed customers and a form whose submit had no behavior. This slice replaces that presentation with a truthful browser-persisted customer workspace and complete create/correct/archive/reactivate loop. It does **not** claim server persistence, multi-user sharing, project integration, backup coverage, or production readiness.
