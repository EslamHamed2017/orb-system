import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000007001";
const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000007002";
const OTHER_SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000007003";
const SUPPLIER_ID = "019a5f9b-7c00-7000-8000-000000007004";
const OTHER_SUPPLIER_ID = "019a5f9b-7c00-7000-8000-000000007005";
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000007006";
const FINANCE = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000007007", displayName: "Finance", roles: ["FINANCE_VIEWER"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000007008", displayName: "Owner", roles: ["OWNER_ADMIN"] });

interface InvoiceService {
  create(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  submitForApproval(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  decideApproval(input: Record<string, unknown>): Promise<any>;
  confirm(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  cancel(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  get(invoiceId: string): Promise<any>;
  supplierShipmentProjection(shipmentId: string): Promise<any>;
  projectProjection(projectId: string): Promise<any>;
  setAllocatedAmount(invoiceId: string, amount: string): Promise<void>;
}

interface InvoiceModule {
  createInMemorySupplierInvoiceService(options: Record<string, unknown>): InvoiceService;
}

async function loadInvoices(): Promise<InvoiceModule> {
  return import("../../../src/modules/invoices/supplier-invoice-service.ts") as Promise<InvoiceModule>;
}

function command(idempotencyKey: string, principal = FINANCE) {
  return { principal, idempotencyKey, correlationId: idempotencyKey };
}

function problem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code &&
    (status === undefined || error.problem.status === status);
}

async function subject() {
  const module = await loadInvoices();
  return module.createInMemorySupplierInvoiceService({
    now: () => "2026-11-07T12:00:00.000Z",
    shipments: [
      { id: SHIPMENT_ID, projectId: PROJECT_ID, supplierId: SUPPLIER_ID, executionState: "RECEIVED", version: 4 },
      { id: OTHER_SHIPMENT_ID, projectId: PROJECT_ID, supplierId: OTHER_SUPPLIER_ID, executionState: "RECEIVED", version: 2 },
    ],
    evidence: [{ id: EVIDENCE_ID, projectId: PROJECT_ID, state: "AVAILABLE", sha256: "a".repeat(64) }],
  });
}

async function draft(service: InvoiceService, reference = "SUP-INV-0701", key = "invoice-create") {
  const result = await service.create({
    shipmentId: SHIPMENT_ID,
    expectedVersion: 4,
    supplierId: SUPPLIER_ID,
    reference,
    invoiceDate: "2026-11-06",
    amount: "12500.250000",
    currency: "USD",
    evidenceId: EVIDENCE_ID,
    ...command(key),
  });
  assert.equal(result.value.state, "DRAFT");
  assert.equal(result.value.supplierShipmentId, SHIPMENT_ID);
  assert.equal(result.value.projectId, PROJECT_ID);
  assert.equal(result.value.outstandingAmount, "12500.250000");
  return result.value;
}

async function confirm(service: InvoiceService, reference = "SUP-INV-0701", prefix = "invoice") {
  const created = await draft(service, reference, `${prefix}-create`);
  const submitted = await service.submitForApproval({ invoiceId: created.id, expectedVersion: created.version, ...command(`${prefix}-submit`) });
  assert.deepEqual(
    { actionCode: submitted.value.actionCode, subjectId: submitted.value.subjectId, subjectVersion: submitted.value.subjectVersion },
    { actionCode: "SUPPLIER_INVOICE_CONFIRMATION", subjectId: created.id, subjectVersion: created.version },
  );
  await assert.rejects(
    () => service.decideApproval({ approvalId: submitted.value.id, approver: FINANCE, decision: "APPROVED" }),
    problem("SELF_APPROVAL_FORBIDDEN", 409),
  );
  const approval = await service.decideApproval({ approvalId: submitted.value.id, approver: OWNER, decision: "APPROVED" });
  const confirmed = await service.confirm({ invoiceId: created.id, expectedVersion: submitted.value.subjectVersion + 1, approvalId: approval.id, ...command(`${prefix}-confirm`) });
  assert.equal(confirmed.value.state, "CONFIRMED");
  return confirmed.value;
}

test("creates exactly one evidence-backed invoice for its shipment supplier and rejects cross-linkage", async () => {
  const service = await subject();
  const created = await draft(service);
  assert.equal(created.evidenceId, EVIDENCE_ID);
  assert.equal(created.supplierId, SUPPLIER_ID);
  const replay = await service.create({ shipmentId: SHIPMENT_ID, expectedVersion: 4, supplierId: SUPPLIER_ID, reference: "SUP-INV-0701", invoiceDate: "2026-11-06", amount: "12500.250000", currency: "USD", evidenceId: EVIDENCE_ID, ...command("invoice-create") });
  assert.equal(replay.replayed, true);
  assert.equal(replay.value.id, created.id);
  await assert.rejects(() => service.create({ shipmentId: SHIPMENT_ID, expectedVersion: 4, supplierId: OTHER_SUPPLIER_ID, reference: "WRONG-SUPPLIER", invoiceDate: "2026-11-06", amount: "1.000000", currency: "USD", evidenceId: EVIDENCE_ID, ...command("wrong-supplier") }), problem("VALIDATION_FAILED", 400));
});

test("confirmation requires the approved exact invoice version and is idempotent", async () => {
  const service = await subject();
  const created = await draft(service, "SUP-INV-EXACT", "exact-create");
  const pending = await service.submitForApproval({ invoiceId: created.id, expectedVersion: created.version, ...command("exact-submit") });
  const approved = await service.decideApproval({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED" });
  await assert.rejects(() => service.confirm({ invoiceId: created.id, expectedVersion: created.version, approvalId: approved.id, ...command("stale-confirm") }), problem("STALE_VERSION", 412));
  await assert.rejects(() => service.confirm({ invoiceId: created.id, expectedVersion: created.version + 1, approvalId: "019a5f9b-7c00-7000-8000-000000007099", ...command("wrong-approval") }), problem("APPROVAL_VERSION_MISMATCH", 409));
  const first = await service.confirm({ invoiceId: created.id, expectedVersion: created.version + 1, approvalId: approved.id, ...command("exact-confirm") });
  const replay = await service.confirm({ invoiceId: created.id, expectedVersion: created.version + 1, approvalId: approved.id, ...command("exact-confirm") });
  assert.equal(first.value.state, "CONFIRMED");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
});

test("confirmed invoice facts are immutable and balances appear in shipment and Project projections", async () => {
  const service = await subject();
  const invoice = await confirm(service, "SUP-INV-BALANCE", "balance");
  const snapshot = structuredClone(await service.get(invoice.id));
  assert.equal(snapshot.amount, "12500.250000");
  assert.equal(snapshot.outstandingAmount, "12500.250000");
  assert.equal((await service.supplierShipmentProjection(SHIPMENT_ID)).supplierInvoiceOutstanding, "12500.250000");
  assert.equal((await service.projectProjection(PROJECT_ID)).supplierInvoiceOutstanding, "12500.250000");
  snapshot.amount = "0.000000";
  assert.equal((await service.get(invoice.id)).amount, "12500.250000", "returned data cannot mutate confirmed storage");
  await assert.rejects(() => service.create({ shipmentId: SHIPMENT_ID, expectedVersion: 5, supplierId: SUPPLIER_ID, reference: "SUP-INV-BALANCE", invoiceDate: "2026-11-06", amount: "1.000000", currency: "USD", evidenceId: EVIDENCE_ID, ...command("duplicate") }), problem("DUPLICATE_REFERENCE", 409));
});

test("Owner can reason-cancel only an unallocated confirmed invoice", async () => {
  const service = await subject();
  const unallocated = await confirm(service, "SUP-INV-CANCEL", "cancel");
  await assert.rejects(() => service.cancel({ invoiceId: unallocated.id, expectedVersion: unallocated.version, reason: "Supplier voided invoice", ...command("finance-cancel") }), problem("PERMISSION_DENIED", 403));
  const cancelled = await service.cancel({ invoiceId: unallocated.id, expectedVersion: unallocated.version, reason: "Supplier voided invoice", ...command("owner-cancel", OWNER) });
  assert.equal(cancelled.value.state, "CANCELLED");
  assert.equal(cancelled.value.cancellationReason, "Supplier voided invoice");
  assert.equal((await service.supplierShipmentProjection(SHIPMENT_ID)).supplierInvoiceOutstanding, "0.000000");

  const allocated = await confirm(service, "SUP-INV-ALLOCATED", "allocated");
  await service.setAllocatedAmount(allocated.id, "100.000000");
  await assert.rejects(() => service.cancel({ invoiceId: allocated.id, expectedVersion: allocated.version, reason: "Cannot cancel while allocated", ...command("allocated-cancel", OWNER) }), problem("INVALID_STATE_TRANSITION", 409));
  assert.equal((await service.get(allocated.id)).state, "CONFIRMED");
});

test("a replacement confirmed invoice restores the received-shipment closure prerequisite", async () => {
  const service = await subject();
  const original = await confirm(service, "SUP-INV-ORIGINAL", "original");
  await service.cancel({ invoiceId: original.id, expectedVersion: original.version, reason: "Replaced by corrected supplier invoice", ...command("original-cancel", OWNER) });
  assert.equal((await service.supplierShipmentProjection(SHIPMENT_ID)).hasConfirmedNonCancelledInvoice, false);
  assert.equal((await service.projectProjection(PROJECT_ID)).supplierInvoiceClosurePrerequisiteMet, false);

  const replacement = await confirm(service, "SUP-INV-REPLACEMENT", "replacement");
  assert.equal(replacement.state, "CONFIRMED");
  assert.equal((await service.supplierShipmentProjection(SHIPMENT_ID)).hasConfirmedNonCancelledInvoice, true);
  assert.equal((await service.projectProjection(PROJECT_ID)).supplierInvoiceClosurePrerequisiteMet, true);
});


test("supplier invoice lines resolve only to the selected supplier in the container active dataset", async () => {
  const module = await loadInvoices();
  const datasetId = "019a5f9b-7c00-7000-8000-000000007020";
  const supplierLineId = "019a5f9b-7c00-7000-8000-000000007021";
  const otherSupplierLineId = "019a5f9b-7c00-7000-8000-000000007022";
  const service = module.createInMemorySupplierInvoiceService({
    now: () => "2026-11-07T12:00:00.000Z",
    shipments: [{ id: SHIPMENT_ID, projectId: PROJECT_ID, activeDatasetId: datasetId, executionState: "RECEIVED", version: 4 }],
    datasets: [{ id: datasetId, shipmentId: SHIPMENT_ID, state: "APPROVED", lines: [
      { id: supplierLineId, supplierId: SUPPLIER_ID, quantity: "10.000000" },
      { id: otherSupplierLineId, supplierId: OTHER_SUPPLIER_ID, quantity: "8.000000" },
    ] }],
    evidence: [{ id: EVIDENCE_ID, projectId: PROJECT_ID, state: "AVAILABLE", sha256: "a".repeat(64) }],
  });
  const created = await service.create({ shipmentId: SHIPMENT_ID, expectedVersion: 4, supplierId: SUPPLIER_ID, reference: "SUP-LINES-1", invoiceDate: "2026-11-06", currency: "USD", evidenceId: EVIDENCE_ID, lines: [
    { shipmentLineId: supplierLineId, description: "Supplier coffee", quantity: "10.000000", unitPrice: "2.500000" },
  ], ...command("supplier-lines-create") });

  assert.equal(created.value.amount, "25.000000");
  assert.deepEqual(created.value.lines.map((line: any) => ({ source: line.supplierShipmentDatasetLineId, supplierId: line.supplierId, amount: line.lineAmount })), [
    { source: supplierLineId, supplierId: SUPPLIER_ID, amount: "25.000000" },
  ]);
  await assert.rejects(() => service.create({ shipmentId: SHIPMENT_ID, expectedVersion: 4, supplierId: SUPPLIER_ID, reference: "SUP-LINES-CROSS", invoiceDate: "2026-11-06", amount: "8.000000", currency: "USD", evidenceId: EVIDENCE_ID, lines: [
    { shipmentLineId: otherSupplierLineId, description: "Other supplier coffee", quantity: "8.000000", unitPrice: "1.000000" },
  ], ...command("supplier-lines-cross") }), problem("SUPPLIER_ATTRIBUTION_MISMATCH", 409));
});
