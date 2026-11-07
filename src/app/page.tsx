import { createInMemoryTodayQuery, REQUIRED_TODAY_ADAPTERS } from "../modules/dashboard/today-query";
import { TodayBlockers } from "../ui/features/dashboard/TodayBlockers";
const PROJECT = "019a6100-1000-7000-8000-000000000001";
const rows: Record<string, readonly Record<string, unknown>[]> = {
  approvals: [{ id: "approval-1", assignedUserId: "owner-1", projectId: PROJECT, occurredAt: "2026-11-07T09:00:00Z", severity: "ACTION", label: "Contract approval", operationId: "listFixedApprovalInbox", href: "/approvals" }],
  projects: [{ id: "project-1", projectId: PROJECT, occurredAt: "2026-11-07T12:00:00Z", severity: "INFO", label: "ORB-P-0001", operationId: "listProjects", href: `/projects/${PROJECT}/overview` }],
  routes: [{ id: "route-1", projectId: PROJECT, occurredAt: "2026-11-07T08:00:00Z", severity: "BLOCKING", label: "Route evidence incomplete", operationId: "getFixedRouteChecklist", href: "/sales-shipments/demo?tab=route" }],
  evidence: [{ id: "evidence-1", projectId: PROJECT, occurredAt: "2026-11-07T08:01:00Z", severity: "BLOCKING", label: "Required evidence missing", operationId: "getEvidenceMetadata", href: "/sales-shipments/demo?tab=evidence" }],
  documents: [{ id: "document-1", projectId: PROJECT, occurredAt: "2026-11-07T08:02:00Z", severity: "BLOCKING", label: "Document generation failed", operationId: "getDocumentGenerationStatus", href: "/documents/demo" }],
  outbound: [{ id: "outbound-1", projectId: PROJECT, occurredAt: "2026-11-07T08:03:00Z", severity: "BLOCKING", label: "Manifest not sent", operationId: "listOutboundSendAttempts", href: "/documents/demo" }],
  invoices: [{ id: "invoice-1", projectId: PROJECT, occurredAt: "2026-11-07T08:04:00Z", severity: "BLOCKING", label: "Invoice pending", operationId: "getOperationalStatement", href: `/projects/${PROJECT}/money` }],
  settlements: [{ id: "settlement-1", projectId: PROJECT, occurredAt: "2026-11-07T08:05:00Z", severity: "BLOCKING", label: "Settlement unallocated", operationId: "getOperationalStatement", href: `/projects/${PROJECT}/money` }],
  expenses: [{ id: "expense-1", projectId: PROJECT, occurredAt: "2026-11-07T08:06:00Z", severity: "BLOCKING", label: "Expense pending", operationId: "getOperationalStatement", href: `/projects/${PROJECT}/expenses` }],
  claims: [{ id: "claim-1", projectId: PROJECT, occurredAt: "2026-11-07T08:07:00Z", severity: "BLOCKING", label: "Claim pending", operationId: "assessProjectClosure", href: `/projects/${PROJECT}/claims` }],
  closure: [{ id: "closure-1", projectId: PROJECT, occurredAt: "2026-11-07T08:08:00Z", severity: "BLOCKING", label: "Closure blocked", operationId: "assessProjectClosure", href: `/projects/${PROJECT}/closure` }],
  audit: [{ id: "audit-1", projectId: PROJECT, occurredAt: "2026-11-07T08:09:00Z", severity: "CRITICAL", label: "Audit continuity failed", operationId: "listProjectAuditEvents", href: `/projects/${PROJECT}/audit` }],
  recovery: [{ id: "recovery-1", projectId: null, occurredAt: "2026-11-07T08:10:00Z", severity: "CRITICAL", label: "Backup RPO exceeded", operationId: "getBackupRecoveryStatus", href: "/admin/backup" }],
};
const adapters = Object.fromEntries(REQUIRED_TODAY_ADAPTERS.map((name) => [name, async () => rows[name]]));
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const query = await searchParams, locale = query.locale === "ar" ? "ar" : "en", ar = locale === "ar";
  const today = await createInMemoryTodayQuery({ now: () => "2026-11-07T12:30:00Z", adapters }).getToday({ principal: { userId: "owner-1", roles: ["OWNER_ADMIN"] }, recentProjectLimit: 5 });
  return <section dir={ar ? "rtl" : "ltr"} style={{ display: "grid", gap: 20 }}><h1>{ar ? "اليوم" : "Today"}</h1><TodayBlockers locale={locale} items={today.blockers} /><section role="region" aria-label={ar ? "المشروعات الأخيرة" : "Recent projects"}><h2>{ar ? "المشروعات الأخيرة" : "Recent projects"}</h2>{today.recentProjects.map((item) => <p key={item.id}><a href={item.source.href}>{item.label}</a></p>)}</section></section>;
}
