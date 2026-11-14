import assert from "node:assert/strict";
import test from "node:test";
import { createProjectRecord, parseProjectRecords, projectNextAction } from "../../../src/modules/projects/daily-projects.ts";

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
  assert.deepEqual(projectNextAction("SETUP", "en", "project-user-1"), { label: "Review project setup", detail: "Confirm the customer, contract, and route saved for this project.", href: "/projects/project-user-1/overview#project-data" });
  assert.deepEqual(projectNextAction("SETUP", "ar", "project-user-1"), { label: "مراجعة إعداد المشروع", detail: "راجع العميل والعقد والمسار المحفوظة لهذا المشروع.", href: "/projects/project-user-1/overview#project-data" });
});
