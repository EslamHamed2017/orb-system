import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000010001";
const SALES_SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000010002";
const SUPPLIER_SHIPMENT_ID = "019a5f9b-7c00-7000-8000-000000010003";
const CLAIMANT_ID = "019a5f9b-7c00-7000-8000-000000010004";
const RESPONDENT_ID = "019a5f9b-7c00-7000-8000-000000010005";
const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000010006";
const OUTCOME_EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000010007";
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000010008", displayName: "Operations", roles: ["OPERATIONS"] });
const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000010009", displayName: "Owner", roles: ["OWNER_ADMIN"] });
const OTHER_OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000010010", displayName: "Other Owner", roles: ["OWNER_ADMIN"] });

type Result = { value: any; replayed: boolean };
interface ClaimService {
  open(input: Record<string, unknown>): Promise<Result>;
  transition(input: Record<string, unknown>): Promise<Result>;
  submitOutcome(input: Record<string, unknown>): Promise<Result>;
  decideApproval(input: Record<string, unknown>): Promise<any>;
  applyOutcome(input: Record<string, unknown>): Promise<Result>;
  expireApproval(input: Record<string, unknown>): Promise<any>;
  get(claimId: string): Promise<any>;
  getProposal(proposalId: string): Promise<any>;
  closure(projectId: string): Promise<any>;
  outcomeArtifacts(claimId: string): Promise<readonly any[]>;
}
interface ClaimModule { createInMemoryClaimService(options: Record<string, unknown>): ClaimService }

async function subject(): Promise<ClaimService> {
  const modulePath = "../../../src/modules/claims/claim-service.ts";
  const module = await import(modulePath) as ClaimModule;
  return module.createInMemoryClaimService({
    now: () => "2026-11-07T18:00:00.000Z",
    projects: [{ id: PROJECT_ID, version: 7, finalState: "FINAL_CLOSED", assessmentValid: true }],
    salesShipments: [{ id: SALES_SHIPMENT_ID, projectId: PROJECT_ID, claimState: "CLEAR" }],
    supplierShipments: [{ id: SUPPLIER_SHIPMENT_ID, projectId: PROJECT_ID }],
    parties: [{ id: CLAIMANT_ID }, { id: RESPONDENT_ID }],
    evidence: [
      { id: EVIDENCE_ID, projectId: PROJECT_ID, state: "AVAILABLE" },
      { id: OUTCOME_EVIDENCE_ID, projectId: PROJECT_ID, state: "AVAILABLE" },
    ],
  });
}
const command = (idempotencyKey: string, principal = OPERATIONS) => ({ principal, idempotencyKey, correlationId: idempotencyKey });
const problem = (code: string, status?: number) => (error: unknown) => error instanceof ProblemError
  && error.problem.code === code && (status === undefined || error.problem.status === status);

async function opened(service: ClaimService, key = "claim-open") {
  const result = await service.open({
    projectId: PROJECT_ID, expectedVersion: 7, salesShipmentId: SALES_SHIPMENT_ID,
    type: "QUALITY", claimantId: CLAIMANT_ID, respondentId: RESPONDENT_ID,
    description: "Moisture exceeded the agreed specification", quantity: "12.500000",
    amount: "750.000000", currency: "USD", evidenceId: EVIDENCE_ID, ...command(key),
  });
  assert.equal(result.value.state, "OPEN");
  return result.value;
}
async function underReview(service: ClaimService, key = "claim") {
  const claim = await opened(service, `${key}-open`);
  const reviewed = await service.transition({ claimId: claim.id, expectedVersion: claim.version,
    toState: "UNDER_REVIEW", reason: "Evidence package is complete", ...command(`${key}-review`) });
  assert.equal(reviewed.value.state, "UNDER_REVIEW");
  return reviewed.value;
}
async function submitted(service: ClaimService, outcome: "RESOLVED" | "REJECTED" = "RESOLVED", key = "claim") {
  const claim = await underReview(service, key);
  const pending = await service.submitOutcome({ claimId: claim.id, expectedVersion: claim.version, outcome,
    reason: outcome === "RESOLVED" ? "Claim accepted after quality review" : "Evidence does not support the claim",
    evidenceId: OUTCOME_EVIDENCE_ID, ...command(`${key}-submit`) });
  assert.equal(pending.value.actionCode, "CLAIM_OUTCOME");
  assert.equal(pending.value.subjectType, "CLAIM_OUTCOME_PROPOSAL");
  return { claim, pending: pending.value };
}

test("opens only fixed simple claim types with valid party, shipment and evidence linkage", async () => {
  const service = await subject();
  const claim = await opened(service);
  assert.deepEqual({ projectId: claim.projectId, salesShipmentId: claim.salesShipmentId, supplierShipmentId: claim.supplierShipmentId,
    claimantId: claim.claimantId, respondentId: claim.respondentId, evidenceId: claim.evidenceId },
  { projectId: PROJECT_ID, salesShipmentId: SALES_SHIPMENT_ID, supplierShipmentId: null,
    claimantId: CLAIMANT_ID, respondentId: RESPONDENT_ID, evidenceId: EVIDENCE_ID });
  await assert.rejects(() => service.open({ projectId: PROJECT_ID, expectedVersion: 8, salesShipmentId: SALES_SHIPMENT_ID,
    type: "COMPENSATION", claimantId: CLAIMANT_ID, respondentId: RESPONDENT_ID, description: "Forbidden advanced claim",
    ...command("claim-forbidden-type") }), problem("VALIDATION_FAILED", 400));
});

test("OPEN can move only to UNDER_REVIEW and direct terminal transitions fail", async () => {
  const service = await subject();
  const claim = await opened(service, "transition-open");
  for (const toState of ["RESOLVED", "REJECTED"]) {
    await assert.rejects(() => service.transition({ claimId: claim.id, expectedVersion: claim.version, toState,
      reason: "Attempted direct terminal transition", ...command(`transition-${toState}`) }), problem("INVALID_STATE_TRANSITION", 409));
  }
  const reviewed = await service.transition({ claimId: claim.id, expectedVersion: claim.version,
    toState: "UNDER_REVIEW", reason: "Begin controlled review", ...command("transition-review") });
  assert.equal(reviewed.value.state, "UNDER_REVIEW");
});

test("submission creates an immutable exact version/hash proposal and never changes terminal claim state", async () => {
  const service = await subject();
  const { claim, pending } = await submitted(service, "RESOLVED", "exact");
  assert.equal((await service.get(claim.id)).state, "UNDER_REVIEW");
  const proposal = await service.getProposal(pending.subjectId);
  assert.deepEqual({ claimId: proposal.claimId, claimVersion: proposal.claimVersion, proposedOutcome: proposal.proposedOutcome,
    reason: proposal.reason, evidenceId: proposal.evidenceId, subjectHash: proposal.subjectHash, state: proposal.state },
  { claimId: claim.id, claimVersion: claim.version, proposedOutcome: "RESOLVED",
    reason: "Claim accepted after quality review", evidenceId: OUTCOME_EVIDENCE_ID,
    subjectHash: pending.subjectHash, state: "PENDING_APPROVAL" });
  assert.match(proposal.subjectHash, /^[a-f0-9]{64}$/);
});

test("approval requires a different Owner and rejection leaves the claim UNDER_REVIEW", async () => {
  const service = await subject();
  const { claim, pending } = await submitted(service, "REJECTED", "rejected-proposal");
  await assert.rejects(() => service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OPERATIONS, decision: "APPROVED", comment: "Self approval" }), problem("SELF_APPROVAL_FORBIDDEN", 409));
  const rejected = await service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OWNER, decision: "REJECTED", comment: "Proposal requires more evidence" });
  assert.equal(rejected.decision, "REJECTED");
  assert.equal((await service.getProposal(pending.subjectId)).state, "REJECTED");
  assert.equal((await service.get(claim.id)).state, "UNDER_REVIEW");
  await assert.rejects(() => service.applyOutcome({ claimId: claim.id, expectedVersion: claim.version,
    approvalId: pending.id, ...command("apply-rejected") }), problem("APPROVAL_REQUIRED", 409));
});

test("expired, stale or mismatched approval cannot apply an outcome", async () => {
  const service = await subject();
  const expiredCase = await submitted(service, "RESOLVED", "expired");
  await service.expireApproval({ approvalId: expiredCase.pending.id, reason: "Approval validity elapsed" });
  await assert.rejects(() => service.applyOutcome({ claimId: expiredCase.claim.id, expectedVersion: expiredCase.claim.version,
    approvalId: expiredCase.pending.id, ...command("apply-expired") }), problem("APPROVAL_REQUIRED", 409));

  const staleCase = await submitted(service, "RESOLVED", "stale");
  const approved = await service.decideApproval({ approvalId: staleCase.pending.id, expectedVersion: staleCase.pending.version,
    approver: OWNER, decision: "APPROVED", comment: "Exact proposal approved" });
  await assert.rejects(() => service.applyOutcome({ claimId: staleCase.claim.id, expectedVersion: staleCase.claim.version + 1,
    approvalId: approved.id, ...command("apply-stale") }), problem("STALE_VERSION", 412));
  await assert.rejects(() => service.applyOutcome({ claimId: staleCase.claim.id, expectedVersion: staleCase.claim.version,
    approvalId: "019a5f9b-7c00-7000-8000-000000010099", ...command("apply-mismatch") }), problem("APPROVAL_VERSION_MISMATCH", 409));
});

test("approved exact proposal is the sole terminal apply and replay is idempotent", async () => {
  const service = await subject();
  const { claim, pending } = await submitted(service, "RESOLVED", "apply");
  const approved = await service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OTHER_OWNER, decision: "APPROVED", comment: "Exact outcome approved" });
  const input = { claimId: claim.id, expectedVersion: claim.version, approvalId: approved.id, ...command("apply-approved") };
  const first = await service.applyOutcome(input);
  const replay = await service.applyOutcome(input);
  assert.equal(first.value.state, "RESOLVED");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  assert.equal((await service.getProposal(pending.subjectId)).state, "APPLIED");
  assert.equal((await service.closure(PROJECT_ID)).claimsComplete, true);
});

test("terminal apply records outcome only and creates no discount, logistics, compensation, netting or settlement artifact", async () => {
  const service = await subject();
  const { claim, pending } = await submitted(service, "REJECTED", "outcome-only");
  const approved = await service.decideApproval({ approvalId: pending.id, expectedVersion: pending.version,
    approver: OWNER, decision: "APPROVED", comment: "Reject exact claim proposal" });
  const result = await service.applyOutcome({ claimId: claim.id, expectedVersion: claim.version,
    approvalId: approved.id, ...command("outcome-only-apply") });
  assert.equal(result.value.state, "REJECTED");
  assert.deepEqual(await service.outcomeArtifacts(claim.id), []);
  for (const forbidden of ["discount", "replacementLogistics", "compensation", "netting", "settlement"])
    assert.equal(Object.hasOwn(result.value, forbidden), false, forbidden);
});
