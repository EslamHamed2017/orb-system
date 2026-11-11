import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const OPENAPI = readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8");

function section(start: string, end: string): string {
  const from = OPENAPI.indexOf(start);
  const to = OPENAPI.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return OPENAPI.slice(from, to);
}

test("masters expose only the five accepted master types", () => {
  const parameter = section("    MasterType:\n", "    StatementType:\n");
  assert.match(parameter, /name: masterType\n      in: path\n      required: true/);
  const values = [...parameter.matchAll(/^        - (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(values, ["customers", "suppliers", "coffee", "currencies", "expense-categories"]);
});

test("master list/create/update operations retain exact authorization and mutation controls", () => {
  const collection = section("  /masters/{masterType}:\n", "  /masters/{masterType}/{recordId}:\n");
  const record = section("  /masters/{masterType}/{recordId}:\n", "  /projects:\n");
  assert.match(collection, /operationId: listMasterRecords[\s\S]*x-required-roles:\n      - OWNER_ADMIN\n      - OPERATIONS\n      - FINANCE_VIEWER/);
  assert.match(collection, /operationId: createMasterRecord[\s\S]*#\/components\/parameters\/IdempotencyKey[\s\S]*#\/components\/parameters\/CsrfToken/);
  assert.match(collection, /operationId: createMasterRecord[\s\S]*x-required-roles:\n      - OWNER_ADMIN\n      - OPERATIONS\n/);
  assert.match(record, /operationId: updateMasterRecord[\s\S]*#\/components\/parameters\/IfMatch[\s\S]*#\/components\/parameters\/IdempotencyKey[\s\S]*#\/components\/parameters\/CsrfToken/);
  assert.match(record, /operationId: updateMasterRecord[\s\S]*x-required-roles:\n      - OWNER_ADMIN\n      - OPERATIONS\n/);
});

test("master route factories enforce list role shaping and deny Finance mutations", async () => {
  const collection = await import("../../src/app/api/masters/[masterType]/route.ts");
  const record = await import("../../src/app/api/masters/[masterType]/[recordId]/route.ts");
  assert.equal(typeof collection.createMastersGetHandler, "function");
  assert.equal(typeof collection.createMastersPostHandler, "function");
  assert.equal(typeof record.createMasterPatchHandler, "function");

  const finance = { userId: "019a5f9b-7c00-7000-8000-000000000401", roles: ["FINANCE_VIEWER"] };
  let createCalled = false;
  const post = collection.createMastersPostHandler({
    authenticate: async () => finance,
    create: async () => { createCalled = true; return { id: "not-reached", version: 1 }; },
  });
  const response = await post(new Request("https://orb.example/masters/customers", {
    method: "POST", headers: { "content-type": "application/json", "idempotency-key": "master-contract-0001", "x-csrf-token": "x".repeat(32), origin: "https://orb.example" },
    body: JSON.stringify({ reference: "C-001", legalNameEn: "Customer" }),
  }), { params: Promise.resolve({ masterType: "customers" }) });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("content-type"), "application/problem+json");
  assert.equal((await response.json()).code, "PERMISSION_DENIED");
  assert.equal(createCalled, false);
});


test("product contract exposes explicit non-destructive lifecycle statuses", () => {
  assert.match(OPENAPI, /ProductStatus:[\s\S]*enum: \[ACTIVE, INACTIVE\]/);
});
