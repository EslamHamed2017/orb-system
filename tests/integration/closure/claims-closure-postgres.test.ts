import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/**
 * Claims and project closure on PostgreSQL:
 *  - a customer claim and a supplier claim go open → review → proposed outcome → another owner approves;
 *    settled amounts move Actual (customer claim lowers revenue, supplier claim lowers cost)
 *  - closure checks live records; open items can be accepted with a reason; another owner approves closing;
 *    a closed project refuses changes (service and database); reopening needs a reason and another owner.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const today = new Date().toISOString().slice(0, 10);

async function useMemoryStorageUnlessConfigured() {
  if (process.env.OBJECT_STORAGE_ENDPOINT) return;
  const { setDocumentObjectStore } = await import("../../../src/modules/evidence/document-storage.ts");
  const objects = new Map<string, Uint8Array>();
  setDocumentObjectStore({
    async putImmutable(input) { const versionId = `v-${objects.size + 1}`; objects.set(`${input.objectKey}@${versionId}`, input.body as Uint8Array); return { objectKey: input.objectKey, objectVersionId: versionId, retentionUntil: input.retentionUntil }; },
    async getImmutable({ objectKey, objectVersionId }) { const body = objects.get(`${objectKey}@${objectVersionId}`); if (!body) throw new Error("missing object"); return { body, contentType: "application/octet-stream", byteLength: body.byteLength }; },
  } as never);
}

interface Claim { id: string; side: string; state: string; settledAmount: string | null; currency: string | null; shipmentReference: string; document: { id: string } | null; proposal: { state: string; amount: string | null } | null }
interface Blocker { id: string; code: string; reference: string; exceptionReason: string | null }
interface Closure { project: { finalState: string; reopenReason: string | null }; assessment: { id: string; blockers: Blocker[]; current: boolean } | null; pending: { approvalId: string; action: string } | null }

integration("claims settle through owner approval and move Actual; closure checks, accepts with reasons, closes read-only and reopens", async () => {
  await useMemoryStorageUnlessConfigured();
  const t = await buildTrade(databaseUrl!);
  const claimsRoute = await import("../../../src/app/api/projects/[projectId]/claims/route.ts");
  const transition = await import("../../../src/app/api/claims/[claimId]/transition/route.ts");
  const submitOutcome = await import("../../../src/app/api/claims/[claimId]/submit-outcome/route.ts");
  const applyOutcome = await import("../../../src/app/api/claims/[claimId]/apply-outcome/route.ts");
  const assessment = await import("../../../src/app/api/projects/[projectId]/closure-assessment/route.ts");
  const exceptions = await import("../../../src/app/api/projects/[projectId]/closure-exceptions/route.ts");
  const closeSubmit = await import("../../../src/app/api/projects/[projectId]/final-close/submit/route.ts");
  const finalClose = await import("../../../src/app/api/projects/[projectId]/final-close/route.ts");
  const reopenSubmit = await import("../../../src/app/api/projects/[projectId]/reopen/submit/route.ts");
  const reopen = await import("../../../src/app/api/projects/[projectId]/reopen/route.ts");
  const decision = await import("../../../src/app/api/approvals/[approvalId]/decision/route.ts");
  const inbox = await import("../../../src/app/api/approvals/route.ts");
  const profit = await import("../../../src/app/api/projects/[projectId]/profit/route.ts");
  const movements = await import("../../../src/app/api/projects/[projectId]/money-movements/route.ts");
  const createSupplierInvoice = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const submitSupplierInvoice = await import("../../../src/app/api/supplier-invoices/[invoiceId]/submit/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const projectId = t.project.id, project = params({ projectId });
  const form = (fields: Record<string, string>, file = true) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); if (file) data.set("file", new File([PDF], "survey.pdf")); return data; };
  const decide = (approvalId: string, who: "owner" | "owner2" | "ops", body: Record<string, unknown> = { decision: "APPROVED" }) =>
    decision.POST(t.post(`/api/approvals/${approvalId}/decision`, who, body) as never, params({ approvalId }));
  const open = (who: "ops" | "finance" | "owner", fields: Record<string, string>, file = true) => claimsRoute.POST(t.multipart(`/api/projects/${projectId}/claims`, who, form(fields, file)), project);
  const review = (claimId: string) => transition.POST(t.post(`/api/claims/${claimId}/transition`, "ops", { toState: "UNDER_REVIEW", reason: "Survey report received" }), params({ claimId }));
  const outcome = (claimId: string, who: "ops" | "owner", body: Record<string, unknown>) => submitOutcome.POST(t.post(`/api/claims/${claimId}/submit-outcome`, who, body), params({ claimId }));
  const closure = async (who: "ops" | "finance" | "owner" = "ops") => t.ok<Closure>(await assessment.GET(t.get(`/api/projects/${projectId}/closure-assessment`, who), project));
  const assess = () => assessment.POST(t.post(`/api/projects/${projectId}/closure-assessment`, "ops", {}), project);
  try {
    await t.confirmShipments();
    const supplierInvoice = await t.ok<{ id: string }>(await createSupplierInvoice.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form({ reference: "AD-CLM-1", invoiceDate: today, amount: "99849.60" })), params({ shipmentId: t.supplierShipment.id })), 201);
    const submitted = await t.ok<{ pendingApprovalId: string }>(await submitSupplierInvoice.POST(t.post(`/api/supplier-invoices/${supplierInvoice.id}/submit`, "finance", {}), params({ invoiceId: supplierInvoice.id })));
    await t.ok(await decide(submitted.pendingApprovalId, "owner"));
    await t.ok(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today }), params({ shipmentId: t.salesShipment.id })), 201);

    // ---- claims ----
    const start = await t.ok<{ claims: Claim[]; shipments: { id: string; side: string }[] }>(await claimsRoute.GET(t.get(`/api/projects/${projectId}/claims`, "finance"), project));
    assert.deepEqual(start.claims, []);
    assert.deepEqual(start.shipments.map((s) => [s.side, s.id]).sort(), [["CUSTOMER", t.salesShipment.id], ["SUPPLIER", t.supplierShipment.id]]);
    assert.equal((await claimsRoute.GET(t.get(`/api/projects/${projectId}/claims`, "outsider"), project)).status, 404, "another company cannot see the project");
    assert.equal((await open("finance", { shipmentId: t.salesShipment.id, type: "QUALITY", description: "Moisture above contract" })).status, 403, "Finance reads claims only");
    assert.equal((await open("ops", { shipmentId: t.salesShipment.id, type: "QUALITY", description: "Moisture above contract" }, false)).status, 422, "evidence is required");
    assert.equal((await open("ops", { shipmentId: projectId, type: "QUALITY", description: "Not a shipment" })).status, 422);

    const customerClaim = await t.ok<Claim>(await open("ops", { shipmentId: t.salesShipment.id, type: "QUALITY", description: "Moisture 13.4% against 12.5% max", amount: "2000", currency: "USD" }), 201);
    assert.equal(customerClaim.side, "CUSTOMER");
    assert.equal(customerClaim.state, "OPEN");
    assert.ok(customerClaim.document, "the evidence opens from the claim");
    const supplierClaim = await t.ok<Claim>(await open("ops", { shipmentId: t.supplierShipment.id, type: "WEIGHT", description: "Short landed 0.8 MT" }), 201);
    assert.equal(supplierClaim.side, "SUPPLIER");

    assert.equal((await outcome(customerClaim.id, "ops", { outcome: "RESOLVED", amount: "1500", reason: "Agreed with buyer" })).status, 409, "review comes first");
    await t.ok(await review(customerClaim.id));
    assert.equal((await outcome(customerClaim.id, "ops", { outcome: "RESOLVED", reason: "Agreed with buyer" })).status, 422, "a settled claim needs the amount");
    assert.equal((await outcome(customerClaim.id, "ops", { outcome: "RESOLVED", amount: "1500", currency: "EUR", reason: "Agreed with buyer" })).status, 422, "settle in the claim currency");
    const proposed = await t.ok<Claim & { approvalId: string }>(await outcome(customerClaim.id, "ops", { outcome: "RESOLVED", amount: "1500", reason: "Agreed USD 1,500 with buyer" }), 202);
    assert.equal(proposed.state, "UNDER_REVIEW", "the claim stays under review until approved");
    assert.equal((await outcome(customerClaim.id, "ops", { outcome: "REJECTED", reason: "again" })).status, 409, "one live proposal per claim");

    const items = (await t.ok<{ items: { id: string; subjectType: string; amount: string | null }[] }>(await inbox.GET(t.get("/api/approvals", "owner")))).items;
    assert.deepEqual(items.filter((i) => i.id === proposed.approvalId).map((i) => [i.subjectType, i.amount]), [["CLAIM", "1500.00"]]);
    assert.equal((await decide(proposed.approvalId, "ops")).status, 403);
    assert.equal((await decide(proposed.approvalId, "owner", { decision: "REJECTED" })).status, 422, "a returned outcome needs a reason");
    const decided = await t.ok<{ subjectType: string; claim: Claim }>(await decide(proposed.approvalId, "owner"));
    assert.equal(decided.subjectType, "CLAIM");
    assert.deepEqual([decided.claim.state, decided.claim.settledAmount, decided.claim.currency, decided.claim.proposal?.state], ["RESOLVED", "1500.00", "USD", "APPLIED"]);
    await t.ok(await applyOutcome.POST(t.post(`/api/claims/${customerClaim.id}/apply-outcome`, "ops", {}), params({ claimId: customerClaim.id })), 200);

    await t.ok(await review(supplierClaim.id));
    const supplierProposal = await t.ok<{ approvalId: string }>(await outcome(supplierClaim.id, "owner", { outcome: "RESOLVED", amount: "800", currency: "USD", reason: "Supplier credits short weight" }), 202);
    assert.equal((await decide(supplierProposal.approvalId, "owner")).status, 422, "nobody approves their own request");
    const returned = await t.ok<{ claim: Claim }>(await decide(supplierProposal.approvalId, "owner2", { decision: "REJECTED", comment: "Attach the supplier's credit confirmation" }));
    assert.deepEqual([returned.claim.state, returned.claim.proposal?.state], ["UNDER_REVIEW", "REJECTED"]);
    const again = await t.ok<{ approvalId: string }>(await outcome(supplierClaim.id, "owner", { outcome: "RESOLVED", amount: "800", reason: "Credit confirmed by supplier" }), 202);
    assert.equal((await t.ok<{ claim: Claim }>(await decide(again.approvalId, "owner2"))).claim.settledAmount, "800.00");

    // Actual: 117,120.00 − 1,500.00 revenue; 99,849.60 − 800.00 cost.
    const margin = await t.ok<{ measures: { actual: { amount: string; revenue: string; cost: string } }; sources: { kind: string; amount: string }[] }>(await profit.GET(t.get(`/api/projects/${projectId}/profit`, "finance"), project));
    assert.deepEqual([margin.measures.actual.revenue, margin.measures.actual.cost, margin.measures.actual.amount], ["115620.00", "99049.60", "16570.40"]);
    assert.deepEqual(margin.sources.filter((s) => s.kind.endsWith("_CLAIM")).map((s) => [s.kind, s.amount]).sort(), [["CUSTOMER_CLAIM", "-1500.00"], ["SUPPLIER_CLAIM", "-800.00"]]);

    // ---- closure ----
    assert.equal((await closure()).assessment, null);
    let state = await t.ok<Closure>(await assess(), 201);
    const codes = state.assessment!.blockers.map((b) => b.code).sort();
    assert.deepEqual(codes, ["SALES_INVOICE_UNPAID", "SALES_SHIPMENT_NOT_DELIVERED", "SUPPLIER_INVOICE_UNPAID", "SUPPLIER_SHIPMENT_NOT_RECEIVED"]);
    assert.match(state.assessment!.blockers.find((b) => b.code === "SALES_INVOICE_UNPAID")!.reference, /./);
    const ids = state.assessment!.blockers.map((b) => b.id);
    const submitClose = () => closeSubmit.POST(t.post(`/api/projects/${projectId}/final-close/submit`, "ops", { assessmentId: state.assessment!.id }), project);
    assert.equal((await submitClose()).status, 422, "every open item needs a reason");
    state = await t.ok<Closure>(await exceptions.POST(t.post(`/api/projects/${projectId}/closure-exceptions`, "finance", { assessmentId: state.assessment!.id, blockerIds: ids.slice(0, 2), reason: "Delivered per buyer's receipt; carrier status not updated" }), project));
    assert.equal(state.assessment!.blockers.filter((b) => b.exceptionReason).length, 2);
    assert.equal((await submitClose()).status, 422);

    // Something changes after the check → the check is stale.
    await t.ok(await open("ops", { shipmentId: t.salesShipment.id, type: "DOCUMENT", description: "Phyto certificate copy missing" }), 201);
    assert.equal((await closure()).assessment!.current, false);
    state = await t.ok<Closure>(await exceptions.POST(t.post(`/api/projects/${projectId}/closure-exceptions`, "ops", { assessmentId: state.assessment!.id, blockerIds: ids.slice(2), reason: "Balance written off by agreement" }), project));
    assert.equal((await submitClose()).status, 409, "run the check again after a change");

    state = await t.ok<Closure>(await assess(), 201);
    assert.equal(state.assessment!.blockers.length, 5);
    assert.equal((await exceptions.POST(t.post(`/api/projects/${projectId}/closure-exceptions`, "ops", { assessmentId: state.assessment!.id, blockerIds: [ids[0]], reason: "old item" }), project)).status, 422, "items of an older check do not count");
    state = await t.ok<Closure>(await exceptions.POST(t.post(`/api/projects/${projectId}/closure-exceptions`, "ops", { assessmentId: state.assessment!.id, blockerIds: state.assessment!.blockers.map((b) => b.id), reason: "Accepted at project review with the owner" }), project));
    state = await t.ok<Closure>(await submitClose(), 202);
    assert.equal(state.pending?.action, "FINAL_CLOSE");
    assert.equal((await submitClose()).status, 409, "already waiting");
    assert.equal((await finalClose.POST(t.post(`/api/projects/${projectId}/final-close`, "owner", { assessmentId: state.assessment!.id, approvalId: state.pending!.approvalId }), project)).status, 409, "not closed before approval");

    const closed = await t.ok<{ subjectType: string; closure: Closure }>(await decide(state.pending!.approvalId, "owner"));
    assert.equal(closed.subjectType, "PROJECT_CLOSE");
    assert.equal(closed.closure.project.finalState, "FINAL_CLOSED");
    await t.ok(await finalClose.POST(t.post(`/api/projects/${projectId}/final-close`, "owner", {}), project));

    // Read-only: the service and the database both refuse changes.
    assert.equal((await open("ops", { shipmentId: t.salesShipment.id, type: "PRICE", description: "Late price claim" })).status, 409);
    assert.equal((await assess()).status, 409);
    const payment = await movements.POST(t.multipart(`/api/projects/${projectId}/money-movements`, "finance", form({ kind: "CUSTOMER_RECEIPT", counterpartyId: t.customer, amount: "100", currency: "USD", fxRate: "3.6725", occurredOn: today, reference: "LATE-1" })), project);
    assert.equal(payment.status, 409, "the database refuses money on a closed project");
    await assert.rejects(t.sql.query(`UPDATE "SalesShipment" SET "version" = "version" WHERE "id" = $1`, [t.salesShipment.id]), /ORB_PROJECT_CLOSED/);

    // Reopen: reason + another owner.
    assert.equal((await reopenSubmit.POST(t.post(`/api/projects/${projectId}/reopen/submit`, "finance", { reason: "x" }), project)).status, 422);
    const asked = await t.ok<Closure>(await reopenSubmit.POST(t.post(`/api/projects/${projectId}/reopen/submit`, "finance", { reason: "Buyer disputes the phyto certificate" }), project), 202);
    assert.equal(asked.pending?.action, "REOPEN");
    assert.equal((await decide(asked.pending!.approvalId, "owner", { decision: "REJECTED" })).status, 422);
    const reopened = await t.ok<{ closure: Closure }>(await decide(asked.pending!.approvalId, "owner"));
    assert.deepEqual([reopened.closure.project.finalState, reopened.closure.project.reopenReason], ["OPEN", "Buyer disputes the phyto certificate"]);
    await t.ok(await reopen.POST(t.post(`/api/projects/${projectId}/reopen`, "owner", { reason: "ok" }), project));
    await t.ok(await open("ops", { shipmentId: t.salesShipment.id, type: "DOCUMENT", description: "Replacement certificate requested" }), 201);

    const audit = (await t.sql.query(`SELECT "action" FROM "ClaimClosureAuditEvent" WHERE "project_id" = $1 ORDER BY "occurred_at", "id"`, [projectId])).rows.map((r) => r.action);
    for (const action of ["OPENED", "UNDER_REVIEW", "OUTCOME_SUBMITTED", "APPROVED", "APPLIED", "REJECTED", "ASSESSED", "EXCEPTION_RECORDED", "CLOSE_SUBMITTED", "CLOSED", "REOPEN_SUBMITTED", "REOPENED"]) assert.ok(audit.includes(action), action);
  } finally {
    await t.sql.end();
  }
});
