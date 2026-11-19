// @ts-expect-error Native Node TypeScript tests require source extensions.
import { PILOT_ROLES, operationIds, requiredRolesForOperation, type PilotRole } from "./roles.ts";

/**
 * The roles the server actually enforces (see roles.ts). Custom roles are not supported yet,
 * so the admin screens show this fixed, truthful catalog instead of browser-stored roles.
 */
export const ROLE_DESCRIPTIONS: Readonly<Record<PilotRole, { nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string }>> = Object.freeze({
  OWNER_ADMIN: { nameEn: "Owner administrator", nameAr: "المالك / مدير النظام", descriptionEn: "Full access, including users, settings, approvals, and all financial values.", descriptionAr: "صلاحية كاملة تشمل المستخدمين والإعدادات والاعتمادات وكل القيم المالية." },
  OPERATIONS: { nameEn: "Operations", nameAr: "العمليات", descriptionEn: "Day-to-day projects, contracts, shipments, and documents. Margins and supplier costs are hidden.", descriptionAr: "المشاريع والعقود والشحنات والمستندات اليومية. الهوامش وتكلفة المورد مخفية." },
  FINANCE_VIEWER: { nameEn: "Finance", nameAr: "المالية", descriptionEn: "Accounts, money movements, statements, profit, and reports.", descriptionAr: "الحسابات وحركات الأموال والكشوف والأرباح والتقارير." },
});

export interface CatalogRole {
  readonly code: PilotRole;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly isSystem: true;
  readonly operationIds: readonly string[];
}

export function roleCatalog(): readonly CatalogRole[] {
  const operations = operationIds();
  return PILOT_ROLES.map((code) => ({
    code,
    ...ROLE_DESCRIPTIONS[code],
    isSystem: true as const,
    operationIds: operations.filter((id) => {
      const required = requiredRolesForOperation(id);
      return required.length === 0 || required.includes(code);
    }),
  }));
}

export function operationCatalog(): readonly { operationId: string; roles: readonly PilotRole[] }[] {
  return operationIds().map((operationId) => {
    const required = requiredRolesForOperation(operationId);
    return { operationId, roles: required.length === 0 ? [...PILOT_ROLES] : [...required] };
  });
}
