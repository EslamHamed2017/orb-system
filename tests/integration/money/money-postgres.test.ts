import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/**
 * Receipts, supplier payments, allocation to invoices, reversals and project expenses on PostgreSQL through the real routes.
 * Requires ORB_TEST_DATABASE_URL; documents go to OBJECT_STORAGE_* when set (MinIO in CI), otherwise to an in-memory store.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;

async function useMemoryStorageUnlessConfigured() {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return;
  const { setDocumentObjectStore } = await import("../../../src/modules/evidence/document-storage.ts");
  const objects = new Map<string, Uint8Array>();
  setDocumentObjectStore({
    async putImmutable(input) { const versionId = `v-${objects.size + 1}`; objects.set(`${input.objectKey}@${versionId}`, input.body as Uint8Array); return { objectKey: input.objectKey, objectVersionId: versionId, retentionUntil: input.retentionUntil }; },
    async getImmutable({ objectKey, objectVersionId }) { const body = objects.get(`${objectKey}@${objectVersionId}`); if (!body) throw new Error("missing object"); return { body, contentType: "application/octet-stream", byteLength: body.byteLength }; },
  });
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const today = new Date().toISOString().slice(0, 10);

interface Movement { id: string; kind: string; state: string; amount: string; aedAmount: string; fxRate: string; allocated: string; unallocated: string; pendingApprovalId: string | null; allocations: { id: string; state: string; amount: string; invoiceReference: string }[]; document: { id: string } | null }
interface Expense { id: string; state: string; aedAmount: string; pendingApprovalId: string | null; payee: { name: string }; shipment: { reference: string } | null; lastDecision: { comment: string | null } | null }
interface Invoice { id: string; state: string; amount: string; paid: string; outstanding: string; pendingApprovalId: string | null; reference: string }

integration("receipts and supplier payments are allocated to invoices, reversed with reasons, and expenses need owner approval", async () => {
  await useMemoryStorageUnlessConfigured();
  const t = await buildTrade(databaseUrl!);
  const movements = await import("../../../src/app/api/projects/[projectId]/money-movements/route.ts");
  const allocate = await import("../../../src/app/api/money-movements/[movementId]/allocations/route.ts");
  const reverseMovement = await import("../../../src/app/api/money-movements/[movementId]/reverse/route.ts");
  const reverseAllocation = await import("../../../src/app/api/allocations/[allocationId]/reverse/route.ts");
  const expenses = await import("../../../src/app/api/projects/[projectId]/expenses/route.ts");
  const cancelExpense = await import("../../../src/app/api/expenses/[expenseId]/cancel/route.ts");
  const inbox = await import("../../../src/app/api/approvals/route.ts");
  const createSupplierInvoice = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const cancelSupplierInvoice = await import("../../../src/app/api/supplier-invoices/[invoiceId]/cancel/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const salesInvoice = await import("../../../src/app/api/sales-invoices/[invoiceId]/route.ts");
  const projectId = t.project.id, project = params({ projectId });
  const form = (fields: Record<string, string>, file: Buffer | null = PDF, name = "slip.pdf") => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    if (file) data.set("file", new File([file], name));
    return data;
  };
  const move = (who: Parameters<typeof t.multipart>[1], fields: Record<string, string>, file: Buffer | null = PDF) => movements.POST(t.multipart(`/api/projects/${projectId}/money-movements`, who, form(fields, file)), project);
  const alloc = (movementId: string, body: Record<string, unknown>) => allocate.POST(t.post(`/api/money-movements/${movementId}/allocations`, "finance", body) as never, params({ movementId }) as never);
  const moneyOf = async (who: Parameters<typeof t.get>[1]) => t.ok<{ movements: Movement[]; expenses: Expense[]; invoices: { id: string; outstanding: string }[]; totals: Record<string, string>[]; canManageMoney: boolean }>(await movements.GET(t.get(`/api/projects/${projectId}/money-movements`, who), project));
  const sales = async (id: string) => t.ok<Invoice>(await salesInvoice.GET(t.get(`/api/sales-invoices/${id}`, "finance"), params({ invoiceId: id })));
  try {
    await t.confirmShipments();
    // Invoices to pay: an approved supplier invoice (99,849.60) and an issued customer invoice (117,120.00).
    const invoiceForm = new FormData(); invoiceForm.set("reference", "AD-77"); invoiceForm.set("invoiceDate", today); invoiceForm.set("amount", "99849.60"); invoiceForm.set("file", new File([PDF], "inv.pdf"));
    const supplierInvoice = await t.ok<Invoice>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", invoiceForm), params({ shipmentId: t.supplierShipment.id })), 201);
    const customerInvoice = await t.ok<Invoice>(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today }), params({ shipmentId: t.salesShipment.id })), 201);

    // ---- customer receipt: counts at once, needs the slip and the rate ----
    const receiptFields = { kind: "CUSTOMER_RECEIPT", counterpartyId: t.customer, amount: "50,000", currency: "USD", fxRate: "3.6725", occurredOn: today, reference: "tt-hamburg-001" };
    assert.equal((await move("ops", receiptFields)).status, 403, "Operations cannot record money");
    assert.equal((await move("finance", receiptFields, null)).status, 422, "bank slip is required");
    assert.equal((await move("finance", { ...receiptFields, fxRate: "" })).status, 422, "FX rate is required for USD");
    assert.equal((await move("finance", { ...receiptFields, currency: "AED", fxRate: "3.67" })).status, 422, "AED rate must be 1");
    assert.equal((await move("finance", { ...receiptFields, counterpartyId: t.supplier })).status, 422, "receipt must come from the project's customer");
    const receipt = await t.ok<Movement>(await move("finance", receiptFields), 201);
    assert.equal(receipt.state, "CONFIRMED");
    assert.equal(receipt.amount, "50000.00");
    assert.equal(receipt.aedAmount, "183625.00");
    assert.ok(receipt.document);
    assert.equal((await move("finance", receiptFields)).status, 409, "same bank reference twice");

    // Allocate the receipt to the customer invoice; it cannot pay supplier invoices or more than is due.
    assert.equal((await alloc(receipt.id, { targetType: "SUPPLIER_INVOICE", targetId: supplierInvoice.id, amount: "100", currency: "USD" })).status, 422);
    assert.equal((await alloc(receipt.id, { targetType: "CINV", targetId: customerInvoice.id, amount: "50000.01", currency: "USD" })).status, 422);
    const allocated = await t.ok<Movement>(await alloc(receipt.id, { targetType: "CINV", targetId: customerInvoice.id, amount: "50000", currency: "USD" }), 201);
    assert.equal(allocated.state, "FULLY_ALLOCATED");
    assert.equal(allocated.allocations[0].invoiceReference, customerInvoice.reference);
    assert.deepEqual([(await sales(customerInvoice.id)).paid, (await sales(customerInvoice.id)).outstanding], ["50000.00", "67120.00"]);

    // ---- supplier payment: counts as soon as it is saved (no approval step) ----
    const payment = await t.ok<Movement>(await move("finance", { kind: "SUPPLIER_PAYMENT", counterpartyId: t.supplier, amount: "99849.60", currency: "USD", fxRate: "3.6725", occurredOn: today, reference: "TT-ADEN-1", notes: "Balance for IN shipment" }, PNG), 201);
    assert.equal(payment.state, "CONFIRMED");
    assert.equal(payment.pendingApprovalId, null);
    const items = (await t.ok<{ items: { subjectId: string }[] }>(await inbox.GET(t.get("/api/approvals", "owner") as never))).items;
    assert.ok(!items.some((item) => item.subjectId === payment.id), "nothing waits for approval");
    const partly = await t.ok<Movement>(await alloc(payment.id, { targetType: "SUPPLIER_INVOICE", targetId: supplierInvoice.id, amount: "60000", currency: "USD" }), 201);
    assert.equal(partly.state, "PARTIALLY_ALLOCATED");
    assert.equal(partly.unallocated, "39849.60");
    assert.equal((await cancelSupplierInvoice.POST(t.post(`/api/supplier-invoices/${supplierInvoice.id}/cancel`, "finance", { reason: "Wrong" }), params({ invoiceId: supplierInvoice.id }))).status, 409, "paid invoices cannot be cancelled");

    // Reverse an allocation, then reverse the receipt entirely — history stays.
    const allocationId = partly.allocations[0].id;
    assert.equal((await reverseAllocation.POST(t.post(`/api/allocations/${allocationId}/reverse`, "finance", { reason: "x" }) as never, params({ allocationId }) as never)).status, 422);
    const unallocated = await t.ok<Movement>(await reverseAllocation.POST(t.post(`/api/allocations/${allocationId}/reverse`, "finance", { reason: "Allocated to the wrong invoice" }) as never, params({ allocationId }) as never), 201);
    assert.equal(unallocated.state, "CONFIRMED");
    assert.deepEqual(unallocated.allocations.map((a) => a.state), ["REVERSED"]);
    const reversed = await t.ok<Movement>(await reverseMovement.POST(t.post(`/api/money-movements/${receipt.id}/reverse`, "finance", { reason: "Bank returned the transfer" }) as never, params({ movementId: receipt.id }) as never), 201);
    assert.equal(reversed.state, "REVERSED");
    assert.equal(reversed.unallocated, "0.00");
    assert.equal((await sales(customerInvoice.id)).outstanding, "117120.00");

    // ---- expenses: anyone on the project records them with the bill; they count at once ----
    const expenseFields = { categoryCode: "FREIGHT", payeeName: "Gulf Forwarders LLC", description: "Ocean freight Aden → Jebel Ali", shipmentType: "SUPPLIER", shipmentId: t.supplierShipment.id, amount: "1850", currency: "USD", fxRate: "3.6725", occurredOn: today };
    const spend = (who: Parameters<typeof t.multipart>[1], fields: Record<string, string>, file: Buffer | null = PDF) => expenses.POST(t.multipart(`/api/projects/${projectId}/expenses`, who, form(fields, file, "bill.pdf")), project);
    assert.equal((await spend("ops", expenseFields, null)).status, 422, "the bill is required");
    assert.equal((await spend("ops", { ...expenseFields, payeeName: "" })).status, 422, "who was paid is required");
    assert.equal((await spend("ops", { ...expenseFields, categoryCode: "NOPE" })).status, 422);
    const freight = await t.ok<Expense>(await spend("ops", expenseFields), 201);
    assert.equal(freight.state, "APPROVED");
    assert.equal(freight.pendingApprovalId, null);
    assert.equal(freight.aedAmount, "6794.13");
    assert.equal(freight.shipment?.reference, `IN-${t.tenant.slice(-6).toUpperCase()}`);
    const customs = await t.ok<Expense>(await spend("finance", { ...expenseFields, categoryCode: "CUSTOMS", payeeName: "", supplierId: t.supplier, shipmentId: "", amount: "420" }), 201);
    assert.equal(customs.payee.name, "Aden Coffee Exporters");
    assert.equal((await cancelExpense.POST(t.post(`/api/expenses/${customs.id}/cancel`, "finance", { reason: "" }), params({ expenseId: customs.id }))).status, 422, "cancelling needs a reason");
    assert.equal((await t.ok<Expense>(await cancelExpense.POST(t.post(`/api/expenses/${customs.id}/cancel`, "finance", { reason: "Duplicate of the clearing bill" }), params({ expenseId: customs.id })))).state, "CANCELLED");
    const storage = await t.ok<Expense>(await spend("ops", { ...expenseFields, categoryCode: "STORAGE", amount: "300" }), 201);
    assert.equal((await cancelExpense.POST(t.post(`/api/expenses/${storage.id}/cancel`, "ops", { reason: "Entered twice" }), params({ expenseId: storage.id }))).status, 403, "Operations cannot cancel");
    assert.equal((await t.ok<Expense>(await cancelExpense.POST(t.post(`/api/expenses/${storage.id}/cancel`, "finance", { reason: "Entered twice" }), params({ expenseId: storage.id })))).state, "CANCELLED");

    // ---- project money ----
    const ops = await moneyOf("ops");
    assert.equal(ops.canManageMoney, false);
    assert.deepEqual([ops.movements.length, ops.invoices.length, ops.expenses.length], [0, 0, 3], "Operations sees expenses only");
    const finance = await moneyOf("finance");
    const usd = finance.totals.find((row) => row.currency === "USD")!;
    assert.deepEqual({
      received: usd.receivedFromCustomer, paid: usd.paidToSuppliers, customerOutstanding: usd.customerOutstanding, supplierOutstanding: usd.supplierOutstanding,
      supplierAdvance: usd.supplierAdvance, expensesApproved: usd.expensesApproved, expensesPending: usd.expensesPending,
    }, { received: "0.00", paid: "99849.60", customerOutstanding: "117120.00", supplierOutstanding: "99849.60", supplierAdvance: "99849.60", expensesApproved: "1850.00", expensesPending: "0.00" });

    const actions = (await t.sql.query(`SELECT "subject_type" || ':' || "action" a FROM "MoneyAuditEvent" WHERE "tenant_id" = $1`, [t.tenant])).rows.map((row) => row.a);
    for (const action of ["MOVEMENT:RECORDED", "MOVEMENT:REVERSED", "ALLOCATION:ALLOCATED", "ALLOCATION:REVERSED", "EXPENSE:RECORDED", "EXPENSE:APPROVED", "EXPENSE:CANCELLED"]) assert.ok(actions.includes(action), `missing ${action}`);
  } finally {
    await t.sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
