export type ProblemLocale = "ar" | "en";

export interface ProblemCopy {
  readonly title: string;
  readonly detail: string;
}

const COPY = {
  en: {
    IDEMPOTENCY_KEY_REUSED: { title: "Idempotency key reused", detail: "This idempotency key was already used with a different request." },
    STALE_VERSION: { title: "Stale version", detail: "The record changed since it was loaded. Reload it and try again." },
    PRECONDITION_REQUIRED: { title: "Version required", detail: "A current aggregate version is required for this command." },
    VALIDATION_FAILED: { title: "Validation failed", detail: "The request could not be processed because one or more values are invalid." },
    INTERNAL_ERROR: { title: "Internal error", detail: "The request could not be completed safely." },
  },
  ar: {
    IDEMPOTENCY_KEY_REUSED: { title: "أُعيد استخدام مفتاح الطلب", detail: "استُخدم مفتاح الطلب هذا سابقًا مع طلب مختلف." },
    STALE_VERSION: { title: "إصدار قديم", detail: "تغيّر السجل منذ تحميله. أعد تحميله ثم حاول مرة أخرى." },
    PRECONDITION_REQUIRED: { title: "الإصدار مطلوب", detail: "يتطلب هذا الأمر إصدار السجل الحالي." },
    VALIDATION_FAILED: { title: "فشل التحقق", detail: "تعذرت معالجة الطلب لأن قيمة واحدة أو أكثر غير صالحة." },
    INTERNAL_ERROR: { title: "خطأ داخلي", detail: "تعذر إكمال الطلب بأمان." },
  },
} as const;

export type LocalizedProblemCode = keyof typeof COPY.en;

export function normalizeProblemLocale(locale?: string | null): ProblemLocale {
  return locale?.trim().toLowerCase().startsWith("ar") ? "ar" : "en";
}

export function localizeProblem(code: string, locale?: string | null): ProblemCopy {
  const normalized = normalizeProblemLocale(locale);
  const localized = COPY[normalized] as Readonly<Record<string, ProblemCopy>>;
  return localized[code] ?? COPY[normalized].INTERNAL_ERROR;
}
