"use client";
import { FormEvent, useState } from "react";

type Locale = "ar" | "en";
const COPY = {
  en: { login: "Login or email", password: "Password", submit: "Sign in", pending: "Signing in…", error: "Unable to sign in. Authentication failed.", mfa: "MFA verification code" },
  ar: { login: "اسم المستخدم أو البريد الإلكتروني", password: "كلمة المرور", submit: "دخول", pending: "جارٍ تسجيل الدخول…", error: "تعذر تسجيل الدخول. فشلت المصادقة.", mfa: "رمز التحقق MFA" },
} as const;

export function SignInForm({ locale }: { locale: Locale }) {
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
      window.location.assign("/");
    } catch { setError(true); } finally { setPending(false); }
  }
  return <form onSubmit={submit} noValidate style={{ display: "grid", gap: 16, width: "min(100%, 28rem)" }}>
    <label>{copy.login}<input name="login" autoComplete="username" required style={{ display: "block", width: "100%", minHeight: 48 }} /></label>
    <label>{copy.password}<input name="credential" type="password" autoComplete="current-password" required style={{ display: "block", width: "100%", minHeight: 48 }} /></label>
    {mfa && <label>{copy.mfa}<input name="mfa" inputMode="numeric" autoComplete="one-time-code" style={{ display: "block", width: "100%", minHeight: 48 }} /></label>}
    {error && <p role="alert">{copy.error}</p>}
    <button type="submit" disabled={pending} style={{ minHeight: 48 }}>{pending ? copy.pending : copy.submit}</button>
  </form>;
}
