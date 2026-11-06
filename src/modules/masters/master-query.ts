import type { MasterType } from "./schemas.ts";

export interface StoredMasterRecord extends Record<string, unknown> { id: string; masterType: MasterType; version: number; }
export interface MasterPrincipal { readonly userId: string; readonly roles: readonly string[]; }
export function projectMasterRecord(record: StoredMasterRecord, principal: MasterPrincipal): Readonly<Record<string, unknown> & { id: string; version: number }> {
  const projected = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "masterType" && key !== "sensitiveIdentityCiphertext"));
  if (!principal.roles.includes("OWNER_ADMIN")) delete projected.sensitiveIdentity;
  return Object.freeze(projected) as Readonly<Record<string, unknown> & { id: string; version: number }>;
}
export function listProjectedMasters(records: Iterable<StoredMasterRecord>, masterType: MasterType, principal: MasterPrincipal) {
  return [...records].filter((record) => record.masterType === masterType).map((record) => projectMasterRecord(record, principal))
    .sort((left, right) => String(left.code ?? left.reference ?? left.id).localeCompare(String(right.code ?? right.reference ?? right.id)));
}
