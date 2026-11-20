import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/** Accounts registers, summary and report on PostgreSQL: company-scoped, Owner/Finance only, exact outstanding amounts. */
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

interface Rec { id: string; projectId: string; type: string; state: string; reference: string; amount: string; outstandingAmount: string; projectReference: string; partyName: string; documentId: string | null; href: string }

integration("accounts list, summarise and report the company's own invoices, payments and expenses", async () => {
  await useMemoryStorageUnlessConfigured();
  const t = await buildTrade(databaseUrl!);
  const list = await import("../../../src/app/api/accounts/[recordType]/route.ts");
  const summary = await import("../../../src/app/api/accounts/summary/route.ts");
  const report = await import("../../../src/app/api/reports/[reportType]/route.ts");
  const movements = await import("../../../src/app/api/projects/[projectId]/money-movements/route.ts");
  const allocate = await import("../../../src/app/api/money-movements/[movementId]/allocations/route.ts");
  const expenses = await import("../../../src/app/api/projects/[projectId]/expenses/route.ts");
  const createSupplierInvoice = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const projectId = t.project.id, project = params({ projectId });
  const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); data.set("file", new File([PDF], "doc.pdf")); return data; };
  const records = async (type: string, who: Parameters<typeof t.get>[1] = "finance", query = "") =>
    list.GET(t.get(`/api/accounts/${type}${query}`, who), params({ recordType: type }));
  try {
    await t.confirmShipments();
    const supplierInvoice = await t.ok<{ id: string }>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form({ reference: "AD-ACC-1", invoiceDate: today, amount: "99849.60" })), params({ shipmentId: t.supplierShipment.id })), 201);
    const customerInvoice = await t.ok<{ id: string; reference: string }>(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today }), params({ shipmentId: t.salesShipment.id })), 201);
    const move = (fields: Record<string, string>) => movements.POST(t.multipart(`/api/projects/${projectId}/money-movements`, "finance", form({ currency: "USD", fxRate: "3.6725", occurredOn: today, ...fields })), project);
    const receipt = await t.ok<{ id: string }>(await move({ kind: "CUSTOMER_RECEIPT", counterpartyId: t.customer, amount: "70000", reference: "ACC-R-1" }), 201);
    await t.ok(await allocate.POST(t.post(`/api/money-movements/${receipt.id}/allocations`, "finance", { targetType: "CINV", targetId: customerInvoice.id, amount: "50000", currency: "USD" }) as never, params({ movementId: receipt.id }) as never), 201);
    const payment = await t.ok(await move({ kind: "SUPPLIER_PAYMENT", counterpartyId: t.supplier, amount: "40000", reference: "ACC-P-1" }), 201);
    const expense = await t.ok(await expenses.POST(t.multipart(`/api/projects/${projectId}/expenses`, "ops", form({ categoryCode: "CUSTOMS", payeeName: "Jebel Ali Customs", amount: "1200", currency: "USD", fxRate: "3.6725", occurredOn: today })), project), 201);

    // Registers: one record type each, own company only, with what is still open.
    const sales = (await t.ok<{ type: string; items: Rec[] }>(await records("sales-invoices"))).items.filter((r) => r.projectId === projectId);
    assert.deepEqual(sales.map((r) => [r.reference, r.state, r.amount, r.outstandingAmount, r.partyName]), [[customerInvoice.reference, "ISSUED", "117120.000000", "67120.000000", "Hamburg Roasters GmbH"]]);
    assert.equal(sales[0].href, `/sales-shipments/${t.salesShipment.id}`);
    const [due] = sales as unknown as { dueDate: string; overdue: boolean; aedAmount: string; aedOutstanding: string }[];
    assert.match(due.dueDate, /^\d{4}-\d{2}-\d{2}$/, "invoice date plus the customer's payment terms");
    assert.equal(due.overdue, false);
    assert.deepEqual([due.aedAmount, due.aedOutstanding], ["430123.200000", "246498.200000"], "USD at the 3.6725 peg");
    const supplier = (await t.ok<{ items: Rec[] }>(await records("supplier-invoices"))).items.filter((r) => r.projectId === projectId);
    assert.deepEqual(supplier.map((r) => [r.reference, r.outstandingAmount]), [["AD-ACC-1", "99849.600000"]]);
    assert.ok(supplier[0].documentId, "the supplier's PDF opens from the register");
    const collections = (await t.ok<{ items: Rec[] }>(await records("collections"))).items.filter((r) => r.projectId === projectId);
    assert.deepEqual(collections.map((r) => [r.reference, r.state, r.outstandingAmount]), [["ACC-R-1", "PARTIALLY_ALLOCATED", "20000.000000"]]);
    const payments = (await t.ok<{ items: Rec[] }>(await records("supplier-payments"))).items.filter((r) => r.projectId === projectId);
    assert.deepEqual(payments.map((r) => [r.reference, r.state, r.outstandingAmount]), [["ACC-P-1", "CONFIRMED", "40000.000000"]]);
    const spent = (await t.ok<{ items: Rec[] }>(await records("expenses"))).items.filter((r) => r.projectId === projectId);
    assert.deepEqual(spent.map((r) => [r.reference, r.state, r.partyName, r.amount]), [["Customs and duties", "APPROVED", "Jebel Ali Customs", "1200.000000"]]);

    // Project filter, roles, other companies.
    const scoped = await t.ok<{ projectId: string; items: Rec[] }>(await records("sales-invoices", "finance", `?projectId=${projectId}`));
    assert.equal(scoped.projectId, projectId);
    assert.ok(scoped.items.every((r) => r.projectId === projectId));
    assert.equal((await records("sales-invoices", "finance", "?projectId=not-a-project")).status, 422);
    assert.equal((await records("sales-invoices", "ops")).status, 403, "Operations cannot see accounts");
    assert.deepEqual((await t.ok<{ items: Rec[] }>(await records("sales-invoices", "outsider"))).items.filter((r) => r.projectId === projectId), [], "another company sees nothing");

    // Summary per currency for this project.
    const s = await t.ok<{ recordCount: number; currencySections: Record<string, string>[] }>(await summary.GET(t.get(`/api/accounts/summary?projectId=${projectId}`, "finance")));
    assert.equal(s.recordCount, 5);
    const bar = (s as unknown as { aed: Record<string, string | number> }).aed;
    assert.deepEqual([bar.salesOpen, bar.salesOverdue, bar.supplierOpen, bar.unconverted], ["246498.200000", "0.000000", "366697.660000", 0], "money bar in AED");
    assert.deepEqual(s.currencySections.find((x) => x.currency === "USD"), {
      currency: "USD", salesInvoiced: "117120.000000", salesOutstanding: "67120.000000", supplierInvoiced: "99849.600000", supplierOutstanding: "99849.600000",
      collections: "70000.000000", supplierPayments: "40000.000000", expenses: "1200.000000", netOperationalCash: "28800.000000",
    });

    // Accounts report: dated, with exact totals; dates validated.
    const r = await t.ok<{ reportType: string; items: Rec[]; summary: Record<string, string> }>(await report.GET(t.get(`/api/reports/accounts?projectId=${projectId}&from=${today}&to=${today}`, "finance"), params({ reportType: "accounts" })));
    assert.equal(r.reportType, "ACCOUNTS");
    assert.equal(r.items.length, 5);
    assert.equal(r.summary["USD.SALES_INVOICE.outstanding"], "67120.000000");
    assert.equal((await t.ok<{ items: Rec[] }>(await report.GET(t.get(`/api/reports/accounts?projectId=${projectId}&to=2000-01-01`, "finance"), params({ reportType: "accounts" })))).items.length, 0);
    assert.equal((await report.GET(t.get(`/api/reports/accounts?from=2026-12-31&to=2026-01-01`, "finance"), params({ reportType: "accounts" }))).status, 422);
  } finally {
    await t.sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
