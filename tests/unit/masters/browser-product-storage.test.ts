import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_STORAGE_KEY,
  ProductStorageError,
  createBrowserProduct,
  readBrowserProducts,
  setBrowserProductStatus,
  updateBrowserProduct,
  type StorageLike,
} from "../../../src/modules/masters/browser-product-storage.ts";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const input = { reference: " prod-004 ", nameEn: "Kenya AA", nameAr: "كينيا AA", origin: "ke", type: "Arabica", grade: "AA", cropYear: "2026", bagType: "Jute", standardBagWeight: "60" };

test("browser product storage starts empty and round-trips a normalized product", async () => {
  const storage = new MemoryStorage();
  assert.deepEqual(readBrowserProducts(storage), []);
  const product = await createBrowserProduct(storage, input, () => "product-004");
  assert.equal(product.reference, "PROD-004");
  assert.equal(product.origin, "KE");
  assert.equal(product.standardBagWeight, "60");
  assert.equal(product.status, "ACTIVE");
  assert.deepEqual(readBrowserProducts(storage), [product]);
});

test("browser product storage rejects duplicate references and invalid weight without losing saved data", async () => {
  const storage = new MemoryStorage();
  await createBrowserProduct(storage, input, () => "product-004");
  await assert.rejects(() => createBrowserProduct(storage, { ...input, nameEn: "Duplicate" }, () => "product-005"), (error: unknown) => error instanceof ProductStorageError && error.code === "DUPLICATE_REFERENCE");
  await assert.rejects(() => createBrowserProduct(storage, { ...input, reference: "PROD-006", standardBagWeight: "0" }, () => "product-006"), (error: unknown) => error instanceof ProductStorageError && error.code === "INVALID_PRODUCT");
  assert.equal(readBrowserProducts(storage).length, 1);
});

test("browser product storage fails visibly on corrupt saved data", () => {
  const storage = new MemoryStorage();
  storage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify([{ id: "bad" }]));
  assert.throws(() => readBrowserProducts(storage), (error: unknown) => error instanceof ProductStorageError && error.code === "CORRUPT_DATA");
});

test("browser product storage deactivates and reactivates a saved product", async () => {
  const storage = new MemoryStorage();
  await createBrowserProduct(storage, input, () => "product-004");
  assert.equal((await setBrowserProductStatus(storage, "product-004", "INACTIVE")).status, "INACTIVE");
  assert.equal((await setBrowserProductStatus(storage, "product-004", "ACTIVE")).status, "ACTIVE");
  assert.equal(readBrowserProducts(storage)[0]?.status, "ACTIVE");
});


test("persisted product parsing rejects unknown fields, invalid origins, duplicate ids and duplicate references", () => {
  const valid = { id: "one", reference: "PROD-1", nameEn: "One", nameAr: "واحد", origin: "ET", type: "Arabica", grade: "1", cropYear: "2026", bagType: "Jute", standardBagWeight: "60", status: "ACTIVE" };
  for (const records of [
    [{ ...valid, extra: true }],
    [{ ...valid, origin: "123" }],
    [valid, { ...valid, reference: "PROD-2" }],
    [valid, { ...valid, id: "two", reference: "prod-1" }],
  ]) {
    const storage = new MemoryStorage();
    storage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(records));
    assert.throws(() => readBrowserProducts(storage), (error: unknown) => error instanceof ProductStorageError && error.code === "CORRUPT_DATA");
  }
});

test("cooperating concurrent product creates are serialized without lost records", async () => {
  const storage = new MemoryStorage();
  await Promise.all([
    createBrowserProduct(storage, input, () => "product-004"),
    createBrowserProduct(storage, { ...input, reference: "PROD-005", nameEn: "Kenya AB" }, () => "product-005"),
  ]);
  assert.deepEqual(readBrowserProducts(storage).map((item) => item.reference), ["PROD-004", "PROD-005"]);
});

test("product correction preserves immutable reference and lifecycle status", async () => {
  const storage = new MemoryStorage();
  await createBrowserProduct(storage, input, () => "product-004");
  await setBrowserProductStatus(storage, "product-004", "INACTIVE");
  const updated = await updateBrowserProduct(storage, "product-004", { ...input, reference: "IGNORED", grade: "AB", standardBagWeight: "59" });
  assert.equal(updated.reference, "PROD-004");
  assert.equal(updated.status, "INACTIVE");
  assert.equal(updated.grade, "AB");
  assert.equal(updated.standardBagWeight, "59");
});
