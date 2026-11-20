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

test("accounts registers read live company-scoped records and never trust a role query parameter", () => {
  for (const route of ["sales-invoices", "supplier-invoices", "collections", "supplier-payments", "expenses"]) {
    const page = readFileSync(`src/app/accounts/${route}/page.tsx`, "utf8");
    assert.match(page, /AccountsWorkspace/);
    assert.match(page, new RegExp(`view="${route}"`));
    assert.doesNotMatch(page, /role\?: string|query\.role|BrowserFinanceRegisterPage|DATABASE_URL/);
  }
  const workspace = readFileSync("src/ui/features/accounts/AccountsWorkspace.tsx", "utf8");
  assert.match(workspace, /\/api\/accounts\/\$\{view\}/);
  assert.match(workspace, /\/api\/accounts\/summary/);
  assert.doesNotMatch(workspace, /Object\.freeze\(\[\s*\{ id:/, "no sample rows");
});
