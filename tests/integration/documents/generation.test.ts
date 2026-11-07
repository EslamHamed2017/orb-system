import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const DATASET_ID = "019a5f9b-7c00-7000-8000-000000000901";
const SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000000902";
const OTHER_DATASET_ID = "019a5f9b-7c00-7000-8000-000000000903";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000904", displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000905", displayName: "Owner", roles: ["OWNER_ADMIN"] });

type Kind = "CINV" | "PACKING_LIST";
type Language = "AR" | "EN" | "BILINGUAL";
type Principal = typeof OPERATIONS;
type Revision = Readonly<{
  id: string;
  documentId: string;
  revisionNo: number;
  sourceDatasetId: string;
  language: Language;
  generationState: "QUEUED" | "RENDERING" | "READY" | "FAILED";
  lifecycleState: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "CANCELLED" | "SUPERSEDED";
  version: number;
  sha256: string | null;
  bytes: Uint8Array | null;
  reason: string | null;
  approvalId: string | null;
}>;
interface DocumentService {
  generate(input: Record<string, unknown>): Promise<{ value: Revision; replayed: boolean }>;
  runNextGeneration(): Promise<Revision | null>;
  getStatus(documentId: string): Promise<Revision>;
  submitForApproval(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  applyDecision(input: Record<string, unknown>): Promise<any>;
  revise(input: Record<string, unknown>): Promise<{ value: Revision; replayed: boolean }>;
  cancel(input: Record<string, unknown>): Promise<{ value: Revision; replayed: boolean }>;
  getHistory(documentId: string): Promise<readonly Revision[]>;
}
interface DocumentModule {
  createInMemoryDocumentService(options: Record<string, unknown>): DocumentService;
}
async function loadDocuments(): Promise<DocumentModule> {
  return import("../../../src/modules/documents/document-service.ts") as Promise<DocumentModule>;
}
function command(key: string, principal: Principal = OPERATIONS) {
  return { principal, idempotencyKey: key, correlationId: key };
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status);
}
async function subject() {
  const module = await loadDocuments();
  const service = module.createInMemoryDocumentService({
    now: () => "2026-11-07T09:00:00.000Z",
    datasets: [{
      id: DATASET_ID,
      shipmentId: SHIPMENT_ID,
      revisionNo: 3,
      approvalState: "APPROVED",
      datasetHash: "d".repeat(64),
      sharedFields: {
        shipmentReference: "ORB-SAL-0009",
        customerReference: "PO-2026-0042",
        coffeeSpecification: "Arabica Grade 1",
        bagCount: 320,
        netWeight: "19200.000000",
        grossWeight: "19360.000000",
        origin: "ET",
        destination: "AE",
      },
    }],
  });
  return { service };
}
async function generateReady(service: DocumentService, kind: Kind, language: Language, key: string) {
  const queued = await service.generate({
    shipmentId: SHIPMENT_ID, expectedVersion: 1, sourceDatasetId: DATASET_ID, kind, language, ...command(key),
  });
  assert.equal(queued.value.generationState, "QUEUED");
  assert.equal(queued.value.sha256, null);
  assert.equal(queued.value.bytes, null);
  const rendering = await service.runNextGeneration();
  assert.equal(rendering?.generationState, "RENDERING");
  const ready = await service.runNextGeneration();
  assert.equal(ready?.generationState, "READY");
  assert.equal(ready?.lifecycleState, "DRAFT");
  assert.match(ready?.sha256 ?? "", /^[a-f0-9]{64}$/);
  assert.ok((ready?.bytes.byteLength ?? 0) > 0);
  return ready!;
}

test("generation queues and polls an exact approved dataset before immutable bytes become ready", async () => {
  const { service } = await subject();
  const ready = await generateReady(service, "CINV", "EN", "document-generate-status");
  assert.equal(ready.sourceDatasetId, DATASET_ID);
  assert.deepEqual(await service.getStatus(ready.documentId), ready);

  await assert.rejects(
    () => service.generate({ shipmentId: SHIPMENT_ID, expectedVersion: 1, sourceDatasetId: OTHER_DATASET_ID, kind: "CINV", language: "EN", ...command("document-wrong-dataset") }),
    isProblem("DOCUMENT_SOURCE_DATASET_INVALID", 409),
  );
});

test("CINV and Packing List generated from one dataset preserve exact shared fields in every language", async () => {
  const { service } = await subject();
  for (const language of ["AR", "EN", "BILINGUAL"] as const) {
    const cinv = await generateReady(service, "CINV", language, `document-cinv-${language}`);
    const packing = await generateReady(service, "PACKING_LIST", language, `document-packing-${language}`);
    assert.equal(cinv.sourceDatasetId, DATASET_ID);
    assert.equal(packing.sourceDatasetId, DATASET_ID);
    assert.notDeepEqual(cinv.bytes, packing.bytes, "distinct document kinds must not reuse output bytes");
  }
});

test("approval binds the exact ready revision version and hash and makes approved bytes immutable", async () => {
  const { service } = await subject();
  const ready = await generateReady(service, "CINV", "BILINGUAL", "document-approval-ready");
  const pending = await service.submitForApproval({ documentId: ready.documentId, expectedVersion: ready.version, ...command("document-submit") });
  assert.deepEqual(
    { subjectId: pending.value.subjectId, subjectVersion: pending.value.subjectVersion, subjectHash: pending.value.subjectHash },
    { subjectId: ready.id, subjectVersion: ready.version, subjectHash: ready.sha256 },
  );
  await assert.rejects(
    () => service.applyDecision({ approvalId: pending.value.id, approver: OPERATIONS, decision: "APPROVED", comment: "self" }),
    isProblem("SELF_APPROVAL_FORBIDDEN", 409),
  );
  await service.applyDecision({ approvalId: pending.value.id, approver: OWNER, decision: "APPROVED", comment: "Exact bytes approved" });
  const approved = await service.getStatus(ready.documentId);
  assert.equal(approved.lifecycleState, "APPROVED");
  assert.equal(approved.sha256, ready.sha256);
  assert.deepEqual(approved.bytes, ready.bytes);
  const approvedBytes = Uint8Array.from(approved.bytes!);
  approved.bytes![0] = approved.bytes![0]! ^ 0xff;
  assert.deepEqual((await service.getStatus(ready.documentId)).bytes, approvedBytes, "returned bytes must not mutate stored approved output");
});

test("reasoned revision supersedes without changing prior bytes or hash", async () => {
  const { service } = await subject();
  const original = await generateReady(service, "PACKING_LIST", "EN", "document-revision-original");
  const oldBytes = Uint8Array.from(original.bytes!);
  const revised = await service.revise({ documentId: original.documentId, expectedVersion: original.version, reason: "Correct consignee display name", ...command("document-revise") });
  assert.equal(revised.value.revisionNo, 2);
  assert.equal(revised.value.generationState, "QUEUED");
  assert.equal(revised.value.reason, "Correct consignee display name");
  const history = await service.getHistory(original.documentId);
  assert.equal(history[0]?.lifecycleState, "SUPERSEDED");
  assert.equal(history[0]?.sha256, original.sha256);
  assert.deepEqual(history[0]?.bytes, oldBytes);
  assert.equal(history[1]?.id, revised.value.id);
});

test("only draft or newly revised output can be cancelled with a reason and replay is harmless", async () => {
  const { service } = await subject();
  const ready = await generateReady(service, "CINV", "AR", "document-cancel-ready");
  await assert.rejects(
    () => service.cancel({ documentId: ready.documentId, expectedVersion: ready.version, reason: "", ...command("document-cancel-no-reason") }),
    isProblem("VALIDATION_FAILED", 422),
  );
  const input = { documentId: ready.documentId, expectedVersion: ready.version, reason: "Customer withdrew draft", ...command("document-cancel") };
  const first = await service.cancel(input);
  const replay = await service.cancel(input);
  assert.equal(first.value.lifecycleState, "CANCELLED");
  assert.equal(first.value.reason, "Customer withdrew draft");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
});
