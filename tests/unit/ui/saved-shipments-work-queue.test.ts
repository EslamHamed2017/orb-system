import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/shipments/page.tsx", "utf8");
const queue = readFileSync("src/ui/features/shipments/SavedShipmentsWorkQueue.tsx", "utf8");
const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
const styles = readFileSync("src/ui/features/shipments/SavedShipmentsWorkQueue.module.css", "utf8");

test("global shipments route uses the browser saved-project queue and preserves role context", () => {
  assert.match(page, /SavedShipmentsWorkQueue/);
  assert.match(page, /role=\{query\.role\?\.trim\(\) \|\| undefined\}/);
  assert.match(queue, /localStorage\.getItem\(PROJECT_STORAGE_KEY\)/);
  assert.match(queue, /parseProjectRecords/);
  assert.doesNotMatch(queue, /fixture|Pilot Customer|SS-001|id:\s*["']demo["']/);
});

test("shipment navigation no longer points to the demo project and preserves shell query context", () => {
  assert.doesNotMatch(navigation, /projects\/demo\/shipments/);
  assert.match(navigation, /href=\{`\/shipments\$\{suffix\}`\}/);
});

test("saved shipment UI exposes truthful loading, empty, corrupt, and browser-only states in Arabic and English", () => {
  for (const phrase of ["No saved projects", "لا توجد مشاريع محفوظة", "Saved shipments could not be opened", "تعذر فتح الشحنات المحفوظة", "browser only", "هذا المتصفح فقط"]) assert.match(queue, new RegExp(phrase));
  assert.match(queue, /role="alert"/);
  assert.match(queue, /shipmentQueueRows/);
});

test("queue is responsive, has cards and a desktop table, and clears mobile bottom navigation", () => {
  assert.match(queue, /queueTable/);
  assert.match(queue, /mobileCards/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /padding-block-end:\s*84px/);
  assert.match(styles, /\.queueTable\{[^}]*min-inline-size/s);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});
