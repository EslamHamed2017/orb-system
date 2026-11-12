import assert from "node:assert/strict";
import test from "node:test";

const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000901";
const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000902";
const OTHER_PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000903";
const SUBJECT_ID = "019a5f9b-7c00-7000-8000-000000000904";
const ACTOR_ID = "019a5f9b-7c00-7000-8000-000000000905";

const actor = { userId: ACTOR_ID, roles: ["OPERATIONS"] };
const sourceLink = {
  projectId: PROJECT_ID,
  subjectType: "SALES_SHIPMENT",
  subjectId: SUBJECT_ID,
  authorizationParentType: "SALES_SHIPMENT",
  authorizationParentId: SUBJECT_ID,
  purpose: "DELIVERY_PROOF",
};

function storedEvidence(sourceLinks: readonly Record<string, unknown>[] = [sourceLink]) {
  return {
    id: EVIDENCE_ID,
    projectId: PROJECT_ID,
    sha256: "a".repeat(64),
    byteLength: 12,
    mediaType: "application/pdf",
    objectKey: "private/evidence-901",
    objectVersionId: "immutable-v1",
    originalFilename: "proof.pdf",
    verificationState: "PENDING" as const,
    verifiedAt: null,
    verifiedBy: null,
    uploadedBy: actor,
    uploadedAt: "2026-11-12T00:00:00.000Z",
    retentionUntil: "2033-11-12T00:00:00.000Z",
    sourceLinks,
  };
}

test("repository subject matching is constrained to the requested project", async () => {
  const { PrismaEvidenceRepository } = await import("../../src/modules/evidence/evidence-repository.ts");
  let query: any;
  const repository = new PrismaEvidenceRepository({ evidenceObject: {
    create: async () => undefined,
    findUnique: async () => null,
    findMany: async (args: any) => { query = args; return []; },
  } });

  await repository.listEvidence({ projectId: PROJECT_ID, subjectType: "SALES_SHIPMENT", subjectId: SUBJECT_ID });

  assert.deepEqual(query.where.EvidenceLink.some, {
    project_id: PROJECT_ID,
    subject_type: "SALES_SHIPMENT",
    subject_id: SUBJECT_ID,
  });
});

test("cross-project persisted source metadata fails closed before authorization or object storage", async () => {
  const { getEvidenceMetadata, openEvidenceContent } = await import("../../src/modules/evidence/evidence-service.ts");
  let authorizationCalls = 0;
  let objectReads = 0;
  const malformed = storedEvidence([{ ...sourceLink, projectId: OTHER_PROJECT_ID }]);
  const dependencies = {
    evidenceId: EVIDENCE_ID,
    actor,
    repository: { findEvidenceById: async () => malformed },
    authorize: async () => { authorizationCalls++; return true; },
  };

  await assert.rejects(getEvidenceMetadata(dependencies), /invalid|scope|project|source/i);
  await assert.rejects(openEvidenceContent({
    ...dependencies,
    disposition: "inline",
    objectStore: { getImmutable: async () => { objectReads++; return { body: Buffer.alloc(0), contentType: "application/pdf" }; } },
    audit: { append: async () => undefined },
  }), /invalid|scope|project|source/i);

  assert.equal(authorizationCalls, 0, "corrupt scope metadata must fail before parent authorization");
  assert.equal(objectReads, 0, "corrupt scope metadata must never reach object storage");
});

test("evidence without an authorization parent fails closed", async () => {
  const { getEvidenceMetadata } = await import("../../src/modules/evidence/evidence-service.ts");
  let authorizationCalls = 0;

  await assert.rejects(getEvidenceMetadata({
    evidenceId: EVIDENCE_ID,
    actor,
    repository: { findEvidenceById: async () => storedEvidence([]) },
    authorize: async () => { authorizationCalls++; return true; },
  }), /invalid|scope|source|authorization/i);

  assert.equal(authorizationCalls, 0);
});
