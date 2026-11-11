import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import { createInMemorySalesInvoiceService } from "../../../src/modules/invoices/sales-invoice-service.ts";

const PROJECT = "019a5f9b-7c00-7000-8000-000000008001";
const SHIPMENT = "019a5f9b-7c00-7000-8000-000000008002";
const DATASET = "019a5f9b-7c00-7000-8000-000000008003";
const CUSTOMER = "019a5f9b-7c00-7000-8000-000000008004";
const LINE_1 = "019a5f9b-7c00-7000-8000-000000008005";
const LINE_2 = "019a5f9b-7c00-7000-8000-000000008006";
const FINANCE = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008007", roles: ["FINANCE_VIEWER"] });
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000008008", roles: ["OPERATIONS"] });
const problem = (code: string, status: number) => (error: unknown) => error instanceof ProblemError && error.problem.code === code && error.problem.status === status;

function subject() {
  return createInMemorySalesInvoiceService({
    now: () => "2026-11-11T12:00:00.000Z",
    shipments: [{ id: SHIPMENT, projectId: PROJECT, customerId: CUSTOMER, customerNameEn: "Atlas Coffee", customerNameAr: "أطلس للقهوة", reference: "SS-008", activeDatasetId: DATASET, executionState: "DELIVERED", version: 3 }],
    datasets: [{ id: DATASET, shipmentId: SHIPMENT, state: "APPROVED", lines: [
      { id: LINE_1, lineNo: 1, productDescription: "Ethiopia Grade 1", quantity: "10.000000" },
      { id: LINE_2, lineNo: 2, productDescription: "Brazil Fine Cup", quantity: "5.000000" },
    ] }],
  });
}
const command = (key: string, principal = FINANCE) => ({ principal, idempotencyKey: key, correlationId: key });

async function create(service = subject(), reference = "CINV-008") {
  const result = await service.create({ shipmentId: SHIPMENT, expectedVersion: 3, reference, invoiceDate: "2026-11-11", currency: "USD", lines: [
    { shipmentLineId: LINE_1, description: "Ethiopia Grade 1", quantity: "10.000000", unitPrice: "8.250000" },
    { shipmentLineId: LINE_2, description: "Brazil Fine Cup", quantity: "2.500000", unitPrice: "7.000000" },
  ], ...command(`create-${reference}`) });
  return { service, result };
}

test("creates one shipment-grouped customer invoice with exact traced lines and totals", async () => {
  const { service, result } = await create();
  assert.equal(result.replayed, false);
  assert.deepEqual({ projectId: result.value.projectId, shipmentId: result.value.salesShipmentId, datasetId: result.value.salesShipmentDatasetId, customerId: result.value.customerId, state: result.value.state, total: result.value.totalAmount }, { projectId: PROJECT, shipmentId: SHIPMENT, datasetId: DATASET, customerId: CUSTOMER, state: "DRAFT", total: "100.000000" });
  assert.deepEqual(result.value.lines.map((line: any) => [line.lineNo, line.salesShipmentDatasetLineId, line.lineAmount]), [[1, LINE_1, "82.500000"], [2, LINE_2, "17.500000"]]);
  const replay = await service.create({ shipmentId: SHIPMENT, expectedVersion: 3, reference: "CINV-008", invoiceDate: "2026-11-11", currency: "USD", lines: [{ shipmentLineId: LINE_1, description: "Ethiopia Grade 1", quantity: "10.000000", unitPrice: "8.250000" }, { shipmentLineId: LINE_2, description: "Brazil Fine Cup", quantity: "2.500000", unitPrice: "7.000000" }], ...command("create-CINV-008") });
  assert.equal(replay.replayed, true);
  assert.equal(replay.value.id, result.value.id);
  await assert.rejects(() => create(service, "CINV-009"), problem("ACTIVE_INVOICE_EXISTS", 409));
});

test("rejects arbitrary, duplicate, over-quantity, cross-state, malformed, and unauthorized invoice lines", async () => {
  const variants: Array<[string, unknown]> = [
    ["arbitrary", [{ shipmentLineId: crypto.randomUUID(), description: "x", quantity: "1", unitPrice: "1" }]],
    ["duplicate", [{ shipmentLineId: LINE_1, description: "x", quantity: "1", unitPrice: "1" }, { shipmentLineId: LINE_1, description: "x", quantity: "1", unitPrice: "1" }]],
    ["over", [{ shipmentLineId: LINE_2, description: "x", quantity: "5.000001", unitPrice: "1" }]],
    ["zero", [{ shipmentLineId: LINE_1, description: "x", quantity: "0", unitPrice: "1" }]],
  ];
  for (const [key, lines] of variants) await assert.rejects(() => subject().create({ shipmentId: SHIPMENT, expectedVersion: 3, reference: key, invoiceDate: "2026-11-11", currency: "USD", lines, ...command(`bad-${key}`) }), problem("VALIDATION_FAILED", 400));
  await assert.rejects(() => subject().create({ shipmentId: SHIPMENT, expectedVersion: 3, reference: "denied", invoiceDate: "2026-11-11", currency: "USD", lines: variants[0][1], ...command("denied-key", OPERATIONS) }), problem("PERMISSION_DENIED", 403));
});

test("returns immutable invoice reads and deterministic bilingual print data", async () => {
  const { service, result } = await create();
  const read = await service.get({ invoiceId: result.value.id, principal: FINANCE });
  (read.lines[0] as any).description = "tampered";
  assert.equal((await service.get({ invoiceId: result.value.id, principal: FINANCE })).lines[0].description, "Ethiopia Grade 1");
  const print = await service.getPrintData({ invoiceId: result.value.id, principal: FINANCE, locale: "ar" });
  assert.deepEqual({ direction: print.direction, title: print.title, customerName: print.customer.name, shipmentReference: print.shipment.reference, total: print.totals.totalAmount }, { direction: "rtl", title: "فاتورة مبيعات", customerName: "أطلس للقهوة", shipmentReference: "SS-008", total: "100.000000" });
  assert.equal(print.lines.length, 2);
  await assert.rejects(() => service.get({ invoiceId: result.value.id, principal: OPERATIONS }), problem("PERMISSION_DENIED", 403));
});
