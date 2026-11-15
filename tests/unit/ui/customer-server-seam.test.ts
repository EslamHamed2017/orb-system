import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/ui/features/masters/CustomersPage.tsx", "utf8");

test("customer UI uses only the fail-closed server seam", () => {
  assert.doesNotMatch(page, /localStorage|sessionStorage|browser-customer-storage|customer-fixtures/);
  assert.match(page, /fetch\(CUSTOMERS_ENDPOINT/);
  assert.match(page, /const CUSTOMERS_ENDPOINT = "\/api\/customers"/);
  assert.match(page, /method: "POST"/);
  assert.doesNotMatch(page, /x-tenant|tenant-id|x-role|x-user|authorization/i);
});

test("customer UI has explicit bilingual fail-closed feedback", () => {
  for (const copy of [
    "Sign in to load and save customers.",
    "سجّل الدخول لتحميل العملاء وحفظهم.",
    "Customer service is unavailable.",
    "خدمة العملاء غير متاحة.",
    "No customers registered yet",
    "لم يُسجل أي عميل بعد",
  ]) assert.match(page, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(page, /Northstar Roasters|Atlas Retail|Harbor Coffee/);
});

test("customer detail route cannot present fixed records as authoritative", () => {
  const detailRoute = readFileSync("src/app/customers/[customerId]/page.tsx", "utf8");
  assert.doesNotMatch(detailRoute, /customer-fixtures|CUSTOMERS|CustomerDetailPage/);
  assert.match(detailRoute, /redirect/);
});
