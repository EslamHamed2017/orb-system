import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const uuid7 = () => {
  const value = randomUUID();
  return `${value.slice(0, 14)}7${value.slice(15)}`;
};

integration("production project handlers persist one tenant-isolated audited project and sales contract atomically", async () => {
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  const tenantA = uuid7();
  const tenantB = uuid7();
  const userA = uuid7();
  const userB = uuid7();
  const customer = uuid7();
  const product = uuid7();
  const productB = uuid7();
  const supplierA = uuid7();
  const supplierB = uuid7();
  const tokenA = `project-a-${uuid7().replaceAll("-", "")}`;
  const tokenB = `project-b-${uuid7().replaceAll("-", "")}`;
  try {
    await sql.query('INSERT INTO "Tenant" ("id","slug","name") VALUES ($1,$2,$3),($4,$5,$6)', [tenantA, `project-api-a-${tenantA}`, "Project API A", tenantB, `project-api-b-${tenantB}`, "Project API B"]);
    const actors = [[userA, tenantA, tokenA, "A"], [userB, tenantB, tokenB, "B"]];
    for (const [user, tenant, token, label] of actors) {
      await sql.query('INSERT INTO "User" ("id","auth_subject","name_ar","name_en","locale","status","mfa_state","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())', [user, `project-api-${user}`, `مستخدم ${label}`, `Project user ${label}`, "en", "ACTIVE", "SATISFIED"]);
      await sql.query('INSERT INTO "UserRole" ("id","user_id","role") VALUES ($1,$2,$3)', [uuid7(), user, "OPERATIONS"]);
      await sql.query('INSERT INTO "TenantMembership" ("id","tenant_id","user_id","status") VALUES ($1,$2,$3,$4)', [uuid7(), tenant, user, "ACTIVE"]);
      await sql.query('INSERT INTO "Session" ("id","user_id","expires_at","token_hash","version") VALUES ($1,$2,now()+interval \'1 hour\',$3,1)', [uuid7(), user, createHash("sha256").update(token).digest("hex")]);
    }
    await sql.query('INSERT INTO "Customer" ("id","tenant_id","reference","legal_name","legal_name_ar","email") VALUES ($1,$2,$3,$4,$5,$6)', [customer, tenantA, "CUS-PROJECT-API", "Roaster One", "المحمصة الأولى", "project-api@example.test"]);
    await sql.query('INSERT INTO "Supplier" ("id","tenant_id","reference","registered_name","country_code","email","payment_currency") VALUES ($1,$2,$3,$4,$5,$6,$7),($8,$9,$10,$11,$12,$13,$14)', [supplierA, tenantA, "SUP-PROJECT-A", "Coast Exporters", "YE", "coast@example.test", "USD", supplierB, tenantB, "SUP-PROJECT-B", "Other Tenant Supplier", "ET", "other@example.test", "USD"]);
    await sql.query('INSERT INTO "CoffeeSpecification" ("id","tenant_id","reference","name_en","name_ar","origin","type","grade","crop_year","bag_type","standard_bag_weight","attributes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12),($13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)', [product, tenantA, "PROD-PROJECT-API", "Yemen Matari", "مطري يمني", "YE", "Arabica", "Matari", "2026", "Jute", 60, {}, productB, tenantB, "PROD-PROJECT-B", "Other Product", "منتج آخر", "ET", "Arabica", "Grade 1", "2026", "Jute", 60, {}]);

    process.env.DATABASE_URL = databaseUrl;
    process.env.ORB_APP_ORIGIN = "https://orb.example";
    const collection = await import("../../../src/app/api/projects/route.ts");
    const record = await import("../../../src/app/api/projects/[projectId]/route.ts");
    const purchaseRoute = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
    const activationRoute = await import("../../../src/app/api/projects/[projectId]/activate/route.ts");
    const supplierShipmentRoute = await import("../../../src/app/api/projects/[projectId]/supplier-shipments/route.ts");
    const headers = (token: string) => {
      const csrf = createHash("sha256").update(`orb-customer-csrf\0${token}`).digest("hex");
      return { cookie: `__Host-orb_session=${token}; __Host-orb_csrf=${csrf}`, origin: "https://orb.example", "x-csrf-token": csrf, "content-type": "application/json" };
    };
    const key = uuid7();
    const body = { customerId: customer, salesContract: { counterpartyId: customer, coffeeSpecificationId: product, effectiveDate: "2026-11-17", quantity: "100.000000", unitPrice: "4250.000000", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Jebel Ali", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityUnder: "0", quantityOver: "2.5", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" } } };
    const create = () => collection.POST(new Request("https://orb.example/api/projects", { method: "POST", headers: { ...headers(tokenA), "idempotency-key": key }, body: JSON.stringify(body) }));
    const [first, replay] = await Promise.all([create(), create()]);
    assert.equal(first.status, 201);
    assert.equal(replay.status, 201);
    const saved = await first.json() as { id: string; reference: string; customer: { reference: string }; salesContract: { reference: string; activeVersion: { id: string; product: { reference: string }; quantity: string } } };
    assert.deepEqual(await replay.json(), saved);
    assert.match(saved.reference, /^ORB-PRJ-\d{4}-\d{6}$/);
    assert.match(saved.salesContract.reference, /^ORB-SC-\d{4}-\d{6}$/);
    assert.equal(saved.customer.reference, "CUS-PROJECT-API");
    assert.equal(saved.salesContract.activeVersion.product.reference, "PROD-PROJECT-API");

    const purchaseBody = { counterpartyId: supplierA, coffeeSpecificationId: product, effectiveDate: "2026-11-18", quantity: "80", unitPrice: "4000", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Aden", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityOver: "2" } };
    const purchaseRequest = (counterpartyId: string, idempotencyKey: string, expectedVersion = 1) => new Request(`https://orb.example/api/projects/${saved.id}/purchase-contracts`, { method: "POST", headers: { ...headers(tokenA), "if-match": `"${expectedVersion}"`, "idempotency-key": idempotencyKey }, body: JSON.stringify({ ...purchaseBody, counterpartyId }) });
    const mutationAKey = uuid7();
    const purchaseResponse = await purchaseRoute.POST(purchaseRequest(supplierA, mutationAKey), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(purchaseResponse.status, 201);
    const withPurchase = await purchaseResponse.json() as { version: number; purchaseContracts: Array<{ id: string; reference: string; supplier: { reference: string }; activeVersion: { id: string; product: { reference: string }; quantity: string } }> };
    assert.equal(withPurchase.version, 2);
    assert.equal(withPurchase.purchaseContracts.length, 1);
    assert.match(withPurchase.purchaseContracts[0].reference, /^ORB-PC-\d{4}-\d{6}$/);
    assert.equal(withPurchase.purchaseContracts[0].supplier.reference, "SUP-PROJECT-A");
    assert.equal(withPurchase.purchaseContracts[0].activeVersion.product.reference, "PROD-PROJECT-API");
    const mutationB = await purchaseRoute.POST(purchaseRequest(supplierA, uuid7(), 2), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(mutationB.status, 201);
    const afterMutationB = await mutationB.json() as { version: number; purchaseContracts: Array<{ id: string; activeVersion: { id: string } }> };
    assert.equal(afterMutationB.version, 3, "mutation B commits after mutation A");
    const otherPurchase = afterMutationB.purchaseContracts.find(row => row.id !== withPurchase.purchaseContracts[0].id)!;
    const replayA = await purchaseRoute.POST(purchaseRequest(supplierA, mutationAKey), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(replayA.status, 201);
    assert.deepEqual(await replayA.json(), withPurchase, "retrying A after B must replay A's exact committed response, not the current aggregate");
    const isolated = await purchaseRoute.POST(purchaseRequest(supplierB, uuid7(), 3), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(isolated.status, 400, "a supplier owned by another tenant must not be linkable");
    const activateRequest = (token: string, idempotencyKey: string, expectedVersion = 3) => new Request(`https://orb.example/api/projects/${saved.id}/activate`, { method: "POST", headers: { ...headers(token), "if-match": `"${expectedVersion}"`, "idempotency-key": idempotencyKey } });
    const otherTenantActivation = await activationRoute.POST(activateRequest(tokenB, uuid7()), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(otherTenantActivation.status, 404, "another tenant cannot activate the project");
    const activationKeys = [uuid7(), uuid7()];
    const concurrentActivations = await Promise.all(activationKeys.map((key) => activationRoute.POST(activateRequest(tokenA, key), { params: Promise.resolve({ projectId: saved.id }) })));
    assert.deepEqual(concurrentActivations.map((response) => response.status).sort(), [200, 412], "the project row lock allows exactly one activation for one expected version");
    const winner = concurrentActivations.findIndex((response) => response.status === 200);
    const active = await concurrentActivations[winner].json() as { lifecycleState: string; version: number };
    assert.equal(active.lifecycleState, "ACTIVE");assert.equal(active.version, 4);
    const activationReplay = await activationRoute.POST(activateRequest(tokenA, activationKeys[winner]), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(activationReplay.status, 200);assert.deepEqual(await activationReplay.json(), active);

    const purchaseContractVersionId = withPurchase.purchaseContracts[0].activeVersion.id;
    const shipmentBody = { purchaseContractId: withPurchase.purchaseContracts[0].id, purchaseContractVersionId, supplierId: supplierA, reference: "ORB-SUP-PG-000001", coffeeSpecificationId: product, supplierLotReference: "LOT-PG-1", quantity: "20", bagCount: 320, bagWeight: "60", netWeight: "19200", grossWeight: "19400", origin: { countryCode: "YE", name: "Sana'a" }, loadLocation: { countryCode: "YE", name: "Aden Port" }, destination: { countryCode: "AE", name: "Jebel Ali Port" }, incoterm: "FOB", namedPlace: "Aden", containerNumbers: ["MSCU1234567"], sealNumbers: ["SL-991"], transport: { mode: "SEA", carrierName: "Ocean Line", reference: "BOOK-88", estimatedDepartureAt: "2026-12-01T00:00:00Z", estimatedArrivalAt: "2026-12-12T00:00:00Z" } };
    const shipmentRequest = (idempotencyKey: string, expectedVersion: number, body = shipmentBody, token = tokenA) => new Request(`https://orb.example/api/projects/${saved.id}/supplier-shipments`, { method: "POST", headers: { ...headers(token), "if-match": `"${expectedVersion}"`, "idempotency-key": idempotencyKey }, body: JSON.stringify(body) });
    const staleShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 99), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(staleShipment.status, 412, "stale project versions are rejected before shipment persistence");
    const draftContractShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 4), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(draftContractShipment.status, 404, "an unapproved purchase contract/version cannot source a shipment");
    await sql.query(`UPDATE "Contract" SET "state"='APPROVED' WHERE "id"=$1`, [withPurchase.purchaseContracts[0].id]);
    await sql.query(`UPDATE "ContractVersion" SET "state"='APPROVED' WHERE "id"=$1`, [purchaseContractVersionId]);
    await sql.query(`UPDATE "Contract" SET "state"='APPROVED' WHERE "id"=$1`, [otherPurchase.id]);
    await sql.query(`UPDATE "ContractVersion" SET "state"='APPROVED' WHERE "id"=$1`, [otherPurchase.activeVersion.id]);
    for (const lifecycle of ["DRAFT", "CANCELLED"] as const) {
      await sql.query('UPDATE "Project" SET "lifecycle_state"=$1 WHERE "id"=$2', [lifecycle, saved.id]);
      const rejected = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 4), { params: Promise.resolve({ projectId: saved.id }) });
      assert.equal(rejected.status, 404, `${lifecycle.toLowerCase()} projects cannot accept supplier shipments`);
    }
    await sql.query(`UPDATE "Project" SET "lifecycle_state"='ACTIVE' WHERE "id"=$1`, [saved.id]);
    await sql.query(`UPDATE "CoffeeSpecification" SET "status"='INACTIVE' WHERE "id"=$1`, [product]);
    const inactiveProductShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 4), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(inactiveProductShipment.status, 404, "inactive products cannot source a shipment");
    await sql.query(`UPDATE "CoffeeSpecification" SET "status"='ACTIVE' WHERE "id"=$1`, [product]);
    const wrongVersionShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 4, { ...shipmentBody, purchaseContractVersionId: otherPurchase.activeVersion.id }), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(wrongVersionShipment.status, 404, "the supplied contract version must be the approved active version");
    for (const body of [{ ...shipmentBody, supplierId: supplierB }, { ...shipmentBody, coffeeSpecificationId: productB }]) {
      const crossTenantShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 4, body), { params: Promise.resolve({ projectId: saved.id }) });
      assert.equal(crossTenantShipment.status, 400, "cross-tenant shipment inputs are rejected");
    }
    const shipmentKey = uuid7();
    const firstShipmentResponse = await supplierShipmentRoute.POST(shipmentRequest(shipmentKey, 4), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(firstShipmentResponse.status, 201);
    const firstShipment = await firstShipmentResponse.json() as { id: string; reference: string; activeDataset: { containerNumbers: string[]; transport: { estimatedArrivalAt: string } } };
    assert.match(firstShipment.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal("reference" in firstShipment.activeDataset, false);
    assert.equal(firstShipment.reference, "ORB-SUP-PG-000001");
    assert.deepEqual(firstShipment.activeDataset.containerNumbers, ["MSCU1234567"]);
    assert.equal(firstShipment.activeDataset.transport.estimatedArrivalAt, "2026-12-12T00:00:00.000Z");
    const replayShipment = await supplierShipmentRoute.POST(shipmentRequest(shipmentKey, 4), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(replayShipment.status, 201);
    assert.deepEqual(await replayShipment.json(), firstShipment);
    const shipmentBinding = await sql.query('SELECT "purchase_contract_id","purchase_contract_version_id" FROM "SupplierShipmentDataset" WHERE "shipment_id"=$1', [firstShipment.id]);
    assert.deepEqual(shipmentBinding.rows[0], { purchase_contract_id: withPurchase.purchaseContracts[0].id, purchase_contract_version_id: purchaseContractVersionId }, "dataset is immutably bound to the exact approved contract version");
    const secondShipmentResponse = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 5, { ...shipmentBody, reference: "ORB-SUP-PG-000002", supplierLotReference: "LOT-PG-2", containerNumbers: ["MSCU7654321"], sealNumbers: ["SL-992"] }), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(secondShipmentResponse.status, 201);
    const secondShipment = await secondShipmentResponse.json() as { id: string };
    assert.notEqual(secondShipment.id, firstShipment.id, "one purchase contract may plan multiple independent shipment units");
    const overAllocatedShipment = await supplierShipmentRoute.POST(shipmentRequest(uuid7(), 6, { ...shipmentBody, reference: "ORB-SUP-PG-OVER", supplierLotReference: "LOT-PG-OVER", quantity: "42", containerNumbers: ["MSCU9999999"], sealNumbers: ["SL-999"] }), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(overAllocatedShipment.status, 400, "aggregate supplier shipments cannot exceed the approved contract quantity plus tolerance");
    assert.equal((await overAllocatedShipment.json() as { code: string }).code, "VALIDATION_FAILED");
    const shipmentWorkspace = await record.GET(new Request(`https://orb.example/api/projects/${saved.id}`, { headers: headers(tokenA) }), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(shipmentWorkspace.status, 200);
    assert.deepEqual((await shipmentWorkspace.json() as { supplierShipments: Array<{ id: string }> }).supplierShipments.map(row => row.id).sort(), [firstShipment.id, secondShipment.id].sort());

    const listed = await collection.GET(new Request("https://orb.example/api/projects", { headers: headers(tokenA) }));
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json() as { items: Array<{ id: string }> }).items.map((row) => row.id), [saved.id]);
    const hidden = await collection.GET(new Request("https://orb.example/api/projects", { headers: headers(tokenB) }));
    assert.equal(hidden.status, 200);
    assert.deepEqual((await hidden.json() as { items: unknown[] }).items, []);
    const forbiddenRecord = await record.GET(new Request(`https://orb.example/api/projects/${saved.id}`, { headers: headers(tokenB) }), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(forbiddenRecord.status, 404);
    const counts = await sql.query(`SELECT
      (SELECT count(*)::int FROM "Project" WHERE "id"=$1) projects,
      (SELECT count(*)::int FROM "Contract" WHERE "project_id"=$1) contracts,
      (SELECT count(*)::int FROM "ContractVersion" cv JOIN "Contract" c ON c."id"=cv."contract_id" WHERE c."project_id"=$1) versions,
      (SELECT count(*)::int FROM "ProjectAuditEvent" WHERE "project_id"=$1 AND "actor_id"=$2) audit,
      (SELECT count(*)::int FROM "SupplierShipment" WHERE "project_id"=$1 AND "tenant_id"=$3) shipments`, [saved.id, userA, tenantA]);
    assert.deepEqual(counts.rows[0], { projects: 1, contracts: 3, versions: 3, audit: 6, shipments: 2 });
  } finally {
    await sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
