import assert from "node:assert/strict";
import { test } from "node:test";

import { createBrowserSupplier, SupplierStorageError, readBrowserSuppliers, setBrowserSupplierStatus, updateBrowserSupplier } from "../../src/modules/masters/browser-supplier-storage.ts";

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}

const input = { reference: " sup-101 ", legalNameEn: " Cedar Coffee ", legalNameAr: " سيدار للقهوة ", countryCode: " ae ", contactName: " Hana Ali ", email: " HANA@EXAMPLE.COM ", phone: " +971500001234 " };

test("supplier creation normalizes and persists an active working record", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserSupplier(storage, input, () => "supplier-101");
  assert.deepEqual(created, { id: "supplier-101", reference: "SUP-101", legalNameEn: "Cedar Coffee", legalNameAr: "سيدار للقهوة", countryCode: "AE", contactName: "Hana Ali", email: "hana@example.com", phone: "+971500001234", active: true, projectCount: 0, openInvoiceCount: 0 });
  assert.deepEqual(readBrowserSuppliers(storage), [created]);
});

test("supplier creation rejects a duplicate reference without overwriting saved data", async () => {
  const storage = new MemoryStorage();
  await createBrowserSupplier(storage, input, () => "supplier-101");
  await assert.rejects(createBrowserSupplier(storage, { ...input, legalNameEn: "Different" }, () => "supplier-102"), (error: unknown) => error instanceof SupplierStorageError && error.code === "DUPLICATE_REFERENCE");
  assert.equal(readBrowserSuppliers(storage).length, 1);
});

test("supplier storage fails closed for corrupt or invalid data", async () => {
  const storage = new MemoryStorage();
  storage.value = "not-json";
  assert.throws(() => readBrowserSuppliers(storage), (error: unknown) => error instanceof SupplierStorageError && error.code === "CORRUPT_DATA");
  storage.value = null;
  await assert.rejects(createBrowserSupplier(storage, { ...input, email: "invalid" }), (error: unknown) => error instanceof SupplierStorageError && error.code === "INVALID_SUPPLIER");
});


test("supplier details can be corrected without changing the immutable reference", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserSupplier(storage, input, () => "supplier-101");
  const updated = await updateBrowserSupplier(storage, created.id, { ...input, reference: "CHANGED", contactName: "Mona Bekele" });
  assert.equal(updated.reference, "SUP-101");
  assert.equal(updated.contactName, "Mona Bekele");
  assert.equal(readBrowserSuppliers(storage)[0].contactName, "Mona Bekele");
});

test("supplier can be archived and reactivated without deletion", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserSupplier(storage, input, () => "supplier-101");
  assert.equal((await setBrowserSupplierStatus(storage, created.id, false)).active, false);
  assert.equal(readBrowserSuppliers(storage)[0].active, false);
  assert.equal((await setBrowserSupplierStatus(storage, created.id, true)).active, true);
});
