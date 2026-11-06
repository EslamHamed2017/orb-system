import { NextRequest, NextResponse } from "next/server";

export interface EvidenceContentResult { readonly body: BodyInit; readonly contentType: string; readonly disposition: "inline" | "attachment"; readonly filename?: string }
export interface EvidenceContentRouteDependencies {
  readonly handle: (input: { request: NextRequest; evidenceId: string; disposition: "inline" | "attachment" }) => Promise<EvidenceContentResult>;
}

export function createEvidenceContentGetHandler(dependencies: EvidenceContentRouteDependencies) {
  return async function GET(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
    const { evidenceId } = await context.params;
    const raw = request.nextUrl.searchParams.get("disposition") ?? "inline";
    if (raw !== "inline" && raw !== "attachment") return NextResponse.json({ code: "VALIDATION_FAILED", status: 400 }, { status: 400 });
    const result = await dependencies.handle({ request, evidenceId, disposition: raw });
    const filename = (result.filename ?? "evidence").replace(/["\\\r\n]/g, "_");
    return new NextResponse(result.body, { headers: { "content-type": result.contentType, "content-disposition": `${result.disposition}; filename="${filename}"` } });
  };
}

export async function GET() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence content dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}
