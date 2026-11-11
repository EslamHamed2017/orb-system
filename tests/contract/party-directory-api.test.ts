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

test("customer and supplier directories expose dedicated UI-ready CRUD contracts", () => {
  const customers = section("  /customers:\n", "  /suppliers:\n");
  const suppliers = section("  /suppliers:\n", "  /masters/{masterType}:\n");
  for (const [contract, noun] of [[customers, "Customer"], [suppliers, "Supplier"]] as const) {
    assert.match(contract, new RegExp(`operationId: list${noun}s`));
    assert.match(contract, new RegExp(`operationId: create${noun}`));
    assert.match(contract, new RegExp(`operationId: get${noun}`));
    assert.match(contract, new RegExp(`operationId: update${noun}`));
    assert.match(contract, /#\/components\/schemas\/PartyInput/);
    assert.match(contract, /#\/components\/schemas\/Party/);
  }
  assert.match(OPENAPI, /PartyInput:[\s\S]*additionalProperties: false[\s\S]*required: \[reference, legalNameAr, legalNameEn, countryCode\]/);
  assert.match(OPENAPI, /Party:[\s\S]*required: \[id, reference, legalNameAr, legalNameEn, countryCode, active, version\]/);
});

test("dedicated party route factories support list, detail read, create and update", async () => {
  const customerCollection = await import("../../src/app/api/customers/route.ts");
  const customerRecord = await import("../../src/app/api/customers/[customerId]/route.ts");
  const supplierCollection = await import("../../src/app/api/suppliers/route.ts");
  const supplierRecord = await import("../../src/app/api/suppliers/[supplierId]/route.ts");

  for (const module of [customerCollection, supplierCollection]) {
    assert.equal(typeof module.createPartyListHandler, "function");
    assert.equal(typeof module.createPartyCreateHandler, "function");
  }
  for (const module of [customerRecord, supplierRecord]) {
    assert.equal(typeof module.createPartyGetHandler, "function");
    assert.equal(typeof module.createPartyPatchHandler, "function");
  }
});
