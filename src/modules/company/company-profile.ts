import type { SqlClient, SqlTransaction } from "../shipments/execution/shipment-execution-store.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { ShipmentProblem, type ShipmentActor } from "../shipments/execution/shipment-execution-service.ts";

/**
 * The company's own details, entered once under the gear → Account and settings and printed on every document
 * (invoices, statements, receipts, contracts, purchase orders, commercial invoices, packing lists) — like the
 * company settings and custom form styles in QuickBooks. One profile per company (tenant); every change is kept.
 */
export interface CompanyDetails {
  readonly legalNameEn: string; readonly legalNameAr: string;
  readonly addressEn: string; readonly addressAr: string;
  readonly phone: string; readonly email: string; readonly website: string;
  readonly trn: string; readonly licenceNo: string;
  readonly bankName: string; readonly bankAccountName: string; readonly iban: string; readonly swift: string; readonly bankCurrency: string;
  readonly termsEn: string; readonly termsAr: string; readonly footerEn: string; readonly footerAr: string;
  readonly brandColor: string; readonly documentLanguage: "BILINGUAL" | "EN" | "AR";
  readonly vatRegistered: boolean; readonly standardVatRate: string;
}

export interface CompanyProfileView {
  readonly organization: { readonly legalNameEn: string; readonly legalNameAr: string; readonly defaultLocale: "en" | "ar"; readonly timeZone: string };
  readonly numbering: { readonly salesContractPrefix: string; readonly purchaseContractPrefix: string; readonly salesShipmentPrefix: string; readonly supplierContainerPrefix: string };
  readonly print: { readonly footerEn: string; readonly footerAr: string; readonly showLogo: boolean };
  readonly company: CompanyDetails & { readonly logoDataUrl: string | null };
  readonly version: number; readonly updatedAt: string | null; readonly updatedBy: string | null;
}

export const EMPTY_COMPANY: CompanyDetails = Object.freeze({
  legalNameEn: "", legalNameAr: "", addressEn: "", addressAr: "", phone: "", email: "", website: "", trn: "", licenceNo: "",
  bankName: "", bankAccountName: "", iban: "", swift: "", bankCurrency: "", termsEn: "", termsAr: "", footerEn: "", footerAr: "",
  brandColor: "#1f4e79", documentLanguage: "BILINGUAL", vatRegistered: false, standardVatRate: "5",
});

const LIMITS: Record<keyof CompanyDetails, number> = {
  legalNameEn: 160, legalNameAr: 160, addressEn: 400, addressAr: 400, phone: 40, email: 160, website: 160, trn: 20, licenceNo: 40,
  bankName: 120, bankAccountName: 160, iban: 40, swift: 11, bankCurrency: 3, termsEn: 1000, termsAr: 1000, footerEn: 500, footerAr: 500,
  brandColor: 7, documentLanguage: 9, vatRegistered: 5, standardVatRate: 6,
};
const MAX_LOGO = 512 * 1024;
const LOGO = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

const invalid = (detail: string) => new ShipmentProblem(422, "VALIDATION_FAILED", detail);

/** Checks a partial update and returns the cleaned fields. */
export function cleanCompanyPatch(input: unknown): Partial<CompanyDetails> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalid("company must be an object.");
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (key === "logoDataUrl") continue;
    if (!(key in LIMITS)) throw invalid(`Unknown company field ${key}.`);
    const field = key as keyof CompanyDetails;
    if (field === "vatRegistered") { if (typeof raw !== "boolean") throw invalid("vatRegistered must be true or false."); out[field] = raw; continue; }
    if (typeof raw !== "string") throw invalid(`${key} must be text.`);
    const value = raw.trim();
    if (value.length > LIMITS[field]) throw invalid(`${key} is too long (${LIMITS[field]} characters at most).`);
    if (field === "documentLanguage" && !["BILINGUAL", "EN", "AR"].includes(value)) throw invalid("documentLanguage must be BILINGUAL, EN or AR.");
    if (field === "brandColor" && !/^#[0-9a-fA-F]{6}$/.test(value)) throw invalid("brandColor must look like #1f4e79.");
    if (field === "email" && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw invalid("Enter a valid email address.");
    if (field === "trn" && value && !/^\d{15}$/.test(value)) throw invalid("The UAE tax registration number (TRN) has 15 digits.");
    if (field === "iban" && value && !/^[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}$/i.test(value)) throw invalid("Enter a valid IBAN.");
    if (field === "swift" && value && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/i.test(value)) throw invalid("SWIFT/BIC has 8 or 11 letters and digits.");
    if (field === "bankCurrency" && value && !/^[A-Z]{3}$/.test(value)) throw invalid("Currency must be a 3-letter code.");
    if (field === "standardVatRate" && !(/^\d{1,2}(\.\d{1,2})?$/.test(value))) throw invalid("VAT rate must be a percentage like 5.");
    out[field] = field === "iban" || field === "swift" ? value.toUpperCase() : value;
  }
  return out as Partial<CompanyDetails>;
}

export function decodeLogo(value: unknown): { bytes: Buffer; mediaType: string } | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const match = typeof value === "string" ? LOGO.exec(value) : null;
  if (!match) throw invalid("The logo must be a PNG, JPEG or WebP image.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > MAX_LOGO) throw invalid("The logo must be 512 KB or smaller.");
  return { bytes, mediaType: match[1] };
}

export class PrismaCompanyProfileStore {
  readonly client: SqlClient;
  constructor(client: SqlClient) { this.client = client; }

  async read(tx: SqlTransaction | SqlClient, tenantId: string): Promise<{ profile: Record<string, unknown>; logo: Buffer | null; logoMediaType: string | null; version: number; updatedAt: string | null; updatedBy: string | null; tenantName: string }> {
    const row = (await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT t."name" tenant_name, p."profile", p."logo", p."logo_media_type", p."version", p."updated_at", p."updated_by"::text updated_by
         FROM "Tenant" t LEFT JOIN "CompanyProfile" p ON p."tenant_id" = t."id" WHERE t."id" = $1`, tenantId))[0];
    return {
      profile: (row?.profile as Record<string, unknown>) ?? {}, logo: (row?.logo as Buffer) ?? null, logoMediaType: (row?.logo_media_type as string) ?? null,
      version: Number(row?.version ?? 1), updatedAt: row?.updated_at ? new Date(row.updated_at as string).toISOString() : null, updatedBy: (row?.updated_by as string) ?? null,
      tenantName: String(row?.tenant_name ?? ""),
    };
  }

  async update(input: { tenantId: string; actorId: string; expectedVersion: number; reason: string; profile: Record<string, unknown>; logo: { bytes: Buffer; mediaType: string } | null | undefined }) {
    await this.client.$transaction(async (tx) => {
      const current = (await tx.$queryRawUnsafe<Array<{ version: number }>>(`SELECT "version" FROM "CompanyProfile" WHERE "tenant_id" = $1 FOR UPDATE`, input.tenantId))[0];
      const version = current ? Number(current.version) : 1;
      if (version !== input.expectedVersion) throw new ShipmentProblem(409, "STATE_CONFLICT", "Someone else changed the settings. Reload and try again.");
      const next = current ? version + 1 : 2;
      if (!current) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "CompanyProfile" ("tenant_id","profile","logo","logo_media_type","version","updated_at","updated_by") VALUES ($1,$2::jsonb,$5::bytea,$6,$3,NOW(),$4)`,
          input.tenantId, JSON.stringify(input.profile), next, input.actorId, input.logo ? input.logo.bytes : null, input.logo ? input.logo.mediaType : null);
      } else {
        if (input.logo === undefined) {
          await tx.$executeRawUnsafe(`UPDATE "CompanyProfile" SET "profile" = $2::jsonb, "version" = $3, "updated_at" = NOW(), "updated_by" = $4 WHERE "tenant_id" = $1`,
            input.tenantId, JSON.stringify(input.profile), next, input.actorId);
        } else {
          await tx.$executeRawUnsafe(`UPDATE "CompanyProfile" SET "profile" = $2::jsonb, "logo" = $5::bytea, "logo_media_type" = $6, "version" = $3, "updated_at" = NOW(), "updated_by" = $4 WHERE "tenant_id" = $1`,
            input.tenantId, JSON.stringify(input.profile), next, input.actorId, input.logo ? input.logo.bytes : null, input.logo ? input.logo.mediaType : null);
        }
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "CompanyProfileHistory" ("tenant_id","version","profile","logo_changed","reason","changed_by") VALUES ($1,$2,$3::jsonb,$4,$5,$6)`,
        input.tenantId, next, JSON.stringify(input.profile), input.logo !== undefined, input.reason, input.actorId);
    });
  }
}

export function viewOf(stored: Awaited<ReturnType<PrismaCompanyProfileStore["read"]>>): CompanyProfileView {
  const p = stored.profile as { company?: Partial<CompanyDetails>; organization?: Record<string, string>; numbering?: Record<string, string>; print?: Record<string, unknown> };
  const merged: CompanyDetails = { ...EMPTY_COMPANY, ...(p.company ?? {}) };
  const company: CompanyDetails = merged.legalNameEn ? merged : { ...merged, legalNameEn: stored.tenantName };
  return {
    organization: { legalNameEn: company.legalNameEn, legalNameAr: company.legalNameAr, defaultLocale: (p.organization?.defaultLocale === "ar" ? "ar" : "en"), timeZone: p.organization?.timeZone ?? "Asia/Dubai" },
    numbering: {
      salesContractPrefix: p.numbering?.salesContractPrefix ?? "ORB-SC", purchaseContractPrefix: p.numbering?.purchaseContractPrefix ?? "ORB-PC",
      salesShipmentPrefix: p.numbering?.salesShipmentPrefix ?? "OUT", supplierContainerPrefix: p.numbering?.supplierContainerPrefix ?? "IN",
    },
    print: { footerEn: company.footerEn, footerAr: company.footerAr, showLogo: p.print?.showLogo !== false },
    company: { ...company, logoDataUrl: stored.logo && stored.logoMediaType ? `data:${stored.logoMediaType};base64,${Buffer.from(stored.logo).toString("base64")}` : null },
    version: stored.version, updatedAt: stored.updatedAt, updatedBy: stored.updatedBy,
  };
}

export function createCompanyProfileService(store: PrismaCompanyProfileStore) {
  return Object.freeze({
    /** Owner-only, like QuickBooks' Account and settings. Documents read the profile through their own print data. */
    async get(actor: ShipmentActor) {
      if (!actor.roles.includes("OWNER_ADMIN")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Only an owner can change company settings.");
      return viewOf(await store.read(store.client, actor.tenantId));
    },
    async update(actor: ShipmentActor, expectedVersion: number, body: { reason?: unknown; patch?: unknown }) {
      if (!actor.roles.includes("OWNER_ADMIN")) throw new ShipmentProblem(403, "PERMISSION_DENIED", "Only an owner can change company settings.");
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
      if (reason.length < 8 || reason.length > 500) throw invalid("Say briefly why you're changing the settings (8-500 characters).");
      const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch) ? body.patch as Record<string, unknown> : null;
      if (!patch || !Object.keys(patch).length) throw invalid("Nothing to change.");
      const current = await store.read(store.client, actor.tenantId);
      const profile = { ...(current.profile as Record<string, unknown>) } as { company?: Partial<CompanyDetails>; organization?: Record<string, unknown>; numbering?: Record<string, unknown>; print?: Record<string, unknown> };
      let logo: ReturnType<typeof decodeLogo>;
      for (const [section, value] of Object.entries(patch)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${section} must be an object.`);
        if (section === "company") {
          profile.company = { ...(profile.company ?? {}), ...cleanCompanyPatch(value) };
          logo = decodeLogo((value as Record<string, unknown>).logoDataUrl);
        } else if (section === "organization") {
          const v = value as Record<string, unknown>;
          const org = { ...(profile.organization ?? {}) } as Record<string, unknown>;
          if (v.defaultLocale !== undefined) { if (v.defaultLocale !== "en" && v.defaultLocale !== "ar") throw invalid("defaultLocale must be en or ar."); org.defaultLocale = v.defaultLocale; }
          if (v.timeZone !== undefined) { if (typeof v.timeZone !== "string" || !v.timeZone.trim()) throw invalid("timeZone is required."); org.timeZone = v.timeZone.trim(); }
          const names = cleanCompanyPatch({ ...(typeof v.legalNameEn === "string" ? { legalNameEn: v.legalNameEn } : {}), ...(typeof v.legalNameAr === "string" ? { legalNameAr: v.legalNameAr } : {}) });
          profile.company = { ...(profile.company ?? {}), ...names };
          profile.organization = org;
        } else if (section === "print") {
          const v = value as Record<string, unknown>;
          const printPatch: Record<string, string> = {};
          if (typeof v.footerEn === "string") printPatch.footerEn = v.footerEn;
          if (typeof v.footerAr === "string") printPatch.footerAr = v.footerAr;
          profile.company = { ...(profile.company ?? {}), ...cleanCompanyPatch(printPatch) };
          if (v.showLogo !== undefined) { if (typeof v.showLogo !== "boolean") throw invalid("showLogo must be true or false."); profile.print = { ...(profile.print ?? {}), showLogo: v.showLogo }; }
        } else if (section === "numbering") {
          const v = value as Record<string, unknown>;
          for (const [k, prefix] of Object.entries(v)) if (typeof prefix !== "string" || !/^[A-Z][A-Z0-9-]{0,7}$/.test(prefix)) throw invalid(`${k} must be capital letters, digits or dashes.`);
          profile.numbering = { ...(profile.numbering ?? {}), ...v };
        } else throw invalid(`Unknown settings section ${section}.`);
      }
      await store.update({ tenantId: actor.tenantId, actorId: actor.userId, expectedVersion, reason, profile, logo });
      return viewOf(await store.read(store.client, actor.tenantId));
    },
  });
}

export type CompanyProfileService = ReturnType<typeof createCompanyProfileService>;
