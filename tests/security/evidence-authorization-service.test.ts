import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000701";
const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000702";
const SUBJECT_ID = "019a5f9b-7c00-7000-8000-000000000703";
const ACTOR_ID = "019a5f9b-7c00-7000-8000-000000000704";
const bytes = Buffer.from("authorized evidence");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const actor = { userId: ACTOR_ID, roles: ["OPERATIONS"] };
const sourceLink = { subjectType: "SALES_SHIPMENT", subjectId: SUBJECT_ID, purpose: "DELIVERY_PROOF" };
const resolvedLink = { ...sourceLink, projectId: PROJECT_ID, authorizationParentType: "SALES_SHIPMENT", authorizationParentId: SUBJECT_ID };

async function module() { return import("../../src/modules/evidence/evidence-service.ts"); }
async function* content() { yield bytes; }

function uploadFixture(authorized: boolean) {
  let objectWrites = 0;
  const persisted: any[] = [];
  return {
    input: {
      id: EVIDENCE_ID, content: content(), expectedSha256: sha256, originalFilename: "proof.pdf", mediaType: "application/pdf",
      maxBytes: 1024, retentionUntil: "2033-11-06T00:00:00.000Z", sourceLink, actor, transaction: {},
      resolveSourceAuthorization: async () => authorized ? resolvedLink : null,
      malwareScanner: { scan: async () => ({ clean: true }) },
      objectStore: { putImmutable: async () => { objectWrites++; return { objectKey: `evidence/${EVIDENCE_ID}`, objectVersionId: "v1", retentionUntil: "2033-11-06T00:00:00.000Z", sha256, byteLength: bytes.length }; } },
      repository: { insertEvidence: async (_tx: unknown, evidence: unknown) => persisted.push(evidence) },
      audit: { append: async () => undefined },
    },
    persisted, writes: () => objectWrites,
  };
}

test("upload resolves and persists project authorization metadata before writing bytes", async () => {
  const service = await module();
  const allowed = uploadFixture(true);
  await service.uploadEvidence(allowed.input);
  assert.equal(allowed.writes(), 1);
  assert.equal(allowed.persisted[0].projectId, PROJECT_ID);
  assert.deepEqual(allowed.persisted[0].sourceLinks, [resolvedLink]);

  const denied = uploadFixture(false);
  await assert.rejects(service.uploadEvidence(denied.input), /forbidden|source|authorization/i);
  assert.equal(denied.writes(), 0, "authorization must precede object storage");
  assert.deepEqual(denied.persisted, []);
});

test("list returns only source-authorized evidence in the requested project and subject", async () => {
  const service = await module();
  const records = [
    { id: EVIDENCE_ID, projectId: PROJECT_ID, sourceLinks: [resolvedLink], objectKey: "private/a", objectVersionId: "v1", retentionUntil: "2033-11-06T00:00:00.000Z" },
    { id: "019a5f9b-7c00-7000-8000-000000000799", projectId: PROJECT_ID, sourceLinks: [{ ...resolvedLink, authorizationParentId: "019a5f9b-7c00-7000-8000-000000000798" }], objectKey: "private/b", objectVersionId: "v1", retentionUntil: "2033-11-06T00:00:00.000Z" },
  ];
  let query: unknown;
  const result = await service.listEvidence({
    actor, projectId: PROJECT_ID, subjectType: "SALES_SHIPMENT", subjectId: SUBJECT_ID,
    repository: { listEvidence: async (input: unknown) => { query = input; return records; } },
    authorize: async ({ sourceLinks }: any) => sourceLinks[0].authorizationParentId === SUBJECT_ID,
  });
  assert.deepEqual(query, { projectId: PROJECT_ID, subjectType: "SALES_SHIPMENT", subjectId: SUBJECT_ID });
  assert.deepEqual(result.map((item: any) => item.id), [EVIDENCE_ID]);
  assert.equal(Object.hasOwn(result[0], "objectKey"), false);
});


test("Prisma repository persists and queries project plus authorization-parent scope", async () => {
  const { PrismaEvidenceRepository } = await import("../../src/modules/evidence/evidence-repository.ts");
  const creates: any[] = [];
  const queries: any[] = [];
  const row = {
    id: EVIDENCE_ID, project_id: PROJECT_ID, sha256, byte_length: BigInt(bytes.length), media_type: "application/pdf",
    object_key: "evidence/key", object_version_id: "v1", original_filename: "proof.pdf", verification_state: "PENDING",
    verified_at: null, verified_by: null, uploaded_by: ACTOR_ID, uploaded_at: new Date("2026-11-11T00:00:00Z"), retention_until: new Date("2033-11-06T00:00:00Z"),
    EvidenceLink: [{ subject_type: sourceLink.subjectType, subject_id: SUBJECT_ID, purpose: sourceLink.purpose, project_id: PROJECT_ID, authorization_parent_type: sourceLink.subjectType, authorization_parent_id: SUBJECT_ID }],
  };
  const client = { evidenceObject: {
    create: async (args: any) => { creates.push(args); },
    findUnique: async () => row,
    findMany: async (args: any) => { queries.push(args); return [row]; },
  } };
  const repository = new PrismaEvidenceRepository(client);
  const evidence = {
    id: EVIDENCE_ID, projectId: PROJECT_ID, sha256, byteLength: bytes.length, mediaType: "application/pdf", objectKey: "evidence/key", objectVersionId: "v1", originalFilename: "proof.pdf", verificationState: "PENDING" as const, verifiedAt: null, verifiedBy: null, uploadedBy: actor, uploadedAt: "2026-11-11T00:00:00.000Z", retentionUntil: "2033-11-06T00:00:00.000Z", sourceLinks: [resolvedLink],
  };
  await repository.insertEvidence(client, evidence);
  assert.equal(creates[0].data.project_id, PROJECT_ID);
  assert.deepEqual(creates[0].data.EvidenceLink.create[0], { project_id: PROJECT_ID, subject_type: "SALES_SHIPMENT", subject_id: SUBJECT_ID, authorization_parent_type: "SALES_SHIPMENT", authorization_parent_id: SUBJECT_ID, purpose: "DELIVERY_PROOF" });
  const listed = await repository.listEvidence({ projectId: PROJECT_ID, subjectType: "SALES_SHIPMENT", subjectId: SUBJECT_ID });
  assert.deepEqual(queries[0].where, { project_id: PROJECT_ID, EvidenceLink: { some: { project_id: PROJECT_ID, subject_type: "SALES_SHIPMENT", subject_id: SUBJECT_ID } } });
  assert.equal(listed[0].sourceLinks[0].authorizationParentId, SUBJECT_ID);
});
