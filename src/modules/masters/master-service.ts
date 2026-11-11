import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { assertServerPermission } from "../access/permissions.ts";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { executeIdempotently, type IdempotencyStore } from "../../platform/idempotency/store.ts";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { listProjectedMasters, projectMasterRecord, type MasterPrincipal, type StoredMasterRecord } from "./master-query.ts";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { isMasterType, referenceOf, uniquenessScope, validateMasterPayload, type MasterPayload, type MasterType } from "./schemas.ts";

export interface MasterAuditEvent extends Readonly<Record<string, unknown>> { readonly action: string; readonly actorId: string; readonly aggregateVersion: number; }
export interface MasterService {
  list(input: { masterType: MasterType; principal: MasterPrincipal }): Promise<readonly Readonly<Record<string, unknown> & { id: string; version: number }>[] >;
  get(input: { masterType: MasterType; recordId: string; principal: MasterPrincipal; correlationId: string; locale?: string }): Promise<Readonly<Record<string, unknown> & { id: string; version: number }>>;
  create(input: { masterType: MasterType; payload: MasterPayload; principal: MasterPrincipal; idempotencyKey: string; correlationId: string; locale?: string }): Promise<{ value: Readonly<Record<string, unknown> & { id: string; version: number }>; replayed: boolean }>;
  update(input: { masterType: MasterType; recordId: string; payload: MasterPayload; expectedVersion: number; principal: MasterPrincipal; idempotencyKey: string; correlationId: string; locale?: string }): Promise<{ value: Readonly<Record<string, unknown> & { id: string; version: number }>; replayed: boolean }>;
}
const internals = new WeakMap<MasterService, { audit: MasterAuditEvent[] }>();
type MasterAction = "list" | "get" | "create" | "update";
function operationId(masterType: MasterType, action: MasterAction): string {
  if (masterType === "customers") return `${action}${action === "list" ? "Customers" : "Customer"}`;
  if (masterType === "suppliers") return `${action}${action === "list" ? "Suppliers" : "Supplier"}`;
  if (action === "list" || action === "get") return "listMasterRecords";
  return action === "create" ? "createMasterRecord" : "updateMasterRecord";
}
function authorize(principal: MasterPrincipal, masterType: MasterType, action: MasterAction, correlationId: string, locale?: string): void {
  try { assertServerPermission(principal, operationId(masterType, action)); }
  catch { throw problemError({ code: "PERMISSION_DENIED", status: 403, correlationId, locale }); }
}
function uuidV7(): string {
  const bytes = randomBytes(16); let time = Date.now();
  for (let index = 5; index >= 0; index--) { bytes[index] = time & 0xff; time = Math.floor(time / 256); }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex"); return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value, Object.keys(value as object).sort())).digest("hex"); }
export function createInMemoryMasterService(input: { idempotencyStore: IdempotencyStore; now: () => string }): MasterService {
  const records = new Map<string, StoredMasterRecord>(), unique = new Map<string, string>(), audit: MasterAuditEvent[] = [], encryptionKey = randomBytes(32);
  const encrypt = (plain: string) => { const iv=randomBytes(12), cipher=createCipheriv("aes-256-gcm", encryptionKey, iv), body=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]); return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64"); };
  const decrypt = (encoded: string) => { const data=Buffer.from(encoded,"base64"), decipher=createDecipheriv("aes-256-gcm",encryptionKey,data.subarray(0,12)); decipher.setAuthTag(data.subarray(12,28)); return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString("utf8"); };
  const expose = (record: StoredMasterRecord, principal: MasterPrincipal) => projectMasterRecord({ ...record, ...(principal.roles.includes("OWNER_ADMIN") && record.sensitiveIdentityCiphertext ? { sensitiveIdentity: decrypt(String(record.sensitiveIdentityCiphertext)) } : {}) }, principal);
  const service: MasterService = {
    async list({ masterType, principal }) { authorize(principal, masterType, "list", "master-list"); return listProjectedMasters(records.values(), masterType, principal).map((row) => { const stored=records.get(String(row.id))!; return expose(stored, principal); }); },
    async get(command) {
      authorize(command.principal, command.masterType, "get", command.correlationId, command.locale);
      const record = records.get(command.recordId);
      if (!record || record.masterType !== command.masterType) throw problemError({ code: "RESOURCE_NOT_FOUND", status: 404, correlationId: command.correlationId, locale: command.locale });
      return expose(record, command.principal);
    },
    async create(command) {
      authorize(command.principal, command.masterType, "create", command.correlationId, command.locale);
      return executeIdempotently(input.idempotencyStore, { actorId: command.principal.userId, operationId: "createMasterRecord", key: command.idempotencyKey, request: { masterType: command.masterType, payload: command.payload }, correlationId: command.correlationId, locale: command.locale }, async () => {
        if (!isMasterType(command.masterType)) throw problemError({ code: "VALIDATION_FAILED", status: 400, correlationId: command.correlationId, locale: command.locale });
        const payload=validateMasterPayload(command.masterType,command.payload,{ locale:command.locale,correlationId:command.correlationId }), reference=referenceOf(command.masterType,payload), scope=`${uniquenessScope(command.masterType)}:${reference}`;
        if (reference && unique.has(scope)) throw problemError({ code:"DUPLICATE_REFERENCE",status:409,correlationId:command.correlationId,locale:command.locale });
        const id=uuidV7(), sensitive=typeof payload.sensitiveIdentity === "string" ? encrypt(payload.sensitiveIdentity) : undefined; delete payload.sensitiveIdentity;
        const lifecycle = command.masterType === "coffee" ? { status: "ACTIVE" } : { active: true };
        const record: StoredMasterRecord={ id,masterType:command.masterType,version:1,...lifecycle,...payload,...(sensitive?{sensitiveIdentityCiphertext:sensitive}:{}) }; records.set(id,record); if(reference) unique.set(scope,id);
        audit.push(Object.freeze({ action:"MASTER_CREATED",actorId:command.principal.userId,aggregateId:id,aggregateVersion:1,occurredAt:input.now(),afterHash:hash(record),correlationId:command.correlationId }));
        return { status:201,value:expose(record,command.principal) };
      }).then(({value,replayed})=>({value,replayed}));
    },
    async update(command) {
      authorize(command.principal,command.masterType,"update",command.correlationId,command.locale);
      return executeIdempotently(input.idempotencyStore,{ actorId:command.principal.userId,operationId:"updateMasterRecord",key:command.idempotencyKey,request:{masterType:command.masterType,recordId:command.recordId,payload:command.payload,expectedVersion:command.expectedVersion},correlationId:command.correlationId,locale:command.locale },async()=>{
        const current=records.get(command.recordId); if(!current || current.masterType!==command.masterType) throw problemError({code:"RESOURCE_NOT_FOUND",status:404,correlationId:command.correlationId,locale:command.locale});
        if(current.version!==command.expectedVersion) throw problemError({code:"STALE_VERSION",status:412,correlationId:command.correlationId,locale:command.locale,extensions:{currentVersion:current.version}});
        const patch=validateMasterPayload(command.masterType,command.payload,{locale:command.locale,correlationId:command.correlationId,partial:true});
        if("reference" in patch || "code" in patch) { const nextRef=referenceOf(command.masterType,{...current,...patch}); const oldRef=referenceOf(command.masterType,current); if(nextRef!==oldRef) throw problemError({code:"IMMUTABLE_VERSION",status:409,correlationId:command.correlationId,locale:command.locale}); }
        const sensitive=typeof patch.sensitiveIdentity === "string" ? encrypt(patch.sensitiveIdentity) : undefined; delete patch.sensitiveIdentity;
        const next: StoredMasterRecord={...current,...patch,...(sensitive?{sensitiveIdentityCiphertext:sensitive}:{}),version:current.version+1}; records.set(next.id,next);
        const archived=(current.active!==false && next.active===false) || (current.status==="ACTIVE" && next.status==="INACTIVE"); audit.push(Object.freeze({action:archived?"MASTER_ARCHIVED":"MASTER_UPDATED",actorId:command.principal.userId,aggregateId:next.id,aggregateVersion:next.version,occurredAt:input.now(),afterHash:hash(next),correlationId:command.correlationId}));
        return {status:200,value:expose(next,command.principal)};
      }).then(({value,replayed})=>({value,replayed}));
    },
  };
  internals.set(service,{audit}); return service;
}
export function readMasterAuditEvents(service: MasterService): readonly MasterAuditEvent[] { return Object.freeze([...(internals.get(service)?.audit ?? [])]); }
