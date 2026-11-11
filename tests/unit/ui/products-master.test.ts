import assert from "node:assert/strict";
import test from "node:test";

import {
  filterProducts,
  summarizeProducts,
  type ProductDirectoryRecord,
} from "../../../src/ui/features/masters/product-directory.ts";

const products: readonly ProductDirectoryRecord[] = [
  {
    id: "product-1",
    reference: "PROD-001",
    nameEn: "Ethiopia Yirgacheffe",
    nameAr: "إثيوبيا يرغاشيف",
    origin: "ET",
    type: "Arabica",
    grade: "Grade 1",
    cropYear: "2026",
    bagType: "Jute",
    standardBagWeight: "60.000000",
    status: "ACTIVE",
  },
  {
    id: "product-2",
    reference: "PROD-002",
    nameEn: "Brazil Santos",
    nameAr: "برازيل سانتوس",
    origin: "BR",
    type: "Arabica",
    grade: "NY2",
    cropYear: "2025/26",
    bagType: "Jute",
    standardBagWeight: "59.000000",
    status: "INACTIVE",
  },
];

test("product directory summarizes explicit lifecycle states without inventory balances", () => {
  assert.deepEqual(summarizeProducts(products), { total: 2, active: 1, inactive: 1 });
});

test("product directory search supports references and bilingual product names", () => {
  assert.deepEqual(filterProducts(products, "prod-002", "ALL").map((item) => item.id), ["product-2"]);
  assert.deepEqual(filterProducts(products, "يرغاشيف", "ACTIVE").map((item) => item.id), ["product-1"]);
  assert.deepEqual(filterProducts(products, "arabica", "INACTIVE").map((item) => item.id), ["product-2"]);
});
