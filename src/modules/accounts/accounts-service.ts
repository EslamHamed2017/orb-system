import type { AccountRecordType, PrismaAccountsStore } from "./accounts-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

/** Accounts show sales and costs side by side, so they are for the Owner administrator and Finance only. */
const FINANCE = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES: readonly AccountRecordType[] = ["SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE"];

function guard(actor: ShipmentActor) {
  if (!actor.roles.some((role) => FINANCE.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Accounts are for finance and owners.");
}
function project(projectId: unknown): string | null {
  if (projectId === undefined || projectId === null || projectId === "") return null;
  if (typeof projectId !== "string" || !UUID.test(projectId)) throw new ShipmentProblem(422, "VALIDATION_FAILED", "projectId must be a project id.");
  return projectId.toLowerCase();
}
function date(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ShipmentProblem(422, "VALIDATION_FAILED", `${field} must be a date (YYYY-MM-DD).`);
  return value;
}

export function createAccountsService(store: Pick<PrismaAccountsStore, "list" | "summary">) {
  return Object.freeze({
    async list(actor: ShipmentActor, type: AccountRecordType, projectId?: unknown) {
      guard(actor);
      const scope = project(projectId);
      return { projectId: scope, type, items: await store.list(actor.tenantId, type, scope) };
    },

    async summary(actor: ShipmentActor, projectId?: unknown) {
      guard(actor);
      const scope = project(projectId);
      return { projectId: scope, ...(await store.summary(actor.tenantId, scope)) };
    },

    /** Accounts operational report: every record type in one dated list, with exact totals per currency. */
    async report(actor: ShipmentActor, input: { projectId?: unknown; from?: unknown; to?: unknown }) {
      guard(actor);
      const scope = project(input.projectId), from = date(input.from, "from"), to = date(input.to, "to");
      if (from && to && from > to) throw new ShipmentProblem(422, "VALIDATION_FAILED", "from must be on or before to.");
      const items = (await Promise.all(TYPES.map((type) => store.list(actor.tenantId, type, scope)))).flat()
        .filter((r) => (!from || r.occurredOn >= from) && (!to || r.occurredOn <= to))
        .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.id.localeCompare(a.id));
      const totals = new Map<string, number>();
      const add = (key: string, value: string) => totals.set(key, (totals.get(key) ?? 0) + Math.round(Number(value) * 100));
      for (const r of items) {
        add(`${r.currency}.${r.type}.amount`, r.amount);
        add(`${r.currency}.${r.type}.outstanding`, r.outstandingAmount);
      }
      return {
        reportType: "ACCOUNTS", projectId: scope, from, to, items,
        summary: Object.fromEntries([...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, (value / 100).toFixed(6)])),
      };
    },
  });
}

export type AccountsService = ReturnType<typeof createAccountsService>;
