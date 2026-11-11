import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseYaml } from "./openapi-contract.test.ts";

const PROJECT_A = "019a5f9b-7c00-7000-8000-00000000a001";
const PROJECT_B = "019a5f9b-7c00-7000-8000-00000000a002";
const principal = { userId: "019a5f9b-7c00-7000-8000-00000000a003", roles: ["FINANCE_VIEWER"] };
const records = [
  { id: "sale-a", projectId: PROJECT_A, type: "SALES_INVOICE", occurredOn: "2026-11-03", state: "ISSUED", partyId: "customer-a", reference: "SINV-1", currency: "USD", amount: "120.000000", outstandingAmount: "20.000000" },
  { id: "purchase-a", projectId: PROJECT_A, type: "SUPPLIER_INVOICE", occurredOn: "2026-11-02", state: "CONFIRMED", partyId: "supplier-a", reference: "PINV-1", currency: "USD", amount: "70.000000", outstandingAmount: "30.000000" },
  { id: "collection-a", projectId: PROJECT_A, type: "COLLECTION", occurredOn: "2026-11-04", state: "POSTED", partyId: "customer-a", reference: "COL-1", currency: "USD", amount: "100.000000", outstandingAmount: "0.000000" },
  { id: "payment-a", projectId: PROJECT_A, type: "SUPPLIER_PAYMENT", occurredOn: "2026-11-05", state: "POSTED", partyId: "supplier-a", reference: "PAY-1", currency: "USD", amount: "40.000000", outstandingAmount: "0.000000" },
  { id: "expense-a", projectId: PROJECT_A, type: "EXPENSE", occurredOn: "2026-11-01", state: "APPROVED", reference: "EXP-1", currency: "USD", amount: "10.000000", outstandingAmount: "0.000000" },
  { id: "cancelled-a", projectId: PROJECT_A, type: "SALES_INVOICE", occurredOn: "2026-11-06", state: "CANCELLED", partyId: "customer-a", reference: "SINV-X", currency: "USD", amount: "999.000000", outstandingAmount: "999.000000" },
  { id: "sale-b", projectId: PROJECT_B, type: "SALES_INVOICE", occurredOn: "2026-11-07", state: "ISSUED", partyId: "customer-b", reference: "SINV-2", currency: "AED", amount: "50.000000", outstandingAmount: "50.000000" },
] as const;

test("accounts query returns operational totals by currency and honors the optional project filter", async () => {
  const { createInMemoryAccountsQuery } = await import("../../src/modules/accounts/accounts-query.ts");
  const query = createInMemoryAccountsQuery({ records });
  const result = await query.summary({ principal, projectId: PROJECT_A });
  assert.deepEqual(result, {
    projectId: PROJECT_A,
    recordCount: 5,
    currencySections: [{
      currency: "USD", salesInvoiced: "120.000000", salesOutstanding: "20.000000",
      supplierInvoiced: "70.000000", supplierOutstanding: "30.000000", collections: "100.000000",
      supplierPayments: "40.000000", expenses: "10.000000", netOperationalCash: "50.000000",
    }],
  });
  const global = await query.summary({ principal });
  assert.equal(global.projectId, null);
  assert.equal(global.recordCount, 6);
  assert.deepEqual(global.currencySections.map((section: any) => section.currency), ["AED", "USD"]);
});

test("accounts list is type-scoped, project-filtered, deterministic, and excludes cancelled records", async () => {
  const { createInMemoryAccountsQuery } = await import("../../src/modules/accounts/accounts-query.ts");
  const query = createInMemoryAccountsQuery({ records });
  const result = await query.list({ principal, type: "SALES_INVOICE", projectId: PROJECT_A });
  assert.equal(result.projectId, PROJECT_A);
  assert.equal(result.type, "SALES_INVOICE");
  assert.deepEqual(result.items.map((item: any) => item.id), ["sale-a"]);
  await assert.rejects(() => query.list({ principal, type: "GENERAL_LEDGER" as any }), TypeError);
});

test("accounts summary and list routes authorize server-side and propagate project filters", async () => {
  const summaryRoute = await import("../../src/app/api/accounts/summary/route.ts");
  const listRoute = await import("../../src/app/api/accounts/[recordType]/route.ts");
  let summaryInput: any;
  const summary = summaryRoute.createAccountsSummaryGetHandler({ authenticate: async () => principal, summary: async (input: any) => { summaryInput = input; return { projectId: input.projectId ?? null, recordCount: 0, currencySections: [] }; } });
  const summaryResponse = await summary(new Request(`https://orb.example/api/accounts/summary?projectId=${PROJECT_A}`));
  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.headers.get("cache-control"), "no-store");
  assert.equal(summaryInput.projectId, PROJECT_A);

  let listInput: any;
  const list = listRoute.createAccountsListGetHandler({ authenticate: async () => principal, list: async (input: any) => { listInput = input; return { projectId: input.projectId ?? null, type: input.type, items: [] }; } });
  const listResponse = await list(new Request(`https://orb.example/api/accounts/sales-invoices?projectId=${PROJECT_A}`), { params: Promise.resolve({ recordType: "sales-invoices" }) });
  assert.equal(listResponse.status, 200);
  assert.equal(listInput.type, "SALES_INVOICE");
  assert.equal(listInput.projectId, PROJECT_A);

  let called = false;
  const denied = summaryRoute.createAccountsSummaryGetHandler({ authenticate: async () => ({ userId: "ops", roles: ["OPERATIONS"] }), summary: async () => { called = true; } });
  assert.equal((await denied(new Request("https://orb.example/api/accounts/summary"))).status, 403);
  assert.equal(called, false);
});


test("accounts OpenAPI exposes finance-only operational summary and typed lists with optional project filters", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const summary = api.paths["/accounts/summary"].get;
  const list = api.paths["/accounts/{recordType}"].get;
  assert.equal(summary.operationId, "getAccountsSummary");
  assert.equal(list.operationId, "listAccountRecords");
  assert.deepEqual(summary["x-required-roles"], ["OWNER_ADMIN", "FINANCE_VIEWER"]);
  assert.deepEqual(list["x-required-roles"], ["OWNER_ADMIN", "FINANCE_VIEWER"]);
  assert.equal(summary.parameters[0].name, "projectId");
  assert.equal(summary.parameters[0].required, false);
  assert.deepEqual(list.parameters[0].schema.enum, ["sales-invoices", "supplier-invoices", "collections", "supplier-payments", "expenses"]);
  assert.equal(list.parameters[1].required, false);
  assert.equal(summary.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/AccountsSummary");
  assert.equal(list.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/AccountRecordPage");
});
