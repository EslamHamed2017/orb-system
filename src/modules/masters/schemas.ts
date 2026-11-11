// @ts-expect-error Node native TypeScript execution requires the source extension.
import { problemError } from "../../platform/http/problem.ts";

export const MASTER_TYPES = ["customers", "suppliers", "coffee", "currencies", "expense-categories"] as const;
export type MasterType = typeof MASTER_TYPES[number];
export type MasterPayload = Readonly<Record<string, unknown>>;
const FIXED_CURRENCIES = new Set(["AED", "USD", "SAR"]);
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;

function invalid(locale: string | undefined, correlationId: string): never {
  throw problemError({ code: "VALIDATION_FAILED", status: 400, locale, correlationId });
}
export function isMasterType(value: string): value is MasterType { return MASTER_TYPES.includes(value as MasterType); }
export function validateMasterPayload(type: MasterType, payload: MasterPayload, context: { locale?: string; correlationId: string; partial?: boolean }): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid(context.locale, context.correlationId);
  const result = structuredClone(payload) as Record<string, unknown>;
  const required = (keys: string[]) => { if (!context.partial && keys.some((key) => !text(result[key]))) invalid(context.locale, context.correlationId); };
  if (type === "customers" || type === "suppliers") {
    required(["reference", "legalNameAr", "legalNameEn", "countryCode"]);
    if (result.countryCode !== undefined && !/^[A-Z]{2}$/.test(String(result.countryCode))) invalid(context.locale, context.correlationId);
  } else if (type === "coffee") {
    required(["reference", "origin", "type", "grade", "cropYear", "bagType", "standardBagWeight"]);
    if (result.standardBagWeight !== undefined && !/^[0-9]+(?:\.[0-9]{1,6})?$/.test(String(result.standardBagWeight))) invalid(context.locale, context.correlationId);
    if ("active" in result || (result.status !== undefined && result.status !== "ACTIVE" && result.status !== "INACTIVE")) invalid(context.locale, context.correlationId);
  } else if (type === "currencies") {
    required(["code"]);
    if (result.code !== undefined && !FIXED_CURRENCIES.has(String(result.code))) invalid(context.locale, context.correlationId);
    if (result.decimals !== undefined && (!Number.isInteger(result.decimals) || Number(result.decimals) < 0 || Number(result.decimals) > 6)) invalid(context.locale, context.correlationId);
  } else {
    required(["code", "nameAr", "nameEn"]);
  }
  if (context.partial && Object.keys(result).length === 0) invalid(context.locale, context.correlationId);
  return result;
}
export function referenceOf(type: MasterType, payload: MasterPayload): string | null {
  const value = type === "currencies" || type === "expense-categories" ? payload.code : payload.reference;
  return typeof value === "string" ? value.trim().toUpperCase() : null;
}
export function uniquenessScope(type: MasterType): string { return type === "customers" || type === "suppliers" ? "parties" : type; }
