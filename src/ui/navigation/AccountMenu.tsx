"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { initials, sendJson, type ApiProblem, type CurrentSession } from "../session-client";

type Locale = "ar" | "en";

const ROLE_LABELS: Record<string, [string, string]> = {
  OWNER_ADMIN: ["Owner administrator", "المالك / مدير النظام"],
  OPERATIONS: ["Operations", "العمليات"],
  FINANCE_VIEWER: ["Finance", "المالية"],
};

/**
 * Avatar button + account dialog: who is signed in, change password, sign out.
 * When the user must change a temporary password, the dialog opens by itself and cannot be dismissed.
 */
export function AccountMenu({ session, locale, onPasswordChanged }: { readonly session: CurrentSession; readonly locale: Locale; readonly onPasswordChanged: () => void }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const forced = session.mustChangePassword;
  const name = ar ? session.nameAr : session.nameEn;

  useEffect(() => {
    if (forced && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [forced]);

  async function signOut() {
    setPending(true);
    try { await sendJson("/api/sessions/current", "DELETE"); } catch { /* cookies are cleared either way */ }
    window.location.assign(`/sign-in?locale=${locale}`);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== String(data.get("confirmPassword") ?? "")) {
      setMessage({ tone: "error", text: t("The two new passwords do not match.", "كلمتا المرور الجديدتان غير متطابقتين.") });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      await sendJson("/api/sessions/current/password", "POST", { currentPassword: data.get("currentPassword"), newPassword });
      form.reset();
      setMessage({ tone: "success", text: t("Password changed. Other devices were signed out.", "تم تغيير كلمة المرور. تم تسجيل الخروج من الأجهزة الأخرى.") });
      onPasswordChanged();
    } catch (error) {
      const detail = (error as ApiProblem).detail;
      setMessage({ tone: "error", text: detail ?? t("Could not change the password.", "تعذر تغيير كلمة المرور.") });
    } finally {
      setPending(false);
    }
  }

  return <>
    <button className="orb-avatar" type="button" aria-haspopup="dialog" aria-label={t(`Account: ${name}`, `الحساب: ${name}`)} onClick={() => dialog.current?.showModal()}>
      {initials(session.nameEn || session.nameAr)}
    </button>
    <dialog
      ref={dialog}
      className="orb-account-dialog"
      dir={ar ? "rtl" : "ltr"}
      aria-labelledby="orb-account-title"
      onCancel={(event) => { if (forced) event.preventDefault(); }}
    >
      <style>{`
        .orb-account-dialog{border:0;border-radius:20px;padding:24px;inline-size:min(440px,calc(100vw - 32px));background:var(--orb-color-surface,#fff);color:inherit;box-shadow:0 12px 40px rgb(0 0 0/.18)}
        .orb-account-dialog::backdrop{background:rgb(0 0 0/.35)}
        .orb-account-dialog h2{margin:0 0 4px;font-size:1.15rem}.orb-account-dialog .muted{color:var(--orb-color-on-surface-variant,#555);font-size:.85rem;margin:0}
        .orb-account-dialog .chips{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.orb-account-dialog .chip{border-radius:999px;padding:4px 10px;font-size:.75rem;font-weight:700;background:var(--orb-color-primary-container,#e8f0ff)}
        .orb-account-dialog form{display:grid;gap:10px;margin-block:16px}.orb-account-dialog label{display:grid;gap:4px;font-size:.85rem;font-weight:600}
        .orb-account-dialog input{padding:10px 12px;border-radius:10px;border:1px solid var(--orb-color-outline-variant,#ccc);font:inherit}
        .orb-account-dialog .notice{padding:10px 12px;border-radius:10px;font-size:.85rem}.orb-account-dialog .notice[data-tone=error]{background:var(--orb-color-error-container,#fde8e8)}.orb-account-dialog .notice[data-tone=success]{background:var(--orb-color-primary-container,#e8f6ec)}
        .orb-account-dialog .actions{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap}.orb-account-dialog button{padding:10px 16px;border-radius:999px;border:1px solid var(--orb-color-outline-variant,#ccc);background:transparent;font:inherit;font-weight:700;cursor:pointer}
        .orb-account-dialog button[type=submit]{background:var(--orb-color-primary,#1f4fd1);color:var(--orb-color-on-primary,#fff);border-color:transparent}
      `}</style>
      <h2 id="orb-account-title">{name}</h2>
      {session.login && <p className="muted"><bdi>{session.login}</bdi></p>}
      <div className="chips">{session.roles.map((role) => <span className="chip" key={role}>{(ROLE_LABELS[role] ?? [role, role])[ar ? 1 : 0]}</span>)}</div>
      {forced && <p className="notice" data-tone="error" role="alert">{t("You signed in with a temporary password. Choose a new password to continue.", "سجلت الدخول بكلمة مرور مؤقتة. اختر كلمة مرور جديدة للمتابعة.")}</p>}
      <form onSubmit={changePassword}>
        <strong>{t("Change password", "تغيير كلمة المرور")}</strong>
        <label>{t("Current password", "كلمة المرور الحالية")}<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
        <label>{t("New password (10+ characters, letters and digits)", "كلمة المرور الجديدة (10 أحرف على الأقل، حروف وأرقام)")}<input name="newPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
        <label>{t("Confirm new password", "تأكيد كلمة المرور الجديدة")}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} required /></label>
        {message && <p className="notice" data-tone={message.tone} role={message.tone === "error" ? "alert" : "status"}>{message.text}</p>}
        <button type="submit" disabled={pending} aria-busy={pending}>{t("Save new password", "حفظ كلمة المرور")}</button>
      </form>
      <div className="actions">
        <button type="button" onClick={signOut} disabled={pending} data-operation-id="signOutCurrentSession">{t("Sign out", "تسجيل الخروج")}</button>
        {!forced && <button type="button" onClick={() => { setMessage(null); dialog.current?.close(); }}>{t("Close", "إغلاق")}</button>}
      </div>
    </dialog>
  </>;
}
