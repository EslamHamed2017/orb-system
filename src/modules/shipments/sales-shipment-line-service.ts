import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../access/permissions.ts";

export interface SalesShipmentDatasetRecord { readonly id: string; readonly shipmentId: string; readonly salesContractId: string; readonly state: string }
export interface ApprovedContractLineVersion { readonly id: string; readonly contractId: string; readonly coffeeSpecificationId: string; readonly quantity: string; readonly unitPrice: string; readonly approvalState: string }
export interface SalesShipmentLineFacts {
  readonly contractLineVersionId: string;
  readonly productDescription: string;
  readonly customerPurchaseOrderReference: string | null;
  readonly marksAndNumbers: string | null;
  readonly quantity: string;
  readonly bagCount: number;
  readonly bagWeight: string;
  readonly netWeight: string;
  readonly grossWeight: string;
}
export interface SalesShipmentLineRecord extends SalesShipmentLineFacts {
  readonly id: string;
  readonly salesShipmentDatasetId: string;
  readonly salesContractId: string;
  readonly coffeeSpecificationId: string;
  readonly lineNo: number;
  readonly hashVersion: 2;
  readonly lineHash: string;
}
export interface SalesShipmentLineRepository {
  getDataset(shipmentId: string, datasetId: string): Promise<SalesShipmentDatasetRecord | null>;
  getApprovedContractLineVersion(versionId: string, contractId: string): Promise<ApprovedContractLineVersion | null>;
  nextLineNo(datasetId: string): Promise<number>;
  findByContractLineVersion(datasetId: string, versionId: string): Promise<SalesShipmentLineRecord | null>;
  insert(input: SalesShipmentLineRecord): Promise<SalesShipmentLineRecord>;
  list(datasetId: string): Promise<readonly SalesShipmentLineRecord[]>;
  get(datasetId: string, lineId: string): Promise<SalesShipmentLineRecord | null>;
}
export interface SalesShipmentLineService {
  create(input: { shipmentId: string; datasetId: string; facts: unknown; correlationId: string; principal: OperationPrincipal }): Promise<SalesShipmentLineRecord>;
  list(input: { shipmentId: string; datasetId: string; correlationId: string; principal: OperationPrincipal }): Promise<readonly SalesShipmentLineRecord[]>;
  get(input: { shipmentId: string; datasetId: string; lineId: string; correlationId: string; principal: OperationPrincipal }): Promise<SalesShipmentLineRecord>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL_20_6 = /^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,6})?$/;
const KEYS = ["contractLineVersionId", "productDescription", "customerPurchaseOrderReference", "marksAndNumbers", "quantity", "bagCount", "bagWeight", "netWeight", "grossWeight"] as const;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function authorize(principal: OperationPrincipal, operationId: string, correlationId: string): void {
  try { assertServerPermission(principal, operationId); } catch { fail("PERMISSION_DENIED", 403, correlationId); }
}
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }
function positiveDecimal(value: unknown): value is string { return typeof value === "string" && DECIMAL_20_6.test(value) && Number(value) > 0; }
function optionalText(value: unknown): value is string | null { return value === null || (typeof value === "string" && value.trim().length > 0 && value.length <= 500); }
function validateFacts(value: unknown, correlationId: string): SalesShipmentLineFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", 400, correlationId);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some((key) => !(KEYS as readonly string[]).includes(key))) fail("VALIDATION_FAILED", 400, correlationId);
  if (typeof row.contractLineVersionId !== "string" || !UUID.test(row.contractLineVersionId)
      || typeof row.productDescription !== "string" || row.productDescription.trim().length === 0 || row.productDescription.length > 2000
      || !optionalText(row.customerPurchaseOrderReference) || !optionalText(row.marksAndNumbers)
      || !Number.isSafeInteger(row.bagCount) || Number(row.bagCount) < 1
      || !positiveDecimal(row.quantity) || !positiveDecimal(row.bagWeight) || !positiveDecimal(row.netWeight) || !positiveDecimal(row.grossWeight)) fail("VALIDATION_FAILED", 400, correlationId);
  return Object.freeze({
    contractLineVersionId: String(row.contractLineVersionId),
    productDescription: String(row.productDescription).trim(),
    customerPurchaseOrderReference: typeof row.customerPurchaseOrderReference === "string" ? row.customerPurchaseOrderReference.trim() : null,
    marksAndNumbers: typeof row.marksAndNumbers === "string" ? row.marksAndNumbers.trim() : null,
    quantity: String(row.quantity),
    bagCount: row.bagCount as number,
    bagWeight: String(row.bagWeight),
    netWeight: String(row.netWeight),
    grossWeight: String(row.grossWeight),
  });
}
function canonical(value: Record<string, unknown>): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))); }

export function createSalesShipmentLineService(options: { repository: SalesShipmentLineRepository; newId?: () => string }): SalesShipmentLineService {
  const newId = options.newId ?? randomUUID;
  async function dataset(shipmentId: string, datasetId: string, correlationId: string): Promise<SalesShipmentDatasetRecord> {
    validId(shipmentId, correlationId); validId(datasetId, correlationId);
    const found = await options.repository.getDataset(shipmentId, datasetId);
    if (!found) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    if (found.shipmentId !== shipmentId) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    return found;
  }
  return {
    async create(input) {
      authorize(input.principal, "createSalesShipmentLine", input.correlationId);
      const target = await dataset(input.shipmentId, input.datasetId, input.correlationId);
      if (target.state !== "DRAFT") fail("IMMUTABLE_VERSION", 409, input.correlationId);
      const facts = validateFacts(input.facts, input.correlationId);
      const contractLine = await options.repository.getApprovedContractLineVersion(facts.contractLineVersionId, target.salesContractId);
      if (!contractLine) fail("APPROVED_CONTRACT_LINE_REQUIRED", 409, input.correlationId);
      if (contractLine.contractId !== target.salesContractId || contractLine.approvalState !== "APPROVED") fail("APPROVED_CONTRACT_LINE_REQUIRED", 409, input.correlationId);
      if (await options.repository.findByContractLineVersion(target.id, contractLine.id)) fail("SHIPMENT_CONTRACT_LINE_DUPLICATE", 409, input.correlationId);
      const base = { id: newId(), salesShipmentDatasetId: target.id, salesContractId: target.salesContractId, coffeeSpecificationId: contractLine.coffeeSpecificationId, lineNo: await options.repository.nextLineNo(target.id), ...facts, hashVersion: 2 as const };
      const lineHash = createHash("sha256").update(canonical(base)).digest("hex");
      return options.repository.insert(Object.freeze({ ...base, lineHash }));
    },
    async list(input) { authorize(input.principal, "listSalesShipmentLines", input.correlationId); const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); return options.repository.list(target.id); },
    async get(input) {
      authorize(input.principal, "getSalesShipmentLine", input.correlationId);
      const target = await dataset(input.shipmentId, input.datasetId, input.correlationId); validId(input.lineId, input.correlationId);
      const found = await options.repository.get(target.id, input.lineId);
      if (found === null) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      return found;
    },
  };
}
