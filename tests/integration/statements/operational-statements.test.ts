import assert from "node:assert/strict";
import test from "node:test";

const PROJECT = "019a5f9b-7c00-7000-8000-000000009001";
const CUSTOMER = "019a5f9b-7c00-7000-8000-000000009002";
const SUPPLIER = "019a5f9b-7c00-7000-8000-000000009003";
const SALES_SHIPMENT = "019a5f9b-7c00-7000-8000-000000009004";
const SUPPLIER_SHIPMENT = "019a5f9b-7c00-7000-8000-000000009005";

type StatementModule = { createInMemoryStatementQuery(options: Record<string, unknown>): { getOperationalStatement(input: Record<string, unknown>): Promise<any> } };
async function subject() {
  const module = await import("../../../src/modules/statements/statement-query.ts") as StatementModule;
  return module.createInMemoryStatementQuery({
    entries: [
      { id: "sale-usd", projectId: PROJECT, customerId: CUSTOMER, salesShipmentId: SALES_SHIPMENT, kind: "CUSTOMER_INVOICE", occurredOn: "2026-11-01", currency: "USD", debit: "1200.000000", credit: "0.000000", sourceType: "CINV", sourceId: "cinv-usd" },
      { id: "advance-usd", projectId: PROJECT, customerId: CUSTOMER, kind: "CUSTOMER_ADVANCE", occurredOn: "2026-11-02", currency: "USD", debit: "0.000000", credit: "300.000000", sourceType: "MONEY_MOVEMENT", sourceId: "advance-usd" },
      { id: "sale-eur", projectId: PROJECT, customerId: CUSTOMER, salesShipmentId: SALES_SHIPMENT, kind: "CUSTOMER_INVOICE", occurredOn: "2026-11-03", currency: "EUR", debit: "500.000000", credit: "0.000000", sourceType: "CINV", sourceId: "cinv-eur" },
      { id: "buy-usd", projectId: PROJECT, supplierId: SUPPLIER, supplierShipmentId: SUPPLIER_SHIPMENT, kind: "SUPPLIER_INVOICE", occurredOn: "2026-11-01", currency: "USD", debit: "0.000000", credit: "700.000000", sourceType: "SUPPLIER_INVOICE", sourceId: "sinv-usd" },
      { id: "expense-usd", projectId: PROJECT, salesShipmentId: SALES_SHIPMENT, kind: "DIRECT_EXPENSE", occurredOn: "2026-11-04", currency: "USD", debit: "0.000000", credit: "50.000000", sourceType: "DIRECT_EXPENSE", sourceId: "expense-usd" },
    ],
  });
}

test("all five statement types retain source links and exact running balances", async () => {
  const query = await subject();
  const cases = [
    ["customer", CUSTOMER], ["supplier", SUPPLIER], ["sales-shipment", SALES_SHIPMENT],
    ["supplier-shipment", SUPPLIER_SHIPMENT], ["project", PROJECT],
  ] as const;
  for (const [statementType, subjectId] of cases) {
    const statement = await query.getOperationalStatement({ statementType, subjectId, asOf: "2026-11-30" });
    assert.equal(statement.subjectId, subjectId);
    assert.ok(statement.currencySections.length > 0, statementType);
    for (const section of statement.currencySections) {
      let running = 0;
      for (const line of section.lines) {
        assert.ok(line.sourceType && line.sourceId, `${statementType} line must drill to its source`);
        running += Number(line.debit) - Number(line.credit);
        assert.equal(Number(line.runningBalance), running);
      }
      assert.equal(Number(section.balance), running);
      assert.equal(Number(section.unexplainedVariance), 0);
    }
  }
});
test("original currencies remain separate and are never silently netted", async () => {
  const query = await subject();
  const statement = await query.getOperationalStatement({ statementType: "project", subjectId: PROJECT });
  assert.deepEqual(statement.currencySections.map((section: any) => section.currency).sort(), ["EUR", "USD"]);
  const usd = statement.currencySections.find((section: any) => section.currency === "USD");
  const eur = statement.currencySections.find((section: any) => section.currency === "EUR");
  assert.equal(usd.balance, "150.000000");
  assert.equal(eur.balance, "500.000000");
});
