import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { mapShipmentErrors, shipmentActor } from "../../../../../modules/shipments/execution/shipment-execution-runtime.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem } from "../../../../../modules/shipments/execution/shipment-execution-service.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { DocumentStorageError, openDocument } from "../../../../../modules/evidence/document-storage.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { getPrismaClient } from "../../../../../platform/database/prisma-client.ts";

export interface EvidenceContentResult { readonly body: BodyInit; readonly contentType: string; readonly disposition: "inline" | "attachment"; readonly filename?: string }
export interface EvidenceContentRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<OperationPrincipal | null>;
  readonly handle: (input: { request: NextRequest; evidenceId: string; disposition: "inline" | "attachment"; principal: OperationPrincipal }) => Promise<EvidenceContentResult>;
}
function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
export function createEvidenceContentGetHandler(dependencies: EvidenceContentRouteDependencies) {
  return async function GET(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    try { assertServerPermission(principal, "viewOrDownloadEvidence"); } catch { return problem(403, "PERMISSION_DENIED"); }
    const { evidenceId } = await context.params;
    const raw = new URL(request.url).searchParams.get("disposition") ?? "inline";
    if (raw !== "inline" && raw !== "attachment") return problem(400, "VALIDATION_FAILED");
    const result = await dependencies.handle({ request, evidenceId, disposition: raw, principal });
    const filename = (result.filename ?? "evidence").replace(/["\\\r\n]/g, "_");
    return new NextResponse(result.body, { headers: { "content-type": result.contentType, "content-disposition": `${result.disposition}; filename="${filename}"`, "Cache-Control": "no-store" } });
  };
}
/** Streams a stored document to a signed-in user of the same company. */
export const GET = mapShipmentErrors(createEvidenceContentGetHandler({
  authenticate: (request) => shipmentActor(request) as never,
  handle: async ({ evidenceId, disposition, principal }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) throw new ShipmentProblem(404, "RESOURCE_NOT_FOUND", "Document not found.");
    try {
      const file = await openDocument(getPrismaClient() as never, (principal as unknown as { tenantId: string }).tenantId, evidenceId);
      return { body: file.bytes as unknown as BodyInit, contentType: file.contentType, disposition, filename: file.filename };
    } catch (error) {
      if (error instanceof DocumentStorageError) throw new ShipmentProblem(error.code === "NOT_FOUND" ? 404 : 503, error.code === "NOT_FOUND" ? "RESOURCE_NOT_FOUND" : "DEPENDENCY_UNAVAILABLE", error.message);
      throw error;
    }
  },
}));
