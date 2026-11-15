import assert from "node:assert/strict";
import test from "node:test";
import { shipmentQueueRows, shipmentQueueHref } from "../../../src/modules/projects/saved-shipments-work-queue.ts";
import type { ProjectRecord } from "../../../src/modules/projects/daily-projects.ts";

const base: ProjectRecord = {
  id: "saved/one", code: "ORB-P-0042", customer: "Atlas Foods", supplier: "Coast Exporters",
  reference: "AF-42", contractReference: "SC-42", purchaseContractReference: "PC-42",
  startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD",
  unitPrice: "4200", value: 84000, origin: "Mombasa", destination: "Dubai", status: "ACTIVE",
  createdAt: "2026-11-14T10:00:00.000Z", updatedAt: "2026-11-14T11:00:00.000Z",
};

test("shipment queue derives only persisted project and shipment facts with one overview action", () => {
  const rows = shipmentQueueRows([
    base,
    { ...base, id: "supplied", code: "ORB-P-0043", supplierShipment: { reference: "SS-REAL-7", expectedArrival: "2026-12-02", quantity: "12.5" } },
    { ...base, id: "delivered", code: "ORB-P-0044", supplierShipment: { reference: "SS-8", expectedArrival: "2026-12-02", quantity: "12" }, customerShipment: { reference: "CS-REAL-9", plannedDispatchDate: "2026-12-05", quantity: "10" } },
  ], "en");

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    id: "saved/one", code: "ORB-P-0042", customer: "Atlas Foods", supplier: "Coast Exporters",
    contractedQuantity: "20 MT", supplierShipment: null, customerShipment: null,
    stage: "Supplier shipment details not recorded", group: "needs-action",
    action: { label: "Record supplier shipment", href: "/projects/saved%2Fone/overview#supplier-shipment" },
  });
  assert.deepEqual(rows[1].supplierShipment, { reference: "SS-REAL-7", date: "2026-12-02", quantity: "12.5 MT" });
  assert.equal(rows[1].stage, "Supplier shipment details recorded");
  assert.deepEqual(rows[1].action, { label: "Record customer shipment", href: "/projects/supplied/overview#customer-shipment" });
  assert.deepEqual(rows[2].customerShipment, { reference: "CS-REAL-9", date: "2026-12-05", quantity: "10 MT" });
  assert.equal(rows[2].stage, "Customer shipment details recorded");
  assert.deepEqual(rows[2].action, { label: "Review customer shipment details", href: "/projects/delivered/overview#customer-shipment" });
});

test("shipment queue gives setup, reviewed, and closed projects truthful Arabic stages and one safe overview action", () => {
  const rows = shipmentQueueRows([
    { ...base, id: "setup", status: "SETUP", supplier: undefined, purchaseContractReference: undefined },
    { ...base, id: "reviewed", supplierShipment: { reference: "SS", expectedArrival: "2026-12-02", quantity: "12" }, customerShipment: { reference: "CS", plannedDispatchDate: "2026-12-05", quantity: "10" }, customerShipmentReviewedAt: "2026-12-05T12:00:00.000Z" },
    { ...base, id: "closed", status: "CLOSED", supplierShipment: { reference: "SS-C", expectedArrival: "2026-12-02", quantity: "20" }, customerShipment: { reference: "CS-C", plannedDispatchDate: "2026-12-05", quantity: "20" }, customerShipmentReviewedAt: "2026-12-05T12:00:00.000Z", closure: { closedOn: "2026-12-06", note: "تمت المراجعة", closedAt: "2026-12-06T12:00:00.000Z" } },
  ], "ar");

  assert.equal(rows[0].supplier, null);
  assert.equal(rows[0].stage, "يلزم إكمال إعداد المشروع");
  assert.equal(rows[0].group, "needs-action");
  assert.deepEqual(rows[0].action, { label: "إكمال إعداد المشروع", href: "/projects/setup/overview#project-data" });
  assert.equal(rows[1].stage, "تم تسجيل مراجعة تسليم الشحنة");
  assert.equal(rows[1].group, "recorded");
  assert.deepEqual(rows[1].action, { label: "عرض الشحنات المسجلة", href: "/projects/reviewed/overview#customer-shipment" });
  assert.equal(rows[2].stage, "المشروع مغلق");
  assert.equal(rows[2].group, "closed");
  assert.deepEqual(rows[2].action, { label: "عرض المشروع المغلق", href: "/projects/closed/overview#lifecycle" });
});

test("shipment action links preserve locale and role before the overview anchor", () => {
  assert.equal(shipmentQueueHref("/projects/saved%2Fone/overview#supplier-shipment", "ar", "operations"), "/projects/saved%2Fone/overview?locale=ar&role=operations#supplier-shipment");
  assert.equal(shipmentQueueHref("/projects/supplied/overview#customer-shipment", "en"), "/projects/supplied/overview?locale=en#customer-shipment");
});


test("reopened work review takes precedence over shipment actions", () => {
  const reopened = { ...base, id: "reopened", closure: { closedOn: "2026-11-14", note: "Closed correctly", closedAt: "2026-11-14T10:30:00.000Z", reopenedOn: "2026-11-14", reopenReason: "Shipment correction", reopenedAt: "2026-11-14T10:45:00.000Z" }, updatedAt: "2026-11-14T10:45:00.000Z" };
  const [row] = shipmentQueueRows([reopened], "en");
  assert.equal(row.stage, "Reopened work requires review");
  assert.deepEqual(row.action, { label: "Review reopened work", href: "/projects/reopened/closure" });
});

test("shipment queue puts pending work before completed and closed references", () => {
  const reviewed = { ...base, id: "reviewed-order", supplierShipment: { reference: "SS", expectedArrival: "2026-12-02", quantity: "12" }, customerShipment: { reference: "CS", plannedDispatchDate: "2026-12-05", quantity: "10" }, customerShipmentReviewedAt: "2026-12-05T12:00:00.000Z" };
  const closed = { ...reviewed, id: "closed-order", status: "CLOSED" as const, closure: { closedOn: "2026-12-06", note: "Work complete", closedAt: "2026-12-06T12:00:00.000Z" } };
  const pending = { ...base, id: "pending-order" };
  assert.deepEqual(shipmentQueueRows([closed, reviewed, pending], "en").map((row) => row.id), ["pending-order", "reviewed-order", "closed-order"]);
});
