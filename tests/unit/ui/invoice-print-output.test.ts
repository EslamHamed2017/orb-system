import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("customer and supplier invoices expose bilingual targeted print output with line traceability", () => {
  const document = readFileSync("src/ui/features/accounts/InvoicePrintDocument.tsx", "utf8");
  const sales = readFileSync("src/ui/features/accounts/ProjectSalesInvoicesPage.tsx", "utf8");
  const supplier = readFileSync("src/ui/features/accounts/ProjectSupplierInvoicesPage.tsx", "utf8");
  const action = readFileSync("src/ui/features/printing/PrintAction.tsx", "utf8");
  const styles = readFileSync("src/ui/features/shipments/operations.module.css", "utf8");

  assert.match(sales, /InvoicePrintDocument/);
  assert.match(supplier, /InvoicePrintDocument/);
  assert.match(document, /data-print-document/);
  assert.match(document, /salesInvoice/);
  assert.match(document, /supplierInvoice/);
  assert.match(document, /Customer/);
  assert.match(document, /العميل/);
  assert.match(document, /Supplier/);
  assert.match(document, /المورد/);
  assert.match(document, /Sales shipment/);
  assert.match(document, /شحنة البيع/);
  assert.match(document, /Supplier container/);
  assert.match(document, /حاوية الموردين/);
  assert.match(document, /Unit price/);
  assert.match(document, /سعر الوحدة/);
  assert.match(document, /Line total/);
  assert.match(document, /إجمالي البند/);
  assert.match(action, /Print customer invoice/);
  assert.match(action, /طباعة فاتورة العميل/);
  assert.match(action, /Print supplier invoice/);
  assert.match(action, /طباعة فاتورة المورد/);
  assert.match(styles, /@page[^}]*A4 portrait/s);
  assert.match(styles, /orb-print-selected/);
  assert.match(styles, /break-inside:\s*avoid/);
});
