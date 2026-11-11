import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface SupplierShipmentDatasetRecord { readonly id: string; readonly shipmentId: string; readonly projectId: string; readonly purchaseContractId?: string; readonly supplierId?: string; readonly state: string }
export interface ApprovedPurchaseContractLineVersion { readonly id: string; readonly contractId: string; readonly counterpartyId: string; readonly projectId: string; readonly contractKind: string; readonly quantity: string; readonly unitPrice: string; readonly approvalState: string }
export interface SupplierShipmentLineFacts { readonly purchaseContractId: string; readonly supplierId: string; readonly contractLineVersionId: string; readonly supplierLotReference: string; readonly quantity: string; readonly bagCount: number; readonly bagWeight: string; readonly netWeight: string; readonly grossWeight: string }
export interface SupplierShipmentLineRecord extends SupplierShipmentLineFacts { readonly id: string; readonly supplierShipmentDatasetId: string; readonly purchaseContractId: string; readonly supplierId: string; readonly lineNo: number; readonly hashVersion: 2; readonly lineHash: string }
export interface SupplierShipmentLineRepository {
  getDataset(shipmentId: string, datasetId: string): Promise<SupplierShipmentDatasetRecord | null>;
  getApprovedPurchaseContractLineVersion(versionId: string, contractId: string, supplierId: string, projectId: string): Promise<ApprovedPurchaseContractLineVersion | null>;
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
  getConsolidation(input: { shipmentId: string; datasetId: string; correlationId: string }): Promise<SupplierContainerConsolidation>;
}
export interface SupplierContainerConsolidation { readonly containerId: string; readonly datasetId: string; readonly supplierCount: number; readonly lineCount: number; readonly totalQuantity: string; readonly suppliers: readonly { readonly supplierId: string; readonly purchaseContractIds: readonly string[]; readonly lineCount: number; readonly quantity: string }[] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const KEYS = ["purchaseContractId", "supplierId", "contractLineVersionId", "supplierLotReference", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight"] as const;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }
function positiveDecimal(value: unknown): value is string { return typeof value === "string" && DECIMAL.test(value) && Number(value) > 0; }
function validateFacts(value: unknown, correlationId: string): SupplierShipmentLineFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", 400, correlationId);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some((key) => !(KEYS as readonly string[]).includes(key))) fail("VALIDATION_FAILED", 400, correlationId);
  if (typeof row.purchaseContractId !== "string" || !UUID.test(row.purchaseContractId) || typeof row.supplierId !== "string" || !UUID.test(row.supplierId)
      || typeof row.contractLineVersionId !== "string" || !UUID.test(row.contractLineVersionId)
      || typeof row.supplierLotReference !== "string" || row.supplierLotReference.trim().length === 0 || row.supplierLotReference.length > 500
      || !Number.isSafeInteger(row.bagCount) || Number(row.bagCount) < 1
      || !positiveDecimal(row.quantity) || !positiveDecimal(row.bagWeight) || !positiveDecimal(row.netWeight) || !positiveDecimal(row.grossWeight)) fail("VALIDATION_FAILED", 400, correlationId);
  return Object.freeze({ purchaseContractId: row.purchaseContractId, supplierId: row.supplierId, contractLineVersionId: row.contractLineVersionId, supplierLotReference: row.supplierLotReference.trim(), quantity: String(row.quantity), bagCount: row.bagCount as number, bagWeight: String(row.bagWeight), netWeight: String(row.netWeight), grossWeight: String(row.grossWeight) });
}
function decimalMicros(value: string): bigint { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0")); }
function formatMicros(value: bigint): string { const whole = value / 1_000_000n, fraction = (value % 1_000_000n).toString().padStart(6, "0"); return `${whole}.${fraction}`; }
function summarize(containerId: string, datasetId: string, rows: readonly SupplierShipmentLineRecord[]): SupplierContainerConsolidation {
  const groups = new Map<string, { contracts: Set<string>; count: number; quantity: bigint }>(); let total = 0n;
  for (const row of rows) { const quantity = decimalMicros(row.quantity); total += quantity; const group = groups.get(row.supplierId) ?? { contracts: new Set<string>(), count: 0, quantity: 0n }; group.contracts.add(row.purchaseContractId); group.count++; group.quantity += quantity; groups.set(row.supplierId, group); }
  const suppliers = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([supplierId, group]) => Object.freeze({ supplierId, purchaseContractIds: Object.freeze([...group.contracts].sort()), lineCount: group.count, quantity: formatMicros(group.quantity) }));
  return Object.freeze({ containerId, datasetId, supplierCount: suppliers.length, lineCount: rows.length, totalQuantity: formatMicros(total), suppliers: Object.freeze(suppliers) });
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
      const source = await options.repository.getApprovedPurchaseContractLineVersion(facts.contractLineVersionId, facts.purchaseContractId, facts.supplierId, target.projectId);
      if (!source || source.contractId !== facts.purchaseContractId || source.counterpartyId !== facts.supplierId || source.projectId !== target.projectId || source.contractKind !== "PURCHASE" || source.approvalState !== "APPROVED") fail("APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED", 409, input.correlationId);
      if (await options.repository.findByContractLineVersion(target.id, source.id)) fail("SHIPMENT_CONTRACT_LINE_DUPLICATE", 409, input.correlationId);
      const base = { id: newId(), supplierShipmentDatasetId: target.id, lineNo: await options.repository.nextLineNo(target.id), ...facts, hashVersion: 2 as const };
      return options.repository.insert(Object.freeze({ ...base, lineHash: createHash("sha256").update(canonical(base)).digest("hex") }));
    },
    async list(input) { const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); return options.repository.list(target.id); },
    async get(input) { const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); validId(input.lineId, input.correlationId); const found = await options.repository.get(target.id, input.lineId); if (!found) fail("RESOURCE_NOT_FOUND", 404, input.correlationId); return found; },
    async getConsolidation(input) { const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); return summarize(input.shipmentId, target.id, await options.repository.list(target.id)); },
  };
}
