// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../access/permissions.ts";
export interface SettingsPrincipal extends OperationPrincipal {}
export interface OrganizationSettings { readonly legalNameEn: string; readonly legalNameAr: string; readonly defaultLocale: "en" | "ar"; readonly timeZone: string }
export interface NumberingSettings { readonly salesContractPrefix: string; readonly purchaseContractPrefix: string; readonly salesShipmentPrefix: string; readonly supplierContainerPrefix: string }
export interface PrintSettings { readonly footerEn: string; readonly footerAr: string; readonly showLogo: boolean }
export interface SettingsValues { readonly organization: OrganizationSettings; readonly numbering: NumberingSettings; readonly print: PrintSettings }
export interface SettingsSnapshot extends SettingsValues { readonly version: number; readonly updatedAt: string | null; readonly updatedBy: string | null }
export interface SettingsAuditRecord { readonly id: string; readonly action: "SETTINGS_UPDATED"; readonly actorId: string; readonly occurredAt: string; readonly reason: string; readonly beforeVersion: number; readonly afterVersion: number; readonly changedSections: readonly (keyof SettingsValues)[]; readonly before: SettingsValues; readonly after: SettingsValues }
type SettingsPatch = { readonly [Section in keyof SettingsValues]?: Partial<SettingsValues[Section]> };

const SECTION_FIELDS = Object.freeze({ organization: ["legalNameEn", "legalNameAr", "defaultLocale", "timeZone"], numbering: ["salesContractPrefix", "purchaseContractPrefix", "salesShipmentPrefix", "supplierContainerPrefix"], print: ["footerEn", "footerAr", "showLogo"] } as const);
function clone<T>(value: T): T { return structuredClone(value); }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); }
  return value;
}
function authorize(principal: SettingsPrincipal, operationId: "getSettings" | "updateSettings"): void { try { assertServerPermission(principal, operationId); } catch { throw new TypeError("Settings access denied"); } }
function text(value: unknown, name: string, max = 160): string { if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.length > max) throw new TypeError(`${name} is invalid`); return value; }
function validate(values: SettingsValues): void {
  text(values.organization.legalNameEn, "organization.legalNameEn"); text(values.organization.legalNameAr, "organization.legalNameAr");
  if (!(["en", "ar"] as const).includes(values.organization.defaultLocale)) throw new TypeError("organization.defaultLocale is invalid");
  text(values.organization.timeZone, "organization.timeZone"); try { new Intl.DateTimeFormat("en", { timeZone: values.organization.timeZone }).format(); } catch { throw new TypeError("organization.timeZone is invalid"); }
  for (const [name, value] of Object.entries(values.numbering)) if (typeof value !== "string" || !/^[A-Z][A-Z0-9-]{0,7}$/.test(value)) throw new TypeError(`numbering.${name} is invalid`);
  text(values.print.footerEn, "print.footerEn", 500); text(values.print.footerAr, "print.footerAr", 500); if (typeof values.print.showLogo !== "boolean") throw new TypeError("print.showLogo is invalid");
}
function applyPatch(current: SettingsValues, patch: SettingsPatch): { values: SettingsValues; changed: (keyof SettingsValues)[] } {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("Settings patch is required");
  const allowedSections = Object.keys(SECTION_FIELDS) as (keyof SettingsValues)[];
  for (const section of Object.keys(patch)) if (!allowedSections.includes(section as keyof SettingsValues)) throw new TypeError(`Unknown settings section: ${section}`);
  const next = clone(current) as unknown as Record<string, Record<string, unknown>>, changed: (keyof SettingsValues)[] = [];
  for (const section of allowedSections) {
    const values = patch[section]; if (values === undefined) continue;
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new TypeError(`Settings section ${section} is invalid`);
    for (const [field, value] of Object.entries(values)) { if (!(SECTION_FIELDS[section] as readonly string[]).includes(field)) throw new TypeError(`Unknown settings field: ${section}.${field}`); next[section][field] = value; }
    if (Object.keys(values).length > 0) changed.push(section);
  }
  if (changed.length === 0) throw new TypeError("Settings patch must change at least one field");
  const result = next as unknown as SettingsValues; validate(result); return { values: result, changed };
}

export function createInMemorySettingsService(options: { readonly initial: SettingsValues; readonly now?: () => string; readonly id?: () => string }) {
  validate(options.initial); let values = clone(options.initial), version = 1, updatedAt: string | null = null, updatedBy: string | null = null; const audit: SettingsAuditRecord[] = [];
  const now = options.now ?? (() => new Date().toISOString()), id = options.id ?? (() => crypto.randomUUID());
  return Object.freeze({
    async read(input: { readonly principal: SettingsPrincipal }): Promise<SettingsSnapshot> { authorize(input.principal, "getSettings"); return deepFreeze({ ...clone(values), version, updatedAt, updatedBy }); },
    async update(input: { readonly principal: SettingsPrincipal; readonly expectedVersion: number; readonly reason: string; readonly patch: SettingsPatch }): Promise<SettingsSnapshot> {
      authorize(input.principal, "updateSettings"); if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== version) throw new TypeError("Settings version conflict");
      const reason = text(input.reason, "Settings update reason", 500); if (reason.length < 8) throw new TypeError("Settings update reason must contain at least 8 characters");
      const before = clone(values), applied = applyPatch(values, input.patch), occurredAt = now(); if (!Number.isFinite(Date.parse(occurredAt))) throw new TypeError("Settings audit time is invalid");
      values = applied.values; version += 1; updatedAt = occurredAt; updatedBy = input.principal.userId;
      audit.push(deepFreeze({ id: id(), action: "SETTINGS_UPDATED", actorId: input.principal.userId, occurredAt, reason, beforeVersion: version - 1, afterVersion: version, changedSections: clone(applied.changed), before, after: clone(values) }));
      return deepFreeze({ ...clone(values), version, updatedAt, updatedBy });
    },
    listAudit(): readonly SettingsAuditRecord[] { return deepFreeze(clone(audit)); },
  });
}
