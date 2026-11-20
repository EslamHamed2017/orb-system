// @ts-expect-error Native Node TypeScript tests require source extensions.
import { CLAIM_TYPES, ClaimsClosureError, type ClaimType, type PrismaClaimsClosureStore } from "./claims-closure-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DocumentStorageError, readDocument } from "../evidence/document-storage.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

type Store = Pick<PrismaClaimsClosureStore, keyof PrismaClaimsClosureStore>;

/**
 * Who does what (roles.ts):
 *  - claims: Owner administrator and Operations open them, move them to review and propose the outcome; Finance reads them
 *  - closure: Owner/Operations run the check; Owner/Operations/Finance accept items with a reason and ask to close or reopen
 *  - every outcome, close and reopen is decided by an owner other than the person who asked (approvals inbox)
 */
const READERS = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const CLAIM_WRITERS = ["OWNER_ADMIN", "OPERATIONS"];
const CLOSURE_REQUESTERS = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/;
const QUANTITY = /^(?:0|[1-9]\d{0,11})(?:\.\d{1,3})?$/;
const CURRENCY = /^[A-Z]{3}$/;

const invalid = (detail: string) => new ShipmentProblem(422, "VALIDATION_FAILED", detail);
function requireRole(actor: ShipmentActor, roles: readonly string[]) {
  if (!actor.roles.some((role) => roles.includes(role))) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Your role cannot do this.");
}
function id(value: unknown, label: string) {
  if (typeof value !== "string" || !UUID.test(value)) throw invalid(`${label} is not a valid id.`);
  return value.toLowerCase();
}
function text(value: unknown, label: string, min: number, max: number) {
  const v = typeof value === "string" ? value.trim() : "";
  if (v.length < min || v.length > max) throw invalid(`${label} must be ${min}-${max} characters.`);
  return v;
}
function optionalAmount(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null;
  const v = String(value).trim();
  if (!AMOUNT.test(v)) throw invalid(`${label} must be a positive amount with up to 2 decimals.`);
  return v;
}
function optionalCurrency(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const v = String(value).trim().toUpperCase();
  if (!CURRENCY.test(v)) throw invalid("Currency must be a 3-letter code.");
  return v;
}
const field = (form: FormData, name: string) => { const v = form.get(name); return typeof v === "string" ? v : null; };
const objectOf = (body: unknown): Record<string, unknown> => (body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {});

function translate(error: unknown): never {
  if (error instanceof ClaimsClosureError) {
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    if (error.code === "INVALID") throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
    throw new ShipmentProblem(409, "STATE_CONFLICT", error.message);
  }
  if (error instanceof DocumentStorageError) {
    if (error.code === "STORAGE_UNAVAILABLE") throw new ShipmentProblem(503, "DEPENDENCY_UNAVAILABLE", error.message);
    if (error.code === "NOT_FOUND") throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", error.message);
    throw new ShipmentProblem(422, "VALIDATION_FAILED", error.message);
  }
  throw error;
}
async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); } catch (error) { translate(error); }
}

export function createClaimsClosureService(store: Store) {
  return Object.freeze({
    async projectClaims(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, READERS);
      return guarded(() => store.projectClaims(actor.tenantId, id(projectId, "Project")));
    },

    /** multipart/form-data: shipmentId, type, description, quantity?, amount?, currency?, file (evidence). */
    async openClaim(actor: ShipmentActor, projectId: unknown, form: FormData) {
      requireRole(actor, CLAIM_WRITERS);
      const type = field(form, "type");
      if (!type || !CLAIM_TYPES.includes(type as ClaimType)) throw invalid(`Claim type must be one of ${CLAIM_TYPES.join(", ")}.`);
      const quantityRaw = field(form, "quantity");
      const quantity = quantityRaw ? quantityRaw.trim() : null;
      if (quantity && (!QUANTITY.test(quantity) || Number(quantity) <= 0)) throw invalid("Quantity must be a positive number of tonnes with up to 3 decimals.");
      const amount = optionalAmount(field(form, "amount"), "Claimed amount");
      const input = {
        tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), shipmentId: id(field(form, "shipmentId"), "Shipment"),
        type: type as ClaimType, description: text(field(form, "description"), "Description", 3, 1000), quantity, amount, currency: optionalCurrency(field(form, "currency")),
      };
      return guarded(async () => {
        const file = form.get("file");
        if (!file || typeof file === "string") throw invalid("Attach the evidence for this claim.");
        return store.openClaim({ ...input, document: await readDocument(file) });
      });
    },

    async startReview(actor: ShipmentActor, claimId: unknown, body: unknown) {
      requireRole(actor, CLAIM_WRITERS);
      const b = objectOf(body);
      if (b.toState !== undefined && b.toState !== "UNDER_REVIEW") throw invalid("toState must be UNDER_REVIEW.");
      const note = typeof b.reason === "string" && b.reason.trim() ? b.reason.trim().slice(0, 500) : null;
      return guarded(() => store.startReview({ tenantId: actor.tenantId, actorId: actor.userId, claimId: id(claimId, "Claim"), note }));
    },

    /** body: { outcome: RESOLVED (settled — amount required) | REJECTED (rejected or withdrawn), amount?, currency?, reason } */
    async submitOutcome(actor: ShipmentActor, claimId: unknown, body: unknown) {
      requireRole(actor, CLAIM_WRITERS);
      const b = objectOf(body);
      const outcome = b.outcome ?? b.proposedOutcome;
      if (outcome !== "RESOLVED" && outcome !== "REJECTED") throw invalid("outcome must be RESOLVED or REJECTED.");
      const amount = outcome === "RESOLVED" ? optionalAmount(b.amount, "Settled amount") : null;
      if (outcome === "RESOLVED" && amount === null) throw invalid("Enter the settled amount.");
      return guarded(() => store.submitOutcome({
        tenantId: actor.tenantId, actorId: actor.userId, claimId: id(claimId, "Claim"), outcome, amount, currency: optionalCurrency(b.currency),
        reason: text(b.reason, "Reason", 3, 500),
      }));
    },

    async applyOutcome(actor: ShipmentActor, claimId: unknown) {
      requireRole(actor, CLAIM_WRITERS);
      return guarded(() => store.applyOutcome({ tenantId: actor.tenantId, actorId: actor.userId, claimId: id(claimId, "Claim") }));
    },

    async closure(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, READERS);
      return guarded(() => store.closure(actor.tenantId, id(projectId, "Project")));
    },

    async assess(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, CLAIM_WRITERS);
      return guarded(() => store.assess({ tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project") }));
    },

    /** body: { assessmentId, blockerIds: [..], reason } — accepts open items with a written reason. */
    async recordExceptions(actor: ShipmentActor, projectId: unknown, body: unknown) {
      requireRole(actor, CLOSURE_REQUESTERS);
      const b = objectOf(body);
      const raw: unknown[] = Array.isArray(b.blockerIds) ? b.blockerIds : [];
      if (raw.length < 1 || raw.length > 200) throw invalid("Choose at least one item.");
      return guarded(() => store.recordExceptions({
        tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), assessmentId: id(b.assessmentId, "Closure check"),
        blockerIds: [...new Set(raw.map((value) => id(value, "Item")))], reason: text(b.reason, "Reason", 3, 500),
      }));
    },

    async submitClose(actor: ShipmentActor, projectId: unknown, body: unknown) {
      requireRole(actor, CLOSURE_REQUESTERS);
      const b = objectOf(body);
      return guarded(() => store.submitClose({ tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), assessmentId: id(b.assessmentId, "Closure check") }));
    },

    /** Closing happens when the owner approves; this reports the result for the approval given. */
    async finalClose(actor: ShipmentActor, projectId: unknown, _body?: unknown) {
      requireRole(actor, ["OWNER_ADMIN"]);
      const state = await guarded(() => store.closure(actor.tenantId, id(projectId, "Project")));
      if (state.project.finalState !== "FINAL_CLOSED") throw new ShipmentProblem(409, "STATE_CONFLICT", state.pending?.action === "FINAL_CLOSE" ? "Closing is waiting for an owner's approval." : "Ask to close the project first.");
      return state;
    },

    /** Cancels a project with nothing live on it. Owner only; needs a written reason. */
    async cancelProject(actor: ShipmentActor, projectId: unknown, body: unknown) {
      requireRole(actor, ["OWNER_ADMIN"]);
      const b = objectOf(body);
      return guarded(() => store.cancelProject({ tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), reason: text(b.reason, "Reason", 3, 500) }));
    },

    async submitReopen(actor: ShipmentActor, projectId: unknown, body: unknown) {
      requireRole(actor, CLOSURE_REQUESTERS);
      const b = objectOf(body);
      return guarded(() => store.submitReopen({ tenantId: actor.tenantId, actorId: actor.userId, projectId: id(projectId, "Project"), reason: text(b.reason, "Reason", 3, 500) }));
    },

    async reopen(actor: ShipmentActor, projectId: unknown) {
      requireRole(actor, ["OWNER_ADMIN"]);
      const state = await guarded(() => store.closure(actor.tenantId, id(projectId, "Project")));
      if (state.project.finalState !== "OPEN") throw new ShipmentProblem(409, "STATE_CONFLICT", state.pending?.action === "REOPEN" ? "Reopening is waiting for an owner's approval." : "Ask to reopen the project first.");
      return state;
    },

    async listApprovals(actor: ShipmentActor) {
      if (!actor.roles.includes("OWNER_ADMIN")) return [];
      return store.listPendingApprovals(actor.tenantId);
    },

    /** Owner decision from the approvals inbox. Returns null when the approval is not a claim / closure one. */
    async decide(actor: ShipmentActor, approvalId: string, body: { decision: "APPROVED" | "REJECTED"; comment: string | null }) {
      if (body.decision === "REJECTED" && (!body.comment || body.comment.length < 3)) {
        if (await store.approvalSubject(actor.tenantId, approvalId)) throw invalid("Rejection reason must be 3-500 characters.");
        return null;
      }
      const subject = await guarded(() => store.decide({ tenantId: actor.tenantId, approvalId, approverId: actor.userId, decision: body.decision, comment: body.comment }));
      if (!subject) return null;
      if (subject.action === "CLAIM_OUTCOME") return { subjectType: "CLAIM", claim: await guarded(() => store.claim(actor.tenantId, String(subject.claimId))) };
      return { subjectType: subject.action === "FINAL_CLOSE" ? "PROJECT_CLOSE" : "PROJECT_REOPEN", closure: await guarded(() => store.closure(actor.tenantId, subject.projectId)) };
    },
  });
}

export type ClaimsClosureService = ReturnType<typeof createClaimsClosureService>;
