# ORB UI and Workflow Standard

**Status:** Owner-approved, 2026-11-21. Every agent (Claude, Hermes, others) follows this file for any ORB change.
**Owner:** Eslam El Berkawy.

## 1. What ORB is

- ORB works like QuickBooks Online, with an operational focus: sales, purchases, expenses, projects and shipments.
- It is not heavy accounting. There is no general ledger and no journal entries.
- Its purpose is to make daily operations easy and to explain every event clearly to the finance team.
  - Every event shows what happened, with whom, how much, and which document backs it.
- There are no approval workflows. A saved transaction is final, but it can still be edited later. Every edit is audited.

## 1b. Delivery scope decisions (2026-11-21)

- **Company:** a single company.
- **Out of scope for now:**
  - UAE e-invoicing integration. ORB invoices stay printable PDFs.
  - Finance period export file.
  - Sending email, including invoices, statements and reminders.
  - General ledger.
  - Recurring transactions.
  - Paid tools.
- **In scope for delivery:**
  - The QuickBooks gaps below.
  - Full packing list.
  - Import of opening data: customers, suppliers, products, open projects and open invoices.
  - Credit notes and returns.
  - A VAT summary.
  - Decimal money and the transaction-date FX rate.
  - Close the books with a warning only.
  - A Reports only role.
  - Staging environment, error monitoring, a tested restore and a security review.
  - A user guide, a Hermes runbook and a training session.

## 2. Look and feel

- **UI library:** Ant Design 6 (MIT), with `@ant-design/icons` and `@ant-design/nextjs-registry`.
- **Free tools only.** Never add a paid component, a paid licence or a trial. Anything missing is built in-house on top of Ant Design.
  - Allowed free additions: Ant Design Charts (MIT), Motion (MIT), decimal.js (MIT), ExcelJS (MIT), WebDataRocks (free), Univer (Apache-2.0).
- **Density:** accounting-dense. Use the compact algorithm by default, with a per-user switch between compact and normal.
- **Modern feel:**
  - Charts on Home, the project and the customer/supplier pages.
  - Subtle, fast motion: number count-up, skeleton loading, smooth drawers and page transitions, save feedback.
  - Dark mode.
  - A Ctrl+K command/search palette.
  - Illustrated empty states.
- **Language:** Arabic and English, with full RTL.
  - Fonts: Inter for English, IBM Plex Sans Arabic for Arabic.
- **Colour:** ORB teal primary `#0b6e69`. Calm neutrals.
- **Mobile:** tables become cards, filters collapse into one Filters button, forms are single-column.

## 3. Tables (every list in ORB)

Every table uses the shared ORB table component. It provides:

1. A filter in each column header (search, date range, amount range, pick-list).
2. Quick filters above the table. Active filters show as removable chips, with a "Clear filters" link.
3. Sort on any column header.
4. A gear menu for columns:
   - Show/hide and reorder columns.
   - Choose density.
   - Settings are saved per user, per table.
5. A global search box.
6. Group by customer, project or status, with a subtotal for each group.
7. A totals row for the filtered rows.
8. Excel export of exactly what is shown.
9. Row selection with batch actions such as print and export.
10. Clicking a row opens the transaction.
11. An Action column with the next step: Receive payment, Print, and a menu with Copy, Void and Audit history.
12. A Money Bar (open, overdue, paid in the last 30 days) where a list needs it. Clicking a segment filters the table.

## 4. Transactions

- Every transaction opens full-screen, with Save and new / Save and close.
- Project is a field on the transaction, not a place you have to enter first.
- Lines are editable in-grid.
  - Add from shipment where relevant.
  - Attachments by drag and drop.
  - Pre-fill from the last transaction for the same party.
- Any saved transaction can be opened and edited, including contracts.
  - Every edit is audited, showing who changed it, when, and the values before and after.
- Void keeps the number. Delete is audited.
- Warn on duplicate numbers, especially the same supplier invoice number from the same supplier.
- Exchange rates are fixed at the transaction date.
- Money is calculated with decimal arithmetic, never floating point.
- Statements of account offer three types (Transaction, Open items, Balance forward), filters, and Excel and PDF output.

## 5. Workflow (how agents work on ORB)

1. **Plan first.**
   - Propose options for the owner to confirm before building.
   - Flag foundational changes, such as a new library, data model or navigation change, before starting them.
2. **One change per branch, one PR per change.** Never push to `main`.
3. **Merge only when the owner says so explicitly.**
4. **Test like a user, not only for correctness.**
   - Walk the flow on desktop (1440px) and mobile (390px), in English and Arabic.
5. **Before asking to merge, send:**
   - Screenshots (desktop and mobile).
   - A short comparison with QuickBooks Online.
   - CI green.
6. **Never commit:** `test-results/`, `playwright-report/`, `*.tsbuildinfo`, `.env*`. Check `git status` before every commit.
7. **Iterate.** Fix in small corrections. Do not rebuild from scratch.
8. **When the owner is mid-explanation, wait.**
9. **Hermes** handles deployments after a merge.

## 6. QuickBooks gap checklist (biggest first)

Keep this list current. When a PR closes a gap, set its status to `Closed` and add the PR number.

| # | Area | QuickBooks Online | ORB today | Gap | Status | PR |
|---|---|---|---|---|---|---|
| 1 | Transaction form | Full-screen form for each type | Forms sit inside data screens | Big | Open | |
| 2 | Project on transactions | Project is a field on the form | You must enter the project first | Big | Open | |
| 3 | Edit after save | Any transaction can be edited; More menu has Void, Copy and Audit history | Contracts cannot be edited; other types are limited | Big | Open | |
| 4 | Lists and tables | New button, column filters, row opens the transaction, Action column | Money bar and Action column exist; no New button, no column filters, rows do not open | Medium | Open | |
| 5 | Density and mobile | Dense layout, plus a mobile app | Large spacing; mobile layout problems | Medium | Open | |
| 6 | Customer and supplier page | Balance, New transaction, tabs, statement types | Transactions and a statement; no New transaction | Medium | Open | |
| 7 | Reports | Customize, save, schedule, drill-down, compare periods | Periods and Excel export; no saved reports, no drill-down | Medium | Open | |
| 8 | Close the books | Closing date | Missing | Medium | Open | |
| 9 | Receive payment | Open-invoices grid plus credits | Mostly there | Small | Open | |
| 10 | Projects | Status, 4 tabs, project reports | Same idea, plus shipments | Small | Open | |
| 11 | Attachments | On the transaction, an attachments list, create a transaction from a file | List and links; cannot create a transaction from a file | Small | Open | |
| 12 | Audit log | Filters, plus before and after values | Filters only; no before and after values | Small | Open | |
| 13 | Roles | Reports only, A/R manager, A/P manager | No Reports only role | Small | Open | |

**ORB-specific requirements (not in QuickBooks), Open:**
- **Packing list for every shipment (sales and supplier), printable and exportable.**
  - Per-line columns: product, packages and package type, quantity, net, gross and tare weight, dimensions or CBM, and marks and numbers.
  - Header: container number, seal number, vessel or voyage, ports, and B/L number.
  - Totals at the foot.
  - Opens from the shipment page.
  - Arabic and English side by side.
  - Uses the same document settings as invoices.
  - Today's version covers bags and weights for a single shipment only.

**Small details, all Open:**
- Pre-fill from the last transaction.
- Duplicate supplier-invoice warning.
- Copy a transaction.
- Void that keeps the number.
- Credits applied automatically.
- Statements that refresh live.
- Recurring transactions (scheduled, reminder, unscheduled).
- Keyboard shortcuts.
- Global search with recent transactions.
- Custom fields shown in reports.
