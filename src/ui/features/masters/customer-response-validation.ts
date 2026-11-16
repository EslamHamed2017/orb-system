export type BillingAddress = { readonly line1: string; readonly line2: string | null; readonly city: string; readonly region: string | null; readonly postalCode: string | null };
export type ServerCustomer = {
  readonly id: string; readonly reference: string; readonly legalName: string; readonly legalNameAr?: string | null;
  readonly contactName: string | null; readonly email: string | null; readonly phone: string | null;
  readonly countryCode?: string | null; readonly taxRegistrationNumber?: string | null; readonly paymentTermsDays?: number;
  readonly billingAddress?: BillingAddress | null; readonly status: "ACTIVE" | "INACTIVE"; readonly version: number;
};
const LEGACY_CUSTOMER_KEYS = ["contactName", "email", "id", "legalName", "phone", "reference", "status", "version"] as const;
const CUSTOMER_KEYS = ["billingAddress", "contactName", "countryCode", "email", "id", "legalName", "legalNameAr", "paymentTermsDays", "phone", "reference", "status", "taxRegistrationNumber", "version"] as const;
const ADDRESS_KEYS = ["city", "line1", "line2", "postalCode", "region"] as const;
const COLLECTION_KEYS = ["items", "nextCursor"] as const;
const REFERENCE = /^[A-Z0-9][A-Z0-9._/-]{0,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+[1-9][0-9 ()-]{6,31}$/;
function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]) { const actual = Object.keys(value).sort(); return actual.length === expected.length && actual.every((key, index) => key === expected[index]); }
function normalizedText(value: unknown, max: number): value is string { return typeof value === "string" && value.length > 0 && value.length <= max && value === value.trim().replace(/\s+/g, " "); }
function nullableText(value: unknown, max: number): value is string | null { return value === null || normalizedText(value, max); }
function billingAddress(value: unknown): value is BillingAddress | null {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return hasExactlyKeys(item, ADDRESS_KEYS) && normalizedText(item.line1, 200) && normalizedText(item.city, 120) && nullableText(item.line2, 200) && nullableText(item.region, 120) && nullableText(item.postalCode, 32);
}
export function isServerCustomer(value: unknown): value is ServerCustomer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const legacy = hasExactlyKeys(item, LEGACY_CUSTOMER_KEYS);
  const current = hasExactlyKeys(item, CUSTOMER_KEYS);
  return (legacy || current) && typeof item.id === "string" && UUID.test(item.id)
    && typeof item.reference === "string" && REFERENCE.test(item.reference) && normalizedText(item.legalName, 200) && (legacy || nullableText(item.legalNameAr, 200))
    && nullableText(item.contactName, 160) && (item.email === null || (typeof item.email === "string" && item.email.length <= 254 && item.email === item.email.toLowerCase() && EMAIL.test(item.email)))
    && (item.phone === null || (typeof item.phone === "string" && PHONE.test(item.phone))) && (item.email !== null || item.phone !== null)
    && (legacy || (item.countryCode === null || (typeof item.countryCode === "string" && /^[A-Z]{2}$/.test(item.countryCode))) && nullableText(item.taxRegistrationNumber, 64))
    && (legacy || (typeof item.paymentTermsDays === "number" && Number.isSafeInteger(item.paymentTermsDays) && item.paymentTermsDays >= 0 && item.paymentTermsDays <= 3650))
    && (legacy || billingAddress(item.billingAddress)) && (item.status === "ACTIVE" || item.status === "INACTIVE") && typeof item.version === "number" && Number.isSafeInteger(item.version) && item.version > 0;
}
export function isCustomerCollection(value: unknown): value is { readonly items: readonly ServerCustomer[]; readonly nextCursor: null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const collection = value as Record<string, unknown>;
  return hasExactlyKeys(collection, COLLECTION_KEYS) && Array.isArray(collection.items) && collection.items.every(isServerCustomer) && collection.nextCursor === null;
}
