import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const script = readFileSync("ops/acceptance/run-cross-browser-smoke.sh", "utf8");
const journey = readFileSync("tests/acceptance/cross-browser-smoke.spec.ts", "utf8");

test("cross-browser gate runs only the Firefox and WebKit P0 smoke projects", () => {
  for (const token of [
    "ORB_TEST_MANAGED_SERVER=1",
    "cross-browser-smoke.spec.ts",
    "--project=firefox",
    "--project=webkit",
  ]) assert.ok(script.includes(token), `missing gate token ${token}`);
  assert.doesNotMatch(script, /--project=chromium|\|\| true|test\.skip|--pass-with-no-tests/);
});

test("Firefox and WebKit smoke covers the bilingual daily-use pilot path", () => {
  for (const token of [
    `["en", "ar"]`,
    "/api/health/live",
    "/masters/customers",
    "/masters/suppliers",
    "/masters/products",
    "/projects/demo/overview",
    "/projects/demo/contracts",
    "/supplier-shipments/demo",
    "/sales-shipments/demo",
    "/accounts",
    "/attachments",
    "/reports",
  ]) assert.ok(journey.includes(token), `missing smoke surface ${token}`);
  assert.match(journey, /application error|internal server error/i);
  assert.match(journey, /toHaveAttribute\("lang"/);
  assert.match(journey, /toHaveAttribute\("dir"/);
});
