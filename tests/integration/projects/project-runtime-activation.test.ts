import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { projectCsrfToken, validateProjectMutationRequest } from "../../../src/modules/projects/project-mutation-security.ts";

test("production project routes use the tenant-aware PostgreSQL runtime", () => {
  const collection = readFileSync("src/app/api/projects/route.ts", "utf8");
  const record = readFileSync("src/app/api/projects/[projectId]/route.ts", "utf8");
  assert.doesNotMatch(collection + record, /authenticate:\s*async\s*\(\)\s*=>\s*null|const unavailable/);
  for (const seam of ["projectRuntime", "service.list", "projectRuntime().create", "service.get"]) assert.ok((collection + record).includes(seam), `missing ${seam}`);
});

test("project creation requires exact origin, session-bound CSRF, and UUID idempotency", () => {
  process.env.ORB_APP_ORIGIN = "https://orb.example";
  const session = "project-session-secret";
  const csrf = projectCsrfToken(session);
  const valid = new Request("https://orb.example/api/projects", { method: "POST", headers: {
    origin: "https://orb.example", cookie: `__Host-orb_session=${session}; __Host-orb_csrf=${csrf}`,
    "x-csrf-token": csrf, "idempotency-key": "11111111-1111-7111-8111-111111111111",
  } });
  assert.equal(validateProjectMutationRequest(valid), "11111111-1111-7111-8111-111111111111");
  assert.throws(() => validateProjectMutationRequest(new Request(valid.url, { method: "POST", headers: { origin: "https://evil.example" } })));
});

test("isolated infrastructure gate exercises the project API against PostgreSQL", () => {
  const gate = readFileSync("ops/acceptance/run-isolated-infrastructure-gate.sh", "utf8");
  assert.ok(gate.includes("tests/integration/projects/project-api-postgres.test.ts"));
});
