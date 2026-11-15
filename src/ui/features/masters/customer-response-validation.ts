export type ServerCustomer = {
  readonly id: string;
  readonly reference: string;
  readonly legalNameAr: string;
  readonly legalNameEn: string;
  readonly countryCode: string;
  readonly active: boolean;
  readonly version: number;
};

const CUSTOMER_KEYS = ["active", "countryCode", "id", "legalNameAr", "legalNameEn", "reference", "version"] as const;
const COLLECTION_KEYS = ["items", "nextCursor"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasExactlyKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isServerCustomer(value: unknown): value is ServerCustomer {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return hasExactlyKeys(item, CUSTOMER_KEYS)
    && typeof item.id === "string" && UUID.test(item.id)
    && typeof item.reference === "string" && item.reference.trim().length > 0
    && typeof item.legalNameAr === "string" && item.legalNameAr.trim().length > 0
    && typeof item.legalNameEn === "string" && item.legalNameEn.trim().length > 0
    && typeof item.countryCode === "string" && /^[A-Z]{2}$/.test(item.countryCode)
    && typeof item.active === "boolean"
    && typeof item.version === "number" && Number.isSafeInteger(item.version) && item.version > 0;
}

export function isCustomerCollection(value: unknown): value is { readonly items: readonly ServerCustomer[]; readonly nextCursor: null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const collection = value as Record<string, unknown>;
  return hasExactlyKeys(collection, COLLECTION_KEYS)
    && Array.isArray(collection.items)
    && collection.items.every(isServerCustomer)
    && collection.nextCursor === null;
}
