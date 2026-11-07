import assert from "node:assert/strict";
import test from "node:test";

const OWNER = Object.freeze({ userId: "owner-1", roles: ["OWNER_ADMIN"] });
const OPERATIONS = Object.freeze({ userId: "operations-1", roles: ["OPERATIONS"] });
const FINANCE = Object.freeze({ userId: "finance-1", roles: ["FINANCE_VIEWER"] });
const PROJECT_ID = "019a6100-1000-7000-8000-000000000001";

const requiredAdapters = [
  "approvals", "projects", "routes", "evidence", "documents", "outbound", "invoices",
  "settlements", "expenses", "claims", "closure", "audit", "recovery",
] as const;
type AdapterName = typeof requiredAdapters[number];
type Principal = Readonly<{ userId: string; roles: readonly string[] }>;
type TodayModule = {
  REQUIRED_TODAY_ADAPTERS: readonly string[];
  createInMemoryTodayQuery(options: { now: () => string; adapters: Record<string, () => Promise<readonly Record<string, unknown>[]>> }): {
    getToday(input: { principal: Principal; recentProjectLimit: number }): Promise<any>;
  };
};

type MutableRow = Record<string, unknown> & { active: boolean };
function completeFixture() {
  const rows: Record<AdapterName, MutableRow[]> = {
    approvals: [{ id: "approval-1", active: true, assignedUserId: OPERATIONS.userId, projectId: PROJECT_ID, occurredAt: "2026-11-07T09:00:00Z", severity: "ACTION", label: "Contract approval", operationId: "listFixedApprovalInbox", href: "/approvals" }],
    projects: [{ id: "project-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T12:00:00Z", severity: "INFO", label: "Recent project", operationId: "listProjects", href: `/projects/${PROJECT_ID}/overview` }],
    routes: [{ id: "route-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:00:00Z", severity: "BLOCKING", label: "Route evidence incomplete", operationId: "getFixedRouteChecklist", href: "/sales-shipments/sales-1?tab=route" }],
    evidence: [{ id: "evidence-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:01:00Z", severity: "BLOCKING", label: "Required evidence missing", operationId: "getEvidenceMetadata", href: "/sales-shipments/sales-1?tab=evidence" }],
    documents: [{ id: "document-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:02:00Z", severity: "BLOCKING", label: "Document generation failed", operationId: "getDocumentGenerationStatus", href: "/documents/document-1" }],
    outbound: [{ id: "outbound-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:03:00Z", severity: "BLOCKING", label: "Approved manifest not sent", operationId: "listOutboundSendAttempts", href: "/documents/document-1" }],
    invoices: [{ id: "invoice-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:04:00Z", severity: "BLOCKING", label: "Supplier invoice pending", operationId: "getOperationalStatement", href: `/projects/${PROJECT_ID}/money` }],
    settlements: [{ id: "settlement-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:05:00Z", severity: "BLOCKING", label: "Settlement unallocated", operationId: "getOperationalStatement", href: `/projects/${PROJECT_ID}/money` }],
    expenses: [{ id: "expense-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:06:00Z", severity: "BLOCKING", label: "Expense correction pending", operationId: "getOperationalStatement", href: `/projects/${PROJECT_ID}/expenses` }],
    claims: [{ id: "claim-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:07:00Z", severity: "BLOCKING", label: "Claim outcome pending", operationId: "assessProjectClosure", href: `/projects/${PROJECT_ID}/claims` }],
    closure: [{ id: "closure-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:08:00Z", severity: "BLOCKING", label: "Project closure blocked", operationId: "assessProjectClosure", href: `/projects/${PROJECT_ID}/closure` }],
    audit: [{ id: "audit-1", active: true, projectId: PROJECT_ID, occurredAt: "2026-11-07T08:09:00Z", severity: "CRITICAL", label: "Audit continuity failed", operationId: "listProjectAuditEvents", href: `/projects/${PROJECT_ID}/audit` }],
    recovery: [{ id: "recovery-1", active: true, projectId: null, occurredAt: "2026-11-07T08:10:00Z", severity: "CRITICAL", label: "Backup RPO exceeded", operationId: "getBackupRecoveryStatus", href: "/admin/backup", ownerOnly: true }],
  };
  const adapters = Object.fromEntries(requiredAdapters.map((name) => [name, async () => rows[name].filter((row) => row.active).map((row) => structuredClone(row))]));
  return { rows, adapters };
}
async function moduleUnderTest(): Promise<TodayModule> {
  const modulePath = "../../../src/modules/dashboard/today-query.ts";
  return import(modulePath) as Promise<TodayModule>;
}

 test("Today query declares every authoritative source adapter exactly once", async () => {
  const module = await moduleUnderTest();
  assert.deepEqual(module.REQUIRED_TODAY_ADAPTERS, requiredAdapters);
});

test("Today query fails closed when any one source adapter is omitted", async () => {
  const module = await moduleUnderTest();
  for (const omitted of requiredAdapters) {
    const { adapters } = completeFixture();
    delete adapters[omitted];
    assert.throws(() => module.createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters }),
      new RegExp(`missing Today source adapter: ${omitted}`));
  }
});

test("Today includes every blocker family, assigned exact approvals and recent Projects with direct authoritative links", async () => {
  const module = await moduleUnderTest();
  const { adapters } = completeFixture();
  const result = await module.createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters })
    .getToday({ principal: OPERATIONS, recentProjectLimit: 5 });
  assert.deepEqual(result.generatedAt, "2026-11-07T12:30:00Z");
  assert.deepEqual(result.blockers.map((item: any) => item.family), [
    "audit", "routes", "evidence", "documents", "outbound", "invoices", "settlements", "expenses", "claims", "closure", "approvals",
  ]);
  assert.deepEqual(result.recentProjects.map((item: any) => item.id), ["project-1"]);
  for (const item of [...result.blockers, ...result.recentProjects]) {
    assert.match(item.source.operationId, /^(list|get|assess)/);
    assert.match(item.source.href, /^\//);
    assert.ok(!Object.hasOwn(item, "computedState"), `${item.id} must not fabricate aggregate state`);
  }
  assert.equal(result.blockers.filter((item: any) => item.family === "approvals").length, 1);
});

test("role shaping excludes another user's approvals and Owner-only recovery without leaking hidden rows", async () => {
  const module = await moduleUnderTest();
  const fixture = completeFixture();
  fixture.rows.approvals.push({ ...fixture.rows.approvals[0], id: "approval-owner", assignedUserId: OWNER.userId });
  const query = module.createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters: fixture.adapters });
  const operations = await query.getToday({ principal: OPERATIONS, recentProjectLimit: 5 });
  assert.equal(operations.blockers.some((item: any) => item.id === "approval-owner"), false);
  assert.equal(operations.blockers.some((item: any) => item.family === "recovery"), false);
  const owner = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  assert.equal(owner.blockers.some((item: any) => item.id === "approval-1"), false);
  assert.equal(owner.blockers.some((item: any) => item.id === "approval-owner"), true);
  assert.equal(owner.blockers.some((item: any) => item.family === "recovery"), true);
  const finance = await query.getToday({ principal: FINANCE, recentProjectLimit: 5 });
  assert.equal(finance.blockers.some((item: any) => item.family === "approvals" || item.family === "recovery"), false);
  assert.equal(finance.blockers.some((item: any) => item.family === "settlements"), true);
});

test("stable ordering is severity then authoritative time then stable identity, independent of adapter completion order", async () => {
  const module = await moduleUnderTest();
  const fixture = completeFixture();
  fixture.rows.audit[0].occurredAt = "2026-11-07T08:10:00Z";
  const delayed = Object.fromEntries(Object.entries(fixture.adapters).reverse().map(([name, adapter], index) => [name, async () => {
    await new Promise((resolve) => setTimeout(resolve, index % 3));
    return adapter();
  }]));
  const query = module.createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters: delayed });
  const first = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  const second = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  assert.deepEqual(first.blockers.map((item: any) => item.id), second.blockers.map((item: any) => item.id));
  assert.deepEqual(first.blockers.slice(0, 2).map((item: any) => item.id), ["audit-1", "recovery-1"]);
});

test("stale or resolved items disappear only after their authoritative adapter changes state", async () => {
  const module = await moduleUnderTest();
  const fixture = completeFixture();
  const query = module.createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters: fixture.adapters });
  const before = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  assert.equal(before.blockers.some((item: any) => item.id === "route-1"), true);
  assert.equal(before.blockers.some((item: any) => item.id === "closure-1"), true);
  const unrelated = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  assert.equal(unrelated.blockers.some((item: any) => item.id === "route-1"), true);
  fixture.rows.routes[0].active = false;
  fixture.rows.closure[0].active = false;
  const after = await query.getToday({ principal: OWNER, recentProjectLimit: 5 });
  assert.equal(after.blockers.some((item: any) => item.id === "route-1"), false);
  assert.equal(after.blockers.some((item: any) => item.id === "closure-1"), false);
});
