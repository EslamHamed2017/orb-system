import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("saved shipments (UUID ids) open the database-backed execution workspace, never demo data", () => {
  for (const [path, kind] of [["src/app/sales-shipments/[id]/page.tsx", "SALES"], ["src/app/supplier-shipments/[id]/page.tsx", "SUPPLIER"]]) {
    const route = readFileSync(path, "utf8");
    assert.match(route, /ShipmentExecutionWorkspace kind="/ );
    assert.match(route, new RegExp(`kind="${kind}"`));
  }
});

test("the execution workspace reads and writes only through the shipment APIs", () => {
  const page = readFileSync("src/ui/features/shipments/ShipmentExecutionWorkspace.tsx", "utf8");
  assert.match(page, /\/api\/supplier-shipments/);
  assert.match(page, /\/api\/sales-shipments/);
  assert.match(page, /\/execution-transitions/);
  assert.match(page, /\/api\/approvals\/\$\{s\.pendingApproval!\.id\}\/decision/);
  assert.doesNotMatch(page, /localStorage|fixture|demoState/);
});
