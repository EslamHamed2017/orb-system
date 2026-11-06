import { NextRequest, NextResponse } from "next/server";

export interface EvidenceMetadataRouteDependencies {
  readonly handle: (input: { request: NextRequest; evidenceId: string }) => Promise<unknown>;
}

export function createEvidenceMetadataGetHandler(dependencies: EvidenceMetadataRouteDependencies) {
  return async function GET(request: NextRequest, context: { params: Promise<{ evidenceId: string }> }) {
    const { evidenceId } = await context.params;
    return NextResponse.json(await dependencies.handle({ request, evidenceId }));
  };
}

export async function GET() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence access dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}
