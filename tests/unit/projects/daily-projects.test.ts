import assert from "node:assert/strict";
import test from "node:test";
import { completeProjectSetup, createProjectRecord, markCustomerShipmentReviewed, parseProjectRecords, projectNextAction, customerReceivableSummary, recordCustomerCollection, recordCustomerInvoice, recordCustomerShipment, recordProjectExpense, removeProjectExpense, projectExpenseSummary, recordSupplierInvoice, recordSupplierPayment, recordSupplierShipment, resetCustomerFinance, resetSupplierFinance } from "../../../src/modules/projects/daily-projects.ts";

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

test("rejects zero-value projects that could never accept a positive supplier invoice", () => {
  assert.throws(() => createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "0", origin: "Mombasa", destination: "Dubai" }, { id: "project-zero", now: "2026-11-14T10:00:00.000Z", sequence: 2 }), /INVALID_PROJECT_INPUT/);
  assert.throws(() => createProjectRecord({ customer: "Atlas Foods", reference: "AF-102", contractReference: "SC-45", startDate: "2026-11-14", commodity: "Coffee", quantity: "1e-200", unit: "MT", currency: "USD", unitPrice: "1e-200", origin: "Mombasa", destination: "Dubai" }, { id: "project-underflow", now: "2026-11-14T10:00:00.000Z", sequence: 3 }), /INVALID_PROJECT_INPUT/);
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
  assert.deepEqual(projectNextAction(updated, "en"), { label: "Review shipment handover", detail: "Review and confirm recorded customer shipment CS-001 before recording supplier finance.", href: "/projects/project-user-1/overview#customer-shipment" });
  assert.deepEqual(projectNextAction(updated, "ar"), { label: "مراجعة تسليم الشحنة", detail: "راجع وأكد شحنة العميل المسجلة CS-001 للانتقال إلى بيانات المورد المالية.", href: "/projects/project-user-1/overview#customer-shipment" });
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

test("reviews a customer shipment exactly once and advances Today to supplier invoicing", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(active, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  assert.equal(reviewed.customerShipmentReviewedAt, "2026-11-14T14:00:00.000Z");
  assert.equal(reviewed.updatedAt, "2026-11-14T14:00:00.000Z");
  assert.equal(projectNextAction(reviewed, "en")?.label, "Record supplier invoice");
  assert.equal(projectNextAction(reviewed, "ar")?.label, "تسجيل فاتورة المورد");
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


test("records a supplier invoice and full payment after shipment handover and advances Today", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  assert.equal(projectNextAction(reviewed, "en")?.label, "Record supplier invoice");
  assert.equal(projectNextAction(reviewed, "ar")?.label, "تسجيل فاتورة المورد");

  const invoiced = recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" }, "2026-11-14T15:00:00.000Z");
  assert.deepEqual(invoiced.supplierInvoice, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" });
  assert.equal(projectNextAction(invoiced, "en")?.label, "Record supplier payment");
  assert.equal(projectNextAction(invoiced, "ar")?.label, "تسجيل دفعة المورد");

  const paid = recordSupplierPayment(invoiced, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" }, "2026-11-14T16:00:00.000Z");
  assert.deepEqual(paid.supplierPayment, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" });
  assert.equal(projectNextAction(paid, "en")?.label, "Record customer invoice");
  assert.deepEqual(parseProjectRecords(JSON.stringify([paid])), [paid]);
});

test("invoice and payment writes reject impossible or duplicate financial records", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  assert.throws(() => recordSupplierInvoice(shipped, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "1" }, "2026-11-14T15:00:00.000Z"), /INVALID_SUPPLIER_INVOICE_STATE/);
  assert.throws(() => recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-04", amount: "50400" }, "2026-11-14T15:00:00.000Z"), /INVALID_SUPPLIER_INVOICE/);
  assert.throws(() => recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "84000.01" }, "2026-11-14T15:00:00.000Z"), /INVALID_SUPPLIER_INVOICE/);
  const invoiced = recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" }, "2026-11-14T15:00:00.000Z");
  assert.throws(() => recordSupplierInvoice(invoiced, { reference: "SI-002", invoiceDate: "2026-12-05", amount: "1" }, "2026-11-14T16:00:00.000Z"), /INVALID_SUPPLIER_INVOICE_STATE/);
  assert.throws(() => recordSupplierPayment(invoiced, { reference: "PAY-001", paymentDate: "2026-12-04", amount: "50400" }, "2026-11-14T16:00:00.000Z"), /INVALID_SUPPLIER_PAYMENT/);
  assert.throws(() => recordSupplierPayment(invoiced, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50399" }, "2026-11-14T16:00:00.000Z"), /INVALID_SUPPLIER_PAYMENT/);
  const paid = recordSupplierPayment(invoiced, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" }, "2026-11-14T16:00:00.000Z");
  assert.throws(() => recordSupplierPayment(paid, { reference: "PAY-002", paymentDate: "2026-12-07", amount: "50400" }, "2026-11-14T17:00:00.000Z"), /INVALID_SUPPLIER_PAYMENT_STATE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...reviewed, supplierPayment: { reference: "PAY-X", paymentDate: "2026-12-06", amount: "1" } }])), /CORRUPT_PROJECT_STORAGE/);
});


test("resets a mistaken supplier finance entry back to the invoice action", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-user-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  const invoiced = recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" }, "2026-11-14T15:00:00.000Z");
  const paid = recordSupplierPayment(invoiced, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" }, "2026-11-14T16:00:00.000Z");
  const reset = resetSupplierFinance(paid, paid.updatedAt, "2026-11-14T17:00:00.000Z");
  assert.equal(reset.supplierInvoice, undefined);
  assert.equal(reset.supplierPayment, undefined);
  assert.equal(reset.customerInvoice, undefined);
  assert.equal(reset.customerCollections, undefined);
  assert.equal(projectNextAction(reset, "en")?.label, "Record supplier invoice");
  assert.throws(() => resetSupplierFinance(paid, invoiced.updatedAt, "2026-11-14T17:00:00.000Z"), /INVALID_SUPPLIER_FINANCE_RESET_STATE/);
  assert.throws(() => resetSupplierFinance(reviewed, reviewed.updatedAt, "2026-11-14T17:00:00.000Z"), /INVALID_SUPPLIER_FINANCE_RESET_STATE/);
});


test("records a customer invoice and partial collections after supplier payment and advances Today", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-receivable-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  const invoicedSupplier = recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" }, "2026-11-14T15:00:00.000Z");
  const paidSupplier = recordSupplierPayment(invoicedSupplier, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" }, "2026-11-14T16:00:00.000Z");
  assert.equal(projectNextAction(paidSupplier, "en")?.label, "Record customer invoice");
  assert.equal(projectNextAction(paidSupplier, "ar")?.label, "تسجيل فاتورة العميل");

  const invoicedCustomer = recordCustomerInvoice(paidSupplier, { reference: "CI-001", invoiceDate: "2026-12-06", amount: "84000" }, "2026-11-14T17:00:00.000Z");
  assert.deepEqual(invoicedCustomer.customerInvoice, { reference: "CI-001", invoiceDate: "2026-12-06", amount: "84000" });
  assert.equal(projectNextAction(invoicedCustomer, "en")?.label, "Record customer collection");
  assert.equal(projectNextAction(invoicedCustomer, "ar")?.label, "تسجيل تحصيل من العميل");

  const partlyCollected = recordCustomerCollection(invoicedCustomer, { reference: "COL-001", collectionDate: "2026-12-07", amount: "30000" }, "2026-11-14T18:00:00.000Z");
  assert.deepEqual(partlyCollected.customerCollections, [{ reference: "COL-001", collectionDate: "2026-12-07", amount: "30000" }]);
  assert.match(projectNextAction(partlyCollected, "en")?.detail ?? "", /54,000 USD remains/);
  assert.match(projectNextAction(partlyCollected, "ar")?.detail ?? "", /54,000 USD/);

  const fullyCollected = recordCustomerCollection(partlyCollected, { reference: "COL-002", collectionDate: "2026-12-08", amount: "54000" }, "2026-11-14T19:00:00.000Z");
  assert.equal(projectNextAction(fullyCollected, "en")?.label, "Record project expense");
  assert.deepEqual(parseProjectRecords(JSON.stringify([fullyCollected])), [fullyCollected]);
});

test("customer receivables reject impossible, duplicate, stale, and over-collected records", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-101", contractReference: "SC-44", startDate: "2026-11-14", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", origin: "Mombasa", destination: "Dubai" }, { id: "project-receivable-2", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-44", purchaseContractReference: "PC-17" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-001", expectedArrival: "2026-12-02", quantity: "12" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-001", plannedDispatchDate: "2026-12-05", quantity: "10" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  const supplierInvoice = recordSupplierInvoice(reviewed, { reference: "SI-001", invoiceDate: "2026-12-05", amount: "50400" }, "2026-11-14T15:00:00.000Z");
  const paid = recordSupplierPayment(supplierInvoice, { reference: "PAY-001", paymentDate: "2026-12-06", amount: "50400" }, "2026-11-14T16:00:00.000Z");
  assert.throws(() => recordCustomerInvoice(supplierInvoice, { reference: "CI-X", invoiceDate: "2026-12-06", amount: "84000" }, "2026-11-14T17:00:00.000Z"), /INVALID_CUSTOMER_INVOICE_STATE/);
  assert.throws(() => recordCustomerInvoice(paid, { reference: "CI-X", invoiceDate: "2026-12-04", amount: "84000" }, "2026-11-14T17:00:00.000Z"), /INVALID_CUSTOMER_INVOICE/);
  assert.throws(() => recordCustomerInvoice(paid, { reference: "CI-X", invoiceDate: "2026-12-06", amount: "84000.01" }, "2026-11-14T17:00:00.000Z"), /INVALID_CUSTOMER_INVOICE/);
  const invoiced = recordCustomerInvoice(paid, { reference: "CI-001", invoiceDate: "2026-12-06", amount: "84000" }, "2026-11-14T17:00:00.000Z");
  assert.throws(() => recordCustomerInvoice(invoiced, { reference: "CI-002", invoiceDate: "2026-12-07", amount: "1" }, "2026-11-14T18:00:00.000Z"), /INVALID_CUSTOMER_INVOICE_STATE/);
  assert.throws(() => recordCustomerCollection(invoiced, { reference: "COL-X", collectionDate: "2026-12-05", amount: "1" }, "2026-11-14T18:00:00.000Z"), /INVALID_CUSTOMER_COLLECTION/);
  assert.throws(() => recordCustomerCollection(invoiced, { reference: "COL-X", collectionDate: "2026-12-07", amount: "84001" }, "2026-11-14T18:00:00.000Z"), /INVALID_CUSTOMER_COLLECTION/);
  assert.throws(() => recordCustomerCollection(invoiced, { reference: "COL-X", collectionDate: "2026-12-07", amount: "1" }, "2026-11-14T16:59:59.999Z"), /INVALID_CUSTOMER_COLLECTION/);
  const partial = recordCustomerCollection(invoiced, { reference: "COL-001", collectionDate: "2026-12-07", amount: "30000" }, "2026-11-14T18:00:00.000Z");
  assert.throws(() => recordCustomerCollection(partial, { reference: "COL-001", collectionDate: "2026-12-08", amount: "1" }, "2026-11-14T19:00:00.000Z"), /INVALID_CUSTOMER_COLLECTION/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...paid, customerCollections: [{ reference: "COL-X", collectionDate: "2026-12-07", amount: "1" }] }])), /CORRUPT_PROJECT_STORAGE/);
  assert.throws(() => parseProjectRecords(JSON.stringify([{ ...invoiced, customerCollections: [{ reference: "COL-X", collectionDate: "2026-12-07", amount: "84001" }] }])), /CORRUPT_PROJECT_STORAGE/);
});


test("customer collections use exact decimal arithmetic and reject stale eligible submissions", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-DEC", contractReference: "SC-DEC", startDate: "2026-11-14", commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "1", origin: "Mombasa", destination: "Dubai" }, { id: "project-decimal", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-DEC", purchaseContractReference: "PC-DEC" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-DEC", expectedArrival: "2026-12-02", quantity: "1" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-DEC", plannedDispatchDate: "2026-12-05", quantity: "1" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  const supplierInvoice = recordSupplierInvoice(reviewed, { reference: "SI-DEC", invoiceDate: "2026-12-05", amount: "0.3" }, "2026-11-14T15:00:00.000Z");
  const paid = recordSupplierPayment(supplierInvoice, { reference: "PAY-DEC", paymentDate: "2026-12-06", amount: "0.3" }, "2026-11-14T16:00:00.000Z");
  const invoiced = recordCustomerInvoice(paid, { reference: "CI-DEC", invoiceDate: "2026-12-06", amount: "0.3" }, "2026-11-14T17:00:00.000Z", paid.updatedAt);
  assert.throws(() => recordCustomerInvoice(paid, { reference: "CI-STALE", invoiceDate: "2026-12-06", amount: "0.3" }, "2026-11-14T17:00:00.000Z", reviewed.updatedAt), /INVALID_CUSTOMER_INVOICE_STATE/);
  const first = recordCustomerCollection(invoiced, { reference: "COL-DEC-1", collectionDate: "2026-12-07", amount: "0.1" }, "2026-11-14T18:00:00.000Z", invoiced.updatedAt);
  assert.deepEqual(customerReceivableSummary(first), { collected: "0.1", remaining: "0.2", complete: false });
  assert.throws(() => recordCustomerCollection(first, { reference: "COL-STALE", collectionDate: "2026-12-08", amount: "0.2" }, "2026-11-14T19:00:00.000Z", invoiced.updatedAt), /INVALID_CUSTOMER_COLLECTION_STATE/);
  const complete = recordCustomerCollection(first, { reference: "COL-DEC-2", collectionDate: "2026-12-08", amount: "0.2" }, "2026-11-14T19:00:00.000Z", first.updatedAt);
  assert.deepEqual(customerReceivableSummary(complete), { collected: "0.3", remaining: "0", complete: true });
  assert.equal(projectNextAction(complete, "en")?.label, "Record project expense");
  assert.deepEqual(parseProjectRecords(JSON.stringify([complete])), [complete]);
  const reset = resetCustomerFinance(complete, complete.updatedAt, "2026-11-14T20:00:00.000Z");
  assert.equal(reset.customerInvoice, undefined);
  assert.equal(reset.customerCollections, undefined);
  assert.deepEqual(reset.supplierInvoice, complete.supplierInvoice);
  assert.deepEqual(reset.supplierPayment, complete.supplierPayment);
  assert.equal(projectNextAction(reset, "en")?.label, "Record customer invoice");
  assert.throws(() => resetCustomerFinance(complete, first.updatedAt, "2026-11-14T20:00:00.000Z"), /INVALID_CUSTOMER_FINANCE_RESET_STATE/);
});


test("records user-entered project expenses after collection and advances Today to the expense task", () => {
  const setup = completeProjectSetup(
    createProjectRecord({ customer: "Atlas Foods", reference: "AF-EXP", contractReference: "SC-EXP", startDate: "2026-11-14", commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "100", origin: "Mombasa", destination: "Dubai" }, { id: "project-expense-1", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas Foods", supplier: "Coast Exporters", salesContractReference: "SC-EXP", purchaseContractReference: "PC-EXP" }, "2026-11-14T11:00:00.000Z",
  );
  const supplied = recordSupplierShipment(setup, { reference: "SS-EXP", expectedArrival: "2026-11-15", quantity: "1" }, "2026-11-14T12:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS-EXP", plannedDispatchDate: "2026-11-16", quantity: "1" }, "2026-11-14T13:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T14:00:00.000Z");
  const supplierInvoice = recordSupplierInvoice(reviewed, { reference: "SI-EXP", invoiceDate: "2026-11-16", amount: "70" }, "2026-11-14T15:00:00.000Z");
  const paid = recordSupplierPayment(supplierInvoice, { reference: "PAY-EXP", paymentDate: "2026-11-17", amount: "70" }, "2026-11-14T16:00:00.000Z");
  const customerInvoice = recordCustomerInvoice(paid, { reference: "CI-EXP", invoiceDate: "2026-11-17", amount: "100" }, "2026-11-14T17:00:00.000Z");
  const collected = recordCustomerCollection(customerInvoice, { reference: "COL-EXP", collectionDate: "2026-11-18", amount: "100" }, "2026-11-14T18:00:00.000Z");

  assert.deepEqual(projectNextAction(collected, "en"), { label: "Record project expense", detail: "Add the first direct cost paid for this project; ORB records it only and does not make a payment.", href: "/projects/project-expense-1/expenses" });
  assert.equal(projectNextAction(collected, "ar")?.label, "تسجيل مصروف للمشروع");

  const first = recordProjectExpense(collected, { reference: "EXP-001", occurredOn: "2026-11-18", category: "Freight", vendor: "Harbour Services", amount: "12.50" }, "2026-11-14T19:00:00.000Z", collected.updatedAt);
  const second = recordProjectExpense(first, { reference: "EXP-002", occurredOn: "2026-11-19", category: "Inspection", vendor: "Quality Lab", amount: "0.1" }, "2026-11-14T20:00:00.000Z", first.updatedAt);
  assert.deepEqual(projectExpenseSummary(second), { count: 2, total: "12.6" });
  assert.equal(projectNextAction(second, "en"), null);
  assert.deepEqual(parseProjectRecords(JSON.stringify([second])), [second]);

  const corrected = removeProjectExpense(second, "EXP-001", second.updatedAt, "2026-11-14T21:00:00.000Z");
  assert.deepEqual(projectExpenseSummary(corrected), { count: 1, total: "0.1" });
});

test("project expenses reject ineligible, duplicate, stale, malformed, and impossible records", () => {
  const project = createProjectRecord({ customer: "Atlas", reference: "AF-X", contractReference: "SC-X", startDate: "2026-11-14", commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "100", origin: "Mombasa", destination: "Dubai" }, { id: "project-expense-x", now: "2026-11-14T10:00:00.000Z", sequence: 1 });
  const input = { reference: "EXP-X", occurredOn: "2026-11-14", category: "Freight", vendor: "Harbour", amount: "1" };
  assert.throws(() => recordProjectExpense(project, input, "2026-11-14T11:00:00.000Z"), /INVALID_PROJECT_EXPENSE_STATE/);

  const malformed = { ...project, status: "ACTIVE" as const, supplier: "Supplier", purchaseContractReference: "PC-X", expenses: [{ ...input, amount: "0" }] };
  assert.throws(() => parseProjectRecords(JSON.stringify([malformed])), /CORRUPT_PROJECT_STORAGE/);

  const eligible = { ...project, status: "ACTIVE" as const, supplier: "Supplier", purchaseContractReference: "PC-X", supplierShipment: { reference: "SS", expectedArrival: "2026-11-14", quantity: "1" }, customerShipment: { reference: "CS", plannedDispatchDate: "2026-11-14", quantity: "1" }, customerShipmentReviewedAt: "2026-11-14T10:10:00.000Z", supplierInvoice: { reference: "SI", invoiceDate: "2026-11-14", amount: "1" }, supplierPayment: { reference: "SP", paymentDate: "2026-11-14", amount: "1" }, customerInvoice: { reference: "CI", invoiceDate: "2026-11-14", amount: "1" }, customerCollections: [{ reference: "CC", collectionDate: "2026-11-14", amount: "1" }], updatedAt: "2026-11-14T10:10:00.000Z" };
  const recorded = recordProjectExpense(eligible, input, "2026-11-14T11:00:00.000Z", eligible.updatedAt);
  assert.throws(() => recordProjectExpense(recorded, input, "2026-11-14T12:00:00.000Z", recorded.updatedAt), /INVALID_PROJECT_EXPENSE/);
  assert.throws(() => recordProjectExpense(recorded, { ...input, reference: "EXP-2", amount: "0" }, "2026-11-14T12:00:00.000Z", recorded.updatedAt), /INVALID_PROJECT_EXPENSE/);
  assert.throws(() => recordProjectExpense(recorded, { ...input, reference: "EXP-2", occurredOn: "2026-11-13" }, "2026-11-14T12:00:00.000Z", recorded.updatedAt), /INVALID_PROJECT_EXPENSE/);
  assert.throws(() => recordProjectExpense(recorded, { ...input, reference: "EXP-2" }, "2026-11-14T12:00:00.000Z", eligible.updatedAt), /INVALID_PROJECT_EXPENSE_STATE/);
  assert.throws(() => removeProjectExpense(recorded, "MISSING", recorded.updatedAt, "2026-11-14T12:00:00.000Z"), /INVALID_PROJECT_EXPENSE/);
  assert.throws(() => removeProjectExpense(recorded, "EXP-X", eligible.updatedAt, "2026-11-14T12:00:00.000Z"), /INVALID_PROJECT_EXPENSE_STATE/);
});


test("active projects accept direct expenses before finance and finance corrections preserve them", () => {
  const active = completeProjectSetup(
    createProjectRecord({ customer: "Atlas", reference: "AF-EARLY", contractReference: "SC-EARLY", startDate: "2026-11-14", commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "100", origin: "Mombasa", destination: "Dubai" }, { id: "project-expense-early", now: "2026-11-14T10:00:00.000Z", sequence: 1 }),
    { customer: "Atlas", supplier: "Supplier", salesContractReference: "SC-EARLY", purchaseContractReference: "PC-EARLY" }, "2026-11-14T11:00:00.000Z",
  );
  const withExpense = recordProjectExpense(active, { reference: "EXP-EARLY", occurredOn: "2026-11-15", category: "Freight", vendor: "Port", amount: "3" }, "2026-11-14T12:00:00.000Z");
  assert.deepEqual(parseProjectRecords(JSON.stringify([withExpense])), [withExpense]);

  const supplied = recordSupplierShipment(withExpense, { reference: "SS", expectedArrival: "2026-11-15", quantity: "1" }, "2026-11-14T13:00:00.000Z");
  const shipped = recordCustomerShipment(supplied, { reference: "CS", plannedDispatchDate: "2026-11-16", quantity: "1" }, "2026-11-14T14:00:00.000Z");
  const reviewed = markCustomerShipmentReviewed(shipped, "2026-11-14T15:00:00.000Z");
  const invoiced = recordSupplierInvoice(reviewed, { reference: "SI", invoiceDate: "2026-11-16", amount: "70" }, "2026-11-14T16:00:00.000Z");
  const paid = recordSupplierPayment(invoiced, { reference: "PAY", paymentDate: "2026-11-17", amount: "70" }, "2026-11-14T17:00:00.000Z");
  const customerInvoice = recordCustomerInvoice(paid, { reference: "CI", invoiceDate: "2026-11-17", amount: "100" }, "2026-11-14T18:00:00.000Z");
  const collected = recordCustomerCollection(customerInvoice, { reference: "COL", collectionDate: "2026-11-18", amount: "100" }, "2026-11-14T19:00:00.000Z");
  const customerReset = resetCustomerFinance(collected, collected.updatedAt, "2026-11-14T20:00:00.000Z");
  assert.deepEqual(customerReset.expenses, withExpense.expenses);
  assert.deepEqual(parseProjectRecords(JSON.stringify([customerReset])), [customerReset]);
  const supplierReset = resetSupplierFinance(customerReset, customerReset.updatedAt, "2026-11-14T21:00:00.000Z");
  assert.deepEqual(supplierReset.expenses, withExpense.expenses);
  assert.deepEqual(parseProjectRecords(JSON.stringify([supplierReset])), [supplierReset]);
});
