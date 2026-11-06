import assert from "node:assert/strict";
import test from "node:test";

const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000201";
const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000202";
const ACTOR_ID = "019a5f9b-7c00-7000-8000-000000000203";

interface EvidenceAccessModule {
  getEvidenceMetadata(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  openEvidenceContent(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

async function loadEvidenceAccess(): Promise<EvidenceAccessModule> {
  return import("../../src/modules/evidence/evidence-service.ts") as Promise<EvidenceAccessModule>;
}

function fixture(authorized: boolean) {
  const objectReads: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
  const evidence = {
    id: EVIDENCE_ID,
    objectKey: "tenant-private/evidence/object-201",
    objectVersionId: "immutable-version-7",
    projectId: PROJECT_ID,
    sourceLinks: [{ subjectType: "Project", subjectId: PROJECT_ID, purpose: "ROUTE_PROOF" }],
    verificationState: "VERIFIED",
  };
  return {
    actor: { userId: ACTOR_ID, roles: ["FINANCE_VIEWER"] },
    repository: { findEvidenceById: async (id: string) => id === EVIDENCE_ID ? evidence : null },
    authorize: async () => authorized,
    objectStore: {
      getImmutable: async (request: Record<string, unknown>) => {
        objectReads.push(request);
        return { body: Buffer.from("authorized bytes"), contentType: "application/pdf", byteLength: 16 };
      },
    },
    audit: { append: async (event: Record<string, unknown>) => { audits.push(event); } },
    objectReads,
    audits,
  };
}

test("an authorized identifier cannot be replaced with another evidence ID or a raw object key", async () => {
  const access = await loadEvidenceAccess();
  for (const supplied of [
    "019a5f9b-7c00-7000-8000-000000000299",
    "tenant-private/evidence/object-201",
    "../tenant-private/evidence/object-201",
  ]) {
    const denied = fixture(false);
    await assert.rejects(access.openEvidenceContent({
      evidenceId: supplied,
      disposition: "inline",
      actor: denied.actor,
      repository: denied.repository,
      authorize: denied.authorize,
      objectStore: denied.objectStore,
      audit: denied.audit,
    }), /forbidden|not found|evidence|identifier/i);
    assert.deepEqual(denied.objectReads, [], "denial must happen before object storage access");
    assert.deepEqual(denied.audits, [], "denied access must not emit a successful-view audit");
  }
});

test("metadata and bytes both require source-link authorization", async () => {
  const access = await loadEvidenceAccess();
  const denied = fixture(false);
  for (const method of [access.getEvidenceMetadata, access.openEvidenceContent]) {
    await assert.rejects(method({
      evidenceId: EVIDENCE_ID,
      disposition: "inline",
      actor: denied.actor,
      repository: denied.repository,
      authorize: denied.authorize,
      objectStore: denied.objectStore,
      audit: denied.audit,
    }), /forbidden|not found|evidence/i);
  }
  assert.deepEqual(denied.objectReads, []);
});

test("authorized view/download uses only the stored immutable version and appends an access audit", async () => {
  const access = await loadEvidenceAccess();
  for (const disposition of ["inline", "attachment"] as const) {
    const allowed = fixture(true);
    const result = await access.openEvidenceContent({
      evidenceId: EVIDENCE_ID,
      disposition,
      actor: allowed.actor,
      repository: allowed.repository,
      authorize: allowed.authorize,
      objectStore: allowed.objectStore,
      audit: allowed.audit,
      correlationId: `correlation-${disposition}`,
    });
    assert.deepEqual(allowed.objectReads, [{ objectKey: "tenant-private/evidence/object-201", objectVersionId: "immutable-version-7" }]);
    assert.equal(allowed.audits.length, 1);
    assert.deepEqual(allowed.audits[0], {
      action: disposition === "inline" ? "EVIDENCE_VIEWED" : "EVIDENCE_DOWNLOADED",
      evidenceId: EVIDENCE_ID,
      actorId: ACTOR_ID,
      projectId: PROJECT_ID,
      correlationId: `correlation-${disposition}`,
    });
    assert.equal(result.disposition, disposition);
  }
});
