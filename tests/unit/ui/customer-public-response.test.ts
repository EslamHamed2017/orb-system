import assert from "node:assert/strict";
import test from "node:test";

import { toPublicCustomer } from "../../../src/modules/customers/customer-response.ts";
import { isServerCustomer } from "../../../src/ui/features/masters/customer-response-validation.ts";

const record = {
  id: "11111111-1111-4111-8111-111111111111", tenantId: "22222222-2222-4222-8222-222222222222",
  reference: "CUS-101", legalName: "Atlas Trading", contactName: "Mona Ali", email: "accounts@atlas.example",
  phone: "+971 50 123 4567", legalNameAr: "شركة أطلس", countryCode: "AE", taxRegistrationNumber: "100200300", paymentTermsDays: 30, billingAddress: { line1: "Coffee District", line2: null, city: "Dubai", region: "Dubai", postalCode: null }, status: "ACTIVE" as const, version: 1,
  createdAt: "2026-11-16T10:00:00.000Z", updatedAt: "2026-11-16T10:00:00.000Z",
};

test("customer response projects persisted records to a closed public DTO", () => {
  const response = toPublicCustomer(record);
  assert.deepEqual(response, {
    id: record.id, reference: "CUS-101", legalName: "Atlas Trading", contactName: "Mona Ali",
    email: "accounts@atlas.example", phone: "+971 50 123 4567", legalNameAr: "شركة أطلس", countryCode: "AE", taxRegistrationNumber: "100200300", paymentTermsDays: 30, billingAddress: { line1: "Coffee District", line2: null, city: "Dubai", region: "Dubai", postalCode: null }, status: "ACTIVE", version: 1,
  });
  assert.equal(isServerCustomer(response), true);
  assert.equal("tenantId" in response, false);
  assert.equal("createdAt" in response, false);
  assert.equal("updatedAt" in response, false);
});


test("customer collection route projects service records before JSON serialization", async () => {
  const { createPartyListHandler } = await import("../../../src/app/api/customers/route.ts");
  const handler = createPartyListHandler({
    authenticate: async () => ({ userId: record.id, tenantId: record.tenantId, roles: ["OWNER_ADMIN"] }),
    list: async () => [record],
  });
  const response = await handler(new Request("https://orb.example/api/customers", { headers: { accept: "application/vnd.orb.customer+json;version=2" } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(isServerCustomer(body.items[0]), true);
  assert.equal("tenantId" in body.items[0], false);
});


test("customer record route projects service records before JSON serialization", async () => {
  const { createPartyGetHandler } = await import("../../../src/app/api/customers/[customerId]/route.ts");
  const handler = createPartyGetHandler({
    authenticate: async () => ({ userId: record.id, tenantId: record.tenantId, roles: ["OWNER_ADMIN"] }),
    get: async () => record,
  });
  const response = await handler(new Request(`https://orb.example/api/customers/${record.id}`, { headers: { accept: "application/vnd.orb.customer+json;version=2" } }), { params: Promise.resolve({ customerId: record.id }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(isServerCustomer(body), true);
  assert.equal("tenantId" in body, false);
});


test("customer route maps domain validation failures to stable problem details", async () => {
  const { createPartyListHandler } = await import("../../../src/app/api/customers/route.ts");
  const { CustomerProblem } = await import("../../../src/modules/customers/customer-service.ts");
  const get = createPartyListHandler({
    authenticate: async () => ({ userId: record.id, tenantId: record.tenantId, roles: ["OWNER_ADMIN"] }),
    list: async () => { throw new CustomerProblem("VALIDATION_FAILED", 400, "Invalid customer filter"); },
  });
  const response = await get(new Request("https://orb.example/api/customers", { headers: { accept: "application/vnd.orb.customer+json;version=2" } }));
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("content-type"), "application/problem+json");
  assert.deepEqual(await response.json().then(({ correlationId: _correlationId, ...body }) => body), {
    type: "https://orb.example/problems/validation-failed", title: "VALIDATION_FAILED", status: 400, detail: "The request is invalid.", code: "VALIDATION_FAILED",
  });
});


test("customer route does not expose unknown dependency errors as public problem details", async () => {
  const { createPartyListHandler } = await import("../../../src/app/api/customers/route.ts");
  const injected = { code: "INJECTED_ERROR", status: 418, message: "database secret" };
  const get = createPartyListHandler({ authenticate: async () => ({ userId: record.id, tenantId: record.tenantId, roles: ["OWNER_ADMIN"] }), list: async () => { throw injected; } });
  await assert.rejects(() => get(new Request("https://orb.example/api/customers", { headers: { accept: "application/vnd.orb.customer+json;version=2" } })), (error) => error === injected);
});


test("customer DTO negotiation preserves v1 clients while v2 exposes the business profile", () => {
  const legacy = toPublicCustomer(record, 1);
  assert.deepEqual(Object.keys(legacy).sort(), ["contactName", "email", "id", "legalName", "phone", "reference", "status", "version"]);
  const current = toPublicCustomer(record, 2);
  assert.equal(current.legalNameAr, "شركة أطلس");
  assert.equal(current.countryCode, "AE");
});
