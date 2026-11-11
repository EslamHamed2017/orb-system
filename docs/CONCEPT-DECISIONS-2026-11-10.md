# ORB Concept Decisions — Session 2026-11-10

**Status:** User-approved concept decisions extracted from Telegram session `20261110_093942_80229520`.
**Source time:** 2026-11-10 23:47–2026-11-11 00:07 GST.
**Owner:** Eslam El Berkawy.

## 1. 360-degree navigation
- A project is the main 360° workspace and exposes every related operation.
- Every business object also has its own independent page.
- Navigation must work both ways between project, contract, shipment, invoice/payment/expense, attachments, and related records.

## 2. Contracts use header + multiple line items
- One contract can contain multiple products/coffee specifications.
- Each line records its product/specification, quantity, unit price, and related commercial data.
- Remaining quantity/value is tracked at line level.

## 3. Shipments use header + multiple line items
- A shipment can contain multiple different products.
- Every shipment line must reference a product/line already defined in the related contract; no arbitrary product may be introduced at shipment stage.
- One contract line may be fulfilled through multiple partial shipments.
- One physical purchase container/shipment may consolidate multiple suppliers and purchase-contract lines.

## 4. Invoice grouping
- User stated that the invoice is one invoice for the shipment, containing all its lines.
- Implementation clarification required: this is treated as the customer/sales invoice for a sales shipment. Supplier invoices must remain attributable to the relevant supplier when one container consolidates multiple suppliers, unless the owner explicitly approves a different rule.

## 5. Product master and movement tracking
- Add a visible product/coffee-item registration page.
- Add a product movement/history page across all projects.
- ORB is pure back-to-back trading: no free inventory and no warehouse stock balance.
- Product movement is a traceability/reporting view, not an inventory valuation or stock-on-hand subsystem.

## 6. Accounts hub, globally and inside each project
- Add an independent Accounts section to main navigation.
- It includes sales invoices, purchase invoices, payments/collections, expenses, customers, and suppliers.
- The same records must remain available inside each project, filtered to that project, preserving 360° navigation.

## 7. Full users and permissions administration
- Add full user creation and management.
- Replace pilot-only fixed roles as the sole authorization model with configurable granular permissions.
- Permissions must control screen visibility, operation access, sensitive values, approvals, editing, and other business actions.

## 8. Strong sign-in experience
- Redesign the sign-in screen to be visually attractive and communicate the strength and professionalism of ORB.
- Preserve security, accessibility, Arabic RTL, English LTR, and Material Design 3 / ORB branding.

## 9. Attachments, serials, and printing
- Attachments must not exist only as an isolated page.
- Every business transaction must support attachments directly.
- Every transaction must have a unique serial/reference number.
- Every printable business transaction must provide a print action/output.
- A central attachments/documents page may still exist as a cross-system index, linked back to each source transaction.

## 10. Reports and settings
- Add a standalone Reports section.
- Add a comprehensive Settings section from which the owner can control the program.
- Existing scattered admin pages are not sufficient; settings must be organized as a coherent control center.

## Guardrails
- No Odoo.
- No general-ledger/accounting engine; the Accounts hub is operational/commercial tracking only.
- Arabic RTL and English LTR.
- Material Design 3 with ORB branding.
- No external communication without owner approval.
- Plan architecture and migration before implementing the line-item redesign.

## Canonical bilingual domain terminology
The following labels are frozen for application copy, API documentation, print output, and acceptance tests. Concept identifiers are stable implementation keys.

| Concept key | English | العربية | Usage |
|---|---|---|---|
| `project` | Project | مشروع | The 360-degree workspace for related records. |
| `product` | Product | منتج | A traded product/specification, not free-stock inventory. |
| `salesContract` | Sales contract | عقد بيع | The customer commercial agreement. |
| `purchaseContract` | Purchase contract | عقد شراء | The supplier commercial agreement. |
| `contractLine` | Contract line | بند عقد | A versioned product, quantity, price, and commercial-data line. |
| `salesShipment` | Sales shipment | شحنة بيع | Customer-facing fulfillment against approved sales-contract lines. |
| `supplierContainer` | Supplier container | حاوية موردين | The physical inbound container; it may consolidate lines from multiple suppliers. |
| `shipmentLine` | Shipment line | بند شحنة | Fulfillment linked to an exact approved contract-line version. |
| `salesInvoice` | Sales invoice | فاتورة مبيعات | The customer invoice grouped per sales shipment. |
| `supplierInvoice` | Supplier invoice | فاتورة مورد | A supplier-attributable invoice. |
| `accounts` | Accounts | الحسابات | Operational/commercial tracking, never a general ledger. |
| `collection` | Collection | تحصيل | Money received from a customer. |
| `supplierPayment` | Supplier payment | دفعة مورد | Money paid to a supplier. |
| `expense` | Expense | مصروف | A project or transaction operational cost. |
| `attachment` | Attachment | مرفق | An access-controlled file linked to a source transaction. |
| `productMovement` | Product movement | حركة منتج | Cross-project traceability without stock balance or valuation. |
| `remainingQuantity` | Remaining quantity | الكمية المتبقية | Approved contract-line quantity not yet fulfilled. |

Usage rules:
- **Sales shipment / شحنة بيع** and **Supplier container / حاوية موردين** are distinct concepts and must not be used interchangeably.
- **Accounts / الحسابات** means operational commercial records only; do not label or describe it as a general ledger.
