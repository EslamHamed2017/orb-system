import { SignInForm } from "../../ui/features/auth/SignInForm";

type Locale = "ar" | "en";
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const requested = (await searchParams).locale;
  const locale: Locale = requested === "ar" ? "ar" : "en", dir = locale === "ar" ? "rtl" : "ltr";
  return <main lang={locale} dir={dir} style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
    <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.dir=${JSON.stringify(dir)}` }} />
    <section aria-labelledby="sign-in-heading" style={{ width: "min(100%, 28rem)" }}>
      <div aria-label="ORB">ORB</div>
      <h1 id="sign-in-heading">{locale === "ar" ? "تسجيل الدخول" : "Sign in"}</h1>
      <SignInForm locale={locale} />
    </section>
  </main>;
}
