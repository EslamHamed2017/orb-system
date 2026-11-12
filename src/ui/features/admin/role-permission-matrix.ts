export type PermissionCategory = "SCREEN" | "OPERATION" | "SENSITIVE_VALUE" | "APPROVAL" | "ADMINISTRATION";

export interface PermissionMatrixPermission {
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly category: PermissionCategory;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
}

export interface PermissionMatrixRole {
  readonly id: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly permissionCodes: readonly string[];
  readonly userCount: number;
  readonly system: boolean;
}

export type PermissionCategoryFilter = PermissionCategory | "ALL";

export function summarizePermissionMatrix(roles: readonly PermissionMatrixRole[], permissions: readonly PermissionMatrixPermission[]) {
  const categoryCounts = new Map<PermissionCategory, number>();
  for (const permission of permissions) categoryCounts.set(permission.category, (categoryCounts.get(permission.category) ?? 0) + 1);
  return {
    roles: roles.length,
    permissions: permissions.length,
    assignedGrants: roles.reduce((total, role) => total + role.permissionCodes.length, 0),
    usersWithRoles: roles.reduce((total, role) => total + role.userCount, 0),
    categories: [...categoryCounts].sort(([left], [right]) => left.localeCompare(right)).map(([category, count]) => ({ category, permissions: count })),
  };
}

export function filterPermissionMatrix(
  permissions: readonly PermissionMatrixPermission[],
  roles: readonly PermissionMatrixRole[],
  filters: Readonly<{ query: string; category: PermissionCategoryFilter }>,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return permissions
    .filter((permission) => filters.category === "ALL" || permission.category === filters.category)
    .filter((permission) => !query || [permission.code, permission.nameEn, permission.nameAr, permission.descriptionEn, permission.descriptionAr].some((value) => value.toLocaleLowerCase().includes(query)))
    .sort((left, right) => left.category.localeCompare(right.category) || left.code.localeCompare(right.code))
    .map((permission) => ({
      permission,
      grantedRoleCodes: roles.filter((role) => role.permissionCodes.includes(permission.code)).map((role) => role.code).sort(),
    }));
}
