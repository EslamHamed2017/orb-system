import { NextResponse } from "next/server.js";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../../../../../modules/access/permissions.ts";

export interface ContractLinePrincipal extends OperationPrincipal {}
interface Dependencies {
  readonly authenticate: (request: Request) => Promise<ContractLinePrincipal | null>;
  readonly list?: (input: { request: Request; contractId: string; principal: ContractLinePrincipal }) => Promise<unknown>;
  readonly create?: (input: { request: Request; contractId: string; principal: ContractLinePrincipal; body: unknown }) => Promise<unknown>;
}
function problem(status: number, code: string) {
  return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, detail: "The request could not be authorized safely.", code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } });
}
async function authorize(dependencies: Dependencies, request: Request, operationId: "listContractLines" | "createContractLine") {
  const principal = await dependencies.authenticate(request);
  if (!principal) return { response: problem(401, "AUTHENTICATION_REQUIRED") };
  try { assertServerPermission(principal, operationId); } catch { return { response: problem(403, "PERMISSION_DENIED") }; }
  return { principal };
}
export function createContractLinesGetHandler(dependencies: Dependencies) {
  return async (request: Request, context: { params: Promise<{ contractId: string }> }) => {
    const auth = await authorize(dependencies, request, "listContractLines");
    if (auth.response) return auth.response;
    if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { contractId } = await context.params;
    return NextResponse.json({ items: await dependencies.list({ request, contractId, principal: auth.principal! }) }, { headers: { "Cache-Control": "no-store" } });
  };
}
export function createContractLinesPostHandler(dependencies: Dependencies) {
  return async (request: Request, context: { params: Promise<{ contractId: string }> }) => {
    const auth = await authorize(dependencies, request, "createContractLine");
    if (auth.response) return auth.response;
    if (!dependencies.create) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { contractId } = await context.params;
    return NextResponse.json(await dependencies.create({ request, contractId, principal: auth.principal!, body: await request.json() }), { status: 201, headers: { "Cache-Control": "no-store" } });
  };
}
const unavailable: Dependencies = { authenticate: async () => null };
export const GET = createContractLinesGetHandler(unavailable);
export const POST = createContractLinesPostHandler(unavailable);
