import assert from "node:assert/strict";
import test from "node:test";
import { createInMemorySalesInvoiceService } from "../../../src/modules/invoices/sales-invoice-service.ts";
import { createInMemorySupplierInvoiceService } from "../../../src/modules/invoices/supplier-invoice-service.ts";
import {
  createSalesShipmentLineService,
  type SalesShipmentLineRecord,
  type SalesShipmentLineRepository,
} from "../../../src/modules/shipments/sales-shipment-line-service.ts";
import {
  createShipmentLineFulfillmentService,
  type ShipmentLineFulfillmentRepository,
  type ShipmentLineSourceAllocationRecord,
} from "../../../src/modules/shipments/shipment-line-fulfillment-service.ts";
import {
  createSupplierShipmentLineService,
  type SupplierShipmentLineRecord,
  type SupplierShipmentLineRepository,
} from "../../../src/modules/shipments/supplier-shipment-line-service.ts";

const uuid = (suffix: string) => `019a5f9b-7c00-7000-8000-${suffix.padStart(12, "0")}`;
const ids = {
  project: uuid("1"), salesContract: uuid("2"), purchaseContractA: uuid("3"), purchaseContractB: uuid("4"),
  salesShipment: uuid("5"), salesDataset: uuid("6"), container: uuid("7"), containerDataset: uuid("8"),
  customer: uuid("9"), supplierA: uuid("10"), supplierB: uuid("11"), productA: uuid("12"), productB: uuid("13"),
  salesVersionA: uuid("14"), salesVersionB: uuid("15"), purchaseVersionA: uuid("16"), purchaseVersionB: uuid("17"),
  salesLineA: uuid("18"), salesLineB: uuid("19"), supplierLineA: uuid("20"), supplierLineB: uuid("21"),
  allocationA: uuid("22"), allocationB: uuid("23"), evidence: uuid("24"), actor: uuid("25"),
};
const principal = Object.freeze({ userId: ids.actor, roles: ["OWNER_ADMIN"] });

function salesFacts(contractLineVersionId: string, productDescription: string, quantity: string) {
  return { contractLineVersionId, productDescription, customerPurchaseOrderReference: null, marksAndNumbers: null,
    quantity, bagCount: 10, bagWeight: "60.000000", netWeight: quantity, grossWeight: quantity };
}
function supplierFacts(purchaseContractId: string, supplierId: string, contractLineVersionId: string, quantity: string) {
  return { purchaseContractId, supplierId, contractLineVersionId, supplierLotReference: `LOT-${supplierId.slice(-2)}`,
    quantity, bagCount: 10, bagWeight: "60.000000", netWeight: quantity, grossWeight: quantity };
}

function salesRepository(): SalesShipmentLineRepository & { rows: SalesShipmentLineRecord[] } {
  const rows: SalesShipmentLineRecord[] = [];
  const sources = new Map([
    [ids.salesVersionA, { id: ids.salesVersionA, contractId: ids.salesContract, coffeeSpecificationId: ids.productA, quantity: "50.000000", unitPrice: "9.000000", approvalState: "APPROVED" }],
    [ids.salesVersionB, { id: ids.salesVersionB, contractId: ids.salesContract, coffeeSpecificationId: ids.productB, quantity: "30.000000", unitPrice: "8.000000", approvalState: "APPROVED" }],
  ]);
  return {
    rows,
    async getDataset(shipmentId, datasetId) { return shipmentId === ids.salesShipment && datasetId === ids.salesDataset ? { id: ids.salesDataset, shipmentId, salesContractId: ids.salesContract, state: "DRAFT" } : null; },
    async getApprovedContractLineVersion(versionId, contractId) { const row = sources.get(versionId); return row?.contractId === contractId ? row : null; },
    async nextLineNo() { return rows.length + 1; },
    async findByContractLineVersion(datasetId, versionId) { return rows.find((row) => row.salesShipmentDatasetId === datasetId && row.contractLineVersionId === versionId) ?? null; },
    async insert(row) { rows.push(row); return row; },
    async list(datasetId) { return rows.filter((row) => row.salesShipmentDatasetId === datasetId); },
    async get(datasetId, lineId) { return rows.find((row) => row.salesShipmentDatasetId === datasetId && row.id === lineId) ?? null; },
  };
}

function supplierRepository(): SupplierShipmentLineRepository & { rows: SupplierShipmentLineRecord[] } {
  const rows: SupplierShipmentLineRecord[] = [];
  const sources = new Map([
    [ids.purchaseVersionA, { id: ids.purchaseVersionA, contractId: ids.purchaseContractA, counterpartyId: ids.supplierA, projectId: ids.project, contractKind: "PURCHASE", quantity: "40.000000", unitPrice: "5.000000", approvalState: "APPROVED" }],
    [ids.purchaseVersionB, { id: ids.purchaseVersionB, contractId: ids.purchaseContractB, counterpartyId: ids.supplierB, projectId: ids.project, contractKind: "PURCHASE", quantity: "20.000000", unitPrice: "4.000000", approvalState: "APPROVED" }],
  ]);
  return {
    rows,
    async getDataset(shipmentId, datasetId) { return shipmentId === ids.container && datasetId === ids.containerDataset ? { id: ids.containerDataset, shipmentId, projectId: ids.project, state: "DRAFT" } : null; },
    async getApprovedPurchaseContractLineVersion(versionId, contractId, supplierId, projectId) {
      const row = sources.get(versionId); return row?.contractId === contractId && row.counterpartyId === supplierId && row.projectId === projectId ? row : null;
    },
    async nextLineNo() { return rows.length + 1; },
    async findByContractLineVersion(datasetId, versionId) { return rows.find((row) => row.supplierShipmentDatasetId === datasetId && row.contractLineVersionId === versionId) ?? null; },
    async insert(row) { rows.push(row); return row; },
    async list(datasetId) { return rows.filter((row) => row.supplierShipmentDatasetId === datasetId); },
    async get(datasetId, lineId) { return rows.find((row) => row.supplierShipmentDatasetId === datasetId && row.id === lineId) ?? null; },
  };
}

function fulfillmentRepository(salesRows: SalesShipmentLineRecord[], supplierRows: SupplierShipmentLineRecord[]) {
  const allocations: ShipmentLineSourceAllocationRecord[] = [];
  const allocated = (key: "salesShipmentDatasetLineId" | "supplierShipmentDatasetLineId", lineId: string) =>
    allocations.filter((row) => row[key] === lineId).reduce((sum, row) => sum + Number(row.quantity), 0).toFixed(6);
  const repository: ShipmentLineFulfillmentRepository = {
    async runSerializable(input, work) {
      const salesLine = salesRows.find((row) => row.id === input.salesShipmentDatasetLineId);
      const supplierLine = supplierRows.find((row) => row.id === input.supplierShipmentDatasetLineId);
      return work({
        salesLine: salesLine ? { id: salesLine.id, projectId: ids.project, coffeeSpecificationId: salesLine.coffeeSpecificationId, quantity: salesLine.quantity, allocatedQuantity: allocated("salesShipmentDatasetLineId", salesLine.id) } : null,
        supplierLine: supplierLine ? { id: supplierLine.id, projectId: ids.project, coffeeSpecificationId: supplierLine.contractLineVersionId === ids.purchaseVersionA ? ids.productA : ids.productB, quantity: supplierLine.quantity, allocatedQuantity: allocated("supplierShipmentDatasetLineId", supplierLine.id) } : null,
        async insert(row) { allocations.push(row); return row; },
      });
    },
    async getContractLineFulfillment(versionId) {
      const line = salesRows.find((row) => row.contractLineVersionId === versionId);
      if (!line) return null;
      const approvedQuantity = versionId === ids.salesVersionA ? "50.000000" : "30.000000";
      const unitPrice = versionId === ids.salesVersionA ? "9.000000" : "8.000000";
      return { contractLineVersionId: versionId, approvedQuantity, unitPrice, fulfilledQuantity: line.quantity };
    },
  };
  return { repository, allocations };
}

test("multi-line sales fulfillment composes one multi-supplier container with supplier-safe invoices", async () => {
  const salesRepo = salesRepository();
  const supplierRepo = supplierRepository();
  let salesId = 0, supplierId = 0;
  const sales = createSalesShipmentLineService({ repository: salesRepo, newId: () => [ids.salesLineA, ids.salesLineB][salesId++] });
  const suppliers = createSupplierShipmentLineService({ repository: supplierRepo, newId: () => [ids.supplierLineA, ids.supplierLineB][supplierId++] });

  const salesLineA = await sales.create({ shipmentId: ids.salesShipment, datasetId: ids.salesDataset, facts: salesFacts(ids.salesVersionA, "Ethiopia washed", "20.000000"), correlationId: "sales-a", principal });
  const salesLineB = await sales.create({ shipmentId: ids.salesShipment, datasetId: ids.salesDataset, facts: salesFacts(ids.salesVersionB, "Brazil natural", "7.500000"), correlationId: "sales-b", principal });
  const supplierLineA = await suppliers.create({ shipmentId: ids.container, datasetId: ids.containerDataset, facts: supplierFacts(ids.purchaseContractA, ids.supplierA, ids.purchaseVersionA, "25.000000"), correlationId: "supplier-a", principal });
  const supplierLineB = await suppliers.create({ shipmentId: ids.container, datasetId: ids.containerDataset, facts: supplierFacts(ids.purchaseContractB, ids.supplierB, ids.purchaseVersionB, "12.000000"), correlationId: "supplier-b", principal });

  const consolidation = await suppliers.getConsolidation({ shipmentId: ids.container, datasetId: ids.containerDataset, correlationId: "consolidation", principal });
  assert.deepEqual({ supplierCount: consolidation.supplierCount, lineCount: consolidation.lineCount, totalQuantity: consolidation.totalQuantity }, { supplierCount: 2, lineCount: 2, totalQuantity: "37.000000" });

  const fulfillmentState = fulfillmentRepository(salesRepo.rows, supplierRepo.rows);
  let allocationId = 0;
  const fulfillment = createShipmentLineFulfillmentService({ repository: fulfillmentState.repository, newId: () => [ids.allocationA, ids.allocationB][allocationId++] });
  await fulfillment.allocate({ salesShipmentDatasetLineId: salesLineA.id, supplierShipmentDatasetLineId: supplierLineA.id, quantity: "20.000000", correlationId: "allocate-a" });
  await fulfillment.allocate({ salesShipmentDatasetLineId: salesLineB.id, supplierShipmentDatasetLineId: supplierLineB.id, quantity: "7.500000", correlationId: "allocate-b" });
  assert.equal(fulfillmentState.allocations.length, 2);
  assert.deepEqual(await fulfillment.remaining({ contractLineVersionId: ids.salesVersionA, correlationId: "remaining-a" }), {
    contractLineVersionId: ids.salesVersionA, approvedQuantity: "50.000000", fulfilledQuantity: "20.000000", remainingQuantity: "30.000000", unitPrice: "9.000000", remainingValue: "270.000000000000",
  });
  await assert.rejects(() => fulfillment.allocate({ salesShipmentDatasetLineId: salesLineA.id, supplierShipmentDatasetLineId: supplierLineA.id, quantity: "0.000001", correlationId: "over-sales-capacity" }), (error: any) => error.problem?.code === "FULFILLMENT_QUANTITY_EXCEEDED");

  const salesInvoices = createInMemorySalesInvoiceService({
    now: () => "2026-11-12T12:00:00.000Z",
    shipments: [{ id: ids.salesShipment, projectId: ids.project, customerId: ids.customer, customerNameEn: "Pilot Customer", customerNameAr: "عميل تجريبي", reference: "SS-001", activeDatasetId: ids.salesDataset, executionState: "DELIVERED", version: 1 }],
    datasets: [{ id: ids.salesDataset, shipmentId: ids.salesShipment, state: "APPROVED", lines: salesRepo.rows.map((row) => ({ id: row.id, lineNo: row.lineNo, productDescription: row.productDescription, quantity: row.quantity })) }],
  });
  const customerInvoice = await salesInvoices.create({ shipmentId: ids.salesShipment, expectedVersion: 1, reference: "CINV-001", invoiceDate: "2026-11-12", currency: "USD",
    lines: [{ shipmentLineId: salesLineA.id, description: salesLineA.productDescription, quantity: salesLineA.quantity, unitPrice: "9.000000" }, { shipmentLineId: salesLineB.id, description: salesLineB.productDescription, quantity: salesLineB.quantity, unitPrice: "8.000000" }],
    principal, idempotencyKey: "customer-invoice-001", correlationId: "customer-invoice" });
  assert.deepEqual(customerInvoice.value.lines.map((line) => line.salesShipmentDatasetLineId), [salesLineA.id, salesLineB.id]);
  assert.equal(customerInvoice.value.totalAmount, "240.000000");

  const supplierInvoices = createInMemorySupplierInvoiceService({
    now: () => "2026-11-12T12:00:00.000Z",
    shipments: [{ id: ids.container, projectId: ids.project, activeDatasetId: ids.containerDataset, executionState: "RECEIVED", version: 1 }],
    datasets: [{ id: ids.containerDataset, shipmentId: ids.container, state: "APPROVED", lines: supplierRepo.rows.map((row) => ({ id: row.id, supplierId: row.supplierId, quantity: row.quantity })) }],
    evidence: [{ id: ids.evidence, projectId: ids.project, state: "AVAILABLE", sha256: "a".repeat(64) }],
  });
  const invoiceA = await supplierInvoices.create({ shipmentId: ids.container, expectedVersion: 1, supplierId: ids.supplierA, reference: "SINV-A", invoiceDate: "2026-11-12", currency: "USD", evidenceId: ids.evidence,
    lines: [{ shipmentLineId: supplierLineA.id, description: "Supplier A coffee", quantity: "25.000000", unitPrice: "5.000000" }], principal, idempotencyKey: "supplier-invoice-a", correlationId: "supplier-invoice-a" });
  const invoiceB = await supplierInvoices.create({ shipmentId: ids.container, expectedVersion: 1, supplierId: ids.supplierB, reference: "SINV-B", invoiceDate: "2026-11-12", currency: "USD", evidenceId: ids.evidence,
    lines: [{ shipmentLineId: supplierLineB.id, description: "Supplier B coffee", quantity: "12.000000", unitPrice: "4.000000" }], principal, idempotencyKey: "supplier-invoice-b", correlationId: "supplier-invoice-b" });
  assert.deepEqual([invoiceA.value.supplierId, invoiceA.value.amount, invoiceB.value.supplierId, invoiceB.value.amount], [ids.supplierA, "125.000000", ids.supplierB, "48.000000"]);
  await assert.rejects(() => supplierInvoices.create({ shipmentId: ids.container, expectedVersion: 1, supplierId: ids.supplierA, reference: "SINV-CROSS", invoiceDate: "2026-11-12", currency: "USD", evidenceId: ids.evidence,
    lines: [{ shipmentLineId: supplierLineB.id, description: "Wrong supplier", quantity: "1.000000", unitPrice: "1.000000" }], principal, idempotencyKey: "supplier-cross", correlationId: "supplier-cross" }), (error: any) => error.problem?.code === "SUPPLIER_ATTRIBUTION_MISMATCH");
});
