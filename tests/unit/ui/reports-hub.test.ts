import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildReportDestinations,
  buildReportFilterAction,
  type ReportFilter,
} from "../../../src/ui/features/reports/reports-hub.ts";

const filter: ReportFilter = {
  locale: "en",
  role: "finance",
  projectId: "pilot/project",
  from: "2026-11-01",
  to: "2026-11-30",
};

test("Reports hub exposes the approved operational reports with typed API filters", () => {
  assert.deepEqual(buildReportDestinations(filter).map(({ key, apiHref }) => [key, apiHref]), [
    ["productMovement", "/reports/product-movement?locale=en&role=finance&projectId=pilot%2Fproject&from=2026-11-01&to=2026-11-30"],
    ["contractFulfillment", "/api/reports/contract-fulfillment?projectId=pilot%2Fproject&from=2026-11-01&to=2026-11-30"],
    ["accounts", "/api/reports/accounts?projectId=pilot%2Fproject&from=2026-11-01&to=2026-11-30"],
    ["projectProfitability", "/api/reports/project-profitability?projectId=pilot%2Fproject&from=2026-11-01&to=2026-11-30"],
  ]);
});

test("Reports hub filter action preserves locale and permission context and omits blank filters", () => {
  assert.equal(buildReportFilterAction({ locale: "ar", role: "finance", projectId: "", from: "", to: "" }), "/reports?locale=ar&role=finance");
  assert.deepEqual(buildReportDestinations({ locale: "ar" }).map(({ label }) => label), [
    "حركة المنتج", "تنفيذ العقود", "الحسابات", "ربحية المشروع",
  ]);
});

test("Reports is an independent bilingual primary destination with operational-only semantics", () => {
  const page = readFileSync("src/ui/features/reports/ReportsHubPage.tsx", "utf8");
  const route = readFileSync("src/app/reports/page.tsx", "utf8");
  const navigation = readFileSync("src/ui/navigation/AppNavigation.tsx", "utf8");
  assert.match(route, /ReportsHubPage/);
  assert.match(page, /Reports hub/);
  assert.match(page, /مركز التقارير/);
  assert.match(page, /Operational reports/);
  assert.match(page, /تقارير تشغيلية/);
  assert.match(page, /No general ledger, stock balance or inventory valuation/);
  assert.match(navigation, /href={`\/reports\$\{suffix}`}/);
  assert.match(navigation, /pathname\.startsWith\("\/reports"\)/);
});
