// @ts-expect-error Native Node TypeScript tests require source extensions.
import { CustomerProblem, type CustomerRecord, type CustomerRepository, type CustomerValues } from "./customer-service.ts";

interface CustomerRow {
  id: string;
  tenant_id: string;
  reference: string;
  legal_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface CustomerDelegate {
  findMany(args: Record<string, unknown>): Promise<CustomerRow[]>;
  findFirst(args: Record<string, unknown>): Promise<CustomerRow | null>;
  create(args: Record<string, unknown>): Promise<CustomerRow>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}

interface AuditDelegate {
  create(args: Record<string, unknown>): Promise<unknown>;
}

export interface CustomerPrismaTransaction {
  customer: CustomerDelegate;
  customerAuditEvent: AuditDelegate;
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export interface CustomerPrismaClient extends CustomerPrismaTransaction {
  $transaction<T>(work: (transaction: CustomerPrismaTransaction) => Promise<T>): Promise<T>;
}

function record(row: CustomerRow): CustomerRecord {
  return Object.freeze({
    id: row.id, tenantId: row.tenant_id, reference: row.reference, legalName: row.legal_name,
    contactName: row.contact_name, email: row.email, phone: row.phone, status: row.status,
    version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  });
}

function data(values: Partial<CustomerValues>): Record<string, unknown> {
  return {
    ...(values.reference === undefined ? {} : { reference: values.reference }),
    ...(values.legalName === undefined ? {} : { legal_name: values.legalName }),
    ...(values.contactName === undefined ? {} : { contact_name: values.contactName }),
    ...(values.email === undefined ? {} : { email: values.email }),
    ...(values.phone === undefined ? {} : { phone: values.phone }),
    ...(values.status === undefined ? {} : { status: values.status }),
  };
}

function translate(error: unknown): never {
  const code = (error as { code?: unknown })?.code;
  if (code === "P2002") throw new CustomerProblem("DUPLICATE_REFERENCE", 409);
  if (code === "P2004") throw new CustomerProblem("VALIDATION_FAILED", 400);
  throw error;
}

export class PrismaCustomerRepository implements CustomerRepository {
  private readonly client: CustomerPrismaClient;

  constructor(client: CustomerPrismaClient) {
    this.client = client;
  }

  async list(tenantId: string) {
    return (await this.client.customer.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ legal_name: "asc" }, { id: "asc" }],
    })).map(record);
  }

  async get(tenantId: string, id: string) {
    const row = await this.client.customer.findFirst({ where: { id, tenant_id: tenantId } });
    return row ? record(row) : null;
  }

  async create(input: { tenantId: string; actorId: string; values: CustomerValues }) {
    try {
      return await this.client.$transaction(async (transaction) => {
        const row = await transaction.customer.create({ data: { tenant_id: input.tenantId, ...data(input.values) } });
        const after = record(row);
        await transaction.customerAuditEvent.create({
          data: { tenant_id: input.tenantId, customer_id: row.id, actor_id: input.actorId, action: "CUSTOMER_CREATED", aggregate_version: row.version, before: null, after },
        });
        return after;
      });
    } catch (error) {
      return translate(error);
    }
  }

  async update(input: { tenantId: string; actorId: string; id: string; expectedVersion: number; values: Partial<CustomerValues> }) {
    try {
      return await this.client.$transaction(async (transaction) => {
        // The tagged-template API binds both UUIDs as parameters. FOR UPDATE makes the
        // snapshot returned after a lock wait the exact row this transaction will mutate.
        const rows = await transaction.$queryRaw<CustomerRow[]>`
          SELECT "id", "tenant_id", "reference", "legal_name", "contact_name", "email", "phone",
                 "status", "version", "created_at", "updated_at"
          FROM "Customer"
          WHERE "id" = ${input.id}::uuid AND "tenant_id" = ${input.tenantId}::uuid
          FOR UPDATE
        `;
        const current = rows[0];
        if (!current) return null;
        if (current.version !== input.expectedVersion) throw new CustomerProblem("STALE_VERSION", 412);

        const changed = await transaction.customer.updateMany({
          where: { id: input.id, tenant_id: input.tenantId, version: input.expectedVersion },
          data: { ...data(input.values), version: { increment: 1 }, updated_at: new Date() },
        });
        if (changed.count !== 1) throw new CustomerProblem("STALE_VERSION", 412);

        const next = await transaction.customer.findFirst({ where: { id: input.id, tenant_id: input.tenantId } });
        if (!next) throw new CustomerProblem("RESOURCE_NOT_FOUND", 404);
        const before = record(current);
        const after = record(next);
        await transaction.customerAuditEvent.create({
          data: {
            tenant_id: input.tenantId, customer_id: input.id, actor_id: input.actorId,
            action: input.values.status === "INACTIVE" && current.status !== "INACTIVE" ? "CUSTOMER_DEACTIVATED" : "CUSTOMER_UPDATED",
            aggregate_version: next.version, before, after,
          },
        });
        return after;
      });
    } catch (error) {
      return translate(error);
    }
  }
}
