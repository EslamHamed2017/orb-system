# ORB live product-readiness gap inventory — 2026-11-15

This inventory is based on the running canonical UI at `http://127.0.0.1:40637` after a production build, not task counts. Machine-readable observations are in [`../../artifacts/product-review/customer-registration-20261115/live-audit.json`](../../artifacts/product-review/customer-registration-20261115/live-audit.json). The audit used a 390×844 viewport, cleared browser storage, waited for client state to settle, and inspected visible copy/actions and page geometry.

## Live behavior now verified

- **Today (`/`)**: an empty register shows one contextual action, **Create project**, and states that ORB will not insert sample data. It has no generic warning wall, no raw technical enum/hash, zero horizontal overflow, and the content boundary meets rather than sits under the bottom navigation.
- **Projects (`/projects`)**: the empty state identifies browser-only persistence, offers **New project/Create project**, shows no fixed project rows, has zero horizontal overflow, and ends above the mobile navigation.
- **Finance (`/accounts`, `/accounts/collections`)**: the hub is split into focused task routes. Empty states contain no placeholder amounts, no DEMO label, and direct the user to create/select a project. Records are explicitly described as browser-local and unsynchronized.
- **Arabic approvals (`/approvals?locale=ar`)**: business Arabic is visible by default. `EXTERNAL_SEND`, `OUTBOUND_MANIFEST`, raw 64-character hashes, and test email addresses are not visible until the technical disclosure is intentionally opened. The page truthfully says the approval service is disconnected and offers no decision button.
- **Customer registration (`/masters/customers`)**: before this slice, the running directory always showed three fixed fixture customers and the save form had no submit behavior. It now starts with a truthful empty/loading/error state, explicitly discloses browser-local scope, saves validated bilingual customer/contact data, reloads it from browser storage, supports existing search/status filters, and never substitutes fixture rows after corrupt storage.

## Remaining visible readiness gaps

1. **Supplier masters remain fixture-driven**: `/masters/suppliers` visibly shows three fixed suppliers and counts (3 total, 6 linked projects, 3 open invoices); its registration form is not a proven persisted daily flow. This is the closest follow-on slice.
2. **Persisted customer records are not yet connected to Customer 360**: `/customers/customer-northstar` remains a labelled evaluation fixture route; newly saved browser customers are useful in the directory but do not yet open a persisted detail/lifecycle page.
3. **Browser-local data is fragmented**: project backup explicitly covers projects, while products, customers, and finance pages disclose separate browser-only storage. A unified, usable data boundary/backup remains unresolved.
4. **Approvals remain preview-only**: copy is safer and bilingual, but the live approval service is disconnected, attachments are unavailable, and no real decision can be taken.
5. **No owner acceptance yet**: responsive geometry and automated checks do not replace visual judgment of information hierarchy, copy, or daily workflow.

## Historical-note access

The required starting note, `/home/hermesops/obsidian-vault/Home.md`, was requested on 2026-11-15 but the OS returned `PermissionError: [Errno 13] Permission denied`. No historical vault content was inferred or used. All statements above are live verification from this worktree.
