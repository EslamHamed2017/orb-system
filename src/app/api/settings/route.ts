import { NextResponse } from "next/server.js";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
interface UpdateBody { readonly reason?: unknown; readonly patch?: unknown }
export interface SettingsRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly read?: (input: { request: Request; principal: Principal }) => Promise<unknown>;
  readonly update?: (input: { request: Request; principal: Principal; expectedVersion: number; reason: string; patch: Record<string, unknown> }) => Promise<unknown>;
}
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
async function owner(request: Request, authenticate: SettingsRouteDependencies["authenticate"]): Promise<Principal | Response> { const principal = await authenticate(request); if (!principal) return problem(401, "AUTHENTICATION_REQUIRED"); if (!principal.roles.includes("OWNER_ADMIN")) return problem(403, "PERMISSION_DENIED"); return principal; }
function expectedVersion(request: Request): number | null { const value = request.headers.get("if-match"); if (!value) return null; const match = /^"([1-9]\d*)"$/.exec(value); if (!match) return Number.NaN; const version = Number(match[1]); return Number.isSafeInteger(version) ? version : Number.NaN; }
export function createSettingsHandlers(dependencies: SettingsRouteDependencies) {
  return Object.freeze({
    async GET(request: Request) { const principal = await owner(request, dependencies.authenticate); if (principal instanceof Response) return principal; if (!dependencies.read) return problem(503, "DEPENDENCY_UNAVAILABLE"); return NextResponse.json(await dependencies.read({ request, principal }), { headers: { "Cache-Control": "no-store" } }); },
    async PATCH(request: Request) {
      const principal = await owner(request, dependencies.authenticate); if (principal instanceof Response) return principal;
      const version = expectedVersion(request); if (version === null) return problem(428, "PRECONDITION_REQUIRED"); if (!Number.isFinite(version)) return problem(400, "VALIDATION_FAILED"); if (!dependencies.update) return problem(503, "DEPENDENCY_UNAVAILABLE");
      let body: UpdateBody; try { body = await request.json() as UpdateBody; } catch { return problem(400, "VALIDATION_FAILED"); }
      if (typeof body.reason !== "string" || !body.patch || typeof body.patch !== "object" || Array.isArray(body.patch)) return problem(400, "VALIDATION_FAILED");
      return NextResponse.json(await dependencies.update({ request, principal, expectedVersion: version, reason: body.reason, patch: body.patch as Record<string, unknown> }), { headers: { "Cache-Control": "no-store" } });
    },
  });
}
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { companyProfileService, mapShipmentErrors, shipmentActor, shipmentMutationActor } from "../../../modules/shipments/execution/shipment-execution-runtime.ts";

/** Company settings (Account and settings): what prints on every document. Owner only; every change keeps a history. */
const handlers = createSettingsHandlers({
  authenticate: async (request) => (request.method === "PATCH" ? shipmentMutationActor(request) : shipmentActor(request)) as never,
  read: ({ principal }) => companyProfileService().get(principal as never),
  update: ({ principal, expectedVersion, reason, patch }) => companyProfileService().update(principal as never, expectedVersion, { reason, patch }),
});
export const GET = mapShipmentErrors(handlers.GET);
export const PATCH = mapShipmentErrors(handlers.PATCH);
