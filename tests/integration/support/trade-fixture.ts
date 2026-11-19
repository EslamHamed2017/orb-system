import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

/**
 * Builds a realistic trade on PostgreSQL through the real route handlers:
 * one tenant, users per role, customer/supplier/product, an active project with approved
 * sales + purchase contracts, and one confirmed supplier shipment + one confirmed customer shipment.
 */
export const ORIGIN = "https://orb.example";
export const uuid7 = () => { const value = randomUUID(); return `${value.slice(0, 14)}7${value.slice(15)}`; };
export const params = <T>(value: T) => ({ params: Promise.resolve(value) });

export type Who = "ops" | "owner" | "owner2" | "finance" | "outsider";
const ROLES: Record<Who, string> = { ops: "OPERATIONS", owner: "OWNER_ADMIN", owner2: "OWNER_ADMIN", finance: "FINANCE_VIEWER", outsider: "OWNER_ADMIN" };

export async function buildTrade(databaseUrl: string) {
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  const tenant = uuid7(), otherTenant = uuid7(), customer = uuid7(), product = uuid7(), supplier = uuid7();
  const users = Object.fromEntries((Object.keys(ROLES) as Who[]).map((who) => [who, uuid7()])) as Record<Who, string>;
  const tokens = Object.fromEntries((Object.keys(ROLES) as Who[]).map((who) => [who, `t-${who}-${uuid7().replaceAll("-", "")}`])) as Record<Who, string>;
  const tag = tenant.slice(-6).toUpperCase();
  await sql.query('INSERT INTO "Tenant" ("id","slug","name") VALUES ($1,$2,$3),($4,$5,$6)', [tenant, `trade-${tenant}`, "Trade", otherTenant, `trade-other-${otherTenant}`, "Other"]);
  for (const who of Object.keys(ROLES) as Who[]) {
    await sql.query('INSERT INTO "User" ("id","auth_subject","name_ar","name_en","locale","status","mfa_state","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())', [users[who], `trade-${users[who]}`, `مستخدم ${who}`, `User ${who}`, "en", "ACTIVE", "SATISFIED"]);
    await sql.query('INSERT INTO "UserRole" ("id","user_id","role") VALUES ($1,$2,$3)', [uuid7(), users[who], ROLES[who]]);
    await sql.query('INSERT INTO "TenantMembership" ("id","tenant_id","user_id","status") VALUES ($1,$2,$3,$4)', [uuid7(), who === "outsider" ? otherTenant : tenant, users[who], "ACTIVE"]);
    await sql.query('INSERT INTO "Session" ("id","user_id","expires_at","token_hash","version","mfa_satisfied_at") VALUES ($1,$2,now()+interval \'1 hour\',$3,1,now())', [uuid7(), users[who], createHash("sha256").update(tokens[who]).digest("hex")]);
  }
  await sql.query('INSERT INTO "Customer" ("id","tenant_id","reference","legal_name","legal_name_ar","email","billing_address","tax_registration_number","payment_terms_days") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [customer, tenant, `CUS-${tag}`, "Hamburg Roasters GmbH", "محمصة هامبورغ", "buyer@example.test", JSON.stringify({ line1: "Speicherstadt 1", line2: null, city: "Hamburg", region: null, postalCode: "20457" }), "DE123456789", 30]);
  await sql.query('INSERT INTO "Supplier" ("id","tenant_id","reference","registered_name","country_code","email","payment_currency") VALUES ($1,$2,$3,$4,$5,$6,$7)', [supplier, tenant, `SUP-${tag}`, "Aden Coffee Exporters", "YE", "coast@example.test", "USD"]);
  await sql.query('INSERT INTO "CoffeeSpecification" ("id","tenant_id","reference","name_en","name_ar","origin","type","grade","crop_year","bag_type","standard_bag_weight","attributes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [product, tenant, `PROD-${tag}`, "Yemen Matari", "مطري يمني", "YE", "Arabica", "Matari", "2026", "Jute", 60, {}]);

  process.env.DATABASE_URL = databaseUrl;
  process.env.ORB_APP_ORIGIN = ORIGIN;
  process.env.ORB_ALLOWED_ORIGINS = ORIGIN;
  process.env.ORB_OWNER_MFA_REQUIRED = "0";

  const headers = (who: Who, extra: Record<string, string> = {}) => {
    const csrf = createHash("sha256").update(`orb-customer-csrf\0${tokens[who]}`).digest("hex");
    return { cookie: `__Host-orb_session=${tokens[who]}; __Host-orb_csrf=${csrf}`, origin: ORIGIN, "x-csrf-token": csrf, "content-type": "application/json", "idempotency-key": uuid7(), ...extra };
  };
  const post = (path: string, who: Who, body: unknown, extra: Record<string, string> = {}) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: headers(who, extra), body: JSON.stringify(body) });
  const put = (path: string, who: Who, body: unknown) => new Request(`${ORIGIN}${path}`, { method: "PUT", headers: headers(who), body: JSON.stringify(body) });
  const get = (path: string, who: Who) => new Request(`${ORIGIN}${path}`, { headers: headers(who) });
  const multipart = (path: string, who: Who, form: FormData) => {
    const { "content-type": _drop, ...rest } = headers(who);
    return new Request(`${ORIGIN}${path}`, { method: "POST", headers: rest, body: form });
  };
  const ok = async <T>(response: Response, status?: number): Promise<T> => {
    assert.ok(status ? response.status === status : response.status < 300, `${response.status} ${await response.clone().text()}`);
    return await response.json() as T;
  };

  const projects = await import("../../../src/app/api/projects/route.ts");
  const purchase = await import("../../../src/app/api/projects/[projectId]/purchase-contracts/route.ts");
  const activate = await import("../../../src/app/api/projects/[projectId]/activate/route.ts");
  const createSupplierShipment = await import("../../../src/app/api/projects/[projectId]/supplier-shipments/route.ts");
  const createSalesShipment = await import("../../../src/app/api/projects/[projectId]/sales-shipments/route.ts");
  const submitContract = await import("../../../src/app/api/contracts/[contractId]/submit/route.ts");
  const decision = await import("../../../src/app/api/approvals/[approvalId]/decision/route.ts");
  const supplierSubmit = await import("../../../src/app/api/supplier-shipments/[shipmentId]/submit/route.ts");
  const salesSource = await import("../../../src/app/api/sales-shipments/[shipmentId]/primary-source/route.ts");
  const salesSubmit = await import("../../../src/app/api/sales-shipments/[shipmentId]/submit/route.ts");

  const tolerances = { quantityUnder: "0", quantityOver: "2.5", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" };
  const project = await ok<{ id: string; salesContract: { id: string; activeVersion: { id: string } } }>(await projects.POST(post("/api/projects", "ops", { customerId: customer, salesContract: { counterpartyId: customer, coffeeSpecificationId: product, effectiveDate: "2026-11-17", quantity: "100", unitPrice: "6100", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "CFR", namedPlace: "Hamburg", paymentTerms: "CAD 30 days", documentTerms: "Original BL", tolerances } })), 201);
  const purchaseContract = (await ok<{ purchaseContracts: { id: string; activeVersion: { id: string } }[] }>(await purchase.POST(post(`/api/projects/${project.id}/purchase-contracts`, "ops", { counterpartyId: supplier, coffeeSpecificationId: product, effectiveDate: "2026-11-18", quantity: "100", unitPrice: "5200.50", currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Aden", paymentTerms: "30% advance", documentTerms: "Original BL", tolerances: { quantityOver: "2" } }, { "if-match": '"1"' }), params({ projectId: project.id })), 201)).purchaseContracts[0];
  await ok(await activate.POST(post(`/api/projects/${project.id}/activate`, "ops", {}, { "if-match": '"2"' }), params({ projectId: project.id })));
  const approveAll = async () => {
    const pending = (await sql.query(`SELECT "id" FROM "Approval" WHERE "decision" = 'PENDING' AND "requester_id" = $1`, [users.ops])).rows as { id: string }[];
    for (const row of pending) await ok(await decision.POST(post(`/api/approvals/${row.id}/decision`, "owner", { decision: "APPROVED" }) as never, params({ approvalId: row.id })));
  };
  for (const contractId of [project.salesContract.id, purchaseContract.id]) await ok(await submitContract.POST(post(`/api/contracts/${contractId}/submit`, "ops", {}), params({ contractId })));
  await approveAll();

  const transport = { mode: "SEA", carrierName: "MSC", reference: "BKG-1", estimatedDepartureAt: "2026-12-01T00:00:00Z", estimatedArrivalAt: "2026-12-12T00:00:00Z" };
  const supplierShipment = await ok<{ id: string; version: number }>(await createSupplierShipment.POST(post(`/api/projects/${project.id}/supplier-shipments`, "ops", { purchaseContractId: purchaseContract.id, purchaseContractVersionId: purchaseContract.activeVersion.id, supplierId: supplier, reference: `IN-${tag}`, coffeeSpecificationId: product, supplierLotReference: "LOT-1", quantity: "19.2", bagCount: 320, bagWeight: "60", netWeight: "19200", grossWeight: "19390", origin: { countryCode: "YE", name: "Haraz" }, loadLocation: { countryCode: "YE", name: "Aden" }, destination: { countryCode: "AE", name: "Jebel Ali" }, incoterm: "FOB", namedPlace: "Aden", containerNumbers: ["MSCU1234565"], sealNumbers: ["S-1"], transport }, { "if-match": '"3"' }), params({ projectId: project.id })), 201);
  const salesShipment = await ok<{ id: string; version: number }>(await createSalesShipment.POST(post(`/api/projects/${project.id}/sales-shipments`, "ops", { salesContractId: project.salesContract.id, salesContractVersionId: project.salesContract.activeVersion.id, customerId: customer, reference: `OUT-${tag}`, coffeeSpecificationId: product, customerPurchaseOrderReference: "PO-7", quantity: "19.2", bagCount: 320, bagWeight: "60", netWeight: "19200", grossWeight: "19390", origin: { countryCode: "YE", name: "Haraz" }, loadLocation: { countryCode: "AE", name: "Jebel Ali" }, dischargeLocation: { countryCode: "DE", name: "Hamburg" }, destination: { countryCode: "DE", name: "Hamburg" }, incoterm: "CFR", namedPlace: "Hamburg", containerNumbers: ["MSCU1234565"], sealNumbers: ["S-1"], transport }, { "if-match": '"4"' }), params({ projectId: project.id })), 201);

  /** Puts both shipments through owner approval so they are CONFIRMED. */
  async function confirmShipments() {
    const supplierVersion = (await sql.query(`SELECT "version" FROM "SupplierShipment" WHERE "id" = $1`, [supplierShipment.id])).rows[0].version as number;
    await ok(await supplierSubmit.POST(post(`/api/supplier-shipments/${supplierShipment.id}/submit`, "ops", { expectedVersion: supplierVersion }), params({ shipmentId: supplierShipment.id })));
    let salesVersion = (await sql.query(`SELECT "version" FROM "SalesShipment" WHERE "id" = $1`, [salesShipment.id])).rows[0].version as number;
    await ok(await salesSource.PUT(put(`/api/sales-shipments/${salesShipment.id}/primary-source`, "ops", { expectedVersion: salesVersion, supplierShipmentId: supplierShipment.id }), params({ shipmentId: salesShipment.id })));
    salesVersion += 1;
    await ok(await salesSubmit.POST(post(`/api/sales-shipments/${salesShipment.id}/submit`, "ops", { expectedVersion: salesVersion }), params({ shipmentId: salesShipment.id })));
    await approveAll();
  }

  return { sql, tenant, users, tokens, customer, supplier, product, project, purchaseContract, supplierShipment, salesShipment, headers, post, put, get, multipart, ok, confirmShipments, approveAll, params };
}
