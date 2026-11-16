// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ISO_COUNTRY_CODE_SET } from "../customers/country-codes.ts";
// Tenant-owned supplier lifecycle. UI wire contracts deliberately exclude tenantId.
export type SupplierStatus = "ACTIVE" | "INACTIVE";
export interface SupplierPrincipal { readonly tenantId: string; readonly userId: string; readonly roles: readonly string[] }
export interface SupplierValues { readonly reference: string; readonly registeredName: string; readonly displayNameAr: string | null; readonly countryCode: string; readonly contactName: string | null; readonly email: string | null; readonly phone: string | null; readonly paymentCurrency: string; readonly paymentTermsDays: number; readonly status: SupplierStatus }
export interface SupplierRecord extends SupplierValues { readonly id: string; readonly tenantId: string; readonly version: number; readonly createdAt: string; readonly updatedAt: string }
export interface SupplierRepository { list(tenantId: string): Promise<readonly SupplierRecord[]>; get(tenantId: string, id: string): Promise<SupplierRecord | null>; create(input: { tenantId: string; actorId: string; values: SupplierValues }): Promise<SupplierRecord>; update(input: { tenantId: string; actorId: string; id: string; expectedVersion: number; values: Partial<SupplierValues> }): Promise<SupplierRecord | null> }
export type SupplierAuditAction = "SUPPLIER_CREATED" | "SUPPLIER_UPDATED" | "SUPPLIER_DEACTIVATED" | "SUPPLIER_REACTIVATED";
export function supplierAuditAction(before: SupplierStatus, after: SupplierStatus): Exclude<SupplierAuditAction, "SUPPLIER_CREATED"> {
  if (before === "ACTIVE" && after === "INACTIVE") return "SUPPLIER_DEACTIVATED";
  if (before === "INACTIVE" && after === "ACTIVE") return "SUPPLIER_REACTIVATED";
  return "SUPPLIER_UPDATED";
}
export class SupplierProblem extends Error { readonly code: "VALIDATION_FAILED" | "PERMISSION_DENIED" | "RESOURCE_NOT_FOUND" | "DUPLICATE_REFERENCE" | "STALE_VERSION" | "IDEMPOTENCY_CONFLICT"; readonly status: number; constructor(code: SupplierProblem["code"], status: number, message: string = code) { super(message); this.name = "SupplierProblem"; this.code = code; this.status = status; } }
const READ = new Set(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]), WRITE = new Set(["OWNER_ADMIN", "OPERATIONS"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, REFERENCE = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/, EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, PHONE = /^\+[1-9][0-9 ()-]{6,31}$/;
const KEYS = new Set(["reference","registeredName","displayNameAr","countryCode","contactName","email","phone","paymentCurrency","paymentTermsDays","status"]);
function problem(message = "VALIDATION_FAILED"): never { throw new SupplierProblem("VALIDATION_FAILED", 400, message); }
function authorize(p: SupplierPrincipal, write: boolean) { if (!UUID.test(p.tenantId) || !UUID.test(p.userId) || !p.roles.some((r) => (write ? WRITE : READ).has(r))) throw new SupplierProblem("PERMISSION_DENIED", 403); }
function obj(value: unknown, partial: boolean) { if (!value || typeof value !== "object" || Array.isArray(value)) problem(); const input = value as Record<string, unknown>; if (Object.keys(input).some((k) => !KEYS.has(k)) || (partial && !Object.keys(input).length)) problem(); return input; }
function text(value: unknown, max: number, required: boolean): string | null { if (value === null && !required) return null; if (typeof value !== "string") problem(); const s=value.trim().replace(/\s+/g," "); if ((required && !s) || s.length>max) problem(); return s || null; }
function validate(value: unknown, partial: boolean): Partial<SupplierValues> { const i=obj(value,partial), r: Partial<{ -readonly [K in keyof SupplierValues]: SupplierValues[K] }>={};
 if (!partial || "reference" in i) { const v=text(i.reference,64,true)!.toUpperCase(); if(!REFERENCE.test(v)) problem(); r.reference=v; }
 if(!partial || "registeredName" in i) r.registeredName=text(i.registeredName,200,true)!;
 if("displayNameAr" in i) r.displayNameAr=text(i.displayNameAr,200,false); else if(!partial) r.displayNameAr=null;
 if(!partial || "countryCode" in i){const v=text(i.countryCode,2,true)!.toUpperCase(); if(!ISO_COUNTRY_CODE_SET.has(v)) problem(); r.countryCode=v;}
 if("contactName" in i) r.contactName=text(i.contactName,160,false); else if(!partial) r.contactName=null;
 if("email" in i){const v=text(i.email,254,false)?.toLowerCase()??null;if(v&&!EMAIL.test(v))problem();r.email=v;}else if(!partial)r.email=null;
 if("phone" in i){const v=text(i.phone,32,false);if(v&&!PHONE.test(v))problem();r.phone=v;}else if(!partial)r.phone=null;
 if(!partial||"paymentCurrency" in i){const v=text(i.paymentCurrency,3,true)!.toUpperCase();if(!/^[A-Z]{3}$/.test(v))problem();r.paymentCurrency=v;}
 if(!partial||"paymentTermsDays" in i){if(!Number.isSafeInteger(i.paymentTermsDays)||Number(i.paymentTermsDays)<0||Number(i.paymentTermsDays)>365)problem();r.paymentTermsDays=Number(i.paymentTermsDays);}
 if(!partial||"status" in i){const v=i.status??"ACTIVE";if(v!=="ACTIVE"&&v!=="INACTIVE")problem();r.status=v;}
 if(!partial&&!r.email&&!r.phone)problem("email or phone is required"); return r; }
export function createSupplierService(repository: SupplierRepository){return Object.freeze({
 async list({principal}:{principal:SupplierPrincipal}){authorize(principal,false);return repository.list(principal.tenantId)},
 async get({principal,id}:{principal:SupplierPrincipal;id:string}){authorize(principal,false);if(!UUID.test(id))problem();const row=await repository.get(principal.tenantId,id);if(!row)throw new SupplierProblem("RESOURCE_NOT_FOUND",404);return row},
 async create({principal,input}:{principal:SupplierPrincipal;input:unknown}){authorize(principal,true);return repository.create({tenantId:principal.tenantId,actorId:principal.userId,values:validate(input,false) as SupplierValues})},
 async update({principal,id,expectedVersion,input}:{principal:SupplierPrincipal;id:string;expectedVersion:number;input:unknown}){authorize(principal,true);if(!UUID.test(id)||!Number.isSafeInteger(expectedVersion)||expectedVersion<1)problem();const values=validate(input,true); if (values.reference !== undefined) problem();const current=await repository.get(principal.tenantId,id);if(!current)throw new SupplierProblem("RESOURCE_NOT_FOUND",404);if((values.email===undefined?current.email:values.email)===null&&(values.phone===undefined?current.phone:values.phone)===null)problem("email or phone is required");const row=await repository.update({tenantId:principal.tenantId,actorId:principal.userId,id,expectedVersion,values});if(!row)throw new SupplierProblem("RESOURCE_NOT_FOUND",404);return row}
})}
