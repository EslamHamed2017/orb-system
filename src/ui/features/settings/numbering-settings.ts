export type NumberingFieldKey =
  | "salesContractPrefix"
  | "purchaseContractPrefix"
  | "salesShipmentPrefix"
  | "supplierContainerPrefix";

export type NumberingValues = Readonly<Record<NumberingFieldKey, string>>;

export interface NumberingField {
  readonly key: NumberingFieldKey;
  readonly label: string;
  readonly description: string;
  readonly value: string;
  readonly preview: string;
}

const FIELD_COPY = Object.freeze({
  salesContractPrefix: {
    en: ["Sales contract", "Customer commercial agreement references."],
    ar: ["عقد البيع", "مراجع الاتفاقيات التجارية مع العملاء."],
  },
  purchaseContractPrefix: {
    en: ["Purchase contract", "Supplier commercial agreement references."],
    ar: ["عقد الشراء", "مراجع الاتفاقيات التجارية مع الموردين."],
  },
  salesShipmentPrefix: {
    en: ["Sales shipment", "Customer-facing fulfillment references."],
    ar: ["شحنة البيع", "مراجع تنفيذ الشحنات الموجهة للعملاء."],
  },
  supplierContainerPrefix: {
    en: ["Supplier container", "Physical multi-supplier container references."],
    ar: ["حاوية الموردين", "مراجع الحاويات الفعلية متعددة الموردين."],
  },
} as const);

const FIELD_KEYS = Object.freeze(Object.keys(FIELD_COPY) as NumberingFieldKey[]);
const PREFIX_PATTERN = /^[A-Z][A-Z0-9-]{0,7}$/;

export function buildNumberingFields(locale: "en" | "ar", values: NumberingValues): readonly NumberingField[] {
  return Object.freeze(FIELD_KEYS.map((key) => Object.freeze({
    key,
    label: FIELD_COPY[key][locale][0],
    description: FIELD_COPY[key][locale][1],
    value: values[key],
    preview: `${values[key]}-2026-000001`,
  })));
}

export function prepareNumberingUpdate(input: {
  readonly expectedVersion: number;
  readonly reason: string;
  readonly values: NumberingValues;
}) {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new TypeError("Settings version is invalid");
  }
  const reason = input.reason.trim();
  if (reason.length < 8 || reason.length > 500) {
    throw new TypeError("Settings update reason must contain 8 to 500 characters");
  }
  const numbering = {} as Record<NumberingFieldKey, string>;
  for (const key of FIELD_KEYS) {
    const value = input.values[key].trim().toUpperCase();
    if (!PREFIX_PATTERN.test(value)) {
      throw new TypeError(`${FIELD_COPY[key].en[0]} prefix must use 1-8 uppercase letters, numbers, or hyphens`);
    }
    numbering[key] = value;
  }
  if (new Set(Object.values(numbering)).size !== FIELD_KEYS.length) {
    throw new TypeError("Transaction prefixes must be unique");
  }
  return Object.freeze({
    expectedVersion: input.expectedVersion,
    reason,
    patch: Object.freeze({ numbering: Object.freeze(numbering) }),
  });
}
