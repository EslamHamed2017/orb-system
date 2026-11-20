// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PROFIT_FORMULA_VERSION, type PrismaProfitStore, type ProjectProfit } from "./profit-store.ts";
import type { PrismaShipmentQueueStore } from "../shipments/shipment-queue-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

/** Profit shows sales prices against costs, so it is for the Owner administrator and Finance only. */
const FINANCE = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const ALL = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireRole(actor: ShipmentActor, roles: readonly string[]) {
  if (!actor.roles.some((role) => roles.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot see this.");
}

/** The ProfitView contract fields plus the detail the pages show. */
function view(profit: ProjectProfit) {
  const money = (amount: string) => ({ amount, currency: profit.project.currency });
  return {
    expectedMargin: money(profit.measures.expected.amount),
    committedMargin: money(profit.measures.shipped.amount),
    actualOperationalMargin: money(profit.measures.actual.amount),
    cashPosition: money(profit.measures.cash.amount),
    ...profit,
  };
}

export function createProfitService(profits: Pick<PrismaProfitStore, "projectProfit" | "listProjectIds">, shipments: Pick<PrismaShipmentQueueStore, "list">) {
  return Object.freeze({
    async projectProfit(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, FINANCE);
      if (typeof projectId !== "string" || !UUID.test(projectId)) throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", "Project not found");
      const profit = await profits.projectProfit(actor.tenantId, projectId);
      if (!profit) throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", "Project not found");
      return view(profit);
    },

    /** Project profitability report: one row per active project, the four measures side by side. */
    async profitabilityReport(actor: ShipmentActor, projectId?: string) {
      requireRole(actor, FINANCE);
      const ids = projectId ? [projectId] : await profits.listProjectIds(actor.tenantId);
      const rows = (await Promise.all(ids.map((id) => profits.projectProfit(actor.tenantId, id)))).filter((row): row is ProjectProfit => row !== null);
      return {
        reportType: "PROJECT_PROFITABILITY", formulaVersion: PROFIT_FORMULA_VERSION, generatedAt: new Date().toISOString(),
        rows: rows.map((p) => ({
          project: p.project, rate: p.rate, warnings: p.warnings.length,
          expected: p.measures.expected, shipped: p.measures.shipped, actual: p.measures.actual, cash: p.measures.cash,
        })),
      };
    },

    async shipmentQueue(actor: ShipmentActor) {
      requireRole(actor, ALL);
      return { items: await shipments.list(actor.tenantId) };
    },
  });
}

export type ProfitService = ReturnType<typeof createProfitService>;
