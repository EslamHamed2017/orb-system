import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("pilot transaction attachment panel binds expenses and claims to immutable evidence", () => {
  const component = readFileSync("src/ui/features/evidence/PilotTransactionAttachmentPanel.tsx", "utf8");
  assert.match(component, /subjectType: "EXPENSE" \| "CLAIM"/);
  assert.match(component, /data-backend-endpoint={`\/api\/evidence\?projectId=/);
  assert.match(component, /name="projectId" value={projectId}/);
  assert.match(component, /name="subjectType" value={subjectType}/);
  assert.match(component, /name="subjectId" value={subjectId}/);
  assert.match(component, /data-operation-id="uploadEvidence"/);
  assert.match(component, /\/api\/evidence\/\${attachment.id}\/content\?disposition=attachment/);
});

test("pilot transaction attachment panel is bilingual, accessible, and permission-shaped", () => {
  const component = readFileSync("src/ui/features/evidence/PilotTransactionAttachmentPanel.tsx", "utf8");
  assert.match(component, /aria-labelledby={`\${headingId}-title`}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /dir={ar \? "rtl" : "ltr"}/);
  assert.match(component, /Immutable files/);
  assert.match(component, /ملفات غير قابلة للتغيير/);
  assert.match(component, /canUpload &&/);
  assert.match(component, /Read-only attachments/);
});

test("every displayed expense and claim exposes an exactly bound attachment panel", () => {
  const expenses = readFileSync("src/ui/features/accounts/AccountsWorkspace.tsx", "utf8");
  assert.match(expenses, /\/api\/evidence\/\$\{r\.documentId\}\/content/, "every recorded bill opens from the accounts list");

  const claims = readFileSync("src/ui/features/claims/ClaimWorkspace.tsx", "utf8");
  assert.match(claims, /PilotTransactionAttachmentPanel/);
  assert.match(claims, /subjectType="CLAIM"/);
  assert.match(claims, /subjectId="claim-0007"/);
  assert.match(claims, /projectId={projectId}/);
  assert.match(claims, /canUpload={canUpload}/);
});

test("expense register preserves role context without exposing attachment upload controls", () => {
  const expenseRoute = readFileSync("src/app/accounts/expenses/page.tsx", "utf8");
  assert.doesNotMatch(expenseRoute, /role\?: string|canUpload/, "accounts registers are read-only and never trust a role query parameter");

  const claimRoute = readFileSync("src/app/projects/[id]/claims/page.tsx", "utf8");
  assert.match(claimRoute, /role\?: string/);
  assert.match(claimRoute, /canUpload={query.role !== "finance-viewer"}/);
});
