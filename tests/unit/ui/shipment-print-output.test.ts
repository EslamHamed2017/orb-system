import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("sales shipment and supplier container expose bilingual targeted print output", () => {
  const core = readFileSync("src/ui/features/shipments/ShipmentWorkspaceCore.tsx", "utf8");
  const action = readFileSync("src/ui/features/printing/PrintAction.tsx", "utf8");
  const styles = readFileSync("src/ui/features/shipments/operations.module.css", "utf8");

  assert.match(core, /PrintAction/);
  assert.match(core, /sales-shipment-print/);
  assert.match(core, /supplier-container-print/);
  assert.match(core, /data-print-document/);
  assert.match(core, /Sales shipment/);
  assert.match(core, /شحنة بيع/);
  assert.match(core, /Supplier container/);
  assert.match(core, /حاوية موردين/);
  assert.match(action, /Print shipment/);
  assert.match(action, /طباعة الشحنة/);
  assert.match(action, /Print container/);
  assert.match(action, /طباعة الحاوية/);
  assert.match(styles, /@page[^}]*A4 portrait/s);
  assert.match(styles, /orb-print-selected/);
  assert.match(styles, /break-inside:\s*avoid/);
});
