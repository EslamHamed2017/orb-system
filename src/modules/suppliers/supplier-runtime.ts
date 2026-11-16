import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { getPrismaClient } from "../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { createCustomerRequestAuthenticator } from "../tenancy/customer-request-context.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaCustomerSessionContextRepository } from "../tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaSupplierRepository, type SupplierPrismaClient, type SupplierPrismaTransaction } from "./supplier-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { SupplierProblem, createSupplierService, type SupplierPrincipal, type SupplierRecord } from "./supplier-service.ts";

interface IdempotencyRow { request_hash: string; response_locator: string | null }
interface AuditSnapshotRow { tenant_id: string; after: unknown }
interface IdempotencyTransaction extends SupplierPrismaTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  idempotencyRecord: {
    findUnique(input: Record<string, unknown>): Promise<IdempotencyRow | null>;
    create(input: Record<string, unknown>): Promise<unknown>;
  };
  supplierAuditEvent: SupplierPrismaTransaction["supplierAuditEvent"] & { findUnique(input: Record<string, unknown>): Promise<AuditSnapshotRow | null> };
}
interface RuntimePrismaClient extends SupplierPrismaClient {
  $transaction<T>(work: (transaction: IdempotencyTransaction) => Promise<T>): Promise<T>;
}

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function replayRecord(value: unknown): SupplierRecord {
  if (!value || typeof value !== "object") throw new Error("Persisted supplier idempotency snapshot is invalid.");
  return value as SupplierRecord;
}
function transactionClient(transaction: IdempotencyTransaction): SupplierPrismaClient {
  return {
    supplier: transaction.supplier,
    supplierAuditEvent: transaction.supplierAuditEvent,
    $queryRaw: transaction.$queryRaw.bind(transaction),
    $transaction: async <T>(work: (nested: SupplierPrismaTransaction) => Promise<T>) => work(transaction),
  };
}
async function replay(transaction: IdempotencyTransaction, locator: string | null, tenantId: string): Promise<SupplierRecord> {
  const match = /^([0-9a-f-]{36}):([1-9][0-9]*)$/i.exec(locator ?? "");
  if (!match) throw new Error("Persisted supplier idempotency locator is invalid.");
  const snapshot = await transaction.supplierAuditEvent.findUnique({ where: { supplier_id_aggregate_version: { supplier_id: match[1], aggregate_version: Number(match[2]) } }, select: { tenant_id: true, after: true } }) as AuditSnapshotRow | null;
  if (!snapshot || snapshot.tenant_id !== tenantId) throw new SupplierProblem("IDEMPOTENCY_CONFLICT", 409);
  return replayRecord(snapshot.after);
}

function buildRuntime() {
  const prisma = getPrismaClient();
  const service = createSupplierService(new PrismaSupplierRepository(prisma as unknown as SupplierPrismaClient));
  const authenticate = createCustomerRequestAuthenticator(new PrismaCustomerSessionContextRepository(prisma));
  const client = prisma as unknown as RuntimePrismaClient;
  async function mutate(input: { principal: SupplierPrincipal; operation: "createSupplier" | "updateSupplier"; key: string; requestValue: unknown; execute: (service: ReturnType<typeof createSupplierService>) => Promise<SupplierRecord> }) {
    const requestHash = digest({ tenantId: input.principal.tenantId, request: input.requestValue });
    return client.$transaction(async (transaction) => {
      const lockIdentity = `${input.principal.userId}:${input.operation}:${input.key}`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))`;
      const where = { actor_id_operation_id_key: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key } };
      const existing = await transaction.idempotencyRecord.findUnique({ where });
      if (existing) {
        if (existing.request_hash !== requestHash) throw new SupplierProblem("IDEMPOTENCY_CONFLICT", 409);
        return replay(transaction, existing.response_locator, input.principal.tenantId);
      }
      const txService = createSupplierService(new PrismaSupplierRepository(transactionClient(transaction)));
      const result = await input.execute(txService);
      await transaction.idempotencyRecord.create({ data: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key, request_hash: requestHash, response_status: input.operation === "createSupplier" ? 201 : 200, response_locator: `${result.id}:${result.version}`, response_hash: digest(result), expires_at: new Date(Date.now() + 24 * 60 * 60_000) } });
      return result;
    });
  }
  return Object.freeze({ service, authenticate,
    create: (input: { principal: SupplierPrincipal; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "createSupplier", key: input.key, requestValue: input.body, execute: (txService) => txService.create({ principal: input.principal, input: input.body }) }),
    update: (input: { principal: SupplierPrincipal; id: string; expectedVersion: number; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "updateSupplier", key: input.key, requestValue: { id: input.id, expectedVersion: input.expectedVersion, body: input.body }, execute: (txService) => txService.update({ principal: input.principal, id: input.id, expectedVersion: input.expectedVersion, input: input.body }) }),
  });
}
let cached: ReturnType<typeof buildRuntime> | undefined;
export function supplierRuntime() { return cached ??= buildRuntime(); }
