// @ts-expect-error Native Node TypeScript tests require source extensions.
import { operationIds, requiredRolesForOperation } from "./roles.ts";

export interface OperationPrincipal {
  readonly userId: string;
  readonly roles: readonly string[];
  /** Undefined means the session still uses the legacy role bridge. An explicit list is authoritative. */
  readonly permissionCodes?: readonly string[];
}

const PERMISSION_CODE = /^[a-z][a-z0-9_.:-]{1,119}$/;

export function operationPermissionCode(operationId: string): string {
  requiredRolesForOperation(operationId);
  const kebab = operationId
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  const code = `operation.${kebab}`;
  if (!PERMISSION_CODE.test(code)) throw new TypeError("Invalid operation permission code");
  return code;
}

const KNOWN_OPERATION_PERMISSION_CODES = new Set(operationIds().map(operationPermissionCode));

export function assertServerPermission(principal: OperationPrincipal, operationId: string): void {
  const requiredRoles = requiredRolesForOperation(operationId);
  if (
    typeof principal?.userId !== "string"
    || !principal.userId.trim()
    || !Array.isArray(principal.roles)
    || principal.roles.some((role) => typeof role !== "string" || !role.trim())
  ) throw new TypeError("Operation permission denied");
  if (principal.permissionCodes !== undefined) {
    if (
      !Array.isArray(principal.permissionCodes)
      || new Set(principal.permissionCodes).size !== principal.permissionCodes.length
      || principal.permissionCodes.some((code) => typeof code !== "string" || !PERMISSION_CODE.test(code) || !KNOWN_OPERATION_PERMISSION_CODES.has(code))
    ) {
      throw new TypeError("Operation permission denied: malformed grants");
    }
    if (!principal.permissionCodes.includes(operationPermissionCode(operationId))) throw new TypeError("Operation permission denied");
    return;
  }
  if (requiredRoles.length > 0 && !principal.roles.some((role) => requiredRoles.includes(role as never))) {
    throw new TypeError("Operation permission denied");
  }
}
