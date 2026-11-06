import { NextRequest, NextResponse } from "next/server";

function unavailable() {
  return NextResponse.json({ type: "https://orb.invalid/problems/dependency-unavailable", title: "DEPENDENCY_UNAVAILABLE", status: 503, detail: "Evidence upload dependencies are not configured.", code: "DEPENDENCY_UNAVAILABLE" }, { status: 503, headers: { "content-type": "application/problem+json" } });
}

export interface EvidenceUploadRouteDependencies {
  readonly handle: (request: NextRequest) => Promise<unknown>;
}

export function createEvidencePostHandler(dependencies: EvidenceUploadRouteDependencies) {
  return async function POST(request: NextRequest) {
    const result = await dependencies.handle(request);
    return NextResponse.json(result, { status: 201 });
  };
}

// Authentication, CSRF and idempotency wiring is owned by ORB-R1-0210; fail closed until injected.
export async function POST() { return unavailable(); }
