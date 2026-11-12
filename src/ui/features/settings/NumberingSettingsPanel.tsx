"use client";

import { useState, type FormEvent } from "react";
import {
  buildNumberingFields,
  prepareNumberingUpdate,
  type NumberingFieldKey,
  type NumberingValues,
} from "./numbering-settings";

type Locale = "en" | "ar";

export function NumberingSettingsPanel({
  locale,
  initialValues,
  initialVersion,
  canManage,
}: Readonly<{
  locale: Locale;
  initialValues: NumberingValues;
  initialVersion: number;
  canManage: boolean;
}>) {
  const ar = locale === "ar";
  const [values, setValues] = useState<NumberingValues>(initialValues);
  const [version, setVersion] = useState(initialVersion);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const fields = buildNumberingFields(locale, values);

  function updateValue(key: NumberingFieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value.toUpperCase() }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    let update: ReturnType<typeof prepareNumberingUpdate>;
    try {
      update = prepareNumberingUpdate({ expectedVersion: version, reason, values });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (ar ? "تعذر التحقق من الإعدادات." : "Settings validation failed."));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json", "If-Match": `"${update.expectedVersion}"` },
        body: JSON.stringify({ reason: update.reason, patch: update.patch }),
      });
      if (!response.ok) {
        if (response.status === 409 || response.status === 412) throw new Error(ar ? "تغيرت الإعدادات. حدّث الصفحة وحاول مرة أخرى." : "Settings changed. Refresh and try again.");
        throw new Error(ar ? "تعذر حفظ إعدادات الترقيم." : "Numbering settings could not be saved.");
      }
      const snapshot = await response.json() as { version?: unknown; numbering?: unknown };
      if (!Number.isSafeInteger(snapshot.version) || !snapshot.numbering || typeof snapshot.numbering !== "object") {
        throw new Error(ar ? "استجابة الإعدادات غير صالحة." : "The settings response was invalid.");
      }
      setValues(update.patch.numbering);
      setVersion(snapshot.version as number);
      setReason("");
      setStatus(ar ? "تم حفظ بادئات المراجع وتسجيل سبب التغيير." : "Reference prefixes saved with an audited change reason.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (ar ? "تعذر حفظ إعدادات الترقيم." : "Numbering settings could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return <section id="numbering" className="numbering-panel" role="region" aria-labelledby="numbering-title">
    <header>
      <div><p className="orb-eyebrow">{ar ? "مراجع المعاملات" : "Transaction references"}</p><h2 id="numbering-title">{ar ? "الترقيم والمراجع" : "Numbering and references"}</h2></div>
      <span className="orb-chip">{ar ? `الإصدار ${version}` : `Version ${version}`}</span>
    </header>
    <p>{ar ? "حدد بادئات قصيرة وفريدة للمراجع المقروءة. تنطبق التغييرات على المراجع الجديدة فقط؛ لا تتغير المراجع الصادرة سابقاً ولا يعاد ضبط التسلسل." : "Set short, unique prefixes for human-readable references. Changes apply only to new references; issued references remain immutable and sequences are never reset."}</p>
    <form onSubmit={save} data-operation-id="updateSettings">
      <div className="numbering-grid">{fields.map((field) => <label key={field.key} className="numbering-field">
        <span><strong>{field.label}</strong><small>{field.description}</small></span>
        <input aria-describedby={`${field.key}-help`} value={field.value} onChange={(event) => updateValue(field.key, event.target.value)} maxLength={8} pattern="[A-Z][A-Z0-9-]{0,7}" disabled={!canManage || busy} autoComplete="off"/>
        <small id={`${field.key}-help`}>{ar ? "مثال مرجعي:" : "Reference preview:"} <bdi>{field.preview}</bdi></small>
      </label>)}</div>
      <label className="numbering-reason"><span>{ar ? "سبب التغيير" : "Change reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500} required disabled={!canManage || busy}/><small>{ar ? "مطلوب لسجل التدقيق (8 أحرف على الأقل)." : "Required for the audit trail (minimum 8 characters)."}</small></label>
      <div className="numbering-actions"><button type="submit" disabled={!canManage || busy}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ بادئات المراجع" : "Save reference prefixes")}</button><span role="status" aria-live="polite">{status}</span></div>
    </form>
    {!canManage && <p role="alert">{ar ? "ليس لديك صلاحية تحديث إعدادات الترقيم." : "You do not have permission to update numbering settings."}</p>}
  </section>;
}
