import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface SupplierShipmentDatasetRecord { readonly id: string; readonly shipmentId: string; readonly purchaseContractId: string; readonly supplierId: string; readonly state: string }
export interface ApprovedPurchaseContractLineVersion { readonly id: string; readonly contractId: string; readonly counterpartyId: string; readonly contractKind: string; readonly quantity: string; readonly unitPrice: string; readonly approvalState: string }
export interface SupplierShipmentLineFacts { readonly contractLineVersionId: string; readonly supplierLotReference: string; readonly quantity: string; readonly bagCount: number; readonly bagWeight: string; readonly netWeight: string; readonly grossWeight: string }
export interface SupplierShipmentLineRecord extends SupplierShipmentLineFacts { readonly id: string; readonly supplierShipmentDatasetId: string; readonly purchaseContractId: string; readonly supplierId: string; readonly lineNo: number; readonly hashVersion: 2; readonly lineHash: string }
export interface SupplierShipmentLineRepository {
  getDataset(shipmentId: string, datasetId: string): Promise<SupplierShipmentDatasetRecord | null>;
  getApprovedPurchaseContractLineVersion(versionId: string, contractId: string, supplierId: string): Promise<ApprovedPurchaseContractLineVersion | null>;
  nextLineNo(datasetId: string): Promise<number>;
  findByContractLineVersion(datasetId: string, versionId: string): Promise<SupplierShipmentLineRecord | null>;
  insert(input: SupplierShipmentLineRecord): Promise<SupplierShipmentLineRecord>;
  list(datasetId: string): Promise<readonly SupplierShipmentLineRecord[]>;
  get(datasetId: string, lineId: string): Promise<SupplierShipmentLineRecord | null>;
}
export interface SupplierShipmentLineService {
  create(input: { shipmentId: string; datasetId: string; facts: unknown; correlationId: string }): Promise<SupplierShipmentLineRecord>;
  list(input: { shipmentId: string; datasetId: string; correlationId: string }): Promise<readonly SupplierShipmentLineRecord[]>;
  get(input: { shipmentId: string; datasetId: string; lineId: string; correlationId: string }): Promise<SupplierShipmentLineRecord>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const KEYS = ["contractLineVersionId", "supplierLotReference", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight"] as const;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }
function positiveDecimal(value: unknown): value is string { return typeof value === "string" && DECIMAL.test(value) && Number(value) > 0; }
function validateFacts(value: unknown, correlationId: string): SupplierShipmentLineFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", 400, correlationId);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some((key) => !(KEYS as readonly string[]).includes(key))) fail("VALIDATION_FAILED", 400, correlationId);
  if (typeof row.contractLineVersionId !== "string" || !UUID.test(row.contractLineVersionId)
      || typeof row.supplierLotReference !== "string" || row.supplierLotReference.trim().length === 0 || row.supplierLotReference.length > 500
      || !Number.isSafeInteger(row.bagCount) || Number(row.bagCount) < 1
      || !positiveDecimal(row.quantity) || !positiveDecimal(row.bagWeight) || !positiveDecimal(row.netWeight) || !positiveDecimal(row.grossWeight)) fail("VALIDATION_FAILED", 400, correlationId);
  return Object.freeze({ contractLineVersionId: row.contractLineVersionId, supplierLotReference: row.supplierLotReference.trim(), quantity: String(row.quantity), bagCount: row.bagCount as number, bagWeight: String(row.bagWeight), netWeight: String(row.netWeight), grossWeight: String(row.grossWeight) });
}
function canonical(value: Record<string, unknown>): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))); }
export function createSupplierShipmentLineService(options: { repository: SupplierShipmentLineRepository; newId?: () => string }): SupplierShipmentLineService {
  const newId = options.newId ?? randomUUID;
  async function dataset(shipmentId: string, datasetId: string, correlationId: string): Promise<SupplierShipmentDatasetRecord> {
    validId(shipmentId, correlationId); validId(datasetId, correlationId);
    const found = await options.repository.getDataset(shipmentId, datasetId);
    if (!found || found.shipmentId !== shipmentId) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    return found;
  }
  return {
    async create(input) {
      const target = await dataset(input.shipmentId, input.datasetId, input.correlationId);
      if (target.state !== "DRAFT") fail("IMMUTABLE_VERSION", 409, input.correlationId);
      const facts = validateFacts(input.facts, input.correlationId);
      const source = await options.repository.getApprovedPurchaseContractLineVersion(facts.contractLineVersionId, target.purchaseContractId, target.supplierId);
      if (!source || source.contractId !== target.purchaseContractId || source.counterpartyId !== target.supplierId || source.contractKind !== "PURCHASE" || source.approvalState !== "APPROVED") fail("APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED", 409, input.correlationId);
      if (await options.repository.findByContractLineVersion(target.id, source.id)) fail("SHIPMENT_CONTRACT_LINE_DUPLICATE", 409, input.correlationId);
      const base = { id: newId(), supplierShipmentDatasetId: target.id, purchaseContractId: target.purchaseContractId, supplierId: target.supplierId, lineNo: await options.repository.nextLineNo(target.id), ...facts, hashVersion: 2 as const };
      return options.repository.insert(Object.freeze({ ...base, lineHash: createHash("sha256").update(canonical(base)).digest("hex") }));
    },
    async list(input) { const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); return options.repository.list(target.id); },
    async get(input) { const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); validId(input.lineId, input.correlationId); const found = await options.repository.get(target.id, input.lineId); if (!found) fail("RESOURCE_NOT_FOUND", 404, input.correlationId); return found; },
  };
}
