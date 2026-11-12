export type SettingsLocale = "en" | "ar";

export interface OrganizationPrintValues {
  readonly organization: {
    readonly legalNameEn: string;
    readonly legalNameAr: string;
    readonly defaultLocale: SettingsLocale;
    readonly timeZone: string;
  };
  readonly print: {
    readonly footerEn: string;
    readonly footerAr: string;
    readonly showLogo: boolean;
  };
}

const TIME_ZONES = Object.freeze(["Asia/Dubai", "UTC"] as const);
const ARABIC_TEXT = /[\u0600-\u06ff]/;
const LATIN_TEXT = /[A-Za-z]/;

export function supportedTimeZones(): readonly string[] {
  return TIME_ZONES;
}

function requiredText(value: string, label: string, maxLength: number, script: RegExp): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !script.test(normalized)) {
    throw new TypeError(`${label} is invalid`);
  }
  return normalized;
}

export function prepareOrganizationPrintUpdate(input: {
  readonly expectedVersion: number;
  readonly reason: string;
  readonly values: OrganizationPrintValues;
}) {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new TypeError("Settings version is invalid");
  }
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 500) {
    throw new TypeError("Settings update reason must contain 8 to 500 characters");
  }
  const { organization, print } = input.values;
  if (organization.defaultLocale !== "en" && organization.defaultLocale !== "ar") {
    throw new TypeError("Default language is invalid");
  }
  if (!TIME_ZONES.includes(organization.timeZone as (typeof TIME_ZONES)[number])) {
    throw new TypeError("Time zone is invalid");
  }
  if (typeof print.showLogo !== "boolean") {
    throw new TypeError("Logo visibility is invalid");
  }
  return Object.freeze({
    expectedVersion: input.expectedVersion,
    reason,
    patch: Object.freeze({
      organization: Object.freeze({
        legalNameEn: requiredText(organization.legalNameEn, "English legal name", 160, LATIN_TEXT),
        legalNameAr: requiredText(organization.legalNameAr, "Arabic legal name", 160, ARABIC_TEXT),
        defaultLocale: organization.defaultLocale,
        timeZone: organization.timeZone,
      }),
      print: Object.freeze({
        footerEn: requiredText(print.footerEn, "English print footer", 500, LATIN_TEXT),
        footerAr: requiredText(print.footerAr, "Arabic print footer", 500, ARABIC_TEXT),
        showLogo: print.showLogo,
      }),
    }),
  });
}
