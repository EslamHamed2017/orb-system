import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/**
 * Supplier and customer invoices on PostgreSQL + S3-compatible storage through the real routes.
 * Requires ORB_TEST_DATABASE_URL; OBJECT_STORAGE_* (bucket with versioning + object lock) is optional locally.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;

/** Without OBJECT_STORAGE_ENDPOINT (local runs) documents go to an in-memory immutable store; CI uses MinIO with object lock. */
async function useMemoryStorageUnlessConfigured() {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return;
  const { setDocumentObjectStore } = await import("../../../src/modules/evidence/document-storage.ts");
  const objects = new Map<string, Uint8Array>();
  setDocumentObjectStore({
    async putImmutable(input) {
      const versionId = `v-${objects.size + 1}`;
      objects.set(`${input.objectKey}@${versionId}`, input.body as Uint8Array);
      return { objectKey: input.objectKey, objectVersionId: versionId, retentionUntil: input.retentionUntil };
    },
    async getImmutable({ objectKey, objectVersionId }) {
      const body = objects.get(`${objectKey}@${objectVersionId}`);
      if (!body) throw new Error("missing object");
      return { body, contentType: "application/octet-stream", byteLength: body.byteLength };
    },
  });
}

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const pdfFile = (name = "supplier-invoice.pdf") => new File([PDF], name, { type: "application/pdf" });

integration("supplier invoices need the document and count once saved; customer invoices are issued from the shipment", async () => {
  await useMemoryStorageUnlessConfigured();
  const t = await buildTrade(databaseUrl!);
  const createSupplierInvoice = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const submit = await import("../../../src/app/api/supplier-invoices/[invoiceId]/submit/route.ts");
  const confirm = await import("../../../src/app/api/supplier-invoices/[invoiceId]/confirm/route.ts");
  const cancel = await import("../../../src/app/api/supplier-invoices/[invoiceId]/cancel/route.ts");
  const inbox = await import("../../../src/app/api/approvals/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const salesInvoice = await import("../../../src/app/api/sales-invoices/[invoiceId]/route.ts");
  const printData = await import("../../../src/app/api/sales-invoices/[invoiceId]/print-data/route.ts");
  const cancelSales = await import("../../../src/app/api/sales-invoices/[invoiceId]/cancel/route.ts");
  const content = await import("../../../src/app/api/evidence/[evidenceId]/content/route.ts");
  const supplierDetail = await import("../../../src/app/api/supplier-shipments/[shipmentId]/route.ts");
  const inId = params({ shipmentId: t.supplierShipment.id }), outId = params({ shipmentId: t.salesShipment.id });
  const form = (fields: Record<string, string>, file: File | null = pdfFile()) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); if (file) data.set("file", file); return data; };
  type Invoice = { id: string; reference: string; state: string; amount: string; expectedAmount: string; quantity: string; unitPrice: string; currency: string; document: { id: string; filename: string } | null; pendingApprovalId: string | null; lastDecision: { decision: string } | null };
  const fields = { reference: "AD-2026-0091", invoiceDate: "2026-11-19", amount: "99,849.60" };
  try {
    // A draft shipment cannot be invoiced.
    assert.equal((await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form(fields)), inId)).status, 409);
    await t.confirmShipments();

    // Operations cannot record invoices; the document is mandatory and must really be a PDF/JPG/PNG.
    assert.equal((await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "ops", form(fields)), inId)).status, 403);
    assert.equal((await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form(fields, null)), inId)).status, 422);
    const fake = new File([Buffer.from("MZ not a pdf")], "invoice.pdf", { type: "application/pdf" });
    assert.equal((await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form(fields, fake)), inId)).status, 422);

    // Finance records the supplier invoice with its PDF; the line is shipment qty × contract price.
    const draft = await t.ok<Invoice>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form(fields)), inId), 201);
    assert.equal(draft.state, "CONFIRMED", "a bill counts as soon as it is saved");
    assert.equal(draft.quantity, "19.200000");
    assert.equal(draft.unitPrice, "5200.500000");
    assert.equal(draft.expectedAmount, "99849.60");
    assert.equal(draft.amount, "99849.60");
    assert.equal(draft.currency, "USD");
    assert.equal(draft.document?.filename, "supplier-invoice.pdf");
    assert.equal((await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form({ ...fields, reference: "AD-2026-0092" })), inId)).status, 409, "one active invoice per shipment");

    // The stored document streams back unchanged to the same company only.
    const file = await content.GET(t.get(`/api/evidence/${draft.document!.id}/content`, "ops") as never, params({ evidenceId: draft.document!.id }));
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "application/pdf");
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), PDF);
    assert.equal((await content.GET(t.get(`/api/evidence/${draft.document!.id}/content`, "outsider") as never, params({ evidenceId: draft.document!.id }))).status, 404);
    const stored = (await t.sql.query(`SELECT "sha256", "byte_length", "object_version_id" FROM "EvidenceObject" WHERE "id" = $1`, [draft.document!.id])).rows[0];
    assert.equal(Number(stored.byte_length), PDF.byteLength);
    assert.ok(stored.object_version_id);

    // No approval step: the bill counts as soon as it is saved. A wrong bill is cancelled with a reason and recorded again.
    assert.equal((await submit.POST(t.post(`/api/supplier-invoices/${draft.id}/submit`, "finance", {}), params({ invoiceId: draft.id }))).status, 409, "already confirmed");
    const items = (await t.ok<{ items: { subjectId: string }[] }>(await inbox.GET(t.get("/api/approvals", "owner") as never))).items;
    assert.ok(!items.some((item) => item.subjectId === draft.id), "nothing waits for approval");
    assert.equal((await cancel.POST(t.post(`/api/supplier-invoices/${draft.id}/cancel`, "finance", {}), params({ invoiceId: draft.id }))).status, 422, "cancelling needs a reason");
    assert.equal((await t.ok<Invoice>(await cancel.POST(t.post(`/api/supplier-invoices/${draft.id}/cancel`, "finance", { reason: "Bank details missing" }), params({ invoiceId: draft.id })))).state, "CANCELLED");
    const second = await t.ok<Invoice>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form({ ...fields, reference: "AD-2026-0091-R" }, pdfFile("corrected.pdf"))), inId), 201);
    assert.equal(second.state, "CONFIRMED");
    assert.equal((await t.ok<Invoice>(await confirm.POST(t.post(`/api/supplier-invoices/${second.id}/confirm`, "finance", {}), params({ invoiceId: second.id })))).state, "CONFIRMED");

    // The shipment detail lists its invoices.
    const detail = await t.ok<{ invoices: Invoice[] }>(await supplierDetail.GET(t.get(`/api/supplier-shipments/${t.supplierShipment.id}`, "ops"), inId));
    assert.deepEqual(detail.invoices.map((invoice) => invoice.state), ["CONFIRMED", "CANCELLED"]);

    // ---- customer invoice ----
    assert.equal((await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "ops", { invoiceDate: "2026-11-19" }), outId)).status, 403);
    const issued = await t.ok<Invoice>(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: "2026-11-19" }), outId), 201);
    assert.equal(issued.state, "ISSUED");
    assert.match(issued.reference, /^ORB-INV-2026-\d{6}$/);
    assert.equal(issued.amount, "117120.00", "19.2 MT × 6,100");
    assert.equal((await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: "2026-11-19" }), outId)).status, 409, "one invoice per shipment");
    const print = await t.ok<{ buyer: { name: string; taxNumber: string; paymentTermsDays: number }; lines: { quantity: string; unitPrice: string; lineAmount: string }[]; shipment: { reference: string; containers: string[] }; paymentTerms: string }>(await printData.GET(t.get(`/api/sales-invoices/${issued.id}/print-data`, "finance"), params({ invoiceId: issued.id })));
    assert.equal(print.buyer.name, "Hamburg Roasters GmbH");
    assert.equal(print.buyer.taxNumber, "DE123456789");
    assert.equal(print.lines.length, 1);
    assert.deepEqual({ quantity: print.lines[0].quantity, unitPrice: print.lines[0].unitPrice, lineAmount: print.lines[0].lineAmount }, { quantity: "19.200000", unitPrice: "6100.000000", lineAmount: "117120.00" });
    assert.deepEqual(print.shipment.containers, ["MSCU1234565"]);
    assert.equal((await salesInvoice.GET(t.get(`/api/sales-invoices/${issued.id}`, "outsider"), params({ invoiceId: issued.id }))).status, 404);
    const cancelled = await t.ok<Invoice>(await cancelSales.POST(t.post(`/api/sales-invoices/${issued.id}/cancel`, "finance", { reason: "Wrong invoice date" }), params({ invoiceId: issued.id })));
    assert.equal(cancelled.state, "CANCELLED");
    const reissued = await t.ok<Invoice>(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: "2026-11-19" }), outId), 201);
    assert.notEqual(reissued.reference, issued.reference, "numbers are never reused");

    const actions = (await t.sql.query(`SELECT "action" FROM "InvoiceAuditEvent" WHERE "tenant_id" = $1`, [t.tenant])).rows.map((row) => row.action);
    for (const action of ["CREATED", "APPROVED", "ISSUED", "CANCELLED"]) assert.ok(actions.includes(action), `missing ${action}`);
  } finally {
    await t.sql.end();
    const { getPrismaClient } = await import("../../../src/platform/database/prisma-client.ts");
    await getPrismaClient().$disconnect();
  }
});
