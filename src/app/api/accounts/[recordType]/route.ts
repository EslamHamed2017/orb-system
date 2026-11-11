import { NextResponse } from "next/server.js";
interface Principal { readonly userId: string; readonly roles: readonly string[] }
type AccountRecordType = "SALES_INVOICE" | "SUPPLIER_INVOICE" | "COLLECTION" | "SUPPLIER_PAYMENT" | "EXPENSE";
export interface AccountsListRouteDependencies {
  readonly authenticate: (request: Request) => Promise<Principal | null>;
  readonly list?: (input: { request: Request; principal: Principal; type: AccountRecordType; projectId?: string }) => Promise<unknown>;
}
const ROLES = new Set(["OWNER_ADMIN", "FINANCE_VIEWER"]);
const RECORD_TYPES: Readonly<Record<string, AccountRecordType>> = Object.freeze({
  "sales-invoices": "SALES_INVOICE", "supplier-invoices": "SUPPLIER_INVOICE", collections: "COLLECTION",
  "supplier-payments": "SUPPLIER_PAYMENT", expenses: "EXPENSE",
});
function problem(status: number, code: string) { return NextResponse.json({ type: `https://orb.example/problems/${code.toLowerCase().replaceAll("_", "-")}`, title: code, status, code, correlationId: crypto.randomUUID() }, { status, headers: { "content-type": "application/problem+json", "Cache-Control": "no-store" } }); }
export function createAccountsListGetHandler(dependencies: AccountsListRouteDependencies) {
  return async function GET(request: Request, context: { params: Promise<{ recordType: string }> }) {
    const principal = await dependencies.authenticate(request);
    if (!principal) return problem(401, "AUTHENTICATION_REQUIRED");
    if (!principal.roles.some((role) => ROLES.has(role))) return problem(403, "PERMISSION_DENIED");
    if (!dependencies.list) return problem(503, "DEPENDENCY_UNAVAILABLE");
    const { recordType } = await context.params;
    const type = RECORD_TYPES[recordType];
    if (!type) return problem(400, "VALIDATION_FAILED");
    const projectId = new URL(request.url).searchParams.get("projectId") ?? undefined;
    return NextResponse.json(await dependencies.list({ request, principal, type, ...(projectId ? { projectId } : {}) }), { headers: { "Cache-Control": "no-store" } });
  };
}
export const GET = createAccountsListGetHandler({ authenticate: async () => null });
