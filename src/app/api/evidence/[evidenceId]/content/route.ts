import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";

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
    const raw = request.nextUrl.searchParams.get("disposition") ?? "inline";
    if (raw !== "inline" && raw !== "attachment") return problem(400, "VALIDATION_FAILED");
    const result = await dependencies.handle({ request, evidenceId, disposition: raw, principal });
    const filename = (result.filename ?? "evidence").replace(/["\\\r\n]/g, "_");
    return new NextResponse(result.body, { headers: { "content-type": result.contentType, "content-disposition": `${result.disposition}; filename="${filename}"`, "Cache-Control": "no-store" } });
  };
}
export async function GET() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence content dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}
