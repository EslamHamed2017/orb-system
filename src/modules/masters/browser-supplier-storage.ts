export interface SupplierDirectoryRecord {
  readonly id: string; readonly reference: string; readonly legalNameEn: string; readonly legalNameAr: string; readonly countryCode: string;
  readonly contactName: string; readonly email: string; readonly phone: string; readonly active: boolean; readonly projectCount: number; readonly openInvoiceCount: number;
}
export type SupplierInput = Omit<SupplierDirectoryRecord, "id" | "active" | "projectCount" | "openInvoiceCount">;
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export const SUPPLIER_STORAGE_KEY = "orb.browser-suppliers.v1";
export type SupplierStorageErrorCode = "CORRUPT_DATA" | "DUPLICATE_REFERENCE" | "INVALID_SUPPLIER" | "NOT_FOUND" | "STORAGE_UNAVAILABLE";
export class SupplierStorageError extends Error {
  readonly code: SupplierStorageErrorCode;
  constructor(code: SupplierStorageErrorCode) { super(code); this.code = code; this.name = "SupplierStorageError"; }
}

const keys = ["id", "reference", "legalNameEn", "legalNameAr", "countryCode", "contactName", "email", "phone", "active", "projectCount", "openInvoiceCount"] as const;
const countryCode = /^[A-Z]{2}$/;
const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let fallbackTail: Promise<void> = Promise.resolve();
function required(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value === value.trim(); }
function isSupplier(value: unknown): value is SupplierDirectoryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || !keys.every((key) => Object.hasOwn(item, key))) return false;
  return ["id", "reference", "legalNameEn", "legalNameAr", "countryCode", "contactName", "email", "phone"].every((key) => required(item[key]))
    && item.reference === String(item.reference).toUpperCase() && countryCode.test(String(item.countryCode)) && email.test(String(item.email))
    && typeof item.active === "boolean" && item.projectCount === 0 && item.openInvoiceCount === 0;
}
function parse(raw: string | null): SupplierDirectoryRecord[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isSupplier)) throw new Error("invalid");
    const ids = new Set<string>(), references = new Set<string>();
    for (const item of parsed) { if (ids.has(item.id) || references.has(item.reference)) throw new Error("duplicate"); ids.add(item.id); references.add(item.reference); }
    return parsed.map((item) => Object.freeze({ ...item }));
  } catch { throw new SupplierStorageError("CORRUPT_DATA"); }
}
export function readBrowserSuppliers(storage: StorageLike): readonly SupplierDirectoryRecord[] {
  try { return parse(storage.getItem(SUPPLIER_STORAGE_KEY)); } catch (error) { if (error instanceof SupplierStorageError) throw error; throw new SupplierStorageError("STORAGE_UNAVAILABLE"); }
}
function normalize(input: SupplierInput): SupplierInput {
  const result = { reference: input.reference.trim().toUpperCase(), legalNameEn: input.legalNameEn.trim(), legalNameAr: input.legalNameAr.trim(), countryCode: input.countryCode.trim().toUpperCase(), contactName: input.contactName.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim() };
  if (![result.reference, result.legalNameEn, result.legalNameAr, result.contactName, result.phone].every(required) || !countryCode.test(result.countryCode) || !email.test(result.email)) throw new SupplierStorageError("INVALID_SUPPLIER");
  return result;
}
async function withLock<T>(action: () => T | Promise<T>): Promise<T> {
  const locks = typeof window === "undefined" ? undefined : navigator.locks;
  if (locks) return locks.request(SUPPLIER_STORAGE_KEY, { mode: "exclusive" }, action);
  const previous = fallbackTail; let release!: () => void; fallbackTail = new Promise<void>((resolve) => { release = resolve; }); await previous;
  try { return await action(); } finally { release(); }
}
export async function createBrowserSupplier(storage: StorageLike, input: SupplierInput, createId: () => string = () => crypto.randomUUID()): Promise<SupplierDirectoryRecord> {
  const normalized = normalize(input);
  return withLock(() => {
    const suppliers = [...readBrowserSuppliers(storage)];
    if (suppliers.some((item) => item.reference === normalized.reference)) throw new SupplierStorageError("DUPLICATE_REFERENCE");
    const supplier = Object.freeze({ id: createId(), ...normalized, active: true, projectCount: 0, openInvoiceCount: 0 });
    const serialized = JSON.stringify([...suppliers, supplier]); parse(serialized);
    try { storage.setItem(SUPPLIER_STORAGE_KEY, serialized); } catch { throw new SupplierStorageError("STORAGE_UNAVAILABLE"); }
    return supplier;
  });
}


async function replaceSupplier(storage: StorageLike, id: string, change: (current: SupplierDirectoryRecord) => SupplierDirectoryRecord): Promise<SupplierDirectoryRecord> {
  return withLock(() => {
    const suppliers = [...readBrowserSuppliers(storage)];
    const current = suppliers.find((item) => item.id === id);
    if (!current) throw new SupplierStorageError("NOT_FOUND");
    const updated = Object.freeze(change(current));
    const records = suppliers.map((item) => item.id === id ? updated : item);
    const serialized = JSON.stringify(records); parse(serialized);
    try { storage.setItem(SUPPLIER_STORAGE_KEY, serialized); } catch { throw new SupplierStorageError("STORAGE_UNAVAILABLE"); }
    return updated;
  });
}

export async function updateBrowserSupplier(storage: StorageLike, id: string, input: SupplierInput): Promise<SupplierDirectoryRecord> {
  const normalized = normalize(input);
  return replaceSupplier(storage, id, (current) => ({ ...current, ...normalized, reference: current.reference, active: current.active, projectCount: current.projectCount, openInvoiceCount: current.openInvoiceCount }));
}

export async function setBrowserSupplierStatus(storage: StorageLike, id: string, active: boolean): Promise<SupplierDirectoryRecord> {
  return replaceSupplier(storage, id, (current) => ({ ...current, active }));
}
