import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("ops/acceptance/run-internal-alpha-lifecycle.sh", "utf8");
const journey = readFileSync("tests/acceptance/internal-alpha-lifecycle.spec.ts", "utf8");

test("internal-alpha gate binds Chromium to isolated PostgreSQL and object storage", () => {
  for (const token of [
    "compose.isolated-infrastructure.yml",
    "prisma migrate deploy",
    "prisma/seed.ts",
    "ORB_TEST_MANAGED_SERVER=1",
    "--project=chromium",
    "internal-alpha-lifecycle.spec.ts",
    "mc stat",
    "SELECT count(*) FROM \"Project\"",
  ]) assert.match(script, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(script, /owner-uat\.spec\.ts|\|\| true|test\.skip|--pass-with-no-tests/);
});

test("Chromium journey covers the approved daily-use lifecycle and infrastructure readiness", () => {
  for (const token of [
    "/api/health/ready", "/masters/customers", "/masters/suppliers", "/masters/products",
    "/projects/demo/overview", "/projects/demo/contracts", "/supplier-shipments/demo",
    "/sales-shipments/demo", "/accounts/sales-invoices", "/accounts/supplier-invoices",
    "/accounts/collections", "/accounts/supplier-payments", "/accounts/expenses",
    "/attachments", "/reports/product-movement", "/projects/demo/closure",
  ]) assert.ok(journey.includes(token), `missing lifecycle surface ${token}`);
  assert.match(journey, /supplierCount|supplier count/i);
  assert.match(journey, /remaining quantity/i);
  assert.match(journey, /print/i);
  assert.match(journey, /attachment/i);
});
