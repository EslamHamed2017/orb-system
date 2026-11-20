import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/**
 * Project profit, the profitability report and the shipments list on PostgreSQL through the real routes.
 * Hand-checked figures (fixture: sales 100 MT × 6,100 USD, purchase 100 MT × 5,200.50 USD, one 19.2 MT shipment each way):
 *   Expected = 610,000.00 − 520,050.00                                   =  89,950.00
 *   Shipped  = 19.2 × 6,100 − 19.2 × 5,200.50 = 117,120.00 − 99,849.60   =  17,270.40
 *   Actual   = 117,120.00 − 99,849.60 − 1,850.00 − (734.50 AED ÷ 3.6725)  =  15,220.40
 *   Cash     = 50,000.00 received − 60,000.00 paid                        = −10,000.00  (AED −36,725.00)
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const today = new Date().toISOString().slice(0, 10);

async function useMemoryStorageUnlessConfigured() {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return;
  const { setDocumentObjectStore } = await import("../../../src/modules/evidence/document-storage.ts");
  const objects = new Map<string, Uint8Array>();
  setDocumentObjectStore({
    async putImmutable(input) { const versionId = `v-${objects.size + 1}`; objects.set(`${input.objectKey}@${versionId}`, input.body as Uint8Array); return { objectKey: input.objectKey, objectVersionId: versionId, retentionUntil: input.retentionUntil }; },
    async getImmutable({ objectKey, objectVersionId }) { const body = objects.get(`${objectKey}@${objectVersionId}`); if (!body) throw new Error("missing object"); return { body, contentType: "application/octet-stream", byteLength: body.byteLength }; },
  });
}

interface Measure { amount: string; aedAmount: string | null; revenue: string; cost: string; marginPercent: string | null; notIncluded: number }
interface Profit { expectedMargin: { amount: string; currency: string }; actualOperationalMargin: { amount: string }; rate: { aedPerUnit: string | null; source: string }; measures: Record<"expected" | "shipped" | "actual" | "cash", Measure>; sources: { measure: string; kind: string; reference: string; projectAmount: string | null }[]; warnings: string[]; formulaVersion: string }

integration("project profit shows expected, shipped, actual and cash margins with their sources", async () => {
  await useMemoryStorageUnlessConfigured();
  const t = await buildTrade(databaseUrl!);
  const profit = await import("../../../src/app/api/projects/[projectId]/profit/route.ts");
  const report = await import("../../../src/app/api/reports/[reportType]/route.ts");
  const shipments = await import("../../../src/app/api/shipments/route.ts");
  const movements = await import("../../../src/app/api/projects/[projectId]/money-movements/route.ts");
  const allocate = await import("../../../src/app/api/money-movements/[movementId]/allocations/route.ts");
  const expenses = await import("../../../src/app/api/projects/[projectId]/expenses/route.ts");
  const decision = await import("../../../src/app/api/approvals/[approvalId]/decision/route.ts");
  const createSupplierInvoice = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const submitSupplierInvoice = await import("../../../src/app/api/supplier-invoices/[invoiceId]/submit/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const projectId = t.project.id, project = params({ projectId });
  const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); data.set("file", new File([PDF], "doc.pdf")); return data; };
  const approve = (approvalId: string) => decision.POST(t.post(`/api/approvals/${approvalId}/decision`, "owner", { decision: "APPROVED" }) as never, params({ approvalId }));
  const getProfit = async (who: Parameters<typeof t.get>[1]) => profit.GET(t.get(`/api/projects/${projectId}/profit`, who) as never, project as never);
  try {
    // Before anything is shipped: only the contracts count.
    let p = await t.ok<Profit>(await getProfit("finance"));
    assert.equal(p.measures.expected.amount, "89950.00");
    assert.equal(p.measures.expected.marginPercent, "14.7");
    assert.deepEqual([p.measures.shipped.amount, p.measures.actual.amount, p.measures.cash.amount], ["0.00", "0.00", "0.00"]);
    assert.deepEqual(p.rate, { aedPerUnit: "3.6725", source: "USD_PEG" });
    assert.equal(p.expectedMargin.currency, "USD");
    assert.equal((await getProfit("ops")).status, 403, "Operations cannot see profit");
    assert.equal((await getProfit("outsider")).status, 404, "other companies cannot see the project");

    await t.confirmShipments();
    const supplierInvoice = await t.ok<{ id: string }>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form({ reference: "AD-1", invoiceDate: today, amount: "99849.60" })), params({ shipmentId: t.supplierShipment.id })), 201);
    const submitted = await t.ok<{ pendingApprovalId: string }>(await submitSupplierInvoice.POST(t.post(`/api/supplier-invoices/${supplierInvoice.id}/submit`, "finance", {}), params({ invoiceId: supplierInvoice.id })));
    await t.ok(await approve(submitted.pendingApprovalId));
    const customerInvoice = await t.ok<{ id: string }>(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today }), params({ shipmentId: t.salesShipment.id })), 201);

    const move = (fields: Record<string, string>) => movements.POST(t.multipart(`/api/projects/${projectId}/money-movements`, "finance", form({ currency: "USD", fxRate: "3.6725", occurredOn: today, ...fields })), project);
    const receipt = await t.ok<{ id: string }>(await move({ kind: "CUSTOMER_RECEIPT", counterpartyId: t.customer, amount: "50000", reference: "R-1" }), 201);
    await t.ok(await allocate.POST(t.post(`/api/money-movements/${receipt.id}/allocations`, "finance", { targetType: "CINV", targetId: customerInvoice.id, amount: "50000", currency: "USD" }) as never, params({ movementId: receipt.id }) as never), 201);
    const payment = await t.ok<{ pendingApprovalId: string }>(await move({ kind: "SUPPLIER_PAYMENT", counterpartyId: t.supplier, amount: "60000", reference: "P-1" }), 201);
    await t.ok(await approve(payment.pendingApprovalId));
    const spend = (fields: Record<string, string>) => expenses.POST(t.multipart(`/api/projects/${projectId}/expenses`, "ops", form({ occurredOn: today, payeeName: "Gulf Forwarders", ...fields })), project);
    const freight = await t.ok<{ pendingApprovalId: string }>(await spend({ categoryCode: "FREIGHT", amount: "1850", currency: "USD", fxRate: "3.6725" }), 201);
    const fees = await t.ok<{ pendingApprovalId: string }>(await spend({ categoryCode: "DOCUMENTATION", amount: "734.50", currency: "AED", fxRate: "1" }), 201);
    await spend({ categoryCode: "STORAGE", amount: "90", currency: "USD", fxRate: "3.6725" });
    await t.ok(await approve(freight.pendingApprovalId));
    await t.ok(await approve(fees.pendingApprovalId));

    p = await t.ok<Profit>(await getProfit("finance"));
    assert.deepEqual(p.rate, { aedPerUnit: "3.6725", source: "RECORDED_AVERAGE" });
    assert.deepEqual({ revenue: p.measures.shipped.revenue, cost: p.measures.shipped.cost, amount: p.measures.shipped.amount }, { revenue: "117120.00", cost: "99849.60", amount: "17270.40" });
    assert.deepEqual({ revenue: p.measures.actual.revenue, cost: p.measures.actual.cost, amount: p.measures.actual.amount }, { revenue: "117120.00", cost: "101899.60", amount: "15220.40" });
    assert.equal(p.actualOperationalMargin.amount, "15220.40");
    assert.equal(p.measures.actual.marginPercent, "13.0");
    assert.deepEqual({ amount: p.measures.cash.amount, aed: p.measures.cash.aedAmount }, { amount: "-10000.00", aed: "-36725.00" });
    assert.equal(p.measures.actual.notIncluded, 0);
    const fee = p.sources.find((s) => s.measure === "actual" && s.kind === "EXPENSE" && s.reference === "Documents and certificates");
    assert.equal(fee?.projectAmount, "200.00", "AED expense converted with the project rate");
    assert.ok(p.warnings.some((w) => w.includes("waiting for approval")), "pending expense is flagged, not counted");
    assert.ok(p.formulaVersion);

    // Portfolio report.
    const rows = (await t.ok<{ rows: { project: { id: string }; actual: Measure; cash: Measure }[] }>(await report.GET(t.get(`/api/reports/project-profitability`, "finance"), params({ reportType: "project-profitability" })))).rows;
    const row = rows.find((r) => r.project.id === projectId);
    assert.equal(row?.actual.amount, "15220.40");
    assert.equal((await report.GET(t.get(`/api/reports/project-profitability`, "ops"), params({ reportType: "project-profitability" }))).status, 403);
    assert.equal((await report.GET(t.get(`/api/reports/contract-fulfillment`, "finance"), params({ reportType: "contract-fulfillment" }))).status, 200, "every report runs on the database");

    // Shipments list: everyone sees it, without prices.
    const queue = (await t.ok<{ items: Record<string, unknown>[] }>(await shipments.GET(t.get("/api/shipments", "ops")))).items.filter((s) => s.projectId === projectId);
    assert.deepEqual(queue.map((s) => `${s.type}:${s.state}:${s.invoiceState}`).sort(), ["SALES:CONFIRMED:ISSUED", "SUPPLIER:CONFIRMED:CONFIRMED"]);
    assert.equal(queue.find((s) => s.type === "SALES")?.hasSource, true);
    assert.ok(queue.every((s) => !("unitPrice" in s) && !("amount" in s)));
  } finally {
    await t.sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
