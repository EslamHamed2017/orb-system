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
    await sql.query('INSERT INTO "CoffeeSpecification" ("id","tenant_id","reference","name_en","name_ar","origin","type","grade","crop_year","bag_type","standard_bag_weight","attributes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [product, tenantA, "PROD-PROJECT-API", "Yemen Matari", "مطري يمني", "YE", "Arabica", "Matari", "2026", "Jute", 60, {}]);

    process.env.DATABASE_URL = databaseUrl;
    process.env.ORB_APP_ORIGIN = "https://orb.example";
    const collection = await import("../../../src/app/api/projects/route.ts");
    const record = await import("../../../src/app/api/projects/[projectId]/route.ts");
    const purchaseRoute = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
    const activationRoute = await import("../../../src/app/api/projects/[projectId]/activate/route.ts");
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
    const saved = await first.json() as { id: string; reference: string; customer: { reference: string }; salesContract: { reference: string; activeVersion: { product: { reference: string }; quantity: string } } };
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
    const withPurchase = await purchaseResponse.json() as { version: number; purchaseContracts: Array<{ reference: string; supplier: { reference: string }; activeVersion: { product: { reference: string }; quantity: string } }> };
    assert.equal(withPurchase.version, 2);
    assert.equal(withPurchase.purchaseContracts.length, 1);
    assert.match(withPurchase.purchaseContracts[0].reference, /^ORB-PC-\d{4}-\d{6}$/);
    assert.equal(withPurchase.purchaseContracts[0].supplier.reference, "SUP-PROJECT-A");
    assert.equal(withPurchase.purchaseContracts[0].activeVersion.product.reference, "PROD-PROJECT-API");
    const mutationB = await purchaseRoute.POST(purchaseRequest(supplierA, uuid7(), 2), { params: Promise.resolve({ projectId: saved.id }) });
    assert.equal(mutationB.status, 201);
    assert.equal((await mutationB.json() as {version:number}).version, 3, "mutation B commits after mutation A");
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
      (SELECT count(*)::int FROM "ProjectAuditEvent" WHERE "project_id"=$1 AND "actor_id"=$2) audit`, [saved.id, userA]);
    assert.deepEqual(counts.rows[0], { projects: 1, contracts: 3, versions: 3, audit: 4 });
  } finally {
    await sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
