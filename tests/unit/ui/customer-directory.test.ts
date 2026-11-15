import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterCustomers,
  summarizeCustomers,
  type CustomerDirectoryRecord,
} from "../../../src/ui/features/masters/customer-directory.ts";

const customers: readonly CustomerDirectoryRecord[] = [
  { id: "customer-1", reference: "CUS-001", legalNameEn: "Northstar Roasters", legalNameAr: "محمصة نورث ستار", countryCode: "AE", contactName: "Maya Haddad", email: "maya@example.test", phone: "+971 50 000 0001", active: true, projectCount: 3, openInvoiceCount: 2 },
  { id: "customer-2", reference: "CUS-002", legalNameEn: "Atlas Retail", legalNameAr: "أطلس للتجزئة", countryCode: "SA", contactName: "Omar Saleh", email: "omar@example.test", phone: "+966 50 000 0002", active: false, projectCount: 1, openInvoiceCount: 0 },
];

test("customer directory summarizes explicit lifecycle and operational links", () => {
  assert.deepEqual(summarizeCustomers(customers), { total: 2, active: 1, inactive: 1, linkedProjects: 4, openInvoices: 2 });
});

test("customer directory filters references, bilingual names, contacts and lifecycle", () => {
  assert.deepEqual(filterCustomers(customers, "northstar", "ALL").map((item) => item.id), ["customer-1"]);
  assert.deepEqual(filterCustomers(customers, "أطلس", "INACTIVE").map((item) => item.id), ["customer-2"]);
  assert.deepEqual(filterCustomers(customers, "maya", "ACTIVE").map((item) => item.id), ["customer-1"]);
});

test("customers expose a bilingual server-backed directory", () => {
  const directory = readFileSync("src/ui/features/masters/CustomersPage.tsx", "utf8");
  const masterRoute = readFileSync("src/app/masters/[masterType]/page.tsx", "utf8");
  assert.match(masterRoute, /CustomersPage/);
  assert.match(directory, /Customer directory/);
  assert.match(directory, /دليل العملاء/);
  assert.match(directory, /data-operation-id="createCustomer"/);
  assert.match(directory, /\/api\/customers/);
  assert.doesNotMatch(directory, /customer-fixtures|Customer 360/);
});
