export type ProductStatus = "ACTIVE" | "INACTIVE";
export interface ProductDirectoryRecord {
  readonly id: string; readonly reference: string; readonly nameEn: string; readonly nameAr: string; readonly origin: string;
  readonly type: string; readonly grade: string; readonly cropYear: string; readonly bagType: string; readonly standardBagWeight: string; readonly status: ProductStatus;
}

export const PRODUCT_STORAGE_KEY = "orb.user-products.owner-1.v1";
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; }
export type ProductInput = Omit<ProductDirectoryRecord, "id" | "status">;
export type ProductStorageErrorCode = "CORRUPT_DATA" | "DUPLICATE_REFERENCE" | "INVALID_PRODUCT" | "NOT_FOUND" | "STORAGE_UNAVAILABLE";
export class ProductStorageError extends Error {
  readonly code: ProductStorageErrorCode;
  constructor(code: ProductStorageErrorCode) { super(code); this.code = code; this.name = "ProductStorageError"; }
}

const productKeys = ["id", "reference", "nameEn", "nameAr", "origin", "type", "grade", "cropYear", "bagType", "standardBagWeight", "status"] as const;
const decimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const originCode = /^[A-Z]{2}$/;
let fallbackTail: Promise<void> = Promise.resolve();

function required(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value === value.trim(); }
function isProduct(value: unknown): value is ProductDirectoryRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== productKeys.length || !productKeys.every((key) => Object.hasOwn(item, key))) return false;
  if (!["id", "reference", "nameEn", "nameAr", "type", "grade", "cropYear", "bagType"].every((key) => required(item[key]))) return false;
  return item.reference === String(item.reference).toUpperCase() && required(item.origin) && originCode.test(item.origin)
    && required(item.standardBagWeight) && decimal.test(item.standardBagWeight) && Number(item.standardBagWeight) > 0
    && (item.status === "ACTIVE" || item.status === "INACTIVE");
}

function parse(raw: string | null): ProductDirectoryRecord[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isProduct)) throw new Error("invalid");
    const ids = new Set<string>(); const references = new Set<string>();
    for (const item of parsed) {
      if (ids.has(item.id) || references.has(item.reference)) throw new Error("duplicate");
      ids.add(item.id); references.add(item.reference);
    }
    return parsed.map((item) => Object.freeze({ ...item }));
  } catch { throw new ProductStorageError("CORRUPT_DATA"); }
}

export function readBrowserProducts(storage: StorageLike): readonly ProductDirectoryRecord[] {
  try { return parse(storage.getItem(PRODUCT_STORAGE_KEY)); } catch (error) {
    if (error instanceof ProductStorageError) throw error;
    throw new ProductStorageError("STORAGE_UNAVAILABLE");
  }
}

async function withInPageLock<T>(action: () => T | Promise<T>): Promise<T> {
  const previous = fallbackTail; let release!: () => void;
  fallbackTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await action(); } finally { release(); }
}

async function withWriteLock<T>(action: () => T | Promise<T>): Promise<T> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  // Node 24's Web Locks implementation can retain a lock when a callback throws
  // synchronously. The async boundary converts domain errors to rejected promises,
  // matching browser behavior and guaranteeing that subsequent writes can proceed.
  if (locks) return locks.request(PRODUCT_STORAGE_KEY, { mode: "exclusive" }, async () => action());
  return withInPageLock(action);
}

async function mutate<T>(storage: StorageLike, action: (products: ProductDirectoryRecord[]) => { records: ProductDirectoryRecord[]; result: T }): Promise<T> {
  return withWriteLock(() => {
    const products = [...readBrowserProducts(storage)];
    const mutation = action(products);
    const serialized = JSON.stringify(mutation.records);
    parse(serialized);
    try { storage.setItem(PRODUCT_STORAGE_KEY, serialized); } catch { throw new ProductStorageError("STORAGE_UNAVAILABLE"); }
    return mutation.result;
  });
}

function normalize(input: ProductInput): ProductInput {
  const product = { reference: input.reference.trim().toUpperCase(), nameEn: input.nameEn.trim(), nameAr: input.nameAr.trim(), origin: input.origin.trim().toUpperCase(),
    type: input.type.trim(), grade: input.grade.trim(), cropYear: input.cropYear.trim(), bagType: input.bagType.trim(), standardBagWeight: input.standardBagWeight.trim() };
  if (![product.reference, product.nameEn, product.nameAr, product.type, product.grade, product.cropYear, product.bagType].every(required)
    || !originCode.test(product.origin) || !decimal.test(product.standardBagWeight) || Number(product.standardBagWeight) <= 0) throw new ProductStorageError("INVALID_PRODUCT");
  return product;
}

export async function createBrowserProduct(storage: StorageLike, input: ProductInput, createId: () => string = () => crypto.randomUUID()): Promise<ProductDirectoryRecord> {
  const normalized = normalize(input);
  return mutate(storage, (products) => {
    if (products.some((item) => item.reference === normalized.reference)) throw new ProductStorageError("DUPLICATE_REFERENCE");
    const product = Object.freeze({ id: createId(), ...normalized, status: "ACTIVE" as const });
    return { records: [...products, product], result: product };
  });
}

export async function updateBrowserProduct(storage: StorageLike, id: string, input: ProductInput): Promise<ProductDirectoryRecord> {
  const normalized = normalize(input);
  return mutate(storage, (products) => {
    const current = products.find((item) => item.id === id);
    if (!current) throw new ProductStorageError("NOT_FOUND");
    const updated = Object.freeze({ ...current, ...normalized, reference: current.reference, status: current.status });
    return { records: products.map((item) => item.id === id ? updated : item), result: updated };
  });
}

export async function setBrowserProductStatus(storage: StorageLike, id: string, status: ProductStatus): Promise<ProductDirectoryRecord> {
  return mutate(storage, (products) => {
    const current = products.find((item) => item.id === id);
    if (!current) throw new ProductStorageError("NOT_FOUND");
    const updated = Object.freeze({ ...current, status });
    return { records: products.map((item) => item.id === id ? updated : item), result: updated };
  });
}
