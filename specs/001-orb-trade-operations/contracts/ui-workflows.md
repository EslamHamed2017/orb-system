# Release 1 UI Contract

## Exact screen map

| Route | Screen | Primary executable actions |
|---|---|---|
| `/sign-in` | Sign in | authenticate; choose Arabic/English |
| `/` | Today | assigned approvals, route/document/claim/closure blockers, recent Projects |
| `/masters/{customers|suppliers|coffee|currencies|expense-categories}` | Essential masters | list/create/edit/archive subject to role |
| `/projects` | Project list | filter/search; create Project |
| `/projects/new` | Create Project wizard | customer -> sales contract/route/tolerances -> review/create |
| `/projects/{id}/overview` | Project overview | states, quantities, money, blockers, audit summary |
| `/projects/{id}/contracts` | Contracts | view/version/submit sales contract; add/version/submit purchase contract |
| `/projects/{id}/shipments` | Shipments | create sales/supplier shipment; confirm; choose one primary source |
| `/sales-shipments/{id}` | Sales shipment workspace | Dataset, Route checklist, Evidence, Documents, Settlement, Expense, Claims, Closure tabs |
| `/supplier-shipments/{id}` | Supplier shipment workspace | dataset/confirm, evidence, invoice, payment, statement |
| `/projects/{id}/money` | Money | advances/receipts/payments; settlement allocation/reversal |
| `/projects/{id}/expenses` | Direct expenses | draft, proof, submit, approve/reject/cancel |
| `/projects/{id}/statements` | Statements | customer/supplier/sales-shipment/supplier-shipment/Project views |
| `/projects/{id}/profit` | Profit and cash | four measures, formula, source drill-down |
| `/projects/{id}/claims` | Claims | open, review, resolve/reject with evidence |
| `/projects/{id}/closure` | Closure | assessment/blockers, exception request/approval, final close/reopen |
| `/approvals` | Fixed approval inbox | inspect exact version/hash/diff/evidence; approve/reject |
| `/documents/{id}` | Document workspace | generate/status/preview/revise/submit/approve, manifest/send/cancel |
| `/evidence/{id}` | Evidence viewer | metadata/hash, inline view where safe, audited download |
| `/projects/{id}/audit` | Audit | immutable filtered event timeline/hash status |
| `/admin/{users|backup}` | Pilot administration | fixed-role assignment/session revoke; backup/restore evidence |

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

Supplier shipment must be confirmed through approval before it is selectable as source. Sales shipment shows remaining contract quantity and exactly one primary-source picker. Confirm performs route/source/tolerance assessment. A tolerance failure shows each limit/actual and offers “Request exception”; approval is exact-dataset only.

### Fixed route checklist and evidence

The route and template version are read-only. Items display Not started/In progress/Satisfied/Not applicable by rule/Exception approved. Evidence items provide Upload/View/Download; milestone items capture timestamp and evidence where required. Closure-blocking items link bidirectionally to Closure. There is no template editor.

### Documents and external sending

Generate asks kind and language, identifies the exact shipment dataset, returns to a status panel (`Queued/Rendering/Ready/Failed`), and enables preview only when ready. CINV/Packing List shared-field comparison must show zero mismatch. Submit/approve binds revision/version/hash. Revise/cancel requires reason and preserves earlier bytes.

Send uses a separate manifest step: editable To/Cc, subject/body, and attachment selector; preview displays every attachment ID/version/hash and the output ID/version/hash. Submit creates a manifest hash. Owner/Admin approves that exact manifest. Any edit marks approval expired. `Send now` requires a fresh preview and exact approval, shows final recipients/attachments, and records sent/failed delivery; there is no scheduled/automatic send.

### Supplier invoice, money, and expense

Supplier invoice is one shipment/reference/date/amount/currency/evidence with submit/approve. Money capture permits customer/supplier advance before invoice. Allocation shows available and target outstanding, same party/currency, supports partial rows, and previews post-balance. Reversal creates a compensating record. Direct expense selects Project or one shipment—not both—then proof and fixed approval. No allocation controls appear.

### Statements, profit, claims, and closure

Statements have fixed tabs and separate currency sections; every row drills to source. Profit has exactly four visually distinct cards with as-of/formula/source lines. Claims capture the simple lifecycle only. Closure always refreshes assessment before action, groups all blockers, and allows exceptions only for items flagged eligible. Final close/reopen dialogs name Project version/state and require applicable reasons.

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
