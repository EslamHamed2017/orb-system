# Release 1 UI Contract

## Exact screen map

| Route | Screen | Primary executable actions |
|---|---|---|
| `/sign-in` | Sign in | authenticate; choose Arabic/English |
| `/` | Today | assigned approvals, route/document/claim/closure blockers, recent Projects |
| `/masters/{customers|suppliers|coffee|currencies|expense-categories}` | Essential masters | list/create/edit/archive subject to role |
| `/projects` | Project list | filter/search; create Project |
| `/projects/new` | Create Project wizard | customer -> sales contract/route/tolerances -> review/create |
| `/projects/{id}/overview` | Project overview | states, quantities, money, blockers, audit summary; Owner/Admin reasoned cancel only before execution |
| `/projects/{id}/contracts` | Contracts | view/version/submit sales contract; add/version/submit purchase contract |
| `/projects/{id}/shipments` | Shipments | create/revise exact datasets; submit/approve/confirm; choose one primary source; record transit/delivery/receipt/cancel/reject |
| `/sales-shipments/{id}` | Sales shipment workspace | Dataset, Route checklist, Evidence, Documents, Settlement, Expense, Claims, Closure tabs |
| `/supplier-shipments/{id}` | Supplier shipment workspace | dataset/submit/approve/confirm/transitions, evidence, invoice submit/approve/confirm or unallocated cancel, payment, statement |
| `/projects/{id}/money` | Money | advances/receipts/payments; allocate; reverse a selected allocation with reason; inspect exact recalculated balances |
| `/projects/{id}/expenses` | Direct expenses | draft/proof/submit/approve; approved correction by exact cancellation/replacement approval; inspect immutable pair |
| `/projects/{id}/statements` | Statements | customer/supplier/sales-shipment/supplier-shipment/Project views |
| `/projects/{id}/profit` | Profit and cash | four measures, formula, source drill-down |
| `/projects/{id}/claims` | Claims | open; move to review; propose outcome; Owner/Admin approve; apply approved resolution/rejection |
| `/projects/{id}/closure` | Closure | assessment/blockers, exception request/approval, final close/reopen |
| `/approvals` | Fixed approval inbox | inspect exact version/hash/diff/evidence; approve/reject |
| `/documents/{id}` | Document workspace | generate/status/preview/revise/submit/approve, manifest/send/cancel |
| `/evidence/{id}` | Evidence viewer | metadata/hash, inline view where safe, audited download |
| `/projects/{id}/audit` | Audit | immutable filtered event timeline/hash status |
| `/admin/{users|backup}` | Pilot administration | typed pilot-user list, fixed-role assignment, per-user session list (session ID/current/last-seen/expiry/revocation), exact-session revoke, and backup/restore evidence |

No Release 1 navigation or hidden interactive route exists for a deferred feature.

## Common interaction contract

- Arabic sets `lang=ar dir=rtl`; English sets `lang=en dir=ltr` at document root. Use logical properties, bidi isolation for references/numbers, mirrored directional icons, locale formatting, and equivalent keyboard order/actions.
- Every mutation shows pending/success/failure; field problems focus the first invalid control. `412` opens compare/reload, never overwrite. `409` explains the violated invariant and links to the authoritative record.
- Business deletion is never offered. Use cancel, reverse, supersede, or reopen with consequence and reason.
- The fixed approval dialog names action, requester, subject reference/version/hash, changed fields, evidence, and conflicts; self-approval is disabled and explained.
- Evidence uploader shows type/size/hash verification and attaches only after success. Viewer/download rechecks permission and records audit.

## Journey contracts

### Project and contracts

Create Project is atomic with one sales-contract draft. Tolerances default visibly to `0`. Submit creates a fixed approval. Approved versions are read-only; Amend shows old/new comparison and requires effective date/reason. Purchase contracts use the same controls.

### Supplier and sales shipment

Supplier shipment must be submitted and approved before Confirm makes it selectable as source. Both shipment workspaces load their typed aggregate workspace and expose immutable Dataset history in ascending revision order with version/hash, change reason, actor/time, approval linkage and invalidation; they expose and `Revise dataset` only in Draft/Confirmed; revision requires reason, shows old/new diff, expires approval/exception badges, resets Confirmed to Draft, and forces reapproval. There is no revision control in transit/terminal states. Sales shipment shows contracted, confirmed, delivered, cancelled/rejected, remaining quantity and exactly one primary-source picker. Submit binds the exact dataset/source for different Owner/Admin approval; Confirm requires it. Confirm performs route/source/tolerance assessment. A tolerance failure shows each limit/actual and offers “Request exception”; approval is exact-dataset only.

Execution controls are explicit and graph-aware: supplier `Confirm -> Mark in transit -> Mark received`, sales `Confirm -> Mark in transit -> Mark delivered`; eligible Draft/Confirmed records offer Cancel, and Confirmed/In-transit records offer Reject. Each dialog shows current/target state and version, requires reason (and evidence/time where applicable), sends `If-Match` plus idempotency, and displays the resulting audit event and quantity/closure impact. Invalid target buttons are absent and server rejection is still handled.

### Fixed route checklist and evidence

The route and template version are read-only. Items display Not started/In progress/Satisfied/Not applicable by rule/Exception approved. Evidence items provide Upload/View/Download; milestone items capture timestamp and evidence where required. Closure-blocking items link bidirectionally to Closure. There is no template editor.

### Documents and external sending

Generate asks kind and language, identifies the exact shipment dataset, returns to a status panel (`Queued/Rendering/Ready/Failed`), and enables preview only when ready. CINV/Packing List shared-field comparison must show zero mismatch. Submit/approve binds revision/version/hash. Revise/cancel requires reason and preserves earlier bytes.

Send uses a separate manifest step with channel, ordered To/Cc, exact subject, exact body bytes/media type/byte size/SHA-256, and attachments. Preview displays every attachment ID/version/exact outbound filename/byte size/SHA-256 plus output ID/version/hash. Submit freezes a canonical manifest version/hash. Owner/Admin approves that exact version. Approved fields are read-only; Revise creates a superseding manifest and marks prior approval inapplicable. `Send now` refreshes the stored exact preview, accepts no editable payload, verifies every byte/hash/version and approval, fails closed on drift/unavailability, and appends attempt number/time/result/provider reference or safe failure code. After send, the workspace displays approved and sent snapshots side by side and proves identical manifest/output/body/attachment hashes; transport-captured byte evidence is linked. Retry creates another attempt. There is no scheduled/automatic send.

### Supplier invoice, money, and expense

Supplier invoice is one shipment/reference/date/amount/currency/evidence with submit/approve. Money capture permits customer/supplier advance before invoice and reasoned movement reversal where eligible. Allocation shows available and target outstanding, same party/currency, supports partial rows, and previews post-balance. Reverse allocation selects one active row, requires reason/current version, previews movement availability plus invoice/shipment/Project balances, and then displays immutable original/compensating rows and any financial/final-close reopening. Direct expense selects Project or one shipment—not both—then proof and fixed approval. An approved expense has no Edit/Delete: Correct creates an old/new diff and reason, submits the exact pair, and only approved Apply atomically cancels old and approves linked replacement; both evidence sets remain viewable. No allocation controls appear on expense screens.

### Statements, profit, claims, and closure

Statements have fixed tabs and separate currency sections; every row drills to source. Profit has exactly four visually distinct cards with as-of/formula/source lines. Claims capture the simple lifecycle only: Operations can move Open to Under review and submit a proposed Resolved/Rejected outcome; terminal buttons do not exist. The approval inbox shows proposed outcome, exact claim version/hash, reason/evidence and self-approval denial. Apply appears only after approval and is the sole terminal action. A rejected approval leaves the claim Under review.

Closure always refreshes assessment before action, groups all blockers from reachable states, and allows exceptions only for items flagged eligible; financial balance, immutable/audit, approval-integrity, and security blockers never show exception controls. Reversal/refund, shipment cancellation/rejection, document cancellation/revision, expense correction, or new/reopened claim shows an immediate `Final close reopened/assessment stale` result and links to the new assessment. Final close/reopen dialogs name Project version/state and require applicable reasons.


## Fixed role and cookie-session UI contract

The server-enforced `x-required-roles` on every operation is authoritative. Read workspaces are available to all three roles with permission-shaped sensitive fields; operational drafting/actions are Operations or Owner/Admin; supplier-invoice and money actions are Finance/Viewer or Owner/Admin; fixed decisions, safe Project cancellation, final-close/reopen application, role/session administration and recovery are Owner/Admin only. The UI must hide unauthorized actions but still handles server `403`; requester identity is always compared server-side to prohibit self-approval.

Sign-in receives a rotated Secure/HttpOnly/SameSite=Strict `__Host-` session cookie and a separate session-bound CSRF token. Every authenticated mutation sends that token; missing/mismatched Origin or Referer, token, expired session, or revoked session fails closed. Pilot administration first calls `listPilotUsers`, then `listPilotUserSessions`; revoke targets the displayed exact user/session ID and refreshes until `revoked=true`, while the revoked browser proves its next request is unauthorized.

## ORB Material Design 3 visual acceptance

- ORB logo and approved ORB palette populate MD3 primary/secondary/tertiary/error/surface roles; no Google branding and no arbitrary raw colors in screens.
- Typography uses a documented bilingual MD3 display/headline/title/body/label scale with Arabic-appropriate line height; 4dp spacing grid; MD3 shape/elevation tokens; 48x48 CSS-pixel touch targets.
- Navigation: desktop persistent rail + top app bar; tablet compact rail; narrow screens bottom navigation for Today/Projects/Approvals plus “More”. Content reflows without horizontal page scrolling at 320 CSS px; data tables use contained horizontal scroll with sticky identifiers/actions.
- All enabled components have visible rest/hover/focus/pressed/dragged/selected/disabled/error states using state layers; keyboard focus contrast is at least 3:1 and never clipped.
- Loading uses skeleton/progress without layout shift; empty/error/permission-denied/offline/stale-version states include a clear next action. Snackbars never carry the sole error detail.
- Color contrast meets WCAG 2.2 AA; controls have accessible name/role/value; dialogs trap and restore focus; tables expose headers; errors are text plus icon/color; reduced motion is honored.
- Acceptance captures paired Arabic/English screenshots at 1440x900, 768x1024, and 390x844 for every screen above, plus automated accessibility and keyboard-only evidence. Critical layout mirroring, clipped Arabic, untranslated controls, mixed direction corruption, or functional divergence fails.

## Release boundary

Bank import, tax pack, historical migration, multiple sources, shared-expense allocation, approval designer, route designer, and advanced claim settlements are absent—not disabled menu items—and are rejected if discovered by route crawl.
