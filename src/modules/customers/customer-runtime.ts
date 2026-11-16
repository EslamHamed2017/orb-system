import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { getPrismaClient } from "../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { createCustomerRequestAuthenticator } from "../tenancy/customer-request-context.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaCustomerSessionContextRepository } from "../tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { PrismaCustomerRepository, type CustomerPrismaClient, type CustomerPrismaTransaction } from "./customer-repository.ts";
// @ts-expect-error Native Node TypeScript tests require the source extension.
import { CustomerProblem, createCustomerService, type CustomerPrincipal, type CustomerRecord } from "./customer-service.ts";

interface IdempotencyRow { request_hash: string; response_locator: string | null }
interface AuditSnapshotRow { tenant_id: string; after: unknown }
interface IdempotencyTransaction extends CustomerPrismaTransaction {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<number>;
  idempotencyRecord: {
    findUnique(input: Record<string, unknown>): Promise<IdempotencyRow | null>;
    create(input: Record<string, unknown>): Promise<unknown>;
  };
  customerAuditEvent: CustomerPrismaTransaction["customerAuditEvent"] & { findUnique(input: Record<string, unknown>): Promise<AuditSnapshotRow | null> };
}
interface RuntimePrismaClient extends CustomerPrismaClient {
  $transaction<T>(work: (transaction: IdempotencyTransaction) => Promise<T>): Promise<T>;
}

function digest(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function replayRecord(value: unknown): CustomerRecord {
  if (!value || typeof value !== "object") throw new Error("Persisted customer idempotency snapshot is invalid.");
  const record = value as Partial<CustomerRecord>;
  return { ...record, legalNameAr: record.legalNameAr ?? null, countryCode: record.countryCode ?? null, taxRegistrationNumber: record.taxRegistrationNumber ?? null, paymentTermsDays: record.paymentTermsDays ?? 0, billingAddress: record.billingAddress ?? null } as CustomerRecord;
}
function transactionClient(transaction: IdempotencyTransaction): CustomerPrismaClient {
  return {
    customer: transaction.customer,
    customerAuditEvent: transaction.customerAuditEvent,
    $queryRaw: transaction.$queryRaw.bind(transaction),
    $transaction: async <T>(work: (nested: CustomerPrismaTransaction) => Promise<T>) => work(transaction),
  };
}
async function replay(transaction: IdempotencyTransaction, locator: string | null, tenantId: string): Promise<CustomerRecord> {
  const match = /^([0-9a-f-]{36}):([1-9][0-9]*)$/i.exec(locator ?? "");
  if (!match) throw new Error("Persisted customer idempotency locator is invalid.");
  const snapshot = await transaction.customerAuditEvent.findUnique({ where: { customer_id_aggregate_version: { customer_id: match[1], aggregate_version: Number(match[2]) } }, select: { tenant_id: true, after: true } });
  if (!snapshot || snapshot.tenant_id !== tenantId) throw new CustomerProblem("IDEMPOTENCY_CONFLICT", 409);
  return replayRecord(snapshot.after);
}

function buildRuntime() {
  const prisma = getPrismaClient();
  const service = createCustomerService(new PrismaCustomerRepository(prisma as unknown as CustomerPrismaClient));
  const authenticate = createCustomerRequestAuthenticator(new PrismaCustomerSessionContextRepository(prisma));
  const client = prisma as unknown as RuntimePrismaClient;
  async function mutate(input: { principal: CustomerPrincipal; operation: "createCustomer" | "updateCustomer"; key: string; requestValue: unknown; execute: (service: ReturnType<typeof createCustomerService>) => Promise<CustomerRecord> }) {
    const requestHash = digest({ tenantId: input.principal.tenantId, request: input.requestValue });
    return client.$transaction(async (transaction) => {
      const lockIdentity = `${input.principal.userId}:${input.operation}:${input.key}`;
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockIdentity}, 0))`;
      const where = { actor_id_operation_id_key: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key } };
      const existing = await transaction.idempotencyRecord.findUnique({ where });
      if (existing) {
        if (existing.request_hash !== requestHash) throw new CustomerProblem("IDEMPOTENCY_CONFLICT", 409);
        return replay(transaction, existing.response_locator, input.principal.tenantId);
      }
      const txService = createCustomerService(new PrismaCustomerRepository(transactionClient(transaction)));
      const result = await input.execute(txService);
      await transaction.idempotencyRecord.create({ data: { actor_id: input.principal.userId, operation_id: input.operation, key: input.key, request_hash: requestHash, response_status: input.operation === "createCustomer" ? 201 : 200, response_locator: `${result.id}:${result.version}`, response_hash: digest(result), expires_at: new Date(Date.now() + 24 * 60 * 60_000) } });
      return result;
    });
  }
  return Object.freeze({ service, authenticate,
    create: (input: { principal: CustomerPrincipal; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "createCustomer", key: input.key, requestValue: input.body, execute: (txService) => txService.create({ principal: input.principal, input: input.body }) }),
    update: (input: { principal: CustomerPrincipal; id: string; expectedVersion: number; body: unknown; key: string }) => mutate({ principal: input.principal, operation: "updateCustomer", key: input.key, requestValue: { id: input.id, expectedVersion: input.expectedVersion, body: input.body }, execute: (txService) => txService.update({ principal: input.principal, id: input.id, expectedVersion: input.expectedVersion, input: input.body }) }),
  });
}
let cached: ReturnType<typeof buildRuntime> | undefined;
export function customerRuntime() { return cached ??= buildRuntime(); }
