import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAttachmentSourceHref,
  filterAttachments,
  type AttachmentIndexItem,
} from "../../../src/ui/features/evidence/attachments-index.ts";

const items: readonly AttachmentIndexItem[] = [
  { id: "evidence-2", projectId: "project-2", projectReference: "PRJ-002", subjectType: "EXPENSE", subjectId: "expense-2", subjectReference: "EXP-002", purpose: "Freight receipt", originalFilename: "freight.pdf", mediaType: "application/pdf", byteLength: 1200, uploadedAt: "2026-11-11T12:00:00.000Z", verificationState: "VERIFIED" },
  { id: "evidence-1", projectId: "project-1", projectReference: "PRJ-001", subjectType: "CONTRACT", subjectId: "contract-1", subjectReference: "SAL-001", purpose: "Signed contract", originalFilename: "signed.pdf", mediaType: "application/pdf", byteLength: 900, uploadedAt: "2026-11-12T12:00:00.000Z", verificationState: "PENDING" },
  { id: "evidence-3", projectId: "project-1", projectReference: "PRJ-001", subjectType: "SALES_SHIPMENT", subjectId: "shipment-1", subjectReference: "SSH-001", purpose: "Delivery proof", originalFilename: "delivery.jpg", mediaType: "image/jpeg", byteLength: 800, uploadedAt: "2026-11-10T12:00:00.000Z", verificationState: "VERIFIED" },
];

test("attachment index filters fail closed by project and combine type, state and search", () => {
  assert.deepEqual(filterAttachments(items, { projectId: "project-1" }).map((item) => item.id), ["evidence-1", "evidence-3"]);
  assert.deepEqual(filterAttachments(items, { projectId: "project-1", subjectType: "SALES_SHIPMENT", verificationState: "VERIFIED", query: "delivery" }).map((item) => item.id), ["evidence-3"]);
  assert.deepEqual(filterAttachments(items, { query: "exp-002" }).map((item) => item.id), ["evidence-2"]);
  assert.throws(() => filterAttachments(items, { projectId: " " }), /Project filter cannot be blank/);
});

test("every pilot attachment subject maps to its exact source transaction", () => {
  const cases = [
    ["CONTRACT", "/projects/project%2F1/contracts?locale=ar&recordId=subject%2F1"],
    ["SALES_SHIPMENT", "/sales-shipments/subject%2F1?locale=ar&projectId=project%2F1"],
    ["SUPPLIER_CONTAINER", "/supplier-shipments/subject%2F1?locale=ar&projectId=project%2F1"],
    ["SALES_INVOICE", "/accounts/sales-invoices?locale=ar&projectId=project%2F1&recordId=subject%2F1"],
    ["SUPPLIER_INVOICE", "/accounts/supplier-invoices?locale=ar&projectId=project%2F1&recordId=subject%2F1"],
    ["MONEY_MOVEMENT", "/projects/project%2F1/money?locale=ar&recordId=subject%2F1"],
    ["EXPENSE", "/accounts/expenses?locale=ar&projectId=project%2F1&recordId=subject%2F1"],
    ["CLAIM", "/projects/project%2F1/claims?locale=ar&recordId=subject%2F1"],
  ] as const;
  for (const [subjectType, expected] of cases) assert.equal(buildAttachmentSourceHref({ subjectType, subjectId: "subject/1", projectId: "project/1", locale: "ar" }), expected);
});

test("central attachment index is bilingual, authorized, filterable, and links evidence to source", () => {
  const component = readFileSync("src/ui/features/evidence/AttachmentsIndexPage.tsx", "utf8");
  const route = readFileSync("src/app/attachments/page.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.match(route, /AttachmentsIndexPage/);
  assert.match(route, /projectId/);
  assert.match(component, /data-operation-id="listEvidence"/);
  assert.match(component, /data-backend-endpoint="\/api\/evidence"/);
  assert.match(component, /Central attachments index/);
  assert.match(component, /فهرس المرفقات المركزي/);
  assert.match(component, /name="projectId"/);
  assert.match(component, /name="subjectType"/);
  assert.match(component, /name="verificationState"/);
  assert.match(component, /buildAttachmentSourceHref/);
  assert.match(component, /`\/evidence\/\${item.id}\?locale=\${locale}`/);
  assert.match(component, /`\/api\/evidence\/\${item.id}\/content\?disposition=attachment`/);
  assert.match(navigation, /href={`\/attachments\${suffix}`}/);
});
