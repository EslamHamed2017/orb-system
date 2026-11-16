import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { productCsrfToken, validateProductMutationRequest } from "../../../src/modules/products/product-mutation-security.ts";

test("production product routes are runtime composed", () => {
  const source = readFileSync("src/app/api/products/route.ts","utf8") + readFileSync("src/app/api/products/[productId]/route.ts","utf8");
  assert.doesNotMatch(source,/const unavailable/);
  for (const seam of ["productRuntime", "service.list", "productRuntime().create", "service.get", "productRuntime().update"]) assert.ok(source.includes(seam), `missing ${seam}`);
});
test("product mutations require exact origin session-bound CSRF and UUID idempotency", () => {
  process.env.ORB_APP_ORIGIN="https://orb.example";
  const session="session-secret", csrf=productCsrfToken(session);
  const valid=new Request("https://orb.example/api/products",{method:"POST",headers:{origin:"https://orb.example",cookie:`__Host-orb_session=${session}; __Host-orb_csrf=${csrf}`,"x-csrf-token":csrf,"idempotency-key":"11111111-1111-7111-8111-111111111111"}});
  assert.equal(validateProductMutationRequest(valid),"11111111-1111-7111-8111-111111111111");
  assert.throws(()=>validateProductMutationRequest(new Request(valid.url,{method:"POST",headers:{origin:"https://evil.example"}})));
});
test("isolated gate generates Prisma before product PostgreSQL runtime", () => {
 const gate=readFileSync("ops/acceptance/run-isolated-infrastructure-gate.sh","utf8");
 assert.ok(gate.indexOf("corepack pnpm prisma generate")>=0);
 assert.ok(gate.indexOf("tests/integration/products/product-api-postgres.test.ts")>gate.indexOf("corepack pnpm prisma generate"));
});
