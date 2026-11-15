# ORB product-readiness gap inventory

**Observed:** 2026-11-15
**Canonical baseline:** `origin/main` at `2a6278c`
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

## Slice selected for this run

Convert `/masters/coffee` into a truthful daily-use product register: user-entered records persist in the current browser, survive reload, can be searched/filtered, and can be deactivated/reactivated. The page must show loading, empty, invalid/corrupt-data, validation, and success states in English and Arabic, without substituting fixtures. It explicitly says that records are device-local and does not claim shared server persistence.

## Remaining after this slice

1. Real authenticated server sessions and sign-out.
2. Shared persisted customer and supplier directories, then contracts tied to those records.
3. One coherent server-backed dataset across projects, shipments, finance, reports, attachments, and settings.
4. Functional global project quick-find and honest shell actions.
5. Session-bound locale and role context with server-rendered RTL/LTR.
6. Owner-visible walkthrough and explicit Eslam approval; automated checks alone cannot mark ORB ready.
