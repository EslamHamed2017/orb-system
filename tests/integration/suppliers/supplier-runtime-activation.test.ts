import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { supplierCsrfToken, validateSupplierMutationRequest } from "../../../src/modules/suppliers/supplier-mutation-security.ts";

test("production supplier routes are runtime composed", () => {
  const source = readFileSync("src/app/api/suppliers/route.ts","utf8") + readFileSync("src/app/api/suppliers/[supplierId]/route.ts","utf8");
  assert.doesNotMatch(source,/const unavailable/);
  for (const seam of ["supplierRuntime", "service.list", "supplierRuntime().create", "service.get", "supplierRuntime().update"]) assert.ok(source.includes(seam), `missing ${seam}`);
});
test("supplier mutations require exact origin session-bound CSRF and UUID idempotency", () => {
  process.env.ORB_APP_ORIGIN="https://orb.example";
  const session="session-secret", csrf=supplierCsrfToken(session);
  const valid=new Request("https://orb.example/api/suppliers",{method:"POST",headers:{origin:"https://orb.example",cookie:`__Host-orb_session=${session}; __Host-orb_csrf=${csrf}`,"x-csrf-token":csrf,"idempotency-key":"11111111-1111-7111-8111-111111111111"}});
  assert.equal(validateSupplierMutationRequest(valid),"11111111-1111-7111-8111-111111111111");
  assert.throws(()=>validateSupplierMutationRequest(new Request(valid.url,{method:"POST",headers:{origin:"https://evil.example"}})));
});
test("isolated gate generates Prisma before supplier PostgreSQL runtime", () => {
 const gate=readFileSync("ops/acceptance/run-isolated-infrastructure-gate.sh","utf8");
 assert.ok(gate.indexOf("corepack pnpm prisma generate")>=0);
 assert.ok(gate.indexOf("tests/integration/suppliers/supplier-api-postgres.test.ts")>gate.indexOf("corepack pnpm prisma generate"));
});
