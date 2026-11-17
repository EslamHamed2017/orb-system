import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../platform/database/prisma-client.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createCustomerRequestAuthenticator } from "../tenancy/customer-request-context.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaCustomerSessionContextRepository } from "../tenancy/customer-session-context-repository.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PrismaProjectDailyRepository,type ProjectDailyPrismaClient,type ProjectDailyTransaction } from "./project-daily-repository.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { createProjectDailyService,ProjectDailyProblem,type ProjectDailyPrincipal,type ProjectDailyRecord } from "./project-daily-service.ts";
type IdempotencyRow={request_hash:string;response_locator:string|null};
interface RuntimeTransaction extends ProjectDailyTransaction{projectAuditEvent:{findUnique(input:Record<string,unknown>):Promise<{tenant_id:string;after:unknown}|null>}}
interface RuntimeClient extends ProjectDailyPrismaClient{$transaction<T>(work:(tx:RuntimeTransaction)=>Promise<T>):Promise<T>}
const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
function nested(tx:RuntimeTransaction):ProjectDailyPrismaClient{return {$queryRaw:tx.$queryRaw.bind(tx),$queryRawUnsafe:tx.$queryRawUnsafe.bind(tx),$executeRaw:tx.$executeRaw.bind(tx),$transaction:async<T>(work:(inner:ProjectDailyTransaction)=>Promise<T>)=>work(tx)}}
function buildRuntime(){const prisma=getPrismaClient(),client=prisma as unknown as RuntimeClient,service=createProjectDailyService(new PrismaProjectDailyRepository(client)),authenticate=createCustomerRequestAuthenticator(new PrismaCustomerSessionContextRepository(prisma));return Object.freeze({service,authenticate,async create(input:{principal:ProjectDailyPrincipal;body:unknown;key:string}){const requestHash=digest({tenantId:input.principal.tenantId,request:input.body}),operation="createProjectWithSalesContract";return client.$transaction(async tx=>{const identity=`${input.principal.userId}:${operation}:${input.key}`;await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity},0))`;const existing=(await tx.$queryRaw<IdempotencyRow[]>`SELECT "request_hash","response_locator" FROM "IdempotencyRecord" WHERE "actor_id"=${input.principal.userId}::uuid AND "operation_id"=${operation} AND "key"=${input.key}`)[0];const txService=createProjectDailyService(new PrismaProjectDailyRepository(nested(tx)));if(existing){if(existing.request_hash!==requestHash)throw new ProjectDailyProblem("IDEMPOTENCY_CONFLICT",409);if(!existing.response_locator)throw new Error("Project idempotency locator is missing");return txService.get({principal:input.principal,id:existing.response_locator})}const result=await txService.create({principal:input.principal,input:input.body});await tx.$executeRaw`INSERT INTO "IdempotencyRecord" ("actor_id","operation_id","key","request_hash","response_status","response_locator","response_hash","expires_at") VALUES (${input.principal.userId}::uuid,${operation},${input.key},${requestHash},201,${result.id},${digest(result)},now()+interval '24 hours')`;return result})}})}
let cached:ReturnType<typeof buildRuntime>|undefined;export function projectRuntime(){return cached??=buildRuntime()}
