// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ISO_COUNTRY_CODE_SET } from "./country-codes.ts";
export type CustomerStatus = "ACTIVE" | "INACTIVE";
export interface BillingAddress { readonly line1: string; readonly line2: string | null; readonly city: string; readonly region: string | null; readonly postalCode: string | null }
export interface CustomerPrincipal { readonly tenantId: string; readonly userId: string; readonly roles: readonly string[] }
export interface CustomerRecord { readonly id: string; readonly tenantId: string; readonly reference: string; readonly legalName: string; readonly legalNameAr: string | null; readonly contactName: string | null; readonly email: string | null; readonly phone: string | null; readonly countryCode: string | null; readonly taxRegistrationNumber: string | null; readonly paymentTermsDays: number; readonly billingAddress: BillingAddress | null; readonly status: CustomerStatus; readonly version: number; readonly createdAt: string; readonly updatedAt: string }
export interface CustomerValues { readonly reference: string; readonly legalName: string; readonly legalNameAr: string | null; readonly contactName: string | null; readonly email: string | null; readonly phone: string | null; readonly countryCode: string | null; readonly taxRegistrationNumber: string | null; readonly paymentTermsDays: number; readonly billingAddress: BillingAddress | null; readonly status: CustomerStatus }
export interface CustomerRepository {
  list(tenantId: string): Promise<readonly CustomerRecord[]>;
  get(tenantId: string, id: string): Promise<CustomerRecord | null>;
  create(input: { tenantId: string; actorId: string; values: CustomerValues }): Promise<CustomerRecord>;
  update(input: { tenantId: string; actorId: string; id: string; expectedVersion: number; values: Partial<CustomerValues> }): Promise<CustomerRecord | null>;
}
export class CustomerProblem extends Error {
  readonly code: "VALIDATION_FAILED" | "PERMISSION_DENIED" | "RESOURCE_NOT_FOUND" | "DUPLICATE_REFERENCE" | "STALE_VERSION" | "IDEMPOTENCY_CONFLICT";
  readonly status: number;
  constructor(code: CustomerProblem["code"], status: number, message: string = code) { super(message); this.name = "CustomerProblem"; this.code = code; this.status = status; }
}
const READ_ROLES = new Set(["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]);
const WRITE_ROLES = new Set(["OWNER_ADMIN", "OPERATIONS"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+[1-9][0-9 ()-]{6,31}$/;
const COUNTRY = /^[A-Z]{2}$/;
const CREATE_KEYS = new Set(["reference", "legalName", "legalNameAr", "contactName", "email", "phone", "countryCode", "taxRegistrationNumber", "paymentTermsDays", "billingAddress", "status"]);
const UPDATE_KEYS = CREATE_KEYS;
const ADDRESS_KEYS = new Set(["line1", "line2", "city", "region", "postalCode"]);
function authorize(principal: CustomerPrincipal, write: boolean): void {
  if (!UUID.test(principal.tenantId) || !UUID.test(principal.userId) || !principal.roles.some((role) => (write ? WRITE_ROLES : READ_ROLES).has(role))) throw new CustomerProblem("PERMISSION_DENIED", 403);
}
function object(value: unknown, keys: Set<string>, partial: boolean): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CustomerProblem("VALIDATION_FAILED", 400);
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !keys.has(key)) || (partial && Object.keys(input).length === 0)) throw new CustomerProblem("VALIDATION_FAILED", 400);
  return input;
}
function text(value: unknown, field: string, max: number, required: boolean): string | null {
  if (value === null && !required) return null;
  if (typeof value !== "string") throw new CustomerProblem("VALIDATION_FAILED", 400, `${field} is invalid`);
  const normalized = value.trim().replace(/\s+/g, " ");
  if ((required && normalized.length === 0) || normalized.length > max) throw new CustomerProblem("VALIDATION_FAILED", 400, `${field} is invalid`);
  return normalized || null;
}
function address(value: unknown): BillingAddress | null {
  if (value === null) return null;
  const input = object(value, ADDRESS_KEYS, false);
  return { line1: text(input.line1, "billingAddress.line1", 200, true)!, line2: text(input.line2 ?? null, "billingAddress.line2", 200, false), city: text(input.city, "billingAddress.city", 120, true)!, region: text(input.region ?? null, "billingAddress.region", 120, false), postalCode: text(input.postalCode ?? null, "billingAddress.postalCode", 32, false) };
}
function validate(inputValue: unknown, partial: boolean): Partial<CustomerValues> {
  const input = object(inputValue, partial ? UPDATE_KEYS : CREATE_KEYS, partial);
  const result: { -readonly [Key in keyof CustomerValues]?: CustomerValues[Key] } = {};
  if (!partial || "reference" in input) { const value = text(input.reference, "reference", 64, true)!.toUpperCase(); if (!REFERENCE.test(value)) throw new CustomerProblem("VALIDATION_FAILED", 400); result.reference = value; }
  if (!partial || "legalName" in input) result.legalName = text(input.legalName, "legalName", 200, true)!;
  if ("legalNameAr" in input) result.legalNameAr = text(input.legalNameAr, "legalNameAr", 200, false); else if (!partial) result.legalNameAr = null;
  if ("contactName" in input) result.contactName = text(input.contactName, "contactName", 160, false); else if (!partial) result.contactName = null;
  if ("email" in input) { const value = text(input.email, "email", 254, false)?.toLowerCase() ?? null; if (value && !EMAIL.test(value)) throw new CustomerProblem("VALIDATION_FAILED", 400); result.email = value; } else if (!partial) result.email = null;
  if ("phone" in input) { const value = text(input.phone, "phone", 32, false); if (value && !PHONE.test(value)) throw new CustomerProblem("VALIDATION_FAILED", 400); result.phone = value; } else if (!partial) result.phone = null;
  if ("countryCode" in input) { const value = text(input.countryCode, "countryCode", 2, false)?.toUpperCase() ?? null; if (value && (!COUNTRY.test(value) || !ISO_COUNTRY_CODE_SET.has(value))) throw new CustomerProblem("VALIDATION_FAILED", 400); result.countryCode = value; } else if (!partial) result.countryCode = null;
  if ("taxRegistrationNumber" in input) result.taxRegistrationNumber = text(input.taxRegistrationNumber, "taxRegistrationNumber", 64, false); else if (!partial) result.taxRegistrationNumber = null;
  if ("paymentTermsDays" in input) { if (!Number.isSafeInteger(input.paymentTermsDays) || Number(input.paymentTermsDays) < 0 || Number(input.paymentTermsDays) > 3650) throw new CustomerProblem("VALIDATION_FAILED", 400); result.paymentTermsDays = Number(input.paymentTermsDays); } else if (!partial) result.paymentTermsDays = 0;
  if ("billingAddress" in input) result.billingAddress = address(input.billingAddress); else if (!partial) result.billingAddress = null;
  if (!partial || "status" in input) { const status = input.status ?? "ACTIVE"; if (status !== "ACTIVE" && status !== "INACTIVE") throw new CustomerProblem("VALIDATION_FAILED", 400); result.status = status; }
  if (!partial && !result.email && !result.phone) throw new CustomerProblem("VALIDATION_FAILED", 400, "email or phone is required");
  return result;
}
export function createCustomerService(repository: CustomerRepository) {
  return Object.freeze({
    async list(input: { principal: CustomerPrincipal }) { authorize(input.principal, false); return repository.list(input.principal.tenantId); },
    async get(input: { principal: CustomerPrincipal; id: string }) { authorize(input.principal, false); if (!UUID.test(input.id)) throw new CustomerProblem("VALIDATION_FAILED", 400); const row = await repository.get(input.principal.tenantId, input.id); if (!row) throw new CustomerProblem("RESOURCE_NOT_FOUND", 404); return row; },
    async create(input: { principal: CustomerPrincipal; input: unknown }) { authorize(input.principal, true); return repository.create({ tenantId: input.principal.tenantId, actorId: input.principal.userId, values: validate(input.input, false) as CustomerValues }); },
    async update(input: { principal: CustomerPrincipal; id: string; expectedVersion: number; input: unknown }) { authorize(input.principal, true); if (!UUID.test(input.id) || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) throw new CustomerProblem("VALIDATION_FAILED", 400); const values = validate(input.input, true); const current = await repository.get(input.principal.tenantId, input.id); if (!current) throw new CustomerProblem("RESOURCE_NOT_FOUND", 404); if ((values.email === undefined ? current.email : values.email) === null && (values.phone === undefined ? current.phone : values.phone) === null) throw new CustomerProblem("VALIDATION_FAILED", 400, "email or phone is required"); const row = await repository.update({ tenantId: input.principal.tenantId, actorId: input.principal.userId, id: input.id, expectedVersion: input.expectedVersion, values }); if (!row) throw new CustomerProblem("RESOURCE_NOT_FOUND", 404); return row; },
  });
}
