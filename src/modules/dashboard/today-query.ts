// @ts-expect-error Native Node TypeScript tests require source extensions.
import { orderAuthoritativeBlockers, toAuthoritativeBlocker, type AuthoritativeBlocker } from "./blocker-aggregation.ts";

export const REQUIRED_TODAY_ADAPTERS = Object.freeze([
  "approvals", "projects", "routes", "evidence", "documents", "outbound", "invoices",
  "settlements", "expenses", "claims", "closure", "audit", "recovery",
] as const);

type AdapterName = typeof REQUIRED_TODAY_ADAPTERS[number];
type SourceRow = Readonly<Record<string, unknown>>;
type SourceAdapter = () => Promise<readonly SourceRow[]>;
interface Principal { readonly userId: string; readonly roles: readonly string[] }

function isOwner(principal: Principal): boolean { return principal.roles.includes("OWNER_ADMIN"); }
function visible(family: AdapterName, row: SourceRow, principal: Principal): boolean {
  if (family === "approvals") return row.assignedUserId === principal.userId && !principal.roles.includes("FINANCE_VIEWER");
  if (family === "recovery") return isOwner(principal);
  return family !== "projects";
}
function recentProject(row: SourceRow) {
  const id = String(row.id ?? ""), label = String(row.label ?? ""), operationId = String(row.operationId ?? ""), href = String(row.href ?? "");
  if (!id || !label || !operationId || !href.startsWith("/")) throw new TypeError("invalid authoritative recent project");
  return Object.freeze({ id, projectId: row.projectId ?? null, label, occurredAt: String(row.occurredAt ?? ""), source: Object.freeze({ operationId, href }) });
}

export function createInMemoryTodayQuery(options: { readonly now: () => string; readonly adapters: Record<string, SourceAdapter> }) {
  for (const name of REQUIRED_TODAY_ADAPTERS) if (typeof options.adapters[name] !== "function") throw new TypeError(`missing Today source adapter: ${name}`);
  const adapters = Object.fromEntries(REQUIRED_TODAY_ADAPTERS.map((name) => [name, options.adapters[name]])) as Record<AdapterName, SourceAdapter>;
  return Object.freeze({
    async getToday(input: { readonly principal: Principal; readonly recentProjectLimit: number }) {
      if (!Number.isSafeInteger(input.recentProjectLimit) || input.recentProjectLimit < 0) throw new RangeError("recentProjectLimit must be a non-negative integer");
      const result = await Promise.all(REQUIRED_TODAY_ADAPTERS.map(async (name) => [name, await adapters[name]()] as const));
      const rows = Object.fromEntries(result) as Record<AdapterName, readonly SourceRow[]>;
      const blockers: AuthoritativeBlocker[] = [];
      for (const family of REQUIRED_TODAY_ADAPTERS) {
        if (family === "projects") continue;
        for (const row of rows[family]) if (visible(family, row, input.principal)) blockers.push(toAuthoritativeBlocker(family, row));
      }
      const recentProjects = rows.projects.map(recentProject)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || left.id.localeCompare(right.id))
        .slice(0, input.recentProjectLimit);
      return Object.freeze({ generatedAt: options.now(), blockers: orderAuthoritativeBlockers(blockers), recentProjects: Object.freeze(recentProjects) });
    },
  });
}
