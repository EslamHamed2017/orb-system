import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("persisted shipment routes fail closed instead of falling back to demo data", () => {
  const route = readFileSync("src/app/sales-shipments/[id]/page.tsx", "utf8");
  assert.match(route, /isUuid/);
  assert.match(route, /PersistedSalesShipmentUnavailable/);
  assert.doesNotMatch(route, /if \(process\.env\.DATABASE_URL && query\.projectId\)/);
});

test("persisted shipment loader binds the active dataset and evidence to the selected shipment", () => {
  const loader = readFileSync("src/modules/shipments/load-persisted-sales-shipment.ts", "utf8");
  assert.match(loader, /dataset\.shipment_id = shipment\.id/);
  assert.match(loader, /"EvidenceLink"/);
  assert.match(loader, /link\.subject_type::text = 'SALES_SHIPMENT'/);
  assert.match(loader, /link\.subject_id = shipment\.id/);
  assert.match(loader, /attachments:/);
});

test("persisted shipment workspace renders only loaded attachment records", () => {
  const page = readFileSync("src/ui/features/shipments/PersistedSalesShipmentWorkspace.tsx", "utf8");
  assert.match(page, /attachments=\{shipment\.attachments\}/);
});


test("persisted shipment navigation and states use bilingual business labels instead of technical identifiers", () => {
  const page = readFileSync("src/ui/features/shipments/PersistedSalesShipmentWorkspace.tsx", "utf8");
  assert.match(page, /projectLabel=\{shipment\.projectReference\}/);
  assert.match(page, /recordId=\{shipment\.reference\}/);
  assert.doesNotMatch(page, /recordId=\{shipment\.id\}/);
  assert.match(page, /DELIVERED: \["Delivered", "تم التسليم"\]/);
  assert.match(page, /APPROVED: \["Approved", "معتمدة"\]/);
  assert.match(page, /PENDING_APPROVAL: \["Pending approval", "بانتظار الموافقة"\]/);
  assert.match(page, /stateLabel\(shipment\.executionState, locale\)/);
  assert.match(page, /stateLabel\(d\.state, locale\)/);
});
