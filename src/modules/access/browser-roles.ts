export const BROWSER_ROLES_STORAGE_KEY = "orb:evaluation:roles:v1";

export interface BrowserRole {
  readonly id: string;
  readonly code: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  readonly permissionCodes: readonly string[];
  readonly updatedAt: string;
}
export type BrowserRoleInput = Pick<BrowserRole, "code" | "nameEn" | "nameAr" | "descriptionEn" | "descriptionAr">;

const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function validateRole(value: unknown, catalog: ReadonlySet<string>): BrowserRole {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_ROLE");
  const role = value as Record<string, unknown>;
  if (!text(role.id, 100) || !text(role.code, 50) || !/^[A-Z][A-Z0-9_]{2,49}$/.test(role.code) ||
      !text(role.nameEn, 100) || !text(role.nameAr, 100) || !text(role.descriptionEn, 240) || !text(role.descriptionAr, 240) ||
      !timestamp(role.updatedAt) || !Array.isArray(role.permissionCodes)) throw new Error("INVALID_ROLE");
  const permissionCodes = role.permissionCodes;
  if (new Set(permissionCodes).size !== permissionCodes.length || permissionCodes.some((code) => typeof code !== "string" || !catalog.has(code))) throw new Error("INVALID_PERMISSIONS");
  return Object.freeze({ id: role.id, code: role.code, nameEn: role.nameEn, nameAr: role.nameAr, descriptionEn: role.descriptionEn, descriptionAr: role.descriptionAr, permissionCodes: Object.freeze([...permissionCodes].sort()), updatedAt: role.updatedAt });
}

export function parseBrowserRoles(raw: string | null, permissionCatalog: readonly string[]): readonly BrowserRole[] {
  if (raw === null) return Object.freeze([]);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("INVALID_ROLES"); }
  if (!Array.isArray(parsed) || parsed.length > 100) throw new Error("INVALID_ROLES");
  const roles = parsed.map((role) => validateRole(role, new Set(permissionCatalog)));
  if (new Set(roles.map(({ id }) => id)).size !== roles.length || new Set(roles.map(({ code }) => code)).size !== roles.length) throw new Error("DUPLICATE_ROLE");
  return Object.freeze(roles.sort((left, right) => left.code.localeCompare(right.code)));
}

export function createBrowserRole(roles: readonly BrowserRole[], input: BrowserRoleInput, permissionCatalog: readonly string[], id: string, now: string): readonly BrowserRole[] {
  const normalized = { ...input, code: input.code.trim().toUpperCase(), nameEn: input.nameEn.trim(), nameAr: input.nameAr.trim(), descriptionEn: input.descriptionEn.trim(), descriptionAr: input.descriptionAr.trim() };
  if (roles.some(({ code }) => code === normalized.code)) throw new Error("DUPLICATE_ROLE");
  return parseBrowserRoles(JSON.stringify([...roles, { ...normalized, id, permissionCodes: [], updatedAt: now }]), permissionCatalog);
}

export function replaceBrowserRolePermissions(roles: readonly BrowserRole[], roleId: string, expectedUpdatedAt: string, permissionCodes: readonly string[], permissionCatalog: readonly string[], now: string): readonly BrowserRole[] {
  const role = roles.find(({ id }) => id === roleId);
  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (role.updatedAt !== expectedUpdatedAt) throw new Error("STALE_ROLE");
  return parseBrowserRoles(JSON.stringify(roles.map((item) => item.id === roleId ? { ...item, permissionCodes, updatedAt: now } : item)), permissionCatalog);
}
