import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("financial attachment panel binds immutable evidence for invoices and money movements", () => {
  const component = readFileSync("src/ui/features/evidence/FinancialAttachmentPanel.tsx", "utf8");
  assert.match(component, /subjectType: \"SALES_INVOICE\" \| \"SUPPLIER_INVOICE\" \| \"MONEY_MOVEMENT\"/);
  assert.match(component, /data-backend-endpoint={`\/api\/evidence\?projectId=/);
  assert.match(component, /name="projectId" value={projectId}/);
  assert.match(component, /name="subjectType" value={subjectType}/);
  assert.match(component, /name="subjectId" value={subjectId}/);
  assert.match(component, /name="purpose"/);
  assert.match(component, /name="file"/);
  assert.match(component, /data-operation-id="uploadEvidence"/);
  assert.match(component, /\/api\/evidence\/\${attachment.id}\/content\?disposition=attachment/);
});

test("financial attachment panel is bilingual, accessible, and permission-shaped", () => {
  const component = readFileSync("src/ui/features/evidence/FinancialAttachmentPanel.tsx", "utf8");
  assert.match(component, /const headingId = `financial-attachments-\${subjectType.toLowerCase\(\)}-\${subjectId}`/);
  assert.match(component, /aria-labelledby={`\${headingId}-title`}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /dir={ar \? \"rtl\" : \"ltr\"}/);
  assert.match(component, /Immutable files/);
  assert.match(component, /ملفات غير قابلة للتغيير/);
  assert.match(component, /canUpload &&/);
  assert.match(component, /Read-only attachments/);
});

for (const [file, subjectType] of [
  ["ProjectSalesInvoicesPage.tsx", "SALES_INVOICE"],
  ["ProjectSupplierInvoicesPage.tsx", "SUPPLIER_INVOICE"],
  ["ProjectMoneyMovementsPage.tsx", "MONEY_MOVEMENT"],
] as const) {
  test(`${file} exposes a directly bound attachment panel for every displayed record`, () => {
    const page = readFileSync(`src/ui/features/accounts/${file}`, "utf8");
    assert.match(page, /FinancialAttachmentPanel/);
    assert.match(page, /items.map\(\(item|items.map\(\(invoice/);
    assert.match(page, new RegExp(`subjectType=\"${subjectType}\"`));
    assert.match(page, /projectId={.*projectId}/);
    assert.match(page, /subjectId={.*id}/);
    assert.match(page, /canUpload={canUpload}/);
  });
}

test("server-rendered finance registers are permission-shaped through canUpload and preserve role in query type", () => {
  for (const route of ["sales-invoices", "supplier-invoices", "collections", "supplier-payments"]) {
    const page = readFileSync(`src/app/accounts/${route}/page.tsx`, "utf8");
    assert.match(page, /role\?: string/);
    assert.match(page, /canUpload={query\.role !== "finance-viewer"}/);
    assert.doesNotMatch(page, /BrowserFinanceRegisterPage/);
  }
});
