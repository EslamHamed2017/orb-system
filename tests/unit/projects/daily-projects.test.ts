import assert from "node:assert/strict";
import test from "node:test";
import { completeProjectSetup, createProjectRecord, markCustomerShipmentReviewed, parseProjectRecords, projectNextAction, recordCustomerShipment, recordSupplierShipment } from "../../../src/modules/projects/daily-projects.ts";

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
  assert.deepEqual(parseProjectRecords(JSON.stringify([updated])), [updated]);
});

test("project setup completion rejects noncanonical and backdated mutation timestamps", () => {
  const project = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  const setup = { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" };
  for (const now of ["not-a-date", "2026-11-14T11:00:00Z", " 2026-11-14T11:00:00.000Z", "2026-11-14T09:59:59.999Z"])
    assert.throws(() => completeProjectSetup(project, setup, now), /INVALID_PROJECT_SETUP/);
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
  assert.deepEqual(projectNextAction(updated, "en"), { label: "Record customer shipment", detail: "Add the customer shipment reference, planned dispatch date, and quantity.", href: "/projects/project-user-1/overview#customer-shipment" });
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


test("records the first customer shipment after its supplier shipment and advances Today", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.deepEqual(projectNextAction(supplied, "en"), { label: "Record customer shipment", detail: "Add the customer shipment reference, planned dispatch date, and quantity.", href: "/projects/project-user-1/overview#customer-shipment" });
  assert.deepEqual(projectNextAction(supplied, "ar"), { label: "تسجيل شحنة العميل", detail: "أضف مرجع شحنة العميل وتاريخ الإرسال المخطط والكمية.", href: "/projects/project-user-1/overview#customer-shipment" });
  const updated = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  assert.deepEqual(updated.customerShipment, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" });
  assert.deepEqual(projectNextAction(updated, "en"), { label: "Review shipment handover", detail: "Review and confirm recorded customer shipment CS-001 to complete this bounded flow.", href: "/projects/project-user-1/overview#customer-shipment" });
  assert.deepEqual(projectNextAction(updated, "ar"), { label: "مراجعة تسليم الشحنة", detail: "راجع وأكد شحنة العميل المسجلة CS-001 لإكمال هذا المسار المحدود.", href: "/projects/project-user-1/overview#customer-shipment" });
});

test("rejects invalid, excessive, duplicate, and impossible customer shipment state", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  assert.throws(() => recordCustomerShipment(active, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT_STATE/);
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-02-30", quantity: "10" }, "2026-11-14T13:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT/);
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "13" }, "2026-11-14T13:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT/);
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "0" }, "2026-11-14T13:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT/);
  const recorded = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  assert.throws(() => recordCustomerShipment(recorded, { reference: "CS-002", plannedDispatchDate: "2026-12-06", quantity: "1" }, "2026-11-14T14:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT_STATE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...active, customerShipment: recorded.customerShipment }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...recorded, status: "SETUP" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...recorded, customerShipment: { ...recorded.customerShipment, plannedDispatchDate: "2026-02-30" } }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...recorded, customerShipment: { ...recorded.customerShipment, quantity: "13" } }])), /CORRUPT_PROJECT_STORAGE/);
});


test("customer shipments remain parse-valid after the project closes", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const closed = { ...shipped, status: "CLOSED" as const, updatedAt: "2026-11-14T15:00:00.000Z" };
  assert.deepEqual(parseProjectRecords(JSON.stringify([closed])), [closed]);
});

test("reviews a customer shipment exactly once and removes the project from Today actions", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  assert.equal(reviewed.customerShipmentReviewedAt, "2026-11-14T14:00:00.000Z");
  assert.equal(reviewed.updatedAt, "2026-11-14T14:00:00.000Z");
  assert.equal(projectNextAction(reviewed, "en"), null);
  assert.equal(projectNextAction(reviewed, "ar"), null);
  assert.deepEqual(parseProjectRecords(JSON.stringify([reviewed])), [reviewed]);
  const closedAfterReview = { ...reviewed, status: "CLOSED" as const };
  assert.equal(projectNextAction(closedAfterReview, "en"), null);
  assert.throws(() => markCustomerShipmentReviewed(reviewed, "2026-11-14T15:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT_REVIEW_STATE/);
  assert.throws(() => markCustomerShipmentReviewed(supplied, "2026-11-14T14:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT_REVIEW_STATE/);
  assert.throws(() => markCustomerShipmentReviewed({ ...shipped, status: "CLOSED" }, "2026-11-14T14:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT_REVIEW_STATE/);
});

test("strictly validates persisted customer shipment review timestamps and state", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  for (const customerShipmentReviewedAt of ["", "not-a-date", "2026-02-30T12:00:00.000Z", 42]) {
    assert.throws(() => parseProjectRecords(JSON.stringify([{ ...shipped, customerShipmentReviewedAt }])), /CORRUPT_PROJECT_STORAGE/);
  }
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...supplied, customerShipmentReviewedAt: "2026-11-14T14:00:00.000Z" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...shipped, status: "SETUP", customerShipmentReviewedAt: "2026-11-14T14:00:00.000Z" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => markCustomerShipmentReviewed(shipped, "not-a-date"), /INVALID_CUSTOMER_SHIPMENT_REVIEW/);
});


test("enforces project and shipment date chronology on writes and persisted records", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  assert.throws(() => recordSupplierShipment(active, { reference: "SS-EARLY", expectedArrival: "2026-11-13", quantity: "12" }, "2026-11-14T12:00:00.000Z"), /INVALID_SUPPLIER_SHIPMENT/);
  const impossibleSupplier = { ...active, supplierShipment: { reference: "SS-EARLY", expectedArrival: "2026-11-13", quantity: "12" } };
  assert.throws(() => parseProjectRecords(JSON.stringify([impossibleSupplier])), /CORRUPT_PROJECT_STORAGE/);

  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-EARLY", plannedDispatchDate: "2026-12-01", quantity: "10" }, "2026-11-14T13:00:00.000Z"), /INVALID_CUSTOMER_SHIPMENT/);
  const impossibleCustomer = { ...supplied, customerShipment: { reference: "CS-EARLY", plannedDispatchDate: "2026-12-01", quantity: "10" } };
  assert.throws(() => parseProjectRecords(JSON.stringify([impossibleCustomer])), /CORRUPT_PROJECT_STORAGE/);

  const sameDaySupplier = recordSupplierShipment(active, { reference: "SS-SAME", expectedArrival: "2026-11-14", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const sameDayCustomer = recordCustomerShipment(sameDaySupplier, { reference: "CS-SAME", plannedDispatchDate: "2026-11-14", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  assert.deepEqual(parseProjectRecords(JSON.stringify([sameDayCustomer])), [sameDayCustomer]);
});

test("shipment and handover writes reject non-ISO and backdated mutation timestamps", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  for (const now of ["not-a-date", "2026-11-14T12:00:00Z", " 2026-11-14T12:00:00.000Z"])
    assert.throws(() => recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, now), /INVALID_SUPPLIER_SHIPMENT/);
  assert.throws(() => recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T10:59:59.999Z"), /INVALID_SUPPLIER_SHIPMENT/);

  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14 13:00:00Z"), /INVALID_CUSTOMER_SHIPMENT/);
  assert.throws(() => recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T11:59:59.999Z"), /INVALID_CUSTOMER_SHIPMENT/);

  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  assert.throws(() => markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00Z"), /INVALID_CUSTOMER_SHIPMENT_REVIEW/);
  assert.throws(() => markCustomerShipmentReviewed(shipped, "2026-11-14T12:59:59.999Z"), /INVALID_CUSTOMER_SHIPMENT_REVIEW/);

  const equalTimestamp = markCustomerShipmentReviewed(shipped, shipped.updatedAt);
  assert.equal(equalTimestamp.customerShipmentReviewedAt, shipped.updatedAt);
  assert.equal(equalTimestamp.updatedAt, shipped.updatedAt);
});

test("strictly validates persisted project timestamp chronology while preserving valid old records", () => {
  const oldRecord = createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  assert.deepEqual(parseProjectRecords(JSON.stringify([oldRecord])), [oldRecord]);
  for (const badTimestamp of ["not-a-date", "2026-11-14T10:00:00Z", " 2026-11-14T10:00:00.000Z"])
    assert.throws(() => parseProjectRecords(JSON.stringify([{ ...oldRecord, createdAt: badTimestamp }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...oldRecord, updatedAt: "2026-11-14T10:00:00Z" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...oldRecord, createdAt: "2026-11-14T10:00:00.001Z", updatedAt: "2026-11-14T10:00:00.000Z" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-2", now: "2026-11-14T10:00:00Z", sequence: 2 }), /INVALID_PROJECT_INPUT/);
});

test("persisted handover review timestamp stays within project chronology", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...shipped, customerShipmentReviewedAt: "2026-11-14T09:59:59.999Z" }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...shipped, customerShipmentReviewedAt: "2026-11-14T13:00:00.001Z" }])), /CORRUPT_PROJECT_STORAGE/);
  const reviewedAtLatestMutation = { ...shipped, customerShipmentReviewedAt: shipped.updatedAt };
  assert.deepEqual(parseProjectRecords(JSON.stringify([reviewedAtLatestMutation])), [reviewedAtLatestMutation]);
});
