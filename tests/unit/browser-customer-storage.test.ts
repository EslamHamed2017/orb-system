import assert from "node:assert/strict";
import { test } from "node:test";

import { createBrowserCustomer, CustomerStorageError, readBrowserCustomers, setBrowserCustomerStatus, updateBrowserCustomer } from "../../src/modules/masters/browser-customer-storage.ts";

class MemoryStorage {
  value: string | null = null;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}

const input = { reference: " cus-101 ", legalNameEn: " Atlas Coffee ", legalNameAr: " أطلس للقهوة ", countryCode: " ae ", contactName: " Noor Ali ", email: " NOOR@EXAMPLE.COM ", phone: " +971500001234 " };

test("customer creation normalizes and persists an active working record", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  assert.deepEqual(created, { id: "customer-101", reference: "CUS-101", legalNameEn: "Atlas Coffee", legalNameAr: "أطلس للقهوة", countryCode: "AE", contactName: "Noor Ali", email: "noor@example.com", phone: "+971500001234", active: true, projectCount: 0, openInvoiceCount: 0 });
  assert.deepEqual(readBrowserCustomers(storage), [created]);
});

test("customer creation rejects a duplicate reference without overwriting saved data", async () => {
  const storage = new MemoryStorage();
  await createBrowserCustomer(storage, input, () => "customer-101");
  await assert.rejects(createBrowserCustomer(storage, { ...input, legalNameEn: "Different" }, () => "customer-102"), (error: unknown) => error instanceof CustomerStorageError && error.code === "DUPLICATE_REFERENCE");
  assert.equal(readBrowserCustomers(storage).length, 1);
});

test("customer storage fails closed for corrupt or invalid data", async () => {
  const storage = new MemoryStorage();
  storage.value = "not-json";
  assert.throws(() => readBrowserCustomers(storage), (error: unknown) => error instanceof CustomerStorageError && error.code === "CORRUPT_DATA");
  storage.value = null;
  await assert.rejects(createBrowserCustomer(storage, { ...input, email: "invalid" }), (error: unknown) => error instanceof CustomerStorageError && error.code === "INVALID_CUSTOMER");
});


test("customer details can be corrected without changing the immutable reference", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  const updated = await updateBrowserCustomer(storage, created.id, { ...input, reference: "CHANGED", contactName: "Mona Saleh" });
  assert.equal(updated.reference, "CUS-101");
  assert.equal(updated.contactName, "Mona Saleh");
  assert.equal(readBrowserCustomers(storage)[0].contactName, "Mona Saleh");
});

test("customer can be archived and reactivated without deletion", async () => {
  const storage = new MemoryStorage();
  const created = await createBrowserCustomer(storage, input, () => "customer-101");
  assert.equal((await setBrowserCustomerStatus(storage, created.id, false)).active, false);
  assert.equal(readBrowserCustomers(storage)[0].active, false);
  assert.equal((await setBrowserCustomerStatus(storage, created.id, true)).active, true);
});
