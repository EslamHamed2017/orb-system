import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import test from "node:test";

const databaseUrl=process.env.ORB_TEST_DATABASE_URL;
const integration=databaseUrl?test:test.skip;
const uuid7=()=>{const value=randomUUID();return `${value.slice(0,14)}7${value.slice(15)}`};
const userId="019a5f9b-7c00-7000-8000-000000000311";

integration("the CSRF cookie issued by real sign-in authorizes a supplier mutation",async()=>{
 // @ts-expect-error pg is a runtime dependency; optional declarations are not needed.
 const {Client}=await import("pg");const sql=new Client({connectionString:databaseUrl});await sql.connect();const tenantId=uuid7();
 try{
  await sql.query('INSERT INTO "Tenant" (id,slug,name) VALUES ($1,$2,$3)',[tenantId,`supplier-signin-${tenantId}`,"Supplier sign-in integration"]);
  await sql.query('INSERT INTO "User" (id,auth_subject,name_ar,name_en,locale,status,mfa_state,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now()) ON CONFLICT (id) DO NOTHING',[userId,"supplier-signin-operations","عمليات","Operations","en","ACTIVE","SATISFIED"]);
  await sql.query('INSERT INTO "UserRole" (id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT (user_id,role) DO NOTHING',[uuid7(),userId,"OPERATIONS"]);
  await sql.query('INSERT INTO "TenantMembership" (id,tenant_id,user_id,status) VALUES ($1,$2,$3,$4)',[uuid7(),tenantId,userId,"ACTIVE"]);
  process.env.DATABASE_URL=databaseUrl;process.env.ORB_TEST_AUTH="1";process.env.ORB_APP_ORIGIN="http://127.0.0.1:3999";
  const sessions=await import("../../../src/app/api/sessions/route.ts"),suppliers=await import("../../../src/app/api/suppliers/route.ts");
  const signIn=await sessions.POST(new Request("http://127.0.0.1:3999/api/sessions",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({login:"operations@example.test",credential:"test-credential"})}) as never);
  assert.equal(signIn.status,201);const setCookie=signIn.headers.get("set-cookie")??"";const token=/__Host-orb_session=([^;]+)/.exec(setCookie)?.[1],csrf=/__Host-orb_csrf=([^;]+)/.exec(setCookie)?.[1];assert.ok(token);assert.ok(csrf);
  const created=await suppliers.POST(new Request("http://127.0.0.1:3999/api/suppliers",{method:"POST",headers:{origin:"http://127.0.0.1:3999","content-type":"application/json",cookie:`__Host-orb_session=${token}; __Host-orb_csrf=${csrf}`,"x-csrf-token":decodeURIComponent(csrf),"idempotency-key":uuid7()},body:JSON.stringify({reference:"SUP-SIGNIN",registeredName:"Signed-in Coffee Export",displayNameAr:null,countryCode:"ET",contactName:"Hana",email:"hana@example.test",phone:null,paymentCurrency:"USD",paymentTermsDays:30})}));
  if(created.status!==201)assert.fail(`supplier create returned ${created.status}: ${await created.text()}`);assert.ok((await created.json() as {id:string}).id);
 }finally{
  await sql.end();const {getPrismaClient}=await import("../../../src/platform/database/prisma-client.ts");await getPrismaClient().$disconnect();
 }
});
