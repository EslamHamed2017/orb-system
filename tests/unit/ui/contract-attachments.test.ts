import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("contract detail composes a project-scoped attachment panel", () => {
  const page = readFileSync("src/app/projects/[id]/contracts/page.tsx", "utf8");
  assert.match(page, /ContractAttachmentPanel/);
  assert.match(page, /projectId={id}/);
  assert.match(page, /subjectType="CONTRACT"/);
  assert.match(page, /subjectId={SALES_CONTRACT_ID}/);
  assert.match(page, /canUpload={canMutate}/);
});

test("contract attachment panel is bilingual, accessible, and binds evidence metadata", () => {
  const component = readFileSync("src/ui/features/evidence/ContractAttachmentPanel.tsx", "utf8");
  assert.match(component, /Attachments/);
  assert.match(component, /مرفقات/);
  assert.match(component, /data-backend-endpoint={`\/api\/evidence\?projectId=/);
  assert.match(component, /name="subjectType" value={subjectType}/);
  assert.match(component, /name="subjectId" value={subjectId}/);
  assert.match(component, /name="purpose"/);
  assert.match(component, /name="file"/);
  assert.match(component, /data-operation-id="uploadEvidence"/);
  assert.match(component, /\/api\/evidence\/\${attachment.id}\/content\?disposition=attachment/);
  assert.match(component, /aria-live="polite"/);
});

test("contract attachment upload is hidden when the operation is denied", () => {
  const component = readFileSync("src/ui/features/evidence/ContractAttachmentPanel.tsx", "utf8");
  assert.match(component, /canUpload &&/);
  assert.match(component, /Read-only attachments/);
  assert.match(component, /عرض فقط للمرفقات/);
});

test("every displayed sales and purchase contract has its own attachment binding", () => {
  const page = readFileSync("src/app/projects/[id]/contracts/page.tsx", "utf8");
  assert.equal([...page.matchAll(/<ContractAttachmentPanel/g)].length, 3);
  assert.match(page, /subjectId={SALES_CONTRACT_ID}/);
  assert.match(page, /subjectId={APPROVED_PURCHASE_CONTRACT_ID}/);
  assert.match(page, /subjectId={DRAFT_PURCHASE_CONTRACT_ID}/);
  for (const id of ["019a5f9b-7c00-7000-8000-000000000901", "019a5f9b-7c00-7000-8000-000000000902", "019a5f9b-7c00-7000-8000-000000000903"]) assert.match(page, new RegExp(id));
});

test("reused contract attachment panels derive unique ARIA ids from the contract", () => {
  const component = readFileSync("src/ui/features/evidence/ContractAttachmentPanel.tsx", "utf8");
  assert.match(component, /const headingId = `contract-attachments-\${subjectId}`/);
  assert.match(component, /id={headingId}/);
  assert.match(component, /aria-labelledby={`\${headingId}-title`}/);
});

test("contract attachment panel owns locale direction when the host page does not", () => {
  const component = readFileSync("src/ui/features/evidence/ContractAttachmentPanel.tsx", "utf8");
  assert.match(component, /dir={ar \? "rtl" : "ltr"}/);
});
