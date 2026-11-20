import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseYaml } from "./openapi-contract.test.ts";

const PROJECT_A = "019a5f9b-7c00-7000-8000-00000000b001";
const PROJECT_B = "019a5f9b-7c00-7000-8000-00000000b002";
const principal = { userId: "019a5f9b-7c00-7000-8000-00000000b003", roles: ["FINANCE_VIEWER"] };
const rows = [
  { id: "fulfill-a", reportType: "CONTRACT_FULFILLMENT", projectId: PROJECT_A, occurredOn: "2026-11-02", reference: "SC-1/L1", currency: "USD", contractedQuantity: "20", fulfilledQuantity: "7.5", contractedValue: "200", fulfilledValue: "75" },
  { id: "fulfill-b", reportType: "CONTRACT_FULFILLMENT", projectId: PROJECT_B, occurredOn: "2026-11-03", reference: "SC-2/L1", currency: "AED", contractedQuantity: "10", fulfilledQuantity: "10", contractedValue: "100", fulfilledValue: "100" },
  { id: "account-a", reportType: "ACCOUNTS", projectId: PROJECT_A, occurredOn: "2026-11-04", reference: "SINV-1", currency: "USD", accountType: "SALES_INVOICE", amount: "120", outstandingAmount: "20" },
  { id: "profit-a", reportType: "PROJECT_PROFITABILITY", projectId: PROJECT_A, occurredOn: "2026-11-05", reference: "PRJ-1", currency: "USD", salesAmount: "120", supplierAmount: "70", expenseAmount: "10" },
] as const;

test("operational report query applies project/date filters and exact report-specific totals", async () => {
  const { createInMemoryOperationalReportQuery } = await import("../../src/modules/reports/operational-report-query.ts");
  const query = createInMemoryOperationalReportQuery({ rows });
  const fulfillment = await query.run({ principal, reportType: "CONTRACT_FULFILLMENT", projectId: PROJECT_A, from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(fulfillment.summary, { contractedQuantity: "20.000000", fulfilledQuantity: "7.500000", remainingQuantity: "12.500000", contractedValue: "200.000000", fulfilledValue: "75.000000", remainingValue: "125.000000" });
  assert.deepEqual(fulfillment.items.map((item: any) => item.id), ["fulfill-a"]);

  const accounts = await query.run({ principal, reportType: "ACCOUNTS", projectId: PROJECT_A });
  assert.deepEqual(accounts.summary, { amount: "120.000000", outstandingAmount: "20.000000" });

  const profitability = await query.run({ principal, reportType: "PROJECT_PROFITABILITY", projectId: PROJECT_A });
  assert.deepEqual(profitability.summary, { salesAmount: "120.000000", supplierAmount: "70.000000", expenseAmount: "10.000000", operationalMargin: "40.000000" });
  assert.equal(Object.hasOwn(profitability.summary, "generalLedgerBalance"), false);
  assert.equal(Object.hasOwn(fulfillment.summary, "stockOnHand"), false);
});

test("operational reports reject unauthorized, unknown, malformed, and inverted filters", async () => {
  const { createInMemoryOperationalReportQuery } = await import("../../src/modules/reports/operational-report-query.ts");
  const query = createInMemoryOperationalReportQuery({ rows });
  await assert.rejects(() => query.run({ principal: { userId: "ops", roles: ["OPERATIONS"] }, reportType: "ACCOUNTS" }), TypeError);
  await assert.rejects(() => query.run({ principal, reportType: "GENERAL_LEDGER" as any }), TypeError);
  await assert.rejects(() => query.run({ principal, reportType: "ACCOUNTS", from: "11/01/2026" }), TypeError);
  await assert.rejects(() => query.run({ principal, reportType: "ACCOUNTS", from: "2026-11-30", to: "2026-11-01" }), TypeError);
});

test("operational reports route authorizes server-side and maps typed report names", async () => {
  const route = await import("../../src/app/api/reports/[reportType]/route.ts");
  let input: any;
  const get = route.createOperationalReportGetHandler({ authenticate: async () => principal, run: async (value: any) => { input = value; return { items: [], summary: {} }; } });
  const response = await get(new Request(`https://orb.example/api/reports/contract-fulfillment?projectId=${PROJECT_A}&from=2026-11-01&to=2026-11-30`), { params: Promise.resolve({ reportType: "contract-fulfillment" }) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(input.reportType, "CONTRACT_FULFILLMENT");
  assert.equal(input.projectId, PROJECT_A);
  assert.equal(input.from, "2026-11-01");
  assert.equal(input.to, "2026-11-30");

  let called = false;
  const denied = route.createOperationalReportGetHandler({ authenticate: async () => ({ userId: "ops", roles: ["OPERATIONS"] }), run: async () => { called = true; } });
  assert.equal((await denied(new Request("https://orb.example/api/reports/accounts"), { params: Promise.resolve({ reportType: "accounts" }) })).status, 403);
  assert.equal(called, false);
});

test("OpenAPI exposes typed operational reports without ledger or inventory concepts", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const operation = api.paths["/reports/{reportType}"].get;
  assert.equal(operation.operationId, "runOperationalReport");
  assert.deepEqual(operation["x-required-roles"], ["OWNER_ADMIN", "FINANCE_VIEWER"]);
  assert.deepEqual(operation.parameters[0].schema.enum, ["contract-fulfillment", "accounts", "project-profitability", "product-movement"]);
  assert.equal(operation.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/OperationalReportResult");
  const serialized = JSON.stringify(api.components.schemas.OperationalReportResult);
  assert.equal(serialized.includes("generalLedger"), false);
  assert.equal(serialized.includes("stockOnHand"), false);
  assert.equal(serialized.includes("inventoryValue"), false);
});
