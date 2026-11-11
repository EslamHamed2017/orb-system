import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  filterSuppliers,
  summarizeSuppliers,
  type SupplierDirectoryRecord,
} from "../../../src/ui/features/masters/supplier-directory.ts";

const suppliers: readonly SupplierDirectoryRecord[] = [
  { id: "supplier-1", reference: "SUP-001", legalNameEn: "Cedar Coffee Exporters", legalNameAr: "سيدار لتصدير القهوة", countryCode: "AE", contactName: "Maya Haddad", email: "maya@example.test", phone: "+971 50 000 0001", active: true, projectCount: 3, openInvoiceCount: 2 },
  { id: "supplier-2", reference: "SUP-002", legalNameEn: "Highland Coffee Cooperative", legalNameAr: "تعاونية قهوة المرتفعات", countryCode: "SA", contactName: "Omar Saleh", email: "omar@example.test", phone: "+966 50 000 0002", active: false, projectCount: 1, openInvoiceCount: 0 },
];

test("supplier directory summarizes explicit lifecycle and operational links", () => {
  assert.deepEqual(summarizeSuppliers(suppliers), { total: 2, active: 1, inactive: 1, linkedProjects: 4, openInvoices: 2 });
});

test("supplier directory filters references, bilingual names, contacts and lifecycle", () => {
  assert.deepEqual(filterSuppliers(suppliers, "cedar", "ALL").map((item) => item.id), ["supplier-1"]);
  assert.deepEqual(filterSuppliers(suppliers, "المرتفعات", "INACTIVE").map((item) => item.id), ["supplier-2"]);
  assert.deepEqual(filterSuppliers(suppliers, "maya", "ACTIVE").map((item) => item.id), ["supplier-1"]);
});

test("suppliers expose bilingual directory and independent 360 detail navigation", () => {
  const directory = readFileSync("src/ui/features/masters/SuppliersPage.tsx", "utf8");
  const detail = readFileSync("src/ui/features/masters/SupplierDetailPage.tsx", "utf8");
  const masterRoute = readFileSync("src/app/masters/[masterType]/page.tsx", "utf8");
  const detailRoute = readFileSync("src/app/suppliers/[supplierId]/page.tsx", "utf8");
  assert.match(masterRoute, /SuppliersPage/);
  assert.match(detailRoute, /SupplierDetailPage/);
  assert.match(directory, /Supplier directory/);
  assert.match(directory, /دليل الموردين/);
  assert.match(directory, /data-operation-id="createSupplier"/);
  assert.match(detail, /Supplier 360/);
  assert.match(detail, /نظرة المورد ٣٦٠°/);
  assert.match(detail, /data-operation-id="updateSupplier"/);
  for (const destination of ["projects", "purchase contracts", "supplier invoices", "supplier payments"]) assert.match(detail.toLowerCase(), new RegExp(destination));
});
