"use client";
import { FormEvent, useState } from "react";

type Locale = "ar" | "en";
const COPY = {
  en: { login: "Login or email", password: "Password", submit: "Sign in", pending: "Signing in…", error: "Unable to sign in. Check your login and password. After 5 failed attempts the account is locked for 15 minutes.", mfa: "MFA verification code", security: "Secure access to your ORB workspace" },
  ar: { login: "اسم المستخدم أو البريد الإلكتروني", password: "كلمة المرور", submit: "دخول", pending: "جارٍ تسجيل الدخول…", error: "تعذر تسجيل الدخول. تأكد من اسم المستخدم وكلمة المرور. بعد 5 محاولات خاطئة يُقفل الحساب لمدة 15 دقيقة.", mfa: "رمز التحقق MFA", security: "وصول آمن إلى مساحة عمل ORB" },
} as const;

export function SignInForm({ locale, next = "/" }: { locale: Locale; next?: string }) {
  const copy = COPY[locale];
  const [pending, setPending] = useState(false), [error, setError] = useState(false), [mfa, setMfa] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(false);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: data.get("login"), credential: data.get("credential") }) });
      if (!response.ok) { setError(true); return; }
      const body = await response.json() as { mfaRequired?: boolean };
      if (body.mfaRequired) { setMfa(true); return; }
      const destination = new URL(next, window.location.origin);
      if (destination.origin !== window.location.origin) destination.href = window.location.origin + "/";
      if (!destination.searchParams.has("locale")) destination.searchParams.set("locale", locale);
      window.location.assign(destination.pathname + destination.search);
    } catch { setError(true); } finally { setPending(false); }
  }
  return <form className="orb-signin-form" onSubmit={submit} noValidate aria-describedby="signin-security-note">
    <p id="signin-security-note" className="orb-signin-form-note"><span aria-hidden="true">●</span>{copy.security}</p>
    <label className="orb-signin-field"><span>{copy.login}</span><input name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required /></label>
    <label className="orb-signin-field"><span>{copy.password}</span><input name="credential" type="password" autoComplete="current-password" required /></label>
    {mfa && <label className="orb-signin-field"><span>{copy.mfa}</span><input name="mfa" inputMode="numeric" autoComplete="one-time-code" /></label>}
    {error && <p className="orb-signin-error" role="alert">{copy.error}</p>}
    <button className="orb-signin-submit" type="submit" data-operation-id="signIn" disabled={pending} aria-busy={pending}>{pending ? copy.pending : copy.submit}</button>
  </form>;
}
