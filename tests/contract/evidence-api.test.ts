import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const OPENAPI = readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8");

function section(start: string, end: string): string {
  const from = OPENAPI.indexOf(start);
  const to = OPENAPI.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return OPENAPI.slice(from, to);
}

test("evidence upload and authorized read routes retain their exact public controls", () => {
  const upload = section("  /evidence:\n", "  /evidence/{evidenceId}:\n");
  assert.match(upload, /operationId: uploadEvidence/);
  assert.match(upload, /name: X-Content-SHA256[\s\S]*required: true[\s\S]*pattern: \^\[a-f0-9\]\{64\}\$/);
  assert.match(upload, /multipart\/form-data:[\s\S]*- file[\s\S]*- subjectType[\s\S]*- subjectId[\s\S]*- purpose/);
  assert.match(upload, /x-required-roles:\n      - OWNER_ADMIN\n      - OPERATIONS\n/);

  const metadata = section("  /evidence/{evidenceId}:\n", "  /evidence/{evidenceId}/content:\n");
  const content = section("  /evidence/{evidenceId}/content:\n", "  /sales-shipments/{shipmentId}/documents:\n");
  assert.match(metadata, /operationId: getEvidenceMetadata/);
  assert.match(content, /operationId: viewOrDownloadEvidence/);
  assert.match(content, /description: Authorized immutable bytes; access is audited/);
  for (const operation of [metadata, content]) {
    assert.match(operation, /x-required-roles:\n      - OWNER_ADMIN\n      - OPERATIONS\n      - FINANCE_VIEWER\n/);
  }
});

test("EvidenceMetadata is closed, immutable, source-linked, and conditionally shaped", () => {
  const schema = section("    EvidenceMetadata:\n", "    AuditEvent:\n");
  assert.match(schema, /additionalProperties: false/);
  for (const required of ["id", "sha256", "byteLength", "mediaType", "originalFilename", "verificationState", "uploadedBy", "uploadedAt", "sourceLinks", "immutable", "verifiedAt", "verifiedBy"]) {
    assert.match(schema, new RegExp(`      - ${required}\\n`), required);
  }
  assert.match(schema, /sourceLinks:[\s\S]*minItems: 1[\s\S]*- subjectType[\s\S]*- subjectId[\s\S]*- purpose/);
  assert.match(schema, /immutable:\n          type: boolean\n          const: true/);
  assert.match(schema, /const: VERIFIED[\s\S]*then:[\s\S]*verifiedAt:\n              type: string[\s\S]*verifiedBy:\n              \$ref: '#\/components\/schemas\/ActorSnapshot'/);
  assert.match(schema, /const: PENDING[\s\S]*then:[\s\S]*verifiedAt:\n              type: 'null'\n              const: null[\s\S]*verifiedBy:\n              type: 'null'\n              const: null/);
});


test("evidence list route requires project scope and server-side role authorization", async () => {
  const route = await import("../../src/app/api/evidence/route.ts");
  const principal = { userId: "019a5f9b-7c00-7000-8000-000000000801", roles: ["OPERATIONS"] };
  let received: any;
  const get = route.createEvidenceListGetHandler({ authenticate: async () => principal, list: async (input) => { received = input; return []; } });
  const response = await get(new (await import("next/server.js")).NextRequest("https://orb.example/api/evidence?projectId=019a5f9b-7c00-7000-8000-000000000802&subjectType=CONTRACT&subjectId=019a5f9b-7c00-7000-8000-000000000803"));
  assert.equal(response.status, 200);
  assert.equal(received.projectId, "019a5f9b-7c00-7000-8000-000000000802");
  assert.equal(received.subjectType, "CONTRACT");

  const malformed = await get(new (await import("next/server.js")).NextRequest("https://orb.example/api/evidence?projectId=019a5f9b-7c00-7000-8000-000000000802&subjectType=CONTRACT"));
  assert.equal(malformed.status, 400);
  const denied = route.createEvidenceListGetHandler({ authenticate: async () => ({ userId: "x", roles: [] }), list: async () => { throw new Error("must not run"); } });
  assert.equal((await denied(new (await import("next/server.js")).NextRequest("https://orb.example/api/evidence?projectId=x"))).status, 403);
});
