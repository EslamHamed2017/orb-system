export type SettingsDestinationKey = "organization" | "numbering" | "print" | "users" | "roles" | "backup";

export interface SettingsDestination {
  readonly key: SettingsDestinationKey;
  readonly label: string;
  readonly description: string;
  readonly href: string;
  readonly group: "SYSTEM" | "ACCESS" | "RESILIENCE";
}

const COPY = Object.freeze({
  organization: { en: ["Organization and language", "Bilingual organization identity, default language, and time zone."], ar: ["المؤسسة واللغة", "هوية المؤسسة ثنائية اللغة واللغة الافتراضية والمنطقة الزمنية."] },
  numbering: { en: ["Numbering and references", "Human-readable serial prefixes for core trade transactions."], ar: ["الترقيم والمراجع", "بادئات المراجع المقروءة لمعاملات التجارة الأساسية."] },
  print: { en: ["Print and templates", "Bilingual print identity, logo, and document footer controls."], ar: ["الطباعة والقوالب", "هوية الطباعة ثنائية اللغة والشعار وتذييل المستندات."] },
  users: { en: ["Users", "Create users and control lifecycle, roles, locale, and sessions."], ar: ["المستخدمون", "إنشاء المستخدمين والتحكم في الحالة والأدوار واللغة والجلسات."] },
  roles: { en: ["Roles and permissions", "Configure granular screen, operation, approval, and sensitive-value access."], ar: ["الأدوار والصلاحيات", "تهيئة وصول دقيق للشاشات والعمليات والاعتمادات والقيم الحساسة."] },
  backup: { en: ["Backup and restore", "Review isolated backup and restore readiness before pilot use."], ar: ["النسخ الاحتياطي والاستعادة", "مراجعة جاهزية النسخ الاحتياطي والاستعادة المعزولة قبل التشغيل التجريبي."] },
} as const);

export function buildSettingsDestinations(locale: "en" | "ar"): readonly SettingsDestination[] {
  const query = `locale=${locale}`;
  const destination = (key: SettingsDestinationKey, href: string, group: SettingsDestination["group"]): SettingsDestination => ({
    key, label: COPY[key][locale][0], description: COPY[key][locale][1], href, group,
  });
  return Object.freeze([
    destination("organization", `/settings?${query}#organization`, "SYSTEM"),
    destination("numbering", `/settings?${query}#numbering`, "SYSTEM"),
    destination("print", `/settings?${query}#print`, "SYSTEM"),
    destination("users", `/admin/users?${query}`, "ACCESS"),
    destination("roles", `/admin/roles?${query}`, "ACCESS"),
    destination("backup", `/admin/backup?${query}`, "RESILIENCE"),
  ]);
}
