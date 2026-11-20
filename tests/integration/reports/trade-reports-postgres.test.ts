import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/** Contract fulfillment and product movement from PostgreSQL: company-scoped, confirmed shipments only, exact quantities. */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;

interface Line { contractType: string; contractReference: string; projectId: string; contractedQuantity: string; fulfilledQuantity: string; contractedValue: string; fulfilledValue: string; currency: string; counterpartyName: string; unit: string }
interface Move { direction: string; projectId: string; productId: string; quantity: string; transactionType: string; transactionId: string; counterpartyName: string; occurredOn: string }

integration("contract fulfillment and product movement read confirmed shipments of the company's own projects", async () => {
  const t = await buildTrade(databaseUrl!);
  const report = await import("../../../src/app/api/reports/[reportType]/route.ts");
  const movements = await import("../../../src/app/api/products/[productId]/movements/route.ts");
  const run = (type: string, who: Parameters<typeof t.get>[1] = "finance", query = "") => report.GET(t.get(`/api/reports/${type}${query}`, who), params({ reportType: type }));
  const projectId = t.project.id;
  try {
    // Before confirmation nothing is fulfilled or moved.
    let lines = (await t.ok<{ rows: Line[] }>(await run("contract-fulfillment", "finance", `?projectId=${projectId}`))).rows;
    assert.deepEqual(lines.map((l) => [l.contractType, l.contractedQuantity, l.fulfilledQuantity]).sort(), [["PURCHASE", "100", "0"], ["SALES", "100", "0"]]);
    assert.deepEqual((await t.ok<{ rows: Move[] }>(await run("product-movement", "finance", `?projectId=${projectId}`))).rows, []);

    await t.confirmShipments();
    lines = (await t.ok<{ rows: Line[] }>(await run("contract-fulfillment", "finance", `?projectId=${projectId}`))).rows;
    const sales = lines.find((l) => l.contractType === "SALES")!, purchase = lines.find((l) => l.contractType === "PURCHASE")!;
    assert.deepEqual([sales.fulfilledQuantity, sales.contractedValue, sales.fulfilledValue, sales.currency, sales.unit], ["19.2", "610000", "117120", "USD", "MT"]);
    assert.deepEqual([purchase.fulfilledQuantity, purchase.contractedValue, purchase.fulfilledValue, purchase.counterpartyName], ["19.2", "520050", "99849.6", "Aden Coffee Exporters"]);

    const moves = (await t.ok<{ rows: Move[] }>(await run("product-movement", "finance", `?projectId=${projectId}`))).rows;
    assert.deepEqual(moves.map((m) => [m.direction, m.transactionType, m.transactionId, m.quantity]).sort(), [
      ["INBOUND", "SUPPLIER_CONTAINER", t.supplierShipment.id, "19.2"], ["OUTBOUND", "SALES_SHIPMENT", t.salesShipment.id, "19.2"]]);
    assert.ok(moves.every((m) => m.productId === t.product && /^\d{4}-\d{2}-\d{2}$/.test(m.occurredOn)));
    const today = new Date().toISOString().slice(0, 10);
    assert.equal((await t.ok<{ rows: Move[] }>(await run("product-movement", "finance", `?projectId=${projectId}&to=2000-01-01`))).rows.length, 0);
    assert.equal((await t.ok<{ rows: Move[] }>(await run("product-movement", "finance", `?projectId=${projectId}&productId=${t.product}&from=${today}`))).rows.length, 2);
    assert.equal((await run("product-movement", "finance", "?from=2026-12-01&to=2026-11-01")).status, 422);
    assert.equal((await run("contract-fulfillment", "ops")).status, 403, "reports are Owner/Finance");
    assert.deepEqual((await t.ok<{ rows: Line[] }>(await run("contract-fulfillment", "outsider"))).rows.filter((l) => l.projectId === projectId), [], "another company sees nothing");

    // A product's movements page: open to Operations, scoped to the company.
    const own = await t.ok<{ product: { reference: string }; items: Move[] }>(await movements.GET(t.get(`/api/products/${t.product}/movements`, "ops"), params({ productId: t.product })));
    assert.equal(own.items.filter((m) => m.projectId === projectId).length, 2);
    assert.match(own.product.reference, /./);
    assert.equal((await movements.GET(t.get(`/api/products/${t.product}/movements`, "outsider"), params({ productId: t.product }))).status, 404);
  } finally {
    await t.sql.end();
  }
});
