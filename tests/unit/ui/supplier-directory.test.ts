import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterSuppliers,
  summarizeSuppliers,
  type SupplierDirectoryRecord,
} from "../../../src/ui/features/masters/supplier-directory.ts";

const suppliers: readonly SupplierDirectoryRecord[] = [
  { id: "11111111-1111-4111-8111-111111111111", reference: "SUP-001", registeredName: "Cedar Coffee Exporters", displayNameAr: "سيدار لتصدير القهوة", countryCode: "AE", contactName: "Maya Haddad", email: "maya@example.test", phone: "+971 50 000 0001", paymentCurrency: "USD", paymentTermsDays: 30, status: "ACTIVE", version: 1 },
  { id: "22222222-2222-4222-8222-222222222222", reference: "SUP-002", registeredName: "Highland Coffee Cooperative", displayNameAr: "تعاونية قهوة المرتفعات", countryCode: "SA", contactName: "Omar Saleh", email: "omar@example.test", phone: "+966 50 000 0002", paymentCurrency: "USD", paymentTermsDays: 45, status: "INACTIVE", version: 2 },
];

test("supplier directory summarizes explicit lifecycle and operational links", () => {
  assert.deepEqual(summarizeSuppliers(suppliers), { total: 2, active: 1, inactive: 1 });
});

test("supplier directory filters references, bilingual names, contacts and lifecycle", () => {
  assert.deepEqual(filterSuppliers(suppliers, "cedar", "ALL").map((item) => item.id), ["11111111-1111-4111-8111-111111111111"]);
  assert.deepEqual(filterSuppliers(suppliers, "المرتفعات", "INACTIVE").map((item) => item.id), ["22222222-2222-4222-8222-222222222222"]);
  assert.deepEqual(filterSuppliers(suppliers, "maya", "ACTIVE").map((item) => item.id), ["11111111-1111-4111-8111-111111111111"]);
});

test("suppliers expose bilingual server-backed directory and detail navigation", () => {
  const directory = readFileSync("src/ui/features/masters/SuppliersPage.tsx", "utf8");
  const detail = readFileSync("src/ui/features/masters/SupplierDetailPage.tsx", "utf8");
  const masterRoute = readFileSync("src/app/masters/[masterType]/page.tsx", "utf8");
  const detailRoute = readFileSync("src/app/suppliers/[supplierId]/page.tsx", "utf8");
  assert.match(masterRoute, /SuppliersPage/);
  assert.match(detailRoute, /SupplierDetailPage/);
  assert.match(directory, /Supplier directory/);
  assert.match(directory, /دليل الموردين/);
  assert.match(directory, /data-operation-id="createSupplier"/);
  assert.match(detail, /Supplier profile/);
  assert.match(detail, /ملف المورد/);
  assert.doesNotMatch(directory + detail, /localStorage|Saved in this browser/);
  assert.match(detail, /data-operation-id="updateSupplier"/);
  for (const destination of ["projects", "supplier bills", "supplier payments"]) assert.match(detail.toLowerCase(), new RegExp(destination));
});
