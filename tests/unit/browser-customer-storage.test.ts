import assert from "node:assert/strict";
import { test } from "node:test";

import { createBrowserCustomer, CUSTOMER_STORAGE_KEY, CustomerStorageError, readBrowserCustomers, setBrowserCustomerStatus, updateBrowserCustomer } from "../../src/modules/masters/browser-customer-storage.ts";

class MemoryStorage {
  value: string | null = null;
  getItem(key: string) { assert.equal(key, CUSTOMER_STORAGE_KEY); return this.value; }
  setItem(key: string, value: string) { assert.equal(key, CUSTOMER_STORAGE_KEY); this.value = value; }
}
const input = { reference: " cus-101 ", legalNameEn: " Atlas Coffee Trading ", legalNameAr: " أطلس لتجارة القهوة ", countryCode: " ae ", contactName: " Noor Ali ", email: " NOOR@EXAMPLE.COM ", phone: " +971 50 123 4567 " };

test("customer creation normalizes, freezes, and persists a strict active record", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  assert.deepEqual(created, { id: "customer-101", reference: "CUS-101", legalNameEn: "Atlas Coffee Trading", legalNameAr: "أطلس لتجارة القهوة", countryCode: "AE", contactName: "Noor Ali", email: "noor@example.com", phone: "+971 50 123 4567", active: true, projectCount: 0, openInvoiceCount: 0 });
  assert.equal(Object.isFrozen(created), true);
  assert.deepEqual(readBrowserCustomers(storage), [created]);
});

test("duplicate normalized references are rejected without overwriting saved data", async () => {
  const storage = new MemoryStorage();
  await createBrowserCustomer(storage, input, () => "customer-101");
  await assert.rejects(createBrowserCustomer(storage, { ...input, reference: "CUS-101", legalNameEn: "Different" }, () => "customer-102"), (error: unknown) => error instanceof CustomerStorageError && error.code === "DUPLICATE_REFERENCE");
  assert.equal(readBrowserCustomers(storage).length, 1);
});

test("strict customer storage fails closed for corrupt shape, unknown keys, and duplicates", () => {
  const storage = new MemoryStorage();
  for (const value of ["not-json", "{}", JSON.stringify([{ id: "x" }]), JSON.stringify([{ id: "x", reference: "CUS-1", legalNameEn: "A", legalNameAr: "أ", countryCode: "AE", contactName: "N", email: "n@example.com", phone: "1", active: true, projectCount: 0, openInvoiceCount: 0, unexpected: true }])]) {
    storage.value = value;
    assert.throws(() => readBrowserCustomers(storage), (error: unknown) => error instanceof CustomerStorageError && error.code === "CORRUPT_DATA");
  }
});

test("unavailable browser storage is distinct from corrupt saved data", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() {} };
  assert.throws(() => readBrowserCustomers(storage), (error: unknown) => error instanceof CustomerStorageError && error.code === "STORAGE_UNAVAILABLE");
});


test("failed customer writes are reported and never confirmed", async () => {
  const storage = { getItem() { return null; }, setItem() { throw new Error("quota"); } };
  await assert.rejects(createBrowserCustomer(storage, input, () => "customer-101"), (error: unknown) => error instanceof CustomerStorageError && error.code === "STORAGE_UNAVAILABLE");
});

test("details can be edited while reference and lifecycle remain immutable to input", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  const updated = await updateBrowserCustomer(storage, created.id, { ...input, reference: "CHANGED", contactName: "Mona Saleh" });
  assert.equal(updated.reference, "CUS-101");
  assert.equal(updated.contactName, "Mona Saleh");
  assert.equal(updated.active, true);
});

test("customer can be archived and reactivated without deletion", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  assert.equal((await setBrowserCustomerStatus(storage, created.id, false)).active, false);
  assert.equal(readBrowserCustomers(storage).length, 1);
  assert.equal((await setBrowserCustomerStatus(storage, created.id, true)).active, true);
});


test("browser mutations fail closed when Web Locks are unsupported", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const storage = new MemoryStorage();
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
    await assert.rejects(createBrowserCustomer(storage, input, () => "customer-unsupported-lock"), (error: unknown) => error instanceof CustomerStorageError && error.code === "STORAGE_UNAVAILABLE");
    assert.equal(storage.value, null);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor); else delete (globalThis as { window?: unknown }).window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor); else delete (globalThis as { navigator?: unknown }).navigator;
  }
});
