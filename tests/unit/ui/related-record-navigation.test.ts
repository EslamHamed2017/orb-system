import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectContextLinks, projectContextCopy, projectTabFor } from "../../../src/ui/navigation/project-context-links.ts";

test("project record navigation exposes the five QuickBooks-style project tabs", () => {
  const links = buildProjectContextLinks("en", "project-7");
  assert.deepEqual(links.map(({ key, label }) => [key, label]), [["overview", "Overview"], ["transactions", projectContextCopy.en.transactions], ["shipments", projectContextCopy.en.shipments], ["reports", projectContextCopy.en.reports], ["documents", "Attachments"]]);
  assert.deepEqual(links.map(({ href }) => href), ["overview", "transactions", "shipments", "profit", "documents"].map((p) => `/projects/project-7/${p}?locale=en`));
  assert.equal(projectTabFor("contracts"), "overview");
  assert.equal(projectTabFor("expenses"), "transactions");
  assert.equal(projectTabFor("claims"), "transactions");
  assert.equal(projectTabFor("salesShipment"), "shipments");
  assert.equal(projectTabFor("closure"), null);
});

test("Arabic project navigation preserves canonical labels, locale and encoded project context", () => {
  const links = buildProjectContextLinks("ar", "مشروع ٧");
  assert.equal(projectContextCopy.ar.breadcrumb, "مسار التنقل");
  assert.equal(links[4].label, "المرفقات");
  assert.equal(links[0].href, "/projects/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%20%D9%A7/overview?locale=ar");
  assert.ok(links.every(({ href }) => href.includes("locale=ar")));
});
