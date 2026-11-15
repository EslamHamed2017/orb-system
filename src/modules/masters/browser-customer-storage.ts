export interface CustomerDirectoryRecord {
  readonly id: string; readonly reference: string; readonly legalNameEn: string; readonly legalNameAr: string; readonly countryCode: string;
  readonly contactName: string; readonly email: string; readonly phone: string; readonly active: boolean; readonly projectCount: number; readonly openInvoiceCount: number;
}
export type CustomerInput = Omit<CustomerDirectoryRecord, "id" | "active" | "projectCount" | "openInvoiceCount">;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const CUSTOMER_STORAGE_KEY = "orb.browser-customers.v1";
export type CustomerStorageErrorCode = "CORRUPT_DATA" | "DUPLICATE_REFERENCE" | "INVALID_CUSTOMER" | "NOT_FOUND" | "STORAGE_UNAVAILABLE";
export class CustomerStorageError extends Error {
  readonly code: CustomerStorageErrorCode;
  constructor(code: CustomerStorageErrorCode) { super(code); this.code = code; this.name = "CustomerStorageError"; }
}

const keys = ["id", "reference", "legalNameEn", "legalNameAr", "countryCode", "contactName", "email", "phone", "active", "projectCount", "openInvoiceCount"] as const;
const countryCode = /^[A-Z]{2}$/;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let fallbackTail: Promise<void> = Promise.resolve();
function required(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value === value.trim(); }
function isCustomer(value: unknown): value is CustomerDirectoryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || !keys.every((key) => Object.hasOwn(item, key))) return false;
  return ["id", "reference", "legalNameEn", "legalNameAr", "countryCode", "contactName", "email", "phone"].every((key) => required(item[key]))
    && item.reference === String(item.reference).toUpperCase() && countryCode.test(String(item.countryCode)) && email.test(String(item.email))
    && typeof item.active === "boolean" && item.projectCount === 0 && item.openInvoiceCount === 0;
}
function parse(raw: string | null): CustomerDirectoryRecord[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isCustomer)) throw new Error("invalid");
    const ids = new Set<string>(), references = new Set<string>();
    for (const item of parsed) { if (ids.has(item.id) || references.has(item.reference)) throw new Error("duplicate"); ids.add(item.id); references.add(item.reference); }
    return parsed.map((item) => Object.freeze({ ...item }));
  } catch { throw new CustomerStorageError("CORRUPT_DATA"); }
}
export function readBrowserCustomers(storage: StorageLike): readonly CustomerDirectoryRecord[] {
  try { return parse(storage.getItem(CUSTOMER_STORAGE_KEY)); } catch (error) { if (error instanceof CustomerStorageError) throw error; throw new CustomerStorageError("STORAGE_UNAVAILABLE"); }
}
function normalize(input: CustomerInput): CustomerInput {
  const result = { reference: input.reference.trim().toUpperCase(), legalNameEn: input.legalNameEn.trim(), legalNameAr: input.legalNameAr.trim(), countryCode: input.countryCode.trim().toUpperCase(), contactName: input.contactName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim() };
  if (![result.reference, result.legalNameEn, result.legalNameAr, result.contactName, result.phone].every(required) || !countryCode.test(result.countryCode) || !email.test(result.email)) throw new CustomerStorageError("INVALID_CUSTOMER");
  return result;
}
async function withLock<T>(action: () => T | Promise<T>): Promise<T> {
  if (typeof window !== "undefined") {
    const locks = navigator.locks;
    if (!locks || typeof locks.request !== "function") throw new CustomerStorageError("STORAGE_UNAVAILABLE");
    return locks.request(CUSTOMER_STORAGE_KEY, { mode: "exclusive" }, action);
  }
  const previous = fallbackTail; let release!: () => void; fallbackTail = new Promise<void>((resolve) => { release = resolve; }); await previous;
  try { return await action(); } finally { release(); }
}
export async function createBrowserCustomer(storage: StorageLike, input: CustomerInput, createId: () => string = () => crypto.randomUUID()): Promise<CustomerDirectoryRecord> {
  const normalized = normalize(input);
  return withLock(() => {
    const customers = [...readBrowserCustomers(storage)];
    if (customers.some((item) => item.reference === normalized.reference)) throw new CustomerStorageError("DUPLICATE_REFERENCE");
    const customer = Object.freeze({ id: createId(), ...normalized, active: true, projectCount: 0, openInvoiceCount: 0 });
    const serialized = JSON.stringify([...customers, customer]); parse(serialized);
    try { storage.setItem(CUSTOMER_STORAGE_KEY, serialized); } catch { throw new CustomerStorageError("STORAGE_UNAVAILABLE"); }
    return customer;
  });
}


async function replaceCustomer(storage: StorageLike, id: string, change: (current: CustomerDirectoryRecord) => CustomerDirectoryRecord): Promise<CustomerDirectoryRecord> {
  return withLock(() => {
    const customers = [...readBrowserCustomers(storage)];
    const current = customers.find((item) => item.id === id);
    if (!current) throw new CustomerStorageError("NOT_FOUND");
    const updated = Object.freeze(change(current));
    const records = customers.map((item) => item.id === id ? updated : item);
    const serialized = JSON.stringify(records); parse(serialized);
    try { storage.setItem(CUSTOMER_STORAGE_KEY, serialized); } catch { throw new CustomerStorageError("STORAGE_UNAVAILABLE"); }
    return updated;
  });
}

export async function updateBrowserCustomer(storage: StorageLike, id: string, input: CustomerInput): Promise<CustomerDirectoryRecord> {
  const normalized = normalize(input);
  return replaceCustomer(storage, id, (current) => ({ ...current, ...normalized, reference: current.reference, active: current.active, projectCount: current.projectCount, openInvoiceCount: current.openInvoiceCount }));
}

export async function setBrowserCustomerStatus(storage: StorageLike, id: string, active: boolean): Promise<CustomerDirectoryRecord> {
  return replaceCustomer(storage, id, (current) => ({ ...current, active }));
}
