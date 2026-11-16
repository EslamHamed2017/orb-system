import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw Object.assign(new Error("DATABASE_URL is required for persisted customer operations."), { code: "DEPENDENCY_UNAVAILABLE", status: 503 });
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return client;
}
