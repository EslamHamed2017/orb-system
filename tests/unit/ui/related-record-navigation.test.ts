import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectContextLinks, projectContextCopy } from "../../../src/ui/navigation/project-context-links.ts";

test("project record navigation exposes exact bidirectional related-record links", () => {
  const links = buildProjectContextLinks("en", "project-7");
  assert.deepEqual(links.map(({ key }) => key), ["overview", "contracts", "supplierContainer", "salesShipment", "accounts", "expenses", "claims", "closure", "audit", "reports"]);
  assert.equal(links[0].href, "/projects/project-7/overview?locale=en");
  assert.equal(links[1].href, "/projects/project-7/contracts?locale=en");
  assert.equal(links[2].href, "/projects/project-7/shipments?locale=en#supplier-dataset");
  assert.equal(links[3].href, "/projects/project-7/shipments?locale=en#sales-dataset");
  assert.equal(links[4].href, "/projects/project-7/money?locale=en");
  assert.equal(links[5].href, "/projects/project-7/expenses?locale=en");
  assert.equal(links[6].href, "/projects/project-7/claims?locale=en");
  assert.equal(links[7].href, "/projects/project-7/closure?locale=en");
  assert.equal(links[8].href, "/projects/project-7/audit?locale=en");
  assert.equal(links[9].href, "/projects/project-7/profit?locale=en");
});

test("Arabic project navigation preserves canonical labels, locale and encoded project context", () => {
  const links = buildProjectContextLinks("ar", "مشروع ٧");
  assert.equal(projectContextCopy.ar.breadcrumb, "مسار التنقل");
  assert.equal(projectContextCopy.ar.project, "المشروع");
  assert.equal(links[2].label, "حاوية الموردين");
  assert.equal(links[3].label, "شحنة البيع");
  assert.equal(links[0].href, "/projects/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%20%D9%A7/overview?locale=ar");
  assert.ok(links.every(({ href }) => href.includes("locale=ar")));
});
