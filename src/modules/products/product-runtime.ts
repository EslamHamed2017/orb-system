import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { getPrismaClient } from "../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { createCustomerRequestAuthenticator } from "../tenancy/customer-request-context.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaCustomerSessionContextRepository } from "../tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaProductRepository, type ProductPrismaClient, type ProductPrismaTransaction } from "./product-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { ProductProblem, createProductService, type ProductPrincipal, type ProductRecord } from "./product-service.ts";

interface IdempotencyRow { request_hash: string; response_locator: string | null }
interface AuditSnapshotRow { tenant_id: string; after: unknown }
interface IdempotencyTransaction extends ProductPrismaTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  idempotencyRecord: {
    findUnique(input: Record<string, unknown>): Promise<IdempotencyRow | null>;
    create(input: Record<string, unknown>): Promise<unknown>;
  };
  productAuditEvent: ProductPrismaTransaction["productAuditEvent"] & { findUnique(input: Record<string, unknown>): Promise<AuditSnapshotRow | null> };
}
interface RuntimePrismaClient extends ProductPrismaClient {
  $transaction<T>(work: (transaction: IdempotencyTransaction) => Promise<T>): Promise<T>;
}

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function replayRecord(value: unknown): ProductRecord {
  if (!value || typeof value !== "object") throw new Error("Persisted product idempotency snapshot is invalid.");
  return value as ProductRecord;
}
function transactionClient(transaction: IdempotencyTransaction): ProductPrismaClient {
  return {
    coffeeSpecification: transaction.coffeeSpecification,
    productAuditEvent: transaction.productAuditEvent,
    $queryRaw: transaction.$queryRaw.bind(transaction),
    $transaction: async <T>(work: (nested: ProductPrismaTransaction) => Promise<T>) => work(transaction),
  };
}
async function replay(transaction: IdempotencyTransaction, locator: string | null, tenantId: string): Promise<ProductRecord> {
  const match = /^([0-9a-f-]{36}):([1-9][0-9]*)$/i.exec(locator ?? "");
  if (!match) throw new Error("Persisted product idempotency locator is invalid.");
  const snapshot = await transaction.productAuditEvent.findUnique({ where: { product_id_aggregate_version: { product_id: match[1], aggregate_version: Number(match[2]) } }, select: { tenant_id: true, after: true } }) as AuditSnapshotRow | null;
  if (!snapshot || snapshot.tenant_id !== tenantId) throw new ProductProblem("IDEMPOTENCY_CONFLICT", 409);
  return replayRecord(snapshot.after);
}

function buildRuntime() {
  const prisma = getPrismaClient();
  const service = createProductService(new PrismaProductRepository(prisma as unknown as ProductPrismaClient));
  const authenticate = createCustomerRequestAuthenticator(new PrismaCustomerSessionContextRepository(prisma));
  const client = prisma as unknown as RuntimePrismaClient;
  async function mutate(input: { principal: ProductPrincipal; operation: "createProduct" | "updateProduct"; key: string; requestValue: unknown; execute: (service: ReturnType<typeof createProductService>) => Promise<ProductRecord> }) {
    const requestHash = digest({ tenantId: input.principal.tenantId, request: input.requestValue });
    return client.$transaction(async (transaction) => {
      const lockIdentity = `${input.principal.userId}:${input.operation}:${input.key}`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))`;
      const where = { actor_id_operation_id_key: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key } };
      const existing = await transaction.idempotencyRecord.findUnique({ where });
      if (existing) {
        if (existing.request_hash !== requestHash) throw new ProductProblem("IDEMPOTENCY_CONFLICT", 409);
        return replay(transaction, existing.response_locator, input.principal.tenantId);
      }
      const txService = createProductService(new PrismaProductRepository(transactionClient(transaction)));
      const result = await input.execute(txService);
      await transaction.idempotencyRecord.create({ data: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key, request_hash: requestHash, response_status: input.operation === "createProduct" ? 201 : 200, response_locator: `${result.id}:${result.version}`, response_hash: digest(result), expires_at: new Date(Date.now() + 24 * 60 * 60_000) } });
      return result;
    });
  }
  return Object.freeze({ service, authenticate,
    create: (input: { principal: ProductPrincipal; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "createProduct", key: input.key, requestValue: input.body, execute: (txService) => txService.create({ principal: input.principal, input: input.body }) }),
    update: (input: { principal: ProductPrincipal; id: string; expectedVersion: number; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "updateProduct", key: input.key, requestValue: { id: input.id, expectedVersion: input.expectedVersion, body: input.body }, execute: (txService) => txService.update({ principal: input.principal, id: input.id, expectedVersion: input.expectedVersion, input: input.body }) }),
  });
}
let cached: ReturnType<typeof buildRuntime> | undefined;
export function productRuntime() { return cached ??= buildRuntime(); }
