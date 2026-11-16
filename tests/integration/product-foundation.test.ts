import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ProductProblem, createProductService, productAuditAction, type ProductRecord, type ProductRepository } from "../../src/modules/products/product-service.ts";
const tenantA="11111111-1111-4111-8111-111111111111", tenantB="22222222-2222-4222-8222-222222222222",actor="33333333-3333-4333-8333-333333333333";
const admin={tenantId:tenantA,userId:actor,roles:["OWNER_ADMIN"]} as const;
class Memory implements ProductRepository{records:ProductRecord[]=[];audit:any[]=[];async list(t:string){return this.records.filter(r=>r.tenantId===t)}async get(t:string, i:string){return this.records.find(r=>r.tenantId===t&&r.id===i)??null}async create(input:any){const r={} as ProductRecord;Object.assign(r,{id:crypto.randomUUID(),tenantId:input.tenantId,...input.values,version:1,createdAt:"2026-11-16T10:00:00Z",updatedAt:"2026-11-16T10:00:00Z"});this.records.push(r);this.audit.push({action:"PRODUCT_CREATED"});return r}async update(input:any){const i=this.records.findIndex(r=>r.tenantId===input.tenantId&&r.id===input.id);if(i<0)return null;const b=this.records[i];if(b.version!==input.expectedVersion)throw new ProductProblem("STALE_VERSION",412);const a={...b,...input.values,version:b.version+1,updatedAt:"2026-11-16T10:01:00Z"};this.records[i]=a;this.audit.push({action:productAuditAction(b.status,a.status)});return a}}
test("product schema evolves CoffeeSpecification into a tenant master with append-only audit",()=>{const s=readFileSync("prisma/schema.prisma","utf8"),m=readFileSync("prisma/migrations/202611160004_product_foundation/migration.sql","utf8");assert.match(s,/model CoffeeSpecification {[\s\S]*tenant_id[\s\S]*name_en[\s\S]*name_ar[\s\S]*@@unique\(\[tenant_id, reference\]\)/);assert.match(s,/model ProductAuditEvent/);assert.match(m,/ALTER TABLE "CoffeeSpecification"/);assert.match(m,/ProductAuditEvent_append_only/);assert.doesNotMatch(m,/INSERT INTO "CoffeeSpecification"/)});
test("product lifecycle is bilingual, tenant-scoped, authorized and versioned",async()=>{const r=new Memory(),s=createProductService(r);const c=await s.create({principal:admin,input:{reference:" prod-1 ",nameEn:" Yemen Mocha ",nameAr:" موام يمني يمئن ",origin:"ye",type:"Arabica",grade:"Matari",cropYear:"2026",bagType:"Jute",standardBagWeight:"60"}});assert.equal(c.reference,"PROD-1");assert.equal(c.origin,"YE");assert.equal((await s.list({principal:{...admin,tenantId:tenantB}})).length,0);await assert.rejects(()=>s.create({principal:{...admin,roles:["FINANCE_VIEWER"]},input:{}}),(e:any)=>e.code==="PERMISSION_DENIED");const d=await s.update({principal:admin,id:c.id,expectedVersion:1, input:{status:"INACTIVE"}});assert.equal(d.version,2);assert.equal(r.audit.at(-1).action,"PRODUCT_DEACTIVATED");});

test("product migration expands safely, quarantines unassigned legacy rows, and aligns origin storage",()=>{
 const schema=readFileSync("prisma/schema.prisma","utf8"), migration=readFileSync("prisma/migrations/202611160004_product_foundation/migration.sql","utf8"), fixture=readFileSync("tests/fixtures/r1-masters.ts","utf8");
 assert.doesNotMatch(migration,/ADD COLUMN "(?:tenant_id|name_en|name_ar)" [^,;]+ NOT NULL/);
 assert.match(migration,/CREATE TABLE "LegacyProductQuarantine"/);
 assert.match(schema,/model LegacyProductQuarantine/);
 assert.match(migration,/INSERT INTO "LegacyProductQuarantine"[\s\S]*FROM "CoffeeSpecification"/);
 assert.match(migration,/CoffeeSpecification_ownership_complete/);
 assert.match(migration,/CoffeeSpecification_legacy_reference_key[\s\S]*WHERE "tenant_id" IS NULL/);
 assert.match(migration,/"tenant_id" IS NULL[\s\S]*"origin" ~ '\^\[A-Z\]\{2\}\$'/);
 assert.match(schema,/origin\s+String\s*\n/);
 assert.doesNotMatch(schema,/origin\s+String\s+@db\.Char\(2\)/);
 for(const key of ["tenant_id","name_en","name_ar","origin:\"ET\""]) assert.ok(fixture.includes(key),`fixture missing ${key}`);
 assert.doesNotMatch(fixture,/origin:"Ethiopia"/);
});
test("product tenant invariants bind audit rows while legacy operational links remain explicitly quarantined",()=>{
 const migration=readFileSync("prisma/migrations/202611160004_product_foundation/migration.sql","utf8");
 assert.match(migration,/ProductAuditEvent_product_tenant_fkey/);
 assert.match(migration,/ProductAuditEvent_tenant_actor_fkey/);
 assert.match(migration,/LegacyProductQuarantine[\s\S]*operational_reference_count/);
});
