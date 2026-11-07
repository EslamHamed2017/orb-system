import { createHash, randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { addSix, compareSix, exactSix, MONEY_MOVEMENT_KINDS, subtractSix } from "./movement-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { allocationKey, assertAllocationTargetType, type AllocationTargetType } from "./allocation-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { deriveProjectFinancialState } from "./financial-state.ts";

type Principal = Readonly<{ userId: string; roles: readonly string[] }>;
type Project = { id: string; version: number; finalState: string };
type Contract = Readonly<{ id: string; projectId: string; partyId: string; partyType: "CUSTOMER" | "SUPPLIER"; currency: string }>;
type Target = { type: AllocationTargetType; id: string; projectId: string; partyId: string; currency: string; amount: string; outstanding: string; salesShipmentId?: string };
type Movement = { id: string; projectId: string; partyId: string; contractId: string; kind: string; amount: string; currency: string; occurredOn: string; reference: string; evidenceId: string | null; state: string; availableAmount: string; reversalOfId: string | null; reversalReason: string | null; version: number; createdAt: string };
type Allocation = { id: string; movementId: string; targetType: AllocationTargetType; targetId: string; amount: string; currency: string; state: "ACTIVE"; allocatedBy: string; allocatedAt: string; reversalOfId: string | null; reversalReason: string | null; version: number };
type Replay = { hash: string; value: unknown };
interface State { projects: Map<string, Project>; contracts: Map<string, Contract>; targets: Map<string, Target>; movements: Map<string, Movement>; allocations: Allocation[]; replays: Map<string, Replay>; audit: Record<string, unknown>[] }
export interface SettlementService {
  recordMovement(input: Record<string, unknown>): Promise<{ value: Movement; replayed: boolean }>;
  allocate(input: Record<string, unknown>): Promise<{ value: Allocation; replayed: boolean }>;
  reverseAllocation(input: Record<string, unknown>): Promise<{ value: Allocation; replayed: boolean }>;
  reverseMovement(input: Record<string, unknown>): Promise<{ value: Movement; replayed: boolean }>;
  getMovement(id: string): Promise<Movement>; getAllocation(id: string): Promise<Allocation>; getTarget(type: string, id: string): Promise<Target>;
  projectFinancialState(projectId: string): Promise<unknown>; statement(projectId: string, currency: string): Promise<unknown>;
  auditTrail(): Promise<readonly Record<string, unknown>[]>; allocations(): Promise<readonly Allocation[]>;
}
const clone = <T>(value: T): T => structuredClone(value);
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
function fail(code: string, status: number, correlationId: string = randomUUID(), extensions?: Record<string, unknown>): never { throw problemError({ code, status, correlationId, extensions }); }
function correlation(input: Record<string, unknown>): string { return typeof input.correlationId === "string" && input.correlationId ? input.correlationId : randomUUID(); }
function authorize(input: Record<string, unknown>, id: string): Principal { const principal = input.principal as Principal | undefined; if (!principal?.userId || !Array.isArray(principal.roles) || !principal.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER")) fail("PERMISSION_DENIED", 403, id); return principal; }
function requiredText(value: unknown, id: string, minimum = 1): string { const text = typeof value === "string" ? value.trim() : ""; if (text.length < minimum) fail("VALIDATION_FAILED", 400, id); return text; }
function exactAmount(value: unknown, id: string): string { try { return exactSix(value); } catch { fail("VALIDATION_FAILED", 400, id); } }
function expected(actual: number, value: unknown, id: string): void { if (!Number.isSafeInteger(value) || actual !== value) fail("STALE_VERSION", 412, id, { currentVersion: actual }); }
function movement(state: State, value: unknown, id: string): Movement { const row = state.movements.get(String(value)); if (!row) fail("RESOURCE_NOT_FOUND", 404, id); return row; }
function target(state: State, type: unknown, value: unknown, id: string): Target { try { assertAllocationTargetType(type); } catch { fail("VALIDATION_FAILED", 400, id); } const row = state.targets.get(allocationKey(type as AllocationTargetType, String(value))); if (!row) fail("RESOURCE_NOT_FOUND", 404, id); return row; }
function allocation(state: State, value: unknown, id: string): Allocation { const row = state.allocations.find((item) => item.id === value); if (!row) fail("RESOURCE_NOT_FOUND", 404, id); return row; }

export function createInMemorySettlementService(options: { now: () => string; projects: readonly Project[]; contracts: readonly Contract[]; targets: readonly Target[] }): SettlementService {
  const state: State = { projects: new Map(options.projects.map((row) => [row.id, clone(row)])), contracts: new Map(options.contracts.map((row) => [row.id, clone(row)])), targets: new Map(options.targets.map((row) => [allocationKey(row.type, row.id), { ...clone(row), amount: exactSix(row.amount), outstanding: row.outstanding === "0.000000" ? row.outstanding : exactSix(row.outstanding) }])), movements: new Map(), allocations: [], replays: new Map(), audit: [] };
  async function once<T>(operation: string, input: Record<string, unknown>, work: (principal: Principal, id: string) => T): Promise<{ value: T; replayed: boolean }> {
    const id = correlation(input), principal = authorize(input, id), key = input.idempotencyKey;
    if (typeof key !== "string" || key.length < 8) fail("VALIDATION_FAILED", 400, id);
    const request = Object.fromEntries(Object.entries(input).filter(([name]) => !["principal", "correlationId", "idempotencyKey"].includes(name)));
    const scope = `${principal.userId}:${operation}:${key}`, hash = digest(request), prior = state.replays.get(scope);
    if (prior) { if (prior.hash !== hash) fail("IDEMPOTENCY_KEY_REUSED", 409, id); return { value: clone(prior.value) as T, replayed: true }; }
    const value = work(principal, id); state.replays.set(scope, { hash, value: clone(value) }); return { value: clone(value), replayed: false };
  }
  function audit(action: string, principal: Principal, aggregateId: string, projectId: string, id: string, reason: string | null = null) { state.audit.push(Object.freeze({ action, aggregateId, projectId, actorId: principal.userId, occurredAt: options.now(), correlationId: id, reason })); }
  function compensate(original: Allocation, principal: Principal, id: string, reason: string): Allocation {
    if (state.allocations.some((row) => row.reversalOfId === original.id)) fail("ALLOCATION_ALREADY_REVERSED", 409, id);
    const source = movement(state, original.movementId, id), destination = target(state, original.targetType, original.targetId, id);
    const value: Allocation = { id: randomUUID(), movementId: source.id, targetType: original.targetType, targetId: original.targetId, amount: `-${original.amount}`, currency: original.currency, state: "ACTIVE", allocatedBy: principal.userId, allocatedAt: options.now(), reversalOfId: original.id, reversalReason: reason, version: 1 };
    state.allocations.push(value); source.availableAmount = addSix(source.availableAmount, original.amount); source.version += 1; destination.outstanding = addSix(destination.outstanding, original.amount);
    audit("SETTLEMENT_ALLOCATION_COMPENSATED", principal, value.id, source.projectId, id, reason); return value;
  }
  const service: SettlementService = {
    async recordMovement(input) { return once("recordMoneyMovement", input, (principal, id) => {
      const project = state.projects.get(String(input.projectId)); if (!project) fail("RESOURCE_NOT_FOUND", 404, id); expected(project.version, input.expectedVersion, id);
      const contract = state.contracts.get(String(input.contractId));
      if (!contract || contract.projectId !== project.id || contract.partyId !== input.partyId || contract.currency !== input.currency) fail("VALIDATION_FAILED", 400, id);
      if (!MONEY_MOVEMENT_KINDS.includes(input.kind as never) || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.occurredOn)) || !/^[A-Z]{3}$/.test(String(input.currency))) fail("VALIDATION_FAILED", 400, id);
      if ((contract.partyType === "CUSTOMER") !== String(input.kind).startsWith("CUSTOMER_")) fail("VALIDATION_FAILED", 400, id);
      const amount = exactAmount(input.amount, id), reference = requiredText(input.reference, id);
      if ([...state.movements.values()].some((row) => row.projectId === project.id && row.reference === reference && row.reversalOfId === null)) fail("DUPLICATE_REFERENCE", 409, id);
      const value: Movement = { id: randomUUID(), projectId: project.id, partyId: contract.partyId, contractId: contract.id, kind: String(input.kind), amount, currency: contract.currency, occurredOn: String(input.occurredOn), reference, evidenceId: typeof input.evidenceId === "string" ? input.evidenceId : null, state: "CONFIRMED", availableAmount: amount, reversalOfId: null, reversalReason: null, version: 1, createdAt: options.now() };
      state.movements.set(value.id, value); audit("MONEY_MOVEMENT_RECORDED", principal, value.id, value.projectId, id); return value;
    }); },
    async allocate(input) { return once("allocateMoneyMovement", input, (principal, id) => {
      const source = movement(state, input.movementId, id); expected(source.version, input.expectedVersion, id); if (source.state === "REVERSED") fail("INVALID_STATE_TRANSITION", 409, id);
      const destination = target(state, input.targetType, input.targetId, id), amount = exactAmount(input.amount, id);
      if (source.projectId !== destination.projectId || source.partyId !== destination.partyId || source.currency !== destination.currency || input.currency !== source.currency) fail("ALLOCATION_PARTY_OR_CURRENCY_MISMATCH", 409, id);
      if (compareSix(amount, source.availableAmount) > 0 || compareSix(amount, destination.outstanding) > 0) fail("ALLOCATION_EXCEEDS_AVAILABLE", 409, id);
      const value: Allocation = { id: randomUUID(), movementId: source.id, targetType: destination.type, targetId: destination.id, amount, currency: source.currency, state: "ACTIVE", allocatedBy: principal.userId, allocatedAt: options.now(), reversalOfId: null, reversalReason: null, version: 1 };
      state.allocations.push(value); source.availableAmount = subtractSix(source.availableAmount, amount); source.version += 1; source.state = source.availableAmount === "0.000000" ? "FULLY_ALLOCATED" : "PARTIALLY_ALLOCATED"; destination.outstanding = subtractSix(destination.outstanding, amount);
      audit("SETTLEMENT_ALLOCATION_CREATED", principal, value.id, source.projectId, id); return value;
    }); },
    async reverseAllocation(input) { return once("reverseSettlementAllocation", input, (principal, id) => { const original = allocation(state, input.allocationId, id); expected(original.version, input.expectedVersion, id); if (original.reversalOfId) fail("INVALID_STATE_TRANSITION", 409, id); return compensate(original, principal, id, requiredText(input.reason, id, 3)); }); },
    async reverseMovement(input) { return once("reverseMoneyMovement", input, (principal, id) => {
      const original = movement(state, input.movementId, id); expected(original.version, input.expectedVersion, id); if (original.reversalOfId || original.state === "REVERSED" || [...state.movements.values()].some((row) => row.reversalOfId === original.id)) fail("MOVEMENT_ALREADY_REVERSED", 409, id);
      const reason = requiredText(input.reason, id, 3); for (const row of state.allocations.filter((item) => item.movementId === original.id && item.reversalOfId === null && !state.allocations.some((candidate) => candidate.reversalOfId === item.id))) compensate(row, principal, id, reason);
      const value: Movement = { ...clone(original), id: randomUUID(), kind: "REVERSAL", amount: `-${original.amount}`, availableAmount: "0.000000", state: "CONFIRMED", reversalOfId: original.id, reversalReason: reason, version: 1, reference: `${original.reference}-REVERSAL`, createdAt: options.now() };
      original.state = "REVERSED"; original.availableAmount = "0.000000"; original.version += 1; state.movements.set(value.id, value); audit("MONEY_MOVEMENT_REVERSED", principal, value.id, original.projectId, id, reason); return value;
    }); },
    async getMovement(id) { return clone(movement(state, id, `get-${id}`)); }, async getAllocation(id) { return clone(allocation(state, id, `get-${id}`)); }, async getTarget(type, id) { return clone(target(state, type, id, `get-${id}`)); },
    async projectFinancialState(projectId) { const project = state.projects.get(projectId); if (!project) fail("RESOURCE_NOT_FOUND", 404); return deriveProjectFinancialState(project, [...state.targets.values()]); },
    async statement(projectId, currency) { return Object.freeze({ projectId, currency, movements: Object.freeze([...state.movements.values()].filter((row) => row.projectId === projectId && row.currency === currency).map(clone)), allocations: Object.freeze(state.allocations.filter((row) => state.movements.get(row.movementId)?.projectId === projectId && row.currency === currency).map(clone)) }); },
    async auditTrail() { return Object.freeze(state.audit.map(clone)); }, async allocations() { return Object.freeze(state.allocations.map(clone)); },
  };
  return service;
}
