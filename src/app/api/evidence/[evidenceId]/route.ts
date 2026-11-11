import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../modules/access/permissions.ts";

export interface EvidenceMetadataRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<OperationPrincipal | null>;
  readonly handle: (input: { request: NextRequest; evidenceId: string; principal: OperationPrincipal }) => Promise<unknown>;
}
function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
export function createEvidenceMetadataGetHandler(dependencies: EvidenceMetadataRouteDependencies) {
  return async function GET(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    try { assertServerPermission(principal, "getEvidenceMetadata"); } catch { return problem(403, "PERMISSION_DENIED"); }
    const { evidenceId } = await context.params;
    return NextResponse.json(await dependencies.handle({ request, evidenceId, principal }), { headers: { "Cache-Control": "no-store" } });
  };
}
export async function GET() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence access dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}
