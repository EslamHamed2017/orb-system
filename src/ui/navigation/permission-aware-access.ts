export type NavigationDestination = "today" | "projects" | "approvals" | "products" | "shipments" | "accounts" | "documents" | "reports" | "admin";
export type ActionVisibility = "visible" | "disabled" | "hidden";

type UiRole = "owner-admin" | "operations" | "finance" | "contract-reviewer" | "unknown";

const NAVIGATION_ACCESS: Readonly<Record<UiRole, readonly NavigationDestination[]>> = Object.freeze({
  "owner-admin": ["today", "projects", "approvals", "products", "shipments", "accounts", "documents", "reports", "admin"],
  operations: ["today", "projects", "products", "shipments", "documents"],
  finance: ["today", "projects", "accounts", "documents", "reports"],
  "contract-reviewer": ["today", "projects", "approvals", "documents"],
  unknown: ["today"],
});

const ADMINISTRATION_OPERATIONS = /(?:User|Role|Permission|Session|IsolatedRestore|Settings)/;
const FINANCE_OPERATIONS = /(?:Invoice|Money|Settlement|Expense|Collection|Payment|Account|Profit)/;
const OWNER_ONLY_OPERATIONS = /^(?:decideFixedApproval|finalCloseProject|reopenProject|cancelUnexecutedProject)$/;
const OPERATIONS_OPERATIONS = /(?:Project|Contract|Shipment|Container|Master|Product|Supplier|Customer|Evidence|Document|Route|Claim|Manifest|Closure)/;

function normalizeRole(role: string | null | undefined): UiRole {
  if (!role || role === "owner-admin" || role === "OWNER_ADMIN") return "owner-admin";
  if (role === "operations" || role === "OPERATIONS") return "operations";
  if (role === "finance" || role === "FINANCE_VIEWER") return "finance";
  if (role === "contract-reviewer" || role === "CONTRACT_REVIEWER") return "contract-reviewer";
  return "unknown";
}

export function navigationAccessForRole(role: string | null | undefined, destination: NavigationDestination): boolean {
  return NAVIGATION_ACCESS[normalizeRole(role)].includes(destination);
}

export function actionStateForOperation(role: string | null | undefined, operationId: string): Readonly<{ allowed: boolean; visibility: ActionVisibility }> {
  if (operationId === "signOutCurrentSession") return { allowed: true, visibility: "visible" };
  const normalized = normalizeRole(role);
  if (normalized === "owner-admin") return { allowed: true, visibility: "visible" };
  if (ADMINISTRATION_OPERATIONS.test(operationId)) return { allowed: false, visibility: "hidden" };
  if (OWNER_ONLY_OPERATIONS.test(operationId)) return { allowed: false, visibility: "disabled" };
  const allowed = (normalized === "operations" && OPERATIONS_OPERATIONS.test(operationId))
    || (normalized === "finance" && (FINANCE_OPERATIONS.test(operationId) || /^(?:requestClosureException|submitFinalCloseForApproval|submitReopenForApproval)$/.test(operationId)))
    || (normalized === "contract-reviewer" && /(?:Approval|Approve|approve|decide)/.test(operationId));
  return { allowed, visibility: allowed ? "visible" : "disabled" };
}

export function permissionAwareQuery(locale: "ar" | "en", role: string | null | undefined): string {
  const query = new URLSearchParams({ locale });
  if (role) query.set("role", role);
  return `?${query.toString()}`;
}
