import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("supplier UI uses only fail-closed server seams", () => {
  const directory = readFileSync("src/ui/features/masters/SuppliersPage.tsx", "utf8");
  const detail = readFileSync("src/ui/features/masters/SupplierDetailPage.tsx", "utf8");
  const route = readFileSync("src/app/suppliers/[supplierId]/page.tsx", "utf8");
  assert.match(directory, /const SUPPLIERS_ENDPOINT = "\/api\/suppliers"/);
  assert.match(directory, /fetch\(SUPPLIERS_ENDPOINT/);
  assert.match(directory, /method: "POST"/);
  assert.match(detail, /`\/api\/suppliers\/\$\{encodeURIComponent\(supplierId\)\}`/);
  assert.match(detail, /method: "PATCH"/);
  assert.match(detail, /"If-Match": `"\$\{supplier.version\}"`/);
  assert.doesNotMatch(directory + detail + route, /localStorage|sessionStorage|browser-supplier-storage|supplier-fixtures|x-tenant|tenant-id|x-role|x-user/i);
});

test("supplier UI has explicit bilingual fail-closed feedback", () => {
  const pages = readFileSync("src/ui/features/masters/SuppliersPage.tsx", "utf8") + readFileSync("src/ui/features/masters/SupplierDetailPage.tsx", "utf8");
  for (const copy of ["Sign in to load and save suppliers.", "سجّل الدخول لتحميل الموردين وحفظهم.", "Supplier service is unavailable.", "خدمة الموردين غير متاحة.", "No suppliers registered yet", "لم يُسجل أي مورد بعد"])
    assert.ok(pages.includes(copy), `missing ${copy}`);
  assert.ok(pages.includes("This supplier reference is already in use"));
  assert.ok(pages.includes("This request conflicts with an earlier save"));
  assert.doesNotMatch(pages, /Cedar Coffee Exporters|supplier-cedar|projectCount|openInvoiceCount/);
});
