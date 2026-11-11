import { NextRequest, NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../modules/access/permissions.ts";

function unavailable() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence upload dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}

export interface EvidencePrincipal extends OperationPrincipal {}
export interface EvidenceUploadRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<EvidencePrincipal | null>;
  readonly handle: (input: { request: NextRequest; principal: EvidencePrincipal }) => Promise<unknown>;
}
export interface EvidenceListRouteDependencies {
  readonly authenticate: (request: NextRequest) => Promise<EvidencePrincipal | null>;
  readonly list?: (input: { request: NextRequest; principal: EvidencePrincipal; projectId: string; subjectType?: string; subjectId?: string }) => Promise<unknown>;
}

function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
function permitted(principal: EvidencePrincipal, operationId: string): boolean {
  try { assertServerPermission(principal, operationId); return true; } catch { return false; }
}

export function createEvidenceListGetHandler(dependencies: EvidenceListRouteDependencies) {
  return async function GET(request: NextRequest) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!permitted(principal, "listEvidence")) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const projectId = request.nextUrl.searchParams.get("projectId");
    const subjectType = request.nextUrl.searchParams.get("subjectType") ?? undefined;
    const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;
    if (!projectId || ((subjectType === undefined) !== (subjectId === undefined))) return problem(400, "VALIDATION_FAILED");
    return NextResponse.json(await dependencies.list({ request, principal, projectId, ...(subjectType ? { subjectType, subjectId } : {}) }), { headers: { "Cache-Control": "no-store" } });
  };
}

export function createEvidencePostHandler(dependencies: EvidenceUploadRouteDependencies) {
  return async function POST(request: NextRequest) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!permitted(principal, "uploadEvidence")) return problem(403, "PERMISSION_DENIED");
    const result = await dependencies.handle({ request, principal });
    return NextResponse.json(result, { status: 201 });
  };
}

// Authentication, CSRF and idempotency wiring is owned by ORB-R1-0210; fail closed until injected.
export async function POST() { return unavailable(); }
export const GET = createEvidenceListGetHandler({ authenticate: async () => null });
