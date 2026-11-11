import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseYaml } from "./openapi-contract.test.ts";

const productId = "019a5f9b-7c00-7000-8000-000000000501";
const projectId = "019a5f9b-7c00-7000-8000-000000000503";

test("product movement route authorizes reads and propagates the optional project filter", async () => {
  const route = await import("../../src/app/api/products/[productId]/movements/route.ts");
  let received: unknown;
  const get = route.createProductMovementsGetHandler({
    authenticate: async () => ({ userId: productId, roles: ["FINANCE_VIEWER"] }),
    list: async (input) => { received = input; return { productId, projectId, items: [] }; },
  });
  const response = await get(new Request(`https://orb.example/api/products/${productId}/movements?projectId=${projectId}`), { params: Promise.resolve({ productId }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((received as any).productId, productId);
  assert.equal((received as any).projectId, projectId);
  assert.deepEqual((received as any).principal, { userId: productId, roles: ["FINANCE_VIEWER"] });
  assert.ok((received as any).request instanceof Request);

  let called = false;
  const denied = route.createProductMovementsGetHandler({ authenticate: async () => null, list: async () => { called = true; } });
  const deniedResponse = await denied(new Request(`https://orb.example/api/products/${productId}/movements`), { params: Promise.resolve({ productId }) });
  assert.equal(deniedResponse.status, 401);
  assert.equal(called, false);
});


test("product movement OpenAPI is a global traceability read without stock or valuation", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const operation = api.paths["/products/{productId}/movements"].get;
  assert.equal(operation.operationId, "listProductMovements");
  assert.deepEqual(operation["x-required-roles"], ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);
  assert.equal(operation.parameters.find((parameter: any) => parameter.name === "projectId")?.required, false);
  const page = api.components.schemas.ProductMovementPage;
  assert.deepEqual(page.required, ["productId", "projectId", "items"]);
  const item = api.components.schemas.ProductMovement;
  assert.deepEqual(item.required, ["id", "occurredAt", "direction", "projectId", "productId", "quantity", "transactionType", "transactionId", "shipmentLineId", "contractLineVersionId", "counterpartyId", "sourceAllocations"]);
  assert.equal(Object.hasOwn(item.properties, "stockOnHand"), false);
  assert.equal(Object.hasOwn(item.properties, "inventoryValue"), false);
});
