# ORB live product-readiness gap inventory — 2026-11-15

**Status:** Not ready. Eslam’s owner feedback is authoritative; passing tests and completed task counts do not establish product success. This inventory reflects direct route/UI behavior on canonical `origin/main` at `789ca51`, reviewed on 2026-11-15.

## Live gaps observed

- **Runtime readiness:** `/api/health/live` responds, while `/api/health/ready` returns 503 because database, object storage, and audit-chain dependencies are unavailable.
- **Disconnected data planes:** Today, Projects, Products, and Shipments use browser storage; customer, supplier, admin, attachment, approval, and project-detail surfaces still include fixtures or preview-only data; authenticated APIs return 401. Changes do not reliably propagate across workspaces.
- **Today:** warning-heavy presentation remains broader than a focused daily action queue. Another active worktree owns this surface.
- **Projects:** browser-saved project rows coexist with hard-coded detail records; mobile overlap work is active elsewhere.
- **Lifecycle:** customer, contract, shipment, invoice/payment, expense, claim, and closure/reopen steps are not yet one persisted end-to-end project flow.
- **Finance:** the dense fixed/demo presentation still requires task-oriented persisted pages; work is active elsewhere.
- **Approvals and evidence:** preview-only behavior, technical enums, hashes, and fixed metadata remain visible; business Arabic and explicit technical-details disclosure are incomplete.
- **Attachments:** index/detail fixture identity can disagree and download requires unavailable authentication.
- **Administration:** roles and backup/restore routes exist, but live service connectivity and owner-usable recovery proof are incomplete.
- **Shell:** global search, help, notifications, account controls, and several navigation destinations appear interactive without complete behavior.

## Slice selected for this run

The supplier directory was the smallest non-overlapping daily-use flow: canonical main showed three fixed suppliers and a registration form with no save behavior. This run replaces that directory presentation with honest browser-persisted user entry, create/search/edit/archive/reactivate, localized empty/loading/error feedback, cross-tab refresh, and direct navigation. Supplier data is explicitly labelled as device-local and is **not** represented as integrated with projects, contracts, finance, other users, or server backup.

## Readiness rule

This slice remains awaiting Eslam’s visual approval. ORB overall remains not ready until the disconnected workflows above become coherent persisted daily-use flows and Eslam accepts them.
