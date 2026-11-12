import Link from "next/link";
import { SignInForm } from "../../ui/features/auth/SignInForm";
import { EnterpriseStyles } from "../../ui/features/admin/EnterpriseUx";

type Locale = "ar" | "en";

const ENGLISH_TRUST_SIGNALS = [
  "Complete transaction traceability",
  "Granular access controls",
  "Bilingual by design",
] as const;

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const requested = (await searchParams).locale;
  const locale: Locale = requested === "ar" ? "ar" : "en";
  const dir = locale === "ar" ? "rtl" : "ltr";
  const ar = locale === "ar";

  return <main lang={locale} dir={dir} className="orb-signin">
    <EnterpriseStyles />
    <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(dir)}` }} />
    <section className="orb-signin-brand" aria-label="ORB">
      <div className="orb-signin-brand-mark" aria-hidden="true">O</div>
      <p className="orb-signin-product">ORB TRADE OPERATIONS</p>
      <h1>{ar ? "العمل التشغيلي، تحت السيطرة." : "Operations, under control."}</h1>
      <p>{ar ? "منصة موحدة للمشاريع والشحنات والمالية والموافقات مع سجل تدقيق كامل." : "One workspace for projects, shipments, finance and approvals—with complete traceability."}</p>
      {!ar && <ul className="orb-signin-trust-list" aria-label="Workspace capabilities">
        {ENGLISH_TRUST_SIGNALS.map((signal) => <li key={signal}><span aria-hidden="true">✓</span>{signal}</li>)}
      </ul>}
    </section>
    <section className="orb-signin-panel" aria-labelledby="sign-in-heading">
      <div className="orb-signin-panel-header">
        {ar
          ? <Link className="orb-signin-language" href="/sign-in?locale=en" hrefLang="en">English</Link>
          : <Link className="orb-signin-language" href={`/sign-in?locale=ar`} hrefLang="ar">العربية</Link>}
      </div>
      <div className="orb-signin-card">
        <div className="orb-eyebrow">ORB · {ar ? "مساحة آمنة" : "Secure workspace"}</div>
        <h1 id="sign-in-heading">{ar ? "تسجيل الدخول" : "Sign in"}</h1>
        <p className="orb-muted">{ar ? "سجّل الدخول للمتابعة إلى مساحة ORB." : "Use your authorized account to continue."}</p>
        <SignInForm locale={locale} />
        <p className="orb-signin-monitoring">{ar ? "تخضع جميع عمليات الدخول للتسجيل والمراقبة." : "All access is logged and monitored."}</p>
      </div>
    </section>
  </main>;
}
