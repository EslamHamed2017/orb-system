import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

/**
 * Shipment execution on PostgreSQL through the real route handlers:
 * create project + contracts + shipments → edit draft → confirm (no approval step) → transit → arrival,
 * plus separation of duties, stale versions, idempotent retries, cancellation and tenant isolation.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const uuid7 = () => { const value = randomUUID(); return `${value.slice(0, 14)}7${value.slice(15)}`; };
const ORIGIN = "https://orb.example";

integration("supplier and customer shipments run the full approval and execution lifecycle", async () => {
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  const tenant = uuid7(), otherTenant = uuid7(), customer = uuid7(), product = uuid7(), supplier = uuid7();
  const users = { ops: uuid7(), owner: uuid7(), owner2: uuid7(), finance: uuid7(), outsider: uuid7() };
  const tokens = Object.fromEntries(Object.keys(users).map((name) => [name, `ship-${name}-${uuid7().replaceAll("-", "")}`])) as Record<keyof typeof users, string>;
  const roles: Record<keyof typeof users, string> = { ops: "OPERATIONS", owner: "OWNER_ADMIN", owner2: "OWNER_ADMIN", finance: "FINANCE_VIEWER", outsider: "OWNER_ADMIN" };
  try {
    await sql.query('INSERT INTO "Tenant" ("id","slug","name") VALUES ($1,$2,$3),($4,$5,$6)', [tenant, `ship-${tenant}`, "Shipments", otherTenant, `ship-other-${otherTenant}`, "Other"]);
    for (const name of Object.keys(users) as (keyof typeof users)[]) {
      const user = users[name];
      await sql.query('INSERT INTO "User" ("id","auth_subject","name_ar","name_en","locale","status","mfa_state","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())', [user, `ship-${user}`, `مستخدم ${name}`, `User ${name}`, "en", "ACTIVE", "SATISFIED"]);
      await sql.query('INSERT INTO "UserRole" ("id","user_id","role") VALUES ($1,$2,$3)', [uuid7(), user, roles[name]]);
      await sql.query('INSERT INTO "TenantMembership" ("id","tenant_id","user_id","status") VALUES ($1,$2,$3,$4)', [uuid7(), name === "outsider" ? otherTenant : tenant, user, "ACTIVE"]);
      await sql.query('INSERT INTO "Session" ("id","user_id","expires_at","token_hash","version","mfa_satisfied_at") VALUES ($1,$2,now()+interval \'1 hour\',$3,1,now())', [uuid7(), user, createHash("sha256").update(tokens[name]).digest("hex")]);
    }
    await sql.query('INSERT INTO "Customer" ("id","tenant_id","reference","legal_name","legal_name_ar","email") VALUES ($1,$2,$3,$4,$5,$6)', [customer, tenant, `CUS-${tenant.slice(-6).toUpperCase()}`, "Roaster One", "المحمصة الأولى", "buyer@example.test"]);
    await sql.query('INSERT INTO "Supplier" ("id","tenant_id","reference","registered_name","country_code","email","payment_currency") VALUES ($1,$2,$3,$4,$5,$6,$7)', [supplier, tenant, `SUP-${tenant.slice(-6).toUpperCase()}`, "Coast Exporters", "YE", "coast@example.test", "USD"]);
    await sql.query('INSERT INTO "CoffeeSpecification" ("id","tenant_id","reference","name_en","name_ar","origin","type","grade","crop_year","bag_type","standard_bag_weight","attributes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [product, tenant, `PROD-${tenant.slice(-6).toUpperCase()}`, "Yemen Matari", "مطري يمني", "YE", "Arabica", "Matari", "2026", "Jute", 60, {}]);

    process.env.DATABASE_URL = databaseUrl;
    process.env.ORB_APP_ORIGIN = ORIGIN;
    process.env.ORB_ALLOWED_ORIGINS = ORIGIN;
    process.env.ORB_OWNER_MFA_REQUIRED = "0";
    const headers = (who: keyof typeof users, extra: Record<string, string> = {}) => {
      const csrf = createHash("sha256").update(`orb-customer-csrf\0${tokens[who]}`).digest("hex");
      return { cookie: `__Host-orb_session=${tokens[who]}; __Host-orb_csrf=${csrf}`, origin: ORIGIN, "x-csrf-token": csrf, "content-type": "application/json", "idempotency-key": uuid7(), ...extra };
    };
    const post = (path: string, who: keyof typeof users, body: unknown, extra: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: headers(who, extra), body: JSON.stringify(body) });
    const put = (path: string, who: keyof typeof users, body: unknown) => new Request(`${ORIGIN}${path}`, { method: "PUT", headers: headers(who), body: JSON.stringify(body) });
    const get = (path: string, who: keyof typeof users) => new Request(`${ORIGIN}${path}`, { headers: headers(who) });
    const params = <T>(value: T) => ({ params: Promise.resolve(value) });

    // ---- set up an active project with approved sales + purchase contracts and one shipment each ----
    const projects = await import("../../../src/app/api/projects/route.ts");
    const purchase = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
    const activate = await import("../../../src/app/api/projects/[projectId]/activate/route.ts");
    const createSupplierShipment = await import("../../../src/app/api/projects/[projectId]/supplier-shipments/route.ts");
    const createSalesShipment = await import("../../../src/app/api/projects/[projectId]/sales-shipments/route.ts");
    const tolerances = { quantityUnder: "0", quantityOver: "2.5", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" };
    const created = await projects.POST(post("/api/projects", "ops", { customerId: customer, salesContract: { counterpartyId: customer, coffeeSpecificationId: product, effectiveDate: "2026-11-17", quantity: "100", unitPrice: "4250", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Jebel Ali", paymentTerms: "30 days", documentTerms: "Original BL", tolerances } }));
    assert.equal(created.status, 201, await created.clone().text());
    const project = await created.json() as { id: string; salesContract: { id: string; activeVersion: { id: string } } };
    const withPurchase = await purchase.POST(post(`/api/projects/${project.id}/purchase-contracts`, "ops", { counterpartyId: supplier, coffeeSpecificationId: product, effectiveDate: "2026-11-18", quantity: "100", unitPrice: "4000", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Aden", paymentTerms: "30 days", documentTerms: "Original BL", tolerances: { quantityOver: "2" } }, { "if-match": '"1"' }), params({ projectId: project.id }));
    assert.equal(withPurchase.status, 201, await withPurchase.clone().text());
    const purchaseContract = (await withPurchase.json() as { purchaseContracts: { id: string; activeVersion: { id: string } }[] }).purchaseContracts[0];
    // Saving the supplier contract confirms both contracts and starts the project — no activation or approval step.
    const submitContract = await import("../../../src/app/api/contracts/[contractId]/submit/route.ts");
    for (const contractId of [project.salesContract.id, purchaseContract.id]) {
      assert.equal((await submitContract.POST(post(`/api/contracts/${contractId}/submit`, "ops", {}), params({ contractId }))).status, 409, "already confirmed");
    }
    assert.equal((await activate.POST(post(`/api/projects/${project.id}/activate`, "ops", {}, { "if-match": '"3"' }), params({ projectId: project.id }))).status >= 400, true, "already in progress");
    const transport = { mode: "SEA", carrierName: "Ocean Line", reference: "BOOK-88", estimatedDepartureAt: "2026-12-01T00:00:00Z", estimatedArrivalAt: "2026-12-12T00:00:00Z" };
    const inbound = await createSupplierShipment.POST(post(`/api/projects/${project.id}/supplier-shipments`, "ops", { purchaseContractId: purchaseContract.id, purchaseContractVersionId: purchaseContract.activeVersion.id, supplierId: supplier, reference: `IN-${tenant.slice(-6).toUpperCase()}`, coffeeSpecificationId: product, supplierLotReference: "LOT-1", quantity: "20", bagCount: 320, bagWeight: "60", netWeight: "19200", grossWeight: "19400", origin: { countryCode: "YE", name: "Sana'a" }, loadLocation: { countryCode: "YE", name: "Aden Port" }, destination: { countryCode: "AE", name: "Jebel Ali Port" }, incoterm: "FOB", namedPlace: "Aden", containerNumbers: ["MSCU1234567"], sealNumbers: ["SL-991"], transport }, { "if-match": '"3"' }), params({ projectId: project.id }));
    assert.equal(inbound.status, 201, await inbound.clone().text());
    const supplierShipmentId = (await inbound.json() as { id: string }).id;
    const outbound = await createSalesShipment.POST(post(`/api/projects/${project.id}/sales-shipments`, "ops", { salesContractId: project.salesContract.id, salesContractVersionId: project.salesContract.activeVersion.id, customerId: customer, reference: `OUT-${tenant.slice(-6).toUpperCase()}`, coffeeSpecificationId: product, customerPurchaseOrderReference: "PO-7", quantity: "20", bagCount: 320, bagWeight: "60", netWeight: "19200", grossWeight: "19400", origin: { countryCode: "YE", name: "Sana'a" }, loadLocation: { countryCode: "AE", name: "Jebel Ali Port" }, dischargeLocation: { countryCode: "DE", name: "Hamburg" }, destination: { countryCode: "DE", name: "Hamburg" }, incoterm: "FOB", namedPlace: "Jebel Ali", containerNumbers: ["MSCU7654321"], sealNumbers: ["SL-777"], transport }, { "if-match": '"4"' }), params({ projectId: project.id }));
    assert.equal(outbound.status, 201, await outbound.clone().text());
    const salesShipmentId = (await outbound.json() as { id: string }).id;

    // ---- routes under test ----
    const supplierDetail = await import("../../../src/app/api/supplier-shipments/[shipmentId]/route.ts");
    const supplierDatasets = await import("../../../src/app/api/supplier-shipments/[shipmentId]/datasets/route.ts");
    const supplierSubmit = await import("../../../src/app/api/supplier-shipments/[shipmentId]/submit/route.ts");
    const supplierConfirm = await import("../../../src/app/api/supplier-shipments/[shipmentId]/confirm/route.ts");
    const supplierTransition = await import("../../../src/app/api/supplier-shipments/[shipmentId]/execution-transitions/route.ts");
    const salesDetail = await import("../../../src/app/api/sales-shipments/[shipmentId]/route.ts");
    const salesSource = await import("../../../src/app/api/sales-shipments/[shipmentId]/primary-source/route.ts");
    const salesSubmit = await import("../../../src/app/api/sales-shipments/[shipmentId]/submit/route.ts");
    const salesTransition = await import("../../../src/app/api/sales-shipments/[shipmentId]/execution-transitions/route.ts");
    const approvals = await import("../../../src/app/api/approvals/route.ts");
      const inId = params({ shipmentId: supplierShipmentId }), outId = params({ shipmentId: salesShipmentId });
    type View = { version: number; executionState: string; availableActions: string[]; dataset: { revisionNo: number; quantity: string; state: string; containerNumbers: string[] }; revisions: unknown[]; pendingApproval: { id: string } | null; lastDecision: { decision: string; comment: string | null } | null; events: { fromState: string; toState: string; reason: string | null }[]; history: { action: string }[]; quantities: { remaining: string }; primarySource: { id: string } | null };
    const read = async (response: Response) => { assert.ok(response.status < 300, `${response.status} ${await response.clone().text()}`); return await response.json() as View; };

    // Detail: everyone in the tenant can read; another tenant gets 404.
    let view = await read(await supplierDetail.GET(get(`/api/supplier-shipments/${supplierShipmentId}`, "finance"), inId));
    assert.equal(view.executionState, "DRAFT");
    assert.deepEqual(view.availableActions, [], "finance is read-only");
    view = await read(await supplierDetail.GET(get(`/api/supplier-shipments/${supplierShipmentId}`, "ops"), inId));
    assert.deepEqual(view.availableActions, ["REVISE", "SUBMIT_CONFIRMATION", "CANCEL"]);
    assert.equal((await supplierDetail.GET(get(`/api/supplier-shipments/${supplierShipmentId}`, "outsider"), inId)).status, 404);

    // Edit the draft: new revision, old one superseded; over-contract quantity refused; stale version refused.
    const tooMuch = await supplierDatasets.POST(post(`/api/supplier-shipments/${supplierShipmentId}/datasets`, "ops", { expectedVersion: view.version, reason: "More bags", changes: { quantity: "150" } }), inId);
    assert.equal(tooMuch.status, 422);
    view = await read(await supplierDatasets.POST(post(`/api/supplier-shipments/${supplierShipmentId}/datasets`, "ops", { expectedVersion: view.version, reason: "Supplier added a container", changes: { quantity: "21", containerNumbers: ["MSCU1234567", "MSCU9999999"], bagCount: 350 } }), inId));
    assert.equal(view.dataset.revisionNo, 2);
    assert.equal(view.dataset.quantity, "21.000000");
    assert.deepEqual(view.dataset.containerNumbers, ["MSCU1234567", "MSCU9999999"]);
    assert.equal(view.revisions.length, 2);
    const stale = await supplierDatasets.POST(post(`/api/supplier-shipments/${supplierShipmentId}/datasets`, "ops", { expectedVersion: view.version - 1, reason: "Old screen", changes: { notes: "x" } }), inId);
    assert.equal(stale.status, 412);

    // Confirming is one step (no approval): finance cannot confirm; operations confirms and the shipment is CONFIRMED at once.
    assert.equal((await supplierConfirm.POST(post(`/api/supplier-shipments/${supplierShipmentId}/confirm`, "ops", {}), inId)).status, 409, "not confirmed yet");
    assert.equal((await supplierSubmit.POST(post(`/api/supplier-shipments/${supplierShipmentId}/submit`, "finance", { expectedVersion: view.version }), inId)).status, 403);
    view = await read(await supplierSubmit.POST(post(`/api/supplier-shipments/${supplierShipmentId}/submit`, "ops", { expectedVersion: view.version }), inId));
    assert.equal(view.pendingApproval, null);
    assert.equal(view.executionState, "CONFIRMED");
    assert.equal(view.dataset.state, "APPROVED");
    assert.equal((await approvals.GET(get("/api/approvals", "ops") as never)).status, 403);
    const inbox = await (await approvals.GET(get("/api/approvals", "owner") as never)).json() as { items: { id: string; subjectId: string }[] };
    assert.ok(!inbox.items.some((item) => item.subjectId === supplierShipmentId), "nothing waits for approval");
    assert.equal((await supplierConfirm.POST(post(`/api/supplier-shipments/${supplierShipmentId}/confirm`, "ops", {}), inId)).status, 200);

    // Transit with an idempotent retry, then arrival. Invalid jumps are refused.
    const retryKey = uuid7();
    assert.equal((await supplierTransition.POST(post(`/api/supplier-shipments/${supplierShipmentId}/execution-transitions`, "ops", { expectedVersion: view.version, toState: "RECEIVED" }), inId)).status, 409, "cannot skip transit");
    view = await read(await supplierTransition.POST(post(`/api/supplier-shipments/${supplierShipmentId}/execution-transitions`, "ops", { expectedVersion: view.version, toState: "IN_TRANSIT" }, { "idempotency-key": retryKey }), inId));
    const retried = await read(await supplierTransition.POST(post(`/api/supplier-shipments/${supplierShipmentId}/execution-transitions`, "ops", { expectedVersion: view.version - 1, toState: "IN_TRANSIT" }, { "idempotency-key": retryKey }), inId));
    assert.equal(retried.version, view.version, "a retried request does not apply twice");
    view = await read(await supplierTransition.POST(post(`/api/supplier-shipments/${supplierShipmentId}/execution-transitions`, "ops", { expectedVersion: view.version, toState: "RECEIVED", reason: "Discharged at Jebel Ali" }), inId));
    assert.equal(view.executionState, "RECEIVED");
    assert.deepEqual(view.events.map((event) => `${event.fromState}->${event.toState}`), ["IN_TRANSIT->RECEIVED", "CONFIRMED->IN_TRANSIT", "DRAFT->CONFIRMED"]);
    assert.deepEqual(view.availableActions, []);

    // ---- customer shipment: needs a source; confirming is one step; cancel needs a reason ----
    let sale = await read(await salesDetail.GET(get(`/api/sales-shipments/${salesShipmentId}`, "owner"), outId));
    assert.ok(!sale.availableActions.includes("SUBMIT_CONFIRMATION"), "no source yet");
    assert.equal((await salesSubmit.POST(post(`/api/sales-shipments/${salesShipmentId}/submit`, "owner", { expectedVersion: sale.version }), outId)).status, 422);
    sale = await read(await salesSource.PUT(put(`/api/sales-shipments/${salesShipmentId}/primary-source`, "owner", { expectedVersion: sale.version, supplierShipmentId }), outId));
    assert.equal(sale.primarySource?.id, supplierShipmentId);
    sale = await read(await salesSubmit.POST(post(`/api/sales-shipments/${salesShipmentId}/submit`, "owner", { expectedVersion: sale.version }), outId));
    assert.equal(sale.executionState, "CONFIRMED");
    assert.equal((await salesTransition.POST(post(`/api/sales-shipments/${salesShipmentId}/execution-transitions`, "ops", { expectedVersion: sale.version, toState: "CANCELLED" }), outId)).status, 422, "cancel needs a reason");
    sale = await read(await salesTransition.POST(post(`/api/sales-shipments/${salesShipmentId}/execution-transitions`, "ops", { expectedVersion: sale.version, toState: "CANCELLED", reason: "Buyer postponed the order" }), outId));
    assert.equal(sale.executionState, "CANCELLED");
    assert.equal(sale.events[0].reason, "Buyer postponed the order");

    // ---- CSRF and tenant isolation on commands ----
    const noCsrf = new Request(`${ORIGIN}/api/sales-shipments/${salesShipmentId}/submit`, { method: "POST", headers: { ...headers("ops"), "x-csrf-token": "x" }, body: JSON.stringify({ expectedVersion: sale.version }) });
    assert.equal((await salesSubmit.POST(noCsrf, outId)).status, 403);
    assert.equal((await approvals.GET(get("/api/approvals", "outsider") as never)).status, 200);
    assert.equal(((await (await approvals.GET(get("/api/approvals", "outsider") as never)).json()) as { items: unknown[] }).items.length, 0, "other tenants see none of these approvals");

    // Audit trail covers every command.
    const actions = (await sql.query('SELECT "action" FROM "ShipmentAuditEvent" WHERE "tenant_id" = $1', [tenant])).rows.map((row) => row.action);
    for (const action of ["DATASET_REVISED", "CONFIRMATION_APPROVED", "STATE_CHANGED", "PRIMARY_SOURCE_SET"]) assert.ok(actions.includes(action), `missing ${action}`);
  } finally {
    await sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    if (process.env.DATABASE_URL) await getPrismaClient().$disconnect();
  }
});
