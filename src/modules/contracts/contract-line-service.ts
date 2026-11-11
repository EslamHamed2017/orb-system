import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface ContractLineFacts {
  readonly coffeeSpecificationId: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly currency: string;
  readonly incoterm: string;
  readonly namedPlace: string;
  readonly quantityToleranceUnder: string;
  readonly quantityToleranceOver: string;
  readonly paymentTerms: string;
  readonly documentTerms: string;
}
export interface StoredContractLineVersion {
  readonly id: string; readonly contractId: string; readonly contractLineId: string;
  readonly contractVersionId: string; readonly hashVersion: 2; readonly lineHash: string;
  readonly facts: ContractLineFacts;
}
export interface ContractLineRecord {
  readonly id: string; readonly contractId: string; readonly lineNo: number;
  readonly currentVersion?: StoredContractLineVersion | null;
}
export interface ContractLineRepository {
  getContractVersion(contractId: string, versionId: string): Promise<{ id: string; contractId: string; state: string } | null>;
  getLine(contractId: string, lineId: string): Promise<ContractLineRecord | null>;
  nextLineNo(contractId: string): Promise<number>;
  insertLine(input: { id: string; contractId: string; lineNo: number; version: StoredContractLineVersion }): Promise<ContractLineRecord>;
  insertLineVersion(input: StoredContractLineVersion): Promise<StoredContractLineVersion>;
  listLines(contractId: string): Promise<readonly ContractLineRecord[]>;
  listLineVersions(contractId: string, lineId: string): Promise<readonly StoredContractLineVersion[]>;
}
export interface ContractLineService {
  create(input: LineWrite): Promise<ContractLineRecord>;
  update(input: LineWrite & { lineId: string }): Promise<StoredContractLineVersion>;
  list(input: ReadInput): Promise<readonly ContractLineRecord[]>;
  get(input: ReadInput & { lineId: string }): Promise<ContractLineRecord>;
  versions(input: ReadInput & { lineId: string }): Promise<readonly StoredContractLineVersion[]>;
  validateApproval(input: ReadInput & { contractVersionId: string }): Promise<ContractLineApprovalManifest>;
  validateAmendment(input: ReadInput & { sourceVersionId: string; draftVersionId: string }): Promise<void>;
}
export interface ContractLineApprovalManifest {
  readonly lineCount: number;
  readonly lineVersionIds: readonly string[];
  readonly linesHash: string;
}
interface ReadInput { readonly contractId: string; readonly correlationId: string }
interface LineWrite extends ReadInput { readonly contractVersionId: string; readonly facts: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/;
const KEYS = ["coffeeSpecificationId", "quantity", "unitPrice", "currency", "incoterm", "namedPlace", "quantityToleranceUnder", "quantityToleranceOver", "paymentTerms", "documentTerms"] as const;
function fail(code: string, status: number, correlationId: string): never { throw problemError({ code, status, correlationId }); }
function validId(value: string, correlationId: string): void { if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId); }
function validateFacts(value: unknown, correlationId: string): ContractLineFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("VALIDATION_FAILED", 400, correlationId);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== KEYS.length || Object.keys(row).some((key) => !(KEYS as readonly string[]).includes(key))
      || KEYS.some((key) => typeof row[key] !== "string" || String(row[key]).trim() === "")) fail("VALIDATION_FAILED", 400, correlationId);
  if (!UUID.test(String(row.coffeeSpecificationId)) || !DECIMAL.test(String(row.quantity)) || Number(row.quantity) <= 0
      || !DECIMAL.test(String(row.unitPrice)) || Number(row.unitPrice) < 0
      || !DECIMAL.test(String(row.quantityToleranceUnder)) || !DECIMAL.test(String(row.quantityToleranceOver))
      || !/^[A-Z]{3}$/.test(String(row.currency))) fail("VALIDATION_FAILED", 400, correlationId);
  return Object.freeze(Object.fromEntries(KEYS.map((key) => [key, String(row[key]).trim()])) as unknown as ContractLineFacts);
}
function canonical(value: Record<string, unknown>): string { return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))); }
function versionRecord(input: { id: string; contractId: string; lineId: string; contractVersionId: string; facts: ContractLineFacts }): StoredContractLineVersion {
  const hashPayload = { contractId: input.contractId, contractLineId: input.lineId, contractVersionId: input.contractVersionId, ...input.facts };
  return Object.freeze({ id: input.id, contractId: input.contractId, contractLineId: input.lineId, contractVersionId: input.contractVersionId, hashVersion: 2 as const, lineHash: createHash("sha256").update(canonical(hashPayload)).digest("hex"), facts: input.facts });
}

export function createContractLineService(options: { repository: ContractLineRepository; newId?: () => string }): ContractLineService {
  const id = options.newId ?? randomUUID;
  async function draft(contractId: string, contractVersionId: string, correlationId: string) {
    validId(contractId, correlationId); validId(contractVersionId, correlationId);
    const version = await options.repository.getContractVersion(contractId, contractVersionId);
    if (!version) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    if (version.state !== "DRAFT") fail("IMMUTABLE_VERSION", 409, correlationId);
  }
  async function line(contractId: string, lineId: string, correlationId: string) {
    validId(contractId, correlationId); validId(lineId, correlationId);
    const found = await options.repository.getLine(contractId, lineId);
    if (!found) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    return found;
  }
  return {
    async create(input) {
      await draft(input.contractId, input.contractVersionId, input.correlationId);
      const facts = validateFacts(input.facts, input.correlationId), lineId = id(), lineNo = await options.repository.nextLineNo(input.contractId);
      const version = versionRecord({ id: id(), contractId: input.contractId, lineId, contractVersionId: input.contractVersionId, facts });
      return options.repository.insertLine({ id: lineId, contractId: input.contractId, lineNo, version });
    },
    async update(input) {
      await line(input.contractId, input.lineId, input.correlationId);
      await draft(input.contractId, input.contractVersionId, input.correlationId);
      const existing = await options.repository.listLineVersions(input.contractId, input.lineId);
      if (existing.some((item) => item.contractVersionId === input.contractVersionId)) fail("CONTRACT_LINE_VERSION_EXISTS", 409, input.correlationId);
      return options.repository.insertLineVersion(versionRecord({ id: id(), contractId: input.contractId, lineId: input.lineId, contractVersionId: input.contractVersionId, facts: validateFacts(input.facts, input.correlationId) }));
    },
    async list(input) { validId(input.contractId, input.correlationId); return options.repository.listLines(input.contractId); },
    async get(input) { return line(input.contractId, input.lineId, input.correlationId); },
    async versions(input) { await line(input.contractId, input.lineId, input.correlationId); return options.repository.listLineVersions(input.contractId, input.lineId); },
    async validateAmendment(input) {
      validId(input.contractId, input.correlationId); validId(input.sourceVersionId, input.correlationId); validId(input.draftVersionId, input.correlationId);
      if (input.sourceVersionId === input.draftVersionId) fail("VALIDATION_FAILED", 400, input.correlationId);
      const [source, target] = await Promise.all([
        options.repository.getContractVersion(input.contractId, input.sourceVersionId),
        options.repository.getContractVersion(input.contractId, input.draftVersionId),
      ]);
      if (!source || !target) fail("RESOURCE_NOT_FOUND", 404, input.correlationId);
      if (source.state !== "APPROVED" || target.state !== "DRAFT") fail("INVALID_STATE_TRANSITION", 409, input.correlationId);
      const lines = await options.repository.listLines(input.contractId);
      if (lines.length === 0) fail("CONTRACT_LINES_REQUIRED", 409, input.correlationId);
      for (const item of lines) {
        const versions = await options.repository.listLineVersions(input.contractId, item.id);
        const draftSnapshot = versions.find((candidate) => candidate.contractVersionId === input.draftVersionId);
        if (!draftSnapshot) fail("CONTRACT_LINE_SNAPSHOT_INCOMPLETE", 409, input.correlationId);
      }
    },
    async validateApproval(input) {
      await draft(input.contractId, input.contractVersionId, input.correlationId);
      const lines = [...await options.repository.listLines(input.contractId)].sort((a, b) => a.lineNo - b.lineNo);
      if (lines.length === 0) fail("CONTRACT_LINES_REQUIRED", 409, input.correlationId);
      const snapshots: StoredContractLineVersion[] = [];
      for (const item of lines) {
        const versions = await options.repository.listLineVersions(input.contractId, item.id);
        const snapshot = versions.find((candidate) => candidate.contractVersionId === input.contractVersionId);
        if (!snapshot) fail("CONTRACT_LINE_SNAPSHOT_INCOMPLETE", 409, input.correlationId);
        snapshots.push(snapshot);
      }
      return Object.freeze({
        lineCount: snapshots.length,
        lineVersionIds: Object.freeze(snapshots.map((snapshot) => snapshot.id)),
        linesHash: createHash("sha256").update(canonical({ lines: snapshots.map((snapshot) => ({ id: snapshot.id, hash: snapshot.lineHash })) })).digest("hex"),
      });
    },
  };
}
