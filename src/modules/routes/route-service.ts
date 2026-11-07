import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { FIXED_ROUTE_TEMPLATES, isTradeRoute, type RouteItemKind, type TradeRoute } from "./templates.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
export { FIXED_ROUTE_TEMPLATES } from "./templates.ts";

export type RouteItemState = "NOT_STARTED" | "IN_PROGRESS" | "SATISFIED" | "NOT_APPLICABLE_BY_RULE";
export interface RouteItem { readonly id: string; readonly code: string; readonly label: string; readonly kind: RouteItemKind; readonly required: boolean; readonly state: RouteItemState; readonly applicabilityRule: string | null; readonly evidenceId: string | null; readonly milestoneAt: string | null }
export interface RouteChecklist { readonly shipmentId: string; readonly route: TradeRoute; readonly templateVersion: number; readonly version: number; readonly items: readonly RouteItem[]; readonly closureComplete: boolean }
type Principal = Readonly<{ userId: string; roles: readonly string[] }>;
type StoredReplay = { readonly hash: string; readonly value: RouteChecklist };
type State = { checklists: Map<string, RouteChecklist>; evidenceIds: Set<string>; replays: Map<string, StoredReplay> };
export interface RouteService {
  snapshotChecklist(input: { shipmentId: string; route: TradeRoute; expectedShipmentVersion: number; facts?: Readonly<{ storageHandlingUsed?: boolean }> }): Promise<RouteChecklist>;
  getChecklist(shipmentId: string): Promise<RouteChecklist>;
  updateRouteItem(input: Record<string, unknown>): Promise<{ value: RouteChecklist; replayed: boolean }>;
  getClosureBlockers(shipmentId: string): Promise<readonly Readonly<{ code: "ROUTE_ITEM_INCOMPLETE"; subjectId: string; itemCode: string }>[]>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPDATE_KEYS = new Set(["shipmentId", "itemId", "expectedVersion", "idempotencyKey", "correlationId", "principal", "state", "evidenceId", "milestoneAt"]);
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID()): never { throw problemError({ code, status, correlationId }); }
function complete(items: readonly RouteItem[]): boolean { return items.every((item) => !item.required || item.state === "SATISFIED" || item.state === "NOT_APPLICABLE_BY_RULE"); }
function frozen(checklist: RouteChecklist): RouteChecklist { return Object.freeze({ ...checklist, items: Object.freeze(checklist.items.map((entry) => Object.freeze({ ...entry }))) }); }

export function createInMemoryRouteService(options: { evidenceIds: readonly string[]; now: () => string }): RouteService {
  const state: State = { checklists: new Map(), evidenceIds: new Set(options.evidenceIds), replays: new Map() };
  async function snapshotChecklist(input: { shipmentId: string; route: TradeRoute; expectedShipmentVersion: number; facts?: Readonly<{ storageHandlingUsed?: boolean }> }): Promise<RouteChecklist> {
    if (!input || typeof input.shipmentId !== "string" || input.shipmentId.length === 0 || !isTradeRoute(input.route) || !Number.isSafeInteger(input.expectedShipmentVersion) || input.expectedShipmentVersion < 1) fail("VALIDATION_FAILED", 400);
    if (state.checklists.has(input.shipmentId)) fail("ROUTE_CHECKLIST_EXISTS", 409);
    const source = FIXED_ROUTE_TEMPLATES[input.route];
    const items = source.items.map((entry) => ({
      ...entry,
      id: randomUUID(),
      state: entry.applicabilityRule === "STORAGE_HANDLING_USED" && input.facts?.storageHandlingUsed === false ? "NOT_APPLICABLE_BY_RULE" as const : "NOT_STARTED" as const,
      evidenceId: null,
      milestoneAt: null,
    }));
    const value = frozen({ shipmentId: input.shipmentId, route: input.route, templateVersion: source.version, version: 1, items, closureComplete: complete(items) });
    state.checklists.set(input.shipmentId, value);
    return clone(value);
  }
  async function getChecklist(shipmentId: string): Promise<RouteChecklist> {
    const value = state.checklists.get(shipmentId);
    if (!value) fail("RESOURCE_NOT_FOUND", 404);
    return clone(value);
  }
  async function updateRouteItem(input: Record<string, unknown>): Promise<{ value: RouteChecklist; replayed: boolean }> {
    const correlationId = typeof input.correlationId === "string" ? input.correlationId : randomUUID();
    if (Object.keys(input).some((key) => !UPDATE_KEYS.has(key))) fail("VALIDATION_FAILED", 400, correlationId);
    const principal = input.principal as Principal | undefined;
    if (!principal?.userId || !Array.isArray(principal.roles) || !principal.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS")) fail("PERMISSION_DENIED", 403, correlationId);
    if (typeof input.idempotencyKey !== "string" || input.idempotencyKey.length < 8) fail("VALIDATION_FAILED", 400, correlationId);
    const scope = `${principal.userId}:${input.idempotencyKey}`;
    const request = Object.fromEntries(Object.entries(input).filter(([key]) => !["principal", "idempotencyKey", "correlationId"].includes(key)));
    const hash = digest(request), prior = state.replays.get(scope);
    if (prior) {
      if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, correlationId);
      return { value: clone(prior.value), replayed: true };
    }
    const checklist = state.checklists.get(String(input.shipmentId));
    if (!checklist) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== checklist.version) fail("STALE_VERSION", 412, correlationId);
    if (input.state !== "IN_PROGRESS" && input.state !== "SATISFIED") fail("VALIDATION_FAILED", 400, correlationId);
    const index = checklist.items.findIndex((item) => item.id === input.itemId);
    if (index < 0) fail("RESOURCE_NOT_FOUND", 404, correlationId);
    const current = checklist.items[index]!;
    if (current.state === "NOT_APPLICABLE_BY_RULE") fail("ROUTE_ITEM_NOT_APPLICABLE", 409, correlationId);
    if ("evidenceId" in input && (typeof input.evidenceId !== "string" || !UUID.test(input.evidenceId) || !state.evidenceIds.has(input.evidenceId))) fail("VALIDATION_FAILED", 400, correlationId);
    if ("milestoneAt" in input && (typeof input.milestoneAt !== "string" || !Number.isFinite(Date.parse(input.milestoneAt)))) fail("VALIDATION_FAILED", 400, correlationId);
    if (input.state === "SATISFIED" && current.kind === "EVIDENCE" && typeof input.evidenceId !== "string") fail("ROUTE_ITEM_PROOF_REQUIRED", 409, correlationId);
    if (input.state === "SATISFIED" && current.kind === "MILESTONE" && typeof input.milestoneAt !== "string") fail("ROUTE_ITEM_PROOF_REQUIRED", 409, correlationId);
    const nextItem: RouteItem = { ...current, state: input.state, evidenceId: typeof input.evidenceId === "string" ? input.evidenceId : current.evidenceId, milestoneAt: typeof input.milestoneAt === "string" ? input.milestoneAt : current.milestoneAt };
    const items = checklist.items.map((item, itemIndex) => itemIndex === index ? nextItem : item);
    const value = frozen({ ...checklist, version: checklist.version + 1, items, closureComplete: complete(items) });
    state.checklists.set(value.shipmentId, value);
    state.replays.set(scope, { hash, value });
    void options.now();
    return { value: clone(value), replayed: false };
  }
  async function getClosureBlockers(shipmentId: string) {
    const checklist = state.checklists.get(shipmentId);
    if (!checklist) fail("RESOURCE_NOT_FOUND", 404);
    return Object.freeze(checklist.items.filter((item) => item.required && item.state !== "SATISFIED" && item.state !== "NOT_APPLICABLE_BY_RULE").map((item) => Object.freeze({ code: "ROUTE_ITEM_INCOMPLETE" as const, subjectId: shipmentId, itemCode: item.code })));
  }
  return { snapshotChecklist, getChecklist, updateRouteItem, getClosureBlockers };
}
