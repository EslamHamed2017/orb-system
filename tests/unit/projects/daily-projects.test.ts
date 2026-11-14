import assert from "node:assert/strict";
import test from "node:test";
import { completeProjectSetup, createProjectRecord, parseProjectRecords, projectNextAction, recordSupplierShipment } from "../../../src/modules/projects/daily-projects.ts";

test("creates a project record from user-entered data without sample defaults", () => {
  const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  assert.equal(project.code, "ORB-P-0001");
  assert.equal(project.value, 84000);
  assert.equal(project.customer, "Atlas Foods");
  assert.equal(project.status, "SETUP");
});

test("fails visibly on malformed persisted data instead of presenting an empty register", () => {
  assert.throws(() => parseProjectRecords("not-json"), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ id: "x", customer: 42 }])), /CORRUPT_PROJECT_STORAGE/);
});

test("rejects a project value that overflows", () => {
  assert.throws(() => createProjectRecord({ customer: "Atlas", reference: "A", contractReference: "C", startDate: "2026-11-14", commodity: "Coffee", quantity: "1e308", unit: "MT", currency: "USD", unitPrice: "1e308", origin: "Mombasa", destination: "Dubai" }, { id: "p", now: "2026-11-14T10:00:00.000Z", sequence: 1 }), /INVALID_PROJECT_INPUT/);
});

test("derives a localized next action from authoritative project state", () => {
  assert.deepEqual(projectNextAction("SETUP", "en", "project-user-1"), { label: "Complete project setup", detail: "Confirm the customer, supplier, sales contract, and purchase contract.", href: "/projects/project-user-1/overview#project-data" });
  assert.deepEqual(projectNextAction("SETUP", "ar", "project-user-1"), { label: "إكمال إعداد المشروع", detail: "أكد العميل والمورد ومرجعي عقد البيع والشراء.", href: "/projects/project-user-1/overview#project-data" });
  assert.deepEqual(projectNextAction("ACTIVE", "en", "project-user-1"), { label: "Review saved project data", detail: "Review the parties, contracts, route, and commercial details saved for this project.", href: "/projects/project-user-1/overview#project-data" });
});


test("completes project setup from user-entered parties and contract references", () => {
  const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  const updated = completeProjectSetup(project, { customer: " Atlas Foods ", supplier: " Coast Exporters ", salesContractReference: " SC-44 ", purchaseContractReference: " PC-17 " }, "2026-11-14T11:00:00.000Z");
  assert.equal(updated.id, project.id);
  assert.equal(updated.customer, "Atlas Foods");
  assert.equal(updated.supplier, "Coast Exporters");
  assert.equal(updated.contractReference, "SC-44");
  assert.equal(updated.purchaseContractReference, "PC-17");
  assert.equal(updated.status, "ACTIVE");
  assert.equal(updated.updatedAt, "2026-11-14T11:00:00.000Z");
  assert.equal(updated.value, project.value);
});

test("project setup completion rejects missing business parties or contract references", () => {
  const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  assert.throws(() => completeProjectSetup(project, { customer: "Atlas", supplier: "", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z"), /INVALID_PROJECT_SETUP/);
  assert.throws(() => completeProjectSetup({ ...project, status: "ACTIVE" }, { customer: "Atlas", supplier: "Coast", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z"), /INVALID_PROJECT_SETUP_STATE/);
  assert.throws(() => completeProjectSetup({ ...project, status: "CLOSED" }, { customer: "Atlas", supplier: "Coast", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z"), /INVALID_PROJECT_SETUP_STATE/);
});

test("persisted setup fields are optional for old records but validated when present", () => {
  const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  assert.equal(parseProjectRecords(JSON.stringify([project])).length, 1);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...project, supplier: 42 }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...project, purchaseContractReference: "" }])), /CORRUPT_PROJECT_STORAGE/);
});


test("records the first supplier shipment from user-entered data and advances Today", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" },
    "2026-11-14T11:00:00.000Z",
  );
  assert.deepEqual(projectNextAction(setup, "en"), { label: "Record supplier shipment", detail: "Add the supplier shipment reference, expected arrival, and planned quantity.", href: "/projects/project-user-1/overview#supplier-shipment" });
  const updated = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.deepEqual(updated.supplierShipment, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" });
  assert.deepEqual(projectNextAction(updated, "en"), { label: "Review supplier shipment", detail: "Review SS-001, expected 2 Dec 2026, and prepare the customer shipment.", href: "/projects/project-user-1/overview#supplier-shipment" });
});


test("rejects invalid supplier shipment dates, quantities, duplicate writes, and impossible persisted state", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  assert.throws(() => recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-02-30", quantity: "12" }, "2026-11-14T12:00:00.000Z"), /INVALID_SUPPLIER_SHIPMENT/);
  assert.throws(() => recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "21" }, "2026-11-14T12:00:00.000Z"), /INVALID_SUPPLIER_SHIPMENT/);
  const recorded = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.throws(() => recordSupplierShipment(recorded, { reference: "SS-002", expectedArrival: "2026-12-03", quantity: "1" }, "2026-11-14T13:00:00.000Z"), /INVALID_SUPPLIER_SHIPMENT_STATE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...recorded, supplierShipment: { ...recorded.supplierShipment, expectedArrival: "2026-02-30" } }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, status: "SETUP", supplierShipment: { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" } }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...recorded, supplierShipment: { ...recorded.supplierShipment, quantity: "not-a-number" } }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, status: ["SETUP"], supplierShipment: { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" } }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, startDate: "2026-02-30" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, quantity: "garbage" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, supplier: undefined, purchaseContractReference: undefined }])), /CORRUPT_PROJECT_STORAGE/);
});
