import type { PrismaTradeReportsStore } from "./trade-reports-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

type Store = Pick<PrismaTradeReportsStore, keyof PrismaTradeReportsStore>;

/** Contract fulfillment and product movement: company-scoped. Reports are Owner/Finance; a product's movements are open to all three roles. */
const FINANCE = ["OWNER_ADMIN", "FINANCE_VIEWER"];
const ALL = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const invalid = (detail: string) => new ShipmentProblem(422, "VALIDATION_FAILED", detail);
function requireRole(actor: ShipmentActor, roles: readonly string[]) {
  if (!actor.roles.some((role) => roles.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot see this report.");
}
function optionalId(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID.test(value)) throw invalid(`${label} is not a valid id.`);
  return value.toLowerCase();
}
function range(from?: string, to?: string) {
  for (const value of [from, to]) if (value !== undefined && (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) throw invalid("Dates must be YYYY-MM-DD.");
  if (from && to && from > to) throw invalid("The start date is after the end date.");
  return (day: string) => (!from || day >= from) && (!to || day <= to);
}

export function createTradeReportsService(store: Store) {
  return Object.freeze({
    async contractFulfillment(actor: ShipmentActor, input: { projectId?: string; from?: string; to?: string }) {
      requireRole(actor, FINANCE);
      const inRange = range(input.from, input.to);
      const rows = (await store.contractFulfillment(actor.tenantId, optionalId(input.projectId, "Project"))).filter((row) => inRange(row.approvedOn));
      return { reportType: "CONTRACT_FULFILLMENT", generatedAt: new Date().toISOString(), projectId: input.projectId ?? null, from: input.from ?? null, to: input.to ?? null, rows };
    },

    async productMovementReport(actor: ShipmentActor, input: { projectId?: string; productId?: string; from?: string; to?: string }) {
      requireRole(actor, FINANCE);
      const inRange = range(input.from, input.to);
      const rows = (await store.productMovements(actor.tenantId, { productId: optionalId(input.productId, "Product"), projectId: optionalId(input.projectId, "Project") })).filter((row) => inRange(row.occurredOn));
      return { reportType: "PRODUCT_MOVEMENT", generatedAt: new Date().toISOString(), projectId: input.projectId ?? null, from: input.from ?? null, to: input.to ?? null, rows };
    },

    /** One product's movements across projects (listProductMovements). */
    async productMovements(actor: ShipmentActor, productId: unknown, projectId?: string) {
      requireRole(actor, ALL);
      const product = optionalId(productId, "Product");
      if (!product) throw invalid("Product is not a valid id.");
      const found = await store.product(actor.tenantId, product);
      if (!found) throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", "Product not found");
      const items = await store.productMovements(actor.tenantId, { productId: product, projectId: optionalId(projectId, "Project") });
      return { productId: product, product: { id: found.id, reference: found.reference, nameEn: found.name_en, nameAr: found.name_ar }, projectId: projectId ?? null, items };
    },
  });
}

export type TradeReportsService = ReturnType<typeof createTradeReportsService>;
