import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sales shipment workspace binds a project-scoped sales-shipment attachment panel", () => {
  const workspace = readFileSync("src/ui/features/shipments/SalesShipmentWorkspace.tsx", "utf8");
  assert.match(workspace, /ShipmentAttachmentPanel/);
  assert.match(workspace, /projectId={projectId}/);
  assert.match(workspace, /subjectType="SALES_SHIPMENT"/);
  assert.match(workspace, /subjectId={shipmentId}/);
  assert.match(workspace, /canUpload={!readOnly}/);
});

test("supplier workspace binds attachments to the physical multi-supplier container", () => {
  const workspace = readFileSync("src/ui/features/shipments/SupplierShipmentWorkspace.tsx", "utf8");
  assert.match(workspace, /ShipmentAttachmentPanel/);
  assert.match(workspace, /projectId={projectId}/);
  assert.match(workspace, /subjectType="SUPPLIER_CONTAINER"/);
  assert.match(workspace, /subjectId={shipmentId}/);
  assert.match(workspace, /canUpload={!readOnly}/);
});

test("shipment attachment panel lists, uploads and downloads immutable scoped evidence", () => {
  const component = readFileSync("src/ui/features/evidence/ShipmentAttachmentPanel.tsx", "utf8");
  assert.match(component, /subjectType: "SALES_SHIPMENT" \| "SUPPLIER_CONTAINER"/);
  assert.match(component, /data-backend-endpoint={`\/api\/evidence\?projectId=/);
  assert.match(component, /name="projectId" value={projectId}/);
  assert.match(component, /name="subjectType" value={subjectType}/);
  assert.match(component, /name="subjectId" value={subjectId}/);
  assert.match(component, /name="purpose"/);
  assert.match(component, /name="file"/);
  assert.match(component, /data-operation-id="uploadEvidence"/);
  assert.match(component, /\/api\/evidence\/\${attachment.id}\/content\?disposition=attachment/);
  assert.match(component, /Immutable files/);
  assert.match(component, /ملفات غير قابلة للتغيير/);
});

test("shipment attachment panel is accessible, bilingual and permission-shaped", () => {
  const component = readFileSync("src/ui/features/evidence/ShipmentAttachmentPanel.tsx", "utf8");
  assert.match(component, /const headingId = `shipment-attachments-\${subjectType.toLowerCase\(\)}-\${subjectId}`/);
  assert.match(component, /aria-labelledby={`\${headingId}-title`}/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /dir={ar \? "rtl" : "ltr"}/);
  assert.match(component, /canUpload &&/);
  assert.match(component, /Read-only attachments/);
  assert.match(component, /عرض فقط للمرفقات/);
});

for (const file of ["SalesShipmentWorkspace.tsx", "SupplierShipmentWorkspace.tsx"]) {
  test(`${file} replaces the unscoped evidence uploader`, () => {
    const workspace = readFileSync(`src/ui/features/shipments/${file}`, "utf8");
    assert.doesNotMatch(workspace, /EvidenceUploader/);
  });
}
