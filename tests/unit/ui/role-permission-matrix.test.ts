import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPermissionMatrix,
  summarizePermissionMatrix,
  type PermissionMatrixRole,
  type PermissionMatrixPermission,
} from "../../../src/ui/features/admin/role-permission-matrix.ts";

const permissions: readonly PermissionMatrixPermission[] = [
  { code: "screen.projects", nameEn: "Projects screen", nameAr: "شاشة المشاريع", category: "SCREEN", descriptionEn: "Open project workspaces", descriptionAr: "فتح مساحات عمل المشاريع" },
  { code: "operation.contracts.approve", nameEn: "Approve contracts", nameAr: "اعتماد العقود", category: "APPROVAL", descriptionEn: "Approve contract versions", descriptionAr: "اعتماد إصدارات العقود" },
  { code: "field.finance.read", nameEn: "Read financial values", nameAr: "عرض القيم المالية", category: "SENSITIVE_VALUE", descriptionEn: "Read protected commercial values", descriptionAr: "عرض القيم التجارية المحمية" },
];
const roles: readonly PermissionMatrixRole[] = [
  { id: "role-owner", code: "OWNER_ADMIN", nameEn: "Owner administrator", nameAr: "مدير المالك", descriptionEn: "Full controlled administration", descriptionAr: "إدارة كاملة ومنضبطة", permissionCodes: permissions.map(({ code }) => code), userCount: 1, system: true },
  { id: "role-reviewer", code: "CONTRACT_REVIEWER", nameEn: "Contract reviewer", nameAr: "مراجع العقود", descriptionEn: "Reviews contracts", descriptionAr: "يراجع العقود", permissionCodes: ["screen.projects", "operation.contracts.approve"], userCount: 2, system: false },
];

test("permission matrix summarizes assignments by role and category", () => {
  assert.deepEqual(summarizePermissionMatrix(roles, permissions), {
    roles: 2,
    permissions: 3,
    assignedGrants: 5,
    usersWithRoles: 3,
    categories: [
      { category: "APPROVAL", permissions: 1 },
      { category: "SCREEN", permissions: 1 },
      { category: "SENSITIVE_VALUE", permissions: 1 },
    ],
  });
});

test("permission matrix filters bilingual permission facts without losing role grants", () => {
  const result = filterPermissionMatrix(permissions, roles, { query: "العقود", category: "ALL" });
  assert.deepEqual(result.map(({ permission, grantedRoleCodes }) => ({ code: permission.code, grantedRoleCodes })), [
    { code: "operation.contracts.approve", grantedRoleCodes: ["CONTRACT_REVIEWER", "OWNER_ADMIN"] },
  ]);
  assert.deepEqual(filterPermissionMatrix(permissions, roles, { query: "", category: "SENSITIVE_VALUE" })[0]?.grantedRoleCodes, ["OWNER_ADMIN"]);
});
