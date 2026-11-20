import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { buildTrade, params } from "../support/trade-fixture.ts";

/**
 * QuickBooks-style project status, against PostgreSQL:
 *  - saving the project and its supplier contract confirms both contracts and puts the project In progress;
 *  - Mark as completed checks live records, accepts open items with a reason and locks the project; Back to in progress reopens it;
 *  - Cancel works only while nothing live is on the project, owner only, with a reason;
 *  - the Attachments tab lists the project's files with what they are attached to.
 */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const today = new Date().toISOString().slice(0, 10);
interface Closure { project: { finalState: string }; assessment: { id: string; blockers: { id: string }[] } | null }

integration("projects start In progress, complete with reasons, reopen, cancel only when nothing is live; attachments are listed", async () => {
  const t = await buildTrade(databaseUrl!);
  const projectRoute = await import("../../../src/app/api/projects/[projectId]/route.ts");
  const cancel = await import("../../../src/app/api/projects/[projectId]/cancel/route.ts");
  const assessment = await import("../../../src/app/api/projects/[projectId]/closure-assessment/route.ts");
  const exceptions = await import("../../../src/app/api/projects/[projectId]/closure-exceptions/route.ts");
  const closeSubmit = await import("../../../src/app/api/projects/[projectId]/final-close/submit/route.ts");
  const reopenSubmit = await import("../../../src/app/api/projects/[projectId]/reopen/submit/route.ts");
  const evidence = await import("../../../src/app/api/evidence/route.ts");
  const createBill = await import("../../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const projectId = t.project.id, project = params({ projectId });
  const read = async () => await t.ok<{ lifecycleState: string; salesContract: { state: string }; purchaseContracts: { state: string }[] }>(await projectRoute.GET(t.get(`/api/projects/${projectId}`, "owner") as never, project as never));
  try {
    const started = await read();
    assert.equal(started.lifecycleState, "ACTIVE", "In progress as soon as both contracts are saved");
    assert.deepEqual([started.salesContract.state, ...started.purchaseContracts.map((c) => c.state)], ["APPROVED", "APPROVED"]);

    // ---- cancel: only while nothing is live ----
    await t.confirmShipments();
    assert.equal((await cancel.POST(t.post(`/api/projects/${projectId}/cancel`, "ops", { reason: "Buyer withdrew" }), project)).status, 403, "owner only");
    assert.equal((await cancel.POST(t.post(`/api/projects/${projectId}/cancel`, "owner", { reason: "" }), project)).status, 422, "needs a reason");
    assert.equal((await cancel.POST(t.post(`/api/projects/${projectId}/cancel`, "owner", { reason: "Buyer withdrew" }), project)).status, 409, "confirmed shipments are live");

    // ---- a bill with its file shows on the Attachments tab ----
    const form = new FormData();
    for (const [k, v] of Object.entries({ reference: "AD-ST-1", invoiceDate: today, amount: "99849.60" })) form.set(k, v);
    form.set("file", new File([PDF], "bill-ad-st-1.pdf", { type: "application/pdf" }));
    await t.ok(await createBill.POST(t.multipart(`/api/supplier-shipments/${t.supplierShipment.id}/invoices`, "finance", form), params({ shipmentId: t.supplierShipment.id })), 201);
    const files = await t.ok<{ items: { originalFilename: string; subjectType: string; subjectReference: string; contentHref: string }[] }>(await evidence.GET(new NextRequest(t.get(`/api/evidence?projectId=${projectId}`, "ops"))));
    const bill = files.items.find((f) => f.originalFilename === "bill-ad-st-1.pdf");
    assert.deepEqual([bill?.subjectType, bill?.subjectReference], ["SUPPLIER_INVOICE", "AD-ST-1"]);
    assert.match(bill!.contentHref, /^\/api\/evidence\/[0-9a-f-]+\/content$/);

    // ---- mark completed: accept open items with a reason ----
    let state = await t.ok<Closure>(await assessment.POST(t.post(`/api/projects/${projectId}/closure-assessment`, "ops", {}), project));
    const ids = state.assessment!.blockers.map((b) => b.id);
    assert.ok(ids.length > 0, "undelivered shipments and unpaid bills are open");
    assert.equal((await closeSubmit.POST(t.post(`/api/projects/${projectId}/final-close/submit`, "ops", { assessmentId: state.assessment!.id }), project)).status >= 400, true, "open items need a reason first");
    state = await t.ok<Closure>(await exceptions.POST(t.post(`/api/projects/${projectId}/closure-exceptions`, "ops", { assessmentId: state.assessment!.id, blockerIds: ids, reason: "Wrapped up outside the system" }), project));
    state = await t.ok<Closure>(await closeSubmit.POST(t.post(`/api/projects/${projectId}/final-close/submit`, "ops", { assessmentId: state.assessment!.id }), project), 202);
    assert.equal(state.project.finalState, "FINAL_CLOSED", "Completed");
    assert.equal((await cancel.POST(t.post(`/api/projects/${projectId}/cancel`, "owner", { reason: "Buyer withdrew" }), project)).status, 409, "a completed project is reopened before cancelling");

    // ---- back to in progress ----
    state = await t.ok<Closure>(await reopenSubmit.POST(t.post(`/api/projects/${projectId}/reopen/submit`, "finance", { reason: "Buyer disputes the weights" }), project), 202);
    assert.equal(state.project.finalState, "OPEN");
  } finally {
    await t.sql.end();
  }

  // ---- a project with nothing live can be cancelled ----
  const fresh = await buildTrade(databaseUrl!);
  try {
    const id = fresh.project.id, p = params({ projectId: id });
    await fresh.ok(await cancel.POST(fresh.post(`/api/projects/${id}/cancel`, "owner", { reason: "Buyer withdrew before shipping" }), p));
    const after = await fresh.ok<{ lifecycleState: string }>(await projectRoute.GET(fresh.get(`/api/projects/${id}`, "owner") as never, p as never));
    assert.equal(after.lifecycleState, "CANCELLED");
    assert.equal((await cancel.POST(fresh.post(`/api/projects/${id}/cancel`, "owner", { reason: "again please" }), p)).status, 409);
    const audit = (await fresh.sql.query(`SELECT "after"->>'reason' reason FROM "ProjectAuditEvent" WHERE "project_id" = $1 AND "action" = 'PROJECT_CANCELLED'`, [id])).rows as { reason: string }[];
    assert.deepEqual(audit.map((r) => r.reason), ["Buyer withdrew before shipping"]);
  } finally {
    await fresh.sql.end();
  }
});
