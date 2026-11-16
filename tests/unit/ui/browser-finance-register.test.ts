import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildBrowserFinanceRows, type BrowserFinanceKind } from "../../../src/ui/features/accounts/browser-finance-register.ts";
import { parseProjectRecords, type ProjectRecord } from "../../../src/modules/projects/daily-projects.ts";

const project: ProjectRecord = {
  id: "project-close-1", code: "ORB-P-0099", customer: "Atlas Foods", supplier: "Coast Exporters", reference: "AF-101", contractReference: "SC-44", purchaseContractReference: "PC-17",
  startDate: "2026-11-01", commodity: "Coffee", quantity: "20", unit: "MT", currency: "USD", unitPrice: "4200", value: 84000, origin: "Mombasa", destination: "Dubai", status: "ACTIVE",
  supplierShipment: { reference: "SS-001", expectedArrival: "2026-11-02", quantity: "20" }, customerShipment: { reference: "CS-001", plannedDispatchDate: "2026-11-05", quantity: "20" }, customerShipmentReviewedAt: "2026-11-05T10:00:00.000Z",
  supplierInvoice: { reference: "SI-001", invoiceDate: "2026-11-05", amount: "80000" }, supplierPayment: { reference: "SP-001", paymentDate: "2026-11-06", amount: "80000" },
  customerInvoice: { reference: "CI-001", invoiceDate: "2026-11-06", amount: "84000" }, customerCollections: [{ reference: "COL-002", collectionDate: "2026-11-08", amount: "44000" }, { reference: "COL-001", collectionDate: "2026-11-07", amount: "40000" }],
  expenses: [{ reference: "EXP-001", occurredOn: "2026-11-07", category: "Freight", vendor: "Port Services", amount: "1200" }], claims: [],
  createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-08T12:00:00.000Z",
};

const expected: Readonly<Record<BrowserFinanceKind, readonly string[]>> = {
  supplierInvoices: ["SI-001"], supplierPayments: ["SP-001"], salesInvoices: ["CI-001"], collections: ["COL-002", "COL-001"], expenses: ["EXP-001"],
};

for (const kind of Object.keys(expected) as BrowserFinanceKind[]) test(`${kind} uses only persisted project finance records`, () => {
  const rows = buildBrowserFinanceRows([project], kind);
  assert.deepEqual(rows.map((row) => row.reference), expected[kind]);
  assert.ok(rows.every((row) => row.projectId === project.id && row.currency === "USD"));
  assert.ok(rows.every((row) => row.taskHref.startsWith(`/projects/${project.id}/`)));
});

test("browser finance register scopes to the requested project and exposes business states", () => {
  assert.equal(buildBrowserFinanceRows([project], "supplierInvoices", "missing").length, 0);
  assert.equal(buildBrowserFinanceRows([project], "supplierInvoices", project.id)[0]?.state, "paid");
  assert.equal(buildBrowserFinanceRows([project], "salesInvoices")[0]?.state, "collected");
});

test("browser finance register has bilingual truthful states and no known fixture presentation", () => {
  const salesInvoices = readFileSync("src/app/accounts/sales-invoices/page.tsx", "utf8");
  assert.doesNotMatch(salesInvoices, /readonly role\?: string|query\.role/);
  assert.match(salesInvoices, /canUpload={false}/);
  const component = readFileSync("src/ui/features/accounts/BrowserFinanceRegisterPage.tsx", "utf8");
  assert.match(component, /Loading saved records/);
  assert.match(component, /جارٍ تحميل السجلات المحفوظة/);
  assert.match(component, /No saved records yet/);
  assert.match(component, /لا توجد سجلات محفوظة بعد/);
  assert.match(component, /Stored only in this browser/);
  assert.doesNotMatch(component, /SINV-2026-014|PINV-2026-031|COL-2026-014|PAY-2026-031|EXP-2026-018|CONFIRMED|POSTED|APPROVED/);
});


test("six-decimal customer balances remain exact", () => {
  const precise = { ...project, customerInvoice: { reference: "CI-PRECISE", invoiceDate: "2026-11-06", amount: "100.123456" }, customerCollections: [{ reference: "COL-PRECISE", collectionDate: "2026-11-07", amount: "40.123455" }] };
  const row = buildBrowserFinanceRows([precise], "salesInvoices")[0];
  assert.equal(row?.state, "partiallyCollected");
  assert.equal(row?.detail, "60.000001");
});

test("duplicate persisted project IDs fail closed", () => {
  assert.throws(() => parseProjectRecords(JSON.stringify([project, { ...project, code: "ORB-P-DUPLICATE" }])), /CORRUPT_PROJECT_STORAGE/);
});

test("legacy finance routes preserve role context while persisted sales invoices reject query-role authority", () => {
  for (const route of ["supplier-invoices", "supplier-payments", "collections", "expenses"]) {
    const source = readFileSync(`src/app/accounts/${route}/page.tsx`, "utf8");
    assert.match(source, /readonly role\?: string/);
    assert.match(source, /canUpload={query\.role !== "finance-viewer"}/);
  }
  const salesInvoices = readFileSync("src/app/accounts/sales-invoices/page.tsx", "utf8");
  assert.doesNotMatch(salesInvoices, /readonly role\?: string|query\.role/);
  assert.match(salesInvoices, /canUpload={false}/);
  const component = readFileSync("src/ui/features/accounts/BrowserFinanceRegisterPage.tsx", "utf8");
  assert.match(component, /queryFor\(locale, role\)/);
});


test("finance hub ignores caller roles while legacy saved project destinations remain fail closed", () => {
  const accountsRoute = readFileSync("src/app/accounts/page.tsx", "utf8");
  const hub = readFileSync("src/ui/features/accounts/AccountsHubPage.tsx", "utf8");
  const overview = readFileSync("src/app/projects/[id]/overview/page.tsx", "utf8");
  const detail = readFileSync("src/ui/features/projects/SavedProjectDetail.tsx", "utf8");
  assert.doesNotMatch(accountsRoute, /role|query\.role/);
  assert.doesNotMatch(hub, /role\?: string/);
  assert.match(overview, /canMutate=\{query\.role !== "finance-viewer"\}/);
  assert.match(detail, /if \(!canMutate\) throw new Error\("READ_ONLY_ROLE"\)/);
  assert.match(detail, /canMutate \? project\.supplierPayment/);
  assert.match(detail, /canMutate \? project\.customerInvoice/);
  assert.match(detail, /`\$\{nextPath\}\$\{contextQuery\}/);
  const expenses = readFileSync("src/ui/features/projects/SavedProjectExpenses.tsx", "utf8");
  assert.match(expenses, /overview\$\{contextQuery\}/);
});
