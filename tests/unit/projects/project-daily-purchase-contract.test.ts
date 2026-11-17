import assert from "node:assert/strict";
import test from "node:test";
import { createProjectDailyService, type ProjectDailyRecord, type ProjectDailyRepository } from "../../../src/modules/projects/project-daily-service.ts";

const principal = { tenantId: "019a5f9b-7c00-7000-8000-000000000001", userId: "019a5f9b-7c00-7000-8000-000000000002", roles: ["OPERATIONS"] };
const projectId = "019a5f9b-7c00-7000-8000-000000000003";
const supplierId = "019a5f9b-7c00-7000-8000-000000000004";
const productId = "019a5f9b-7c00-7000-8000-000000000005";
const purchase = { id: "019a5f9b-7c00-7000-8000-000000000006", reference: "ORB-PC-2026-000001", state: "DRAFT", version: 1, supplier: { id: supplierId, reference: "SUP-1", registeredName: "Coast Exporters", displayNameAr: "مصدرو الساحل" }, activeVersion: { revisionNo: 1, effectiveDate: "2026-11-17", product: { id: productId, reference: "COF-1", nameEn: "Yemen Matari", nameAr: "مطري يمني" }, quantity: "20.000000", unitPrice: "4100.000000", currency: "USD", route: "FOREIGN_TO_FOREIGN" as const, incoterm: "FOB", namedPlace: "Jebel Ali", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityUnder: "0.000000", quantityOver: "2.000000", netWeightUnder: "0.000000", netWeightOver: "0.000000", grossWeightUnder: "0.000000", grossWeightOver: "0.000000" } } };
const record = { id: projectId, reference: "ORB-PRJ-2026-000001", lifecycleState: "DRAFT", managementCurrency: "USD", version: 2, customer: { id: "019a5f9b-7c00-7000-8000-000000000007", reference: "CUS-1", legalName: "Roaster", legalNameAr: null }, salesContract: { ...purchase, supplier: undefined, reference: "ORB-SC-2026-000001" }, purchaseContracts: [purchase] } as unknown as ProjectDailyRecord;

test("creates one persisted purchase contract against the expected project version", async () => {
  let received: unknown;
  const repository: ProjectDailyRepository = { list: async () => [], get: async () => null, create: async () => record, createPurchaseContract: async (input) => { received = input; return record; } };
  const result = await createProjectDailyService(repository).createPurchaseContract({ principal, projectId, expectedVersion: 1, input: { counterpartyId: supplierId, coffeeSpecificationId: productId, effectiveDate: "2026-11-17", quantity: "20", unitPrice: "4100", currency: "usd", route: "FOREIGN_TO_FOREIGN", incoterm: "fob", namedPlace: "Jebel Ali", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityOver: "2" } } });
  assert.equal(result.version, 2);
  assert.deepEqual(result.purchaseContracts, [purchase]);
  assert.deepEqual(received, { tenantId: principal.tenantId, actorId: principal.userId, projectId, expectedVersion: 1, supplierId, facts: { counterpartyId: supplierId, coffeeSpecificationId: productId, effectiveDate: "2026-11-17", quantity: "20.000000", unitPrice: "4100.000000", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Jebel Ali", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityUnder: "0.000000", quantityOver: "2.000000", netWeightUnder: "0.000000", netWeightOver: "0.000000", grossWeightUnder: "0.000000", grossWeightOver: "0.000000" } } });
});


test("purchase-contract route enforces quoted If-Match and returns RFC 9457 problems", async () => {
  const { createPurchaseContractPostHandler } = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
  const body = { counterpartyId: supplierId };
  const url = `https://orb.example/api/projects/${projectId}/purchase-contracts`;
  const request = (ifMatch?: string) => new Request(url, { method: "POST", headers: { ...(ifMatch === undefined ? {} : { "if-match": ifMatch }), "content-type": "application/json", "x-correlation-id": "corr-purchase-1" }, body: JSON.stringify(body) });
  const handler = createPurchaseContractPostHandler({ authenticate: async () => principal, create: async (input) => record });
  for (const [ifMatch,status,code] of [[undefined,428,"PRECONDITION_REQUIRED"],["1",400,"VALIDATION_FAILED"],["W/\"1\"",400,"VALIDATION_FAILED"],["\"0\"",400,"VALIDATION_FAILED"],["\"1\", \"2\"",400,"VALIDATION_FAILED"]] as const) {
    const response=await handler(request(ifMatch),{params:Promise.resolve({projectId})});
    assert.equal(response.status,status);
    assert.equal(response.headers.get("content-type"),"application/problem+json");
    assert.equal(response.headers.get("cache-control"),"no-store");
    const problem=await response.json();
    assert.deepEqual(Object.keys(problem).sort(),["code","correlationId","status","title","type"]);
    assert.equal(problem.code,code);assert.equal(problem.status,status);assert.equal(problem.correlationId,"corr-purchase-1");
    assert.equal(typeof problem.title,"string");assert.match(problem.type,/^https:\/\/orb\.example\/problems\//);
  }
});

test("purchase-contract route forwards a quoted optimistic version and remains fail-closed", async () => {
  const { createPurchaseContractPostHandler } = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
  const denied = await createPurchaseContractPostHandler({ authenticate: async () => null })(new Request("https://orb.example/api/projects/x/purchase-contracts", { method: "POST", headers:{"x-correlation-id":"denied-correlation"} }), { params: Promise.resolve({ projectId }) });
  assert.equal(denied.status, 401);assert.equal(denied.headers.get("content-type"),"application/problem+json");assert.equal((await denied.json()).correlationId,"denied-correlation");
  let received: unknown;
  const handler = createPurchaseContractPostHandler({ authenticate: async () => principal, create: async (input) => { received = input; return record; } });
  const body = { counterpartyId: supplierId };
  const response = await handler(new Request(`https://orb.example/api/projects/${projectId}/purchase-contracts`, { method: "POST", headers: { "if-match": '"1"', "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ projectId }) });
  assert.equal(response.status, 201);
  assert.deepEqual({ projectId: (received as any).projectId, expectedVersion: (received as any).expectedVersion, body: (received as any).body }, { projectId, expectedVersion: 1, body });
  const unavailable = createPurchaseContractPostHandler({ authenticate: async () => principal, create: async () => { throw new Error("database offline"); } });
  const unavailableResponse = await unavailable(new Request(`https://orb.example/api/projects/${projectId}/purchase-contracts`, { method: "POST", headers: { "if-match": '"1"', "content-type": "application/json", "x-correlation-id":"failure-correlation" }, body: JSON.stringify(body) }), { params: Promise.resolve({ projectId }) });
  assert.equal(unavailableResponse.status, 503);assert.equal(unavailableResponse.headers.get("content-type"),"application/problem+json");assert.equal((await unavailableResponse.json()).correlationId,"failure-correlation");
});


test("rejects malformed tolerance objects, unknown tolerance fields, and impossible calendar dates", async () => {
  let calls = 0;
  const repository: ProjectDailyRepository = { list: async () => [], get: async () => null, create: async () => record, createPurchaseContract: async () => { calls += 1; return record; } };
  const service = createProjectDailyService(repository);
  const base = { counterpartyId: supplierId, coffeeSpecificationId: productId, effectiveDate: "2024-02-29", quantity: "20", unitPrice: "4100", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Aden", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: {} };
  for (const tolerances of [null, [], "0", 1, { unexpected: "0" }]) {
    await assert.rejects(service.createPurchaseContract({ principal, projectId, expectedVersion: 1, input: { ...base, tolerances } }), (error: unknown) => (error as {code?: string; status?: number}).code === "VALIDATION_FAILED" && (error as {status?: number}).status === 400);
  }
  for (const effectiveDate of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-01-00", "2026-1-01", "2026-01-01T00:00:00Z"]) {
    await assert.rejects(service.createPurchaseContract({ principal, projectId, expectedVersion: 1, input: { ...base, effectiveDate } }), (error: unknown) => (error as {code?: string; status?: number}).code === "VALIDATION_FAILED" && (error as {status?: number}).status === 400);
  }
  await service.createPurchaseContract({ principal, projectId, expectedVersion: 1, input: base });
  assert.equal(calls, 1, "a real leap day remains valid");
});
