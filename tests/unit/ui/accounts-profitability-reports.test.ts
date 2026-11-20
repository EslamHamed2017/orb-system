import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Accounts and profitability report pages are bilingual, read live data and link back to projects", () => {
  const accountsPage = readFileSync("src/ui/features/reports/AccountsReportLive.tsx", "utf8");
  const profitabilityPage = readFileSync("src/ui/features/reports/ProfitabilityReportLive.tsx", "utf8");
  const accountsRoute = readFileSync("src/app/reports/accounts/page.tsx", "utf8");
  const profitabilityRoute = readFileSync("src/app/reports/project-profitability/page.tsx", "utf8");
  assert.match(accountsRoute, /AccountsReportLive/);
  assert.match(profitabilityRoute, /ProfitabilityReportLive/);
  assert.match(accountsPage, /Accounts operational report/);
  assert.match(accountsPage, /تقرير الحسابات التشغيلي/);
  assert.match(profitabilityPage, /Project profitability report/);
  assert.match(profitabilityPage, /تقرير ربحية المشروع/);
  assert.match(accountsPage, /\/api\/reports\/accounts/);
  assert.match(profitabilityPage, /\/api\/reports\/project-profitability/);
  assert.match(accountsPage, /\/projects\/\$\{r\.projectId\}\/overview/);
  assert.match(profitabilityPage, /\/projects\/\$\{r\.project\.id\}\/profit/);
  assert.doesNotMatch(accountsPage, /general ledger/i);
  assert.doesNotMatch(`${accountsPage}${profitabilityPage}`, /inventory valuation|const ROWS/i);
});
