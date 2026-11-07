import assert from "node:assert/strict";
import test from "node:test";

const PROJECT = "019a5f9b-7c00-7000-8000-000000009101";
type ProfitModule = { createInMemoryProfitService(options: Record<string, unknown>): { getProjectMarginAndCash(projectId: string): Promise<any> } };
async function view() {
  const module = await import("../../../src/modules/profit/profit-service.ts") as ProfitModule;
  const service = module.createInMemoryProfitService({
    salesContracts: [{ id: "sale", projectId: PROJECT, currency: "USD", amount: "1200.000000" }],
    purchaseContracts: [{ id: "purchase", projectId: PROJECT, currency: "USD", amount: "700.000000" }],
    customerInvoices: [{ id: "cinv", projectId: PROJECT, currency: "USD", amount: "1100.000000" }],
    supplierInvoices: [{ id: "sinv", projectId: PROJECT, currency: "USD", amount: "650.000000" }],
    approvedExpenses: [{ id: "expense", projectId: PROJECT, currency: "USD", amount: "50.000000" }],
    moneyMovements: [
      { id: "advance", projectId: PROJECT, kind: "CUSTOMER_ADVANCE", currency: "USD", amount: "300.000000" },
      { id: "supplier-payment", projectId: PROJECT, kind: "SUPPLIER_PAYMENT", currency: "USD", amount: "200.000000" },
    ],
    exchangeRates: [{ currency: "USD", aedRate: "3.672500", rateDate: "2026-11-01", source: "ORB_RECORDED_RATE" }],
  });
  return service.getProjectMarginAndCash(PROJECT);
}

test("expected, committed, actual operational and cash are four reconciled formula snapshots", async () => {
  const result = await view();
  assert.deepEqual(Object.keys(result.measures), ["expectedMargin", "committedMargin", "actualOperationalMargin", "cashPosition"]);
  const expected = { expectedMargin: "500.000000", committedMargin: "450.000000", actualOperationalMargin: "400.000000", cashPosition: "100.000000" };
  for (const [name, amount] of Object.entries(expected)) {
    const measure = result.measures[name];
    assert.equal(measure.amount, amount, name);
    assert.equal(measure.currency, "USD");
    assert.ok(measure.formula && measure.formulaVersion && measure.inputHash, name);
    assert.ok(measure.sources.length > 0, `${name} must disclose source drill-down`);
    assert.equal(measure.unexplainedVariance, "0.000000", name);
  }
});

test("customer advances affect cash only, never operational revenue or margin", async () => {
  const result = await view();
  for (const name of ["expectedMargin", "committedMargin", "actualOperationalMargin"]) {
    assert.ok(!result.measures[name].sources.some((source: any) => source.id === "advance"), name);
  }
  assert.ok(result.measures.cashPosition.sources.some((source: any) => source.id === "advance"));
});

test("every optional AED equivalent carries its recorded rate, date and source", async () => {
  const result = await view();
  for (const measure of Object.values(result.measures) as any[]) {
    assert.deepEqual(measure.aedEquivalent, {
      amount: (Number(measure.amount) * 3.6725).toFixed(6), currency: "AED", rate: "3.672500",
      rateDate: "2026-11-01", rateSource: "ORB_RECORDED_RATE",
    });
  }
});
