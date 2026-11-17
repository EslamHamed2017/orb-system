import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const uuid7 = () => { const value = randomUUID(); return `${value.slice(0, 14)}7${value.slice(15)}`; };

integration("PostgreSQL enforces tenant ownership across projects, sales contracts, products, and audit events", async () => {
  // @ts-expect-error pg is a runtime dependency; optional declarations are intentionally omitted.
  const { Client } = await import("pg");
  const sql = new Client({ connectionString: databaseUrl });
  await sql.connect();
  const tenantA = uuid7(), tenantB = uuid7(), user = uuid7();
  const customerA = uuid7(), customerB = uuid7(), productA = uuid7(), productB = uuid7();
  const project = uuid7(), contract = uuid7(), version = uuid7(), audit = uuid7();
  const legacyParty = uuid7(), legacyProject = uuid7(), legacyPurchase = uuid7();
  const cutoverProject = uuid7(), cutoverContract = uuid7(), cutoverVersion = uuid7();
  try {
    await sql.query('INSERT INTO "Tenant" ("id","slug","name") VALUES ($1,$2,$3),($4,$5,$6)', [tenantA, `project-a-${tenantA}`, "Project A", tenantB, `project-b-${tenantB}`, "Project B"]);
    await sql.query('INSERT INTO "User" ("id","auth_subject","name_ar","name_en","locale","status","mfa_state","created_at","updated_at") VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())', [user, `project-${user}`, "مستخدم", "Project user", "en", "ACTIVE", "SATISFIED"]);
    await sql.query('INSERT INTO "TenantMembership" ("id","tenant_id","user_id","status") VALUES ($1,$2,$3,$4)', [uuid7(), tenantA, user, "ACTIVE"]);
    await sql.query('INSERT INTO "Customer" ("id","tenant_id","reference","legal_name","email") VALUES ($1,$2,$3,$4,$5),($6,$7,$8,$9,$10)', [customerA, tenantA, "CUS-PROJECT-A", "Buyer A", "buyer-a@example.test", customerB, tenantB, "CUS-PROJECT-B", "Buyer B", "buyer-b@example.test"]);
    await sql.query('INSERT INTO "CoffeeSpecification" ("id","tenant_id","reference","name_en","name_ar","origin","type","grade","crop_year","bag_type","standard_bag_weight","attributes") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12),($13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)', [productA, tenantA, "PROD-PROJECT-A", "Coffee A", "قهوة أ", "YE", "Arabica", "Matari", "2026", "Jute", 60, {}, productB, tenantB, "PROD-PROJECT-B", "Coffee B", "قهوة ب", "ET", "Arabica", "Sidamo", "2026", "Jute", 60, {}]);

    await sql.query('INSERT INTO "Party" ("id","reference","legal_name_ar","legal_name_en","country_code","customer","supplier","status") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [legacyParty, "LEGACY-PARTY-DB", "طرف قديم", "Legacy party", "AE", true, true, "ACTIVE"]);
    await sql.query('INSERT INTO "Project" ("id","reference","tenant_id","customer_master_id","management_currency") VALUES ($1,$2,$3,$4,$5)', [project, "PRJ-DB-1", tenantA, customerA, "USD"]);
    await assert.rejects(sql.query('INSERT INTO "Project" ("id","reference","tenant_id","customer_master_id","management_currency") VALUES ($1,$2,$3,$4,$5)', [uuid7(), "PRJ-CROSS", tenantA, customerB, "USD"]), /foreign key|violates/i);
    await assert.rejects(sql.query('INSERT INTO "Contract" ("id","project_id","kind","reference","counterparty_id","state") VALUES ($1,$2,$3,$4,$5,$6)', [uuid7(), project, "PURCHASE", "PC-LEGACY-BYPASS", legacyParty, "DRAFT"]), /contract project tenant mismatch/i);
    await sql.query('INSERT INTO "Contract" ("id","project_id","tenant_id","kind","reference","counterparty_customer_id","state") VALUES ($1,$2,$3,$4,$5,$6,$7)', [contract, project, tenantA, "SALES", "SC-DB-1", customerA, "DRAFT"]);
    await sql.query('UPDATE "Project" SET primary_sales_contract_id=$1 WHERE id=$2', [contract, project]);
    await assert.rejects(sql.query('INSERT INTO "Contract" ("id","project_id","tenant_id","kind","reference","counterparty_customer_id","state") VALUES ($1,$2,$3,$4,$5,$6,$7)', [uuid7(), project, tenantA, "PURCHASE", "SC-CROSS", customerB, "DRAFT"]), /check constraint|foreign key|violates/i);
    await sql.query('INSERT INTO "Project" ("id","reference","customer_id","management_currency") VALUES ($1,$2,$3,$4)', [legacyProject, "PRJ-LEGACY-DB", legacyParty, "USD"]);
    await sql.query('INSERT INTO "Contract" ("id","project_id","kind","reference","counterparty_id","state") VALUES ($1,$2,$3,$4,$5,$6)', [legacyPurchase, legacyProject, "PURCHASE", "PC-LEGACY-DB", legacyParty, "DRAFT"]);
    await assert.rejects(sql.query('UPDATE "Project" SET primary_sales_contract_id=$1 WHERE id=$2', [legacyPurchase, legacyProject]), /primary contract must be its same-tenant sales contract/i);
    await assert.rejects(sql.query('UPDATE "Project" SET tenant_id=$1,customer_id=NULL,customer_master_id=$2 WHERE id=$3', [tenantA, customerA, legacyProject]), /project contract tenant mismatch/i);

    await sql.query('INSERT INTO "Project" ("id","reference","customer_id","management_currency") VALUES ($1,$2,$3,$4)', [cutoverProject, "PRJ-CUTOVER-DB", legacyParty, "USD"]);
    await sql.query('INSERT INTO "Contract" ("id","project_id","kind","reference","counterparty_id","state") VALUES ($1,$2,$3,$4,$5,$6)', [cutoverContract, cutoverProject, "SALES", "SC-CUTOVER-DB", legacyParty, "DRAFT"]);
    await sql.query('INSERT INTO "ContractVersion" ("id","contract_id","revision_no","effective_date","coffee_specification_id","quantity","unit_price","currency","route","incoterm","named_place","payment_terms","document_terms") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [cutoverVersion, cutoverContract, 1, "2026-11-17", productB, 10, 7, "USD", "FOREIGN_TO_FOREIGN", "CIF", "Jebel Ali", "30 days", "Original BL"]);
    await sql.query("BEGIN");
    await sql.query('UPDATE "Project" SET tenant_id=$1,customer_id=NULL,customer_master_id=$2 WHERE id=$3', [tenantA, customerA, cutoverProject]);
    await sql.query('UPDATE "Contract" SET tenant_id=$1,counterparty_id=NULL,counterparty_customer_id=$2 WHERE id=$3', [tenantA, customerA, cutoverContract]);
    await assert.rejects(sql.query("COMMIT"), /contract version tenant mismatch/i);
    await sql.query("ROLLBACK");

    await sql.query('INSERT INTO "ContractVersion" ("id","contract_id","tenant_id","revision_no","effective_date","coffee_specification_id","quantity","unit_price","currency","route","incoterm","named_place","payment_terms","document_terms") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [version, contract, tenantA, 1, "2026-11-17", productA, 320, 8.5, "USD", "FOREIGN_TO_FOREIGN", "CIF", "Jebel Ali", "30 days", "Original BL"]);
    await assert.rejects(sql.query('UPDATE "Contract" SET active_version_id=$1 WHERE id=$2', [cutoverVersion, contract]), /foreign key|violates/i);
    await sql.query('UPDATE "Contract" SET active_version_id=$1 WHERE id=$2', [version, contract]);
    await assert.rejects(sql.query('INSERT INTO "ContractVersion" ("id","contract_id","tenant_id","revision_no","effective_date","coffee_specification_id","quantity","unit_price","currency","route","incoterm","named_place","payment_terms","document_terms") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)', [uuid7(), contract, tenantA, 2, "2026-11-18", productB, 320, 8.5, "USD", "FOREIGN_TO_FOREIGN", "CIF", "Jebel Ali", "30 days", "Original BL"]), /tenant mismatch|foreign key|violates/i);

    await sql.query('INSERT INTO "ProjectAuditEvent" ("id","tenant_id","project_id","actor_id","action","aggregate_version","after") VALUES ($1,$2,$3,$4,$5,$6,$7)', [audit, tenantA, project, user, "PROJECT_CREATED", 1, { reference: "PRJ-DB-1" }]);
    await assert.rejects(sql.query('UPDATE "ProjectAuditEvent" SET action=$1 WHERE id=$2', ["PROJECT_UPDATED", audit]), /append-only|immutable|mutation|denied|raise/i);
    assert.equal((await sql.query('SELECT count(*)::int AS count FROM "ProjectAuditEvent" WHERE project_id=$1', [project])).rows[0].count, 1);
  } finally {
    await sql.end();
  }
});
