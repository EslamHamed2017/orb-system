# QuickBooks-Style Project Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reorganize ORB's Project workspace around a QuickBooks-style overview, unified transactions, shipments, documents, reports and activity flow, using the approved Commercial Invoice terminology.

**Architecture:** Preserve existing internal invoice APIs and routes for compatibility. Add focused project transaction data/view helpers, expose new project routes for Transactions and Documents, then reshape project navigation, overview, invoice copy and profitability copy around those interfaces.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-13-quickbooks-project-workspace-design.md`

## Global Constraints

- Project primary navigation order is exactly: Overview, Transactions, Shipments, Documents, Project Reports, Activity.
- Customer invoice user-facing name is Customer Commercial Invoice; supplier invoice user-facing name is Supplier Commercial Invoice.
- Internal domain and route names remain backward-compatible.
- Amounts stay partitioned by source currency; no implicit currency merge.
- Cancelled and reversed records are excluded from active transaction views.
- Existing RBAC, audit, approval, immutable evidence and reversal behavior is preserved.
- English and Arabic copy are both required.

---

### Task 1: Project navigation and unified transaction register

**Files:**
- Modify: `src/ui/navigation/project-context-links.ts`
- Create: `src/ui/features/projects/project-transactions.ts`
- Create: `src/ui/features/projects/ProjectTransactionsPage.tsx`
- Create: `src/app/projects/[id]/transactions/page.tsx`
- Modify: `src/ui/features/projects/Projects.module.css`
- Test: `tests/unit/ui/project-transactions.test.ts`

**Interfaces:**
- Produces `ProjectTransaction`, `filterProjectTransactions`, `summarizeProjectTransactions`, and the `/projects/:id/transactions` page.
- `filterProjectTransactions(rows, filters)` excludes CANCELLED/REVERSED, scopes to one nonblank project, filters type/status/query, then sorts newest first.
- `summarizeProjectTransactions(rows)` returns independent currency totals for invoiced sales, supplier costs, expenses, collected, paid and outstanding.

- [x] Write failing tests for the six-link navigation order, project scoping, inactive exclusion, filtering, sorting and currency-partitioned totals.
- [x] Run `corepack pnpm test -- tests/unit/ui/project-transactions.test.ts` and confirm expected failures.
- [x] Implement the helper, page, route and CSS.
- [x] Re-run the focused test and confirm it passes.

### Task 2: Commercial Invoice terminology and project Documents route

**Files:**
- Modify: `src/platform/i18n/domain-terminology.ts`
- Modify: `src/modules/invoices/sales-invoice-service.ts`
- Modify: `src/ui/features/accounts/InvoicePrintDocument.tsx`
- Modify: `src/ui/features/accounts/ProjectSalesInvoicesPage.tsx`
- Modify: `src/ui/features/accounts/ProjectSupplierInvoicesPage.tsx`
- Modify: `src/ui/features/accounts/AccountsHubPage.tsx`
- Modify: `src/ui/features/accounts/accounts-hub.ts`
- Modify: `src/ui/features/evidence/AttachmentsIndexPage.tsx`
- Modify: `src/ui/features/invoices/SupplierInvoicePanel.tsx`
- Modify: `src/ui/features/invoices/SupplierShipmentInvoicePaymentPanel.tsx`
- Create: `src/app/projects/[id]/documents/page.tsx`
- Test: `tests/unit/ui/commercial-invoice-terminology.test.ts`

**Interfaces:**
- User-facing English names are exactly `Customer Commercial Invoice` and `Supplier Commercial Invoice`; Arabic names are `الفاتورة التجارية للعميل` and `الفاتورة التجارية للمورد`.
- Existing route URLs and internal subject types remain unchanged.

- [x] Write a failing source-level terminology and documents-route test.
- [x] Run the focused test and confirm expected failures.
- [x] Replace user-facing copy without renaming internal types/routes; add project Documents wrapper with project navigation and enforced project filter.
- [x] Re-run the focused test and confirm it passes.

### Task 3: QuickBooks-style overview and project report presentation

**Files:**
- Modify: `src/app/projects/[id]/overview/page.tsx`
- Modify: `src/ui/features/projects/ProjectOverviewSummary.tsx`
- Modify: `src/ui/features/profit/ProfitCards.tsx`
- Modify: `src/ui/features/reports/ProjectProfitabilityReportPage.tsx`
- Modify: `src/ui/features/projects/Projects.module.css`
- Test: `tests/unit/ui/project-workspace-overview.test.ts`

**Interfaces:**
- Overview displays project header/status, `Add to project`, six primary tabs, per-currency operating KPIs, recent transaction access, shipment/document health and blockers.
- Profit copy uses Customer/Supplier Commercial Invoice formulas and source links.

- [x] Write failing tests for required overview actions/KPIs and approved formula terminology.
- [x] Run the focused test and confirm expected failures.
- [x] Implement the overview and report copy/layout using existing authoritative overview fields.
- [x] Re-run the focused test and confirm it passes.

### Task 4: Regression, build and live visual verification

**Files:**
- Modify only files required by defects discovered during verification.

- [x] Run `corepack pnpm test`.
- [x] Run `corepack pnpm typecheck`.
- [x] Run `corepack pnpm build`.
- [x] Restart `orb-local` with PM2 and save the process state.
- [x] Verify `/projects/demo/overview`, `/projects/demo/transactions`, `/projects/demo/documents`, customer commercial invoices, supplier commercial invoices and project reports in English and Arabic using browser automation.
- [x] Check browser console errors and horizontal overflow at desktop and mobile widths.

## Verification Record

Completed 2026-11-13. Full Node test suite: 602 passed, 0 failed. TypeScript and Next.js production build passed. PM2 `orb-local` restarted on port 44344. Playwright verified six English/Arabic routes at desktop and mobile sizes with HTTP 200, no console errors, and no page-level overflow; a mobile min-content clipping defect was found during visual review and fixed before acceptance.
