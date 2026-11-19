"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchCurrentSession, problemOf, sendJson, type ApiProblem } from "../../session-client";

type Locale = "en" | "ar";
interface Item {
  id: string; actionCode: string; subjectType: "CONTRACT" | "SUPPLIER" | "SALES"; subjectId: string; subjectReference: string;
  contractKind?: string; projectId: string; projectReference: string; quantity: string; requesterId: string; requesterName: string; requestedAt: string | null;
}

const KIND: Record<Item["subjectType"], [string, string]> = {
  CONTRACT: ["Contract", "عقد"], SUPPLIER: ["Supplier shipment confirmation", "تأكيد شحنة مورد"], SALES: ["Customer shipment confirmation", "تأكيد شحنة عميل"],
};

/** Owner inbox: every pending contract and shipment approval, with approve / reject-with-reason. */
export function ApprovalInbox({ locale }: { readonly locale: Locale }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [items, setItems] = useState<Item[] | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<ApiProblem | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    if (!response.ok) { setError(await problemOf(response)); return; }
    setError(null);
    setItems((await response.json() as { items: Item[] }).items);
  }, []);
  useEffect(() => { void load(); void fetchCurrentSession().then((session) => setMe(session?.userId ?? null)).catch(() => undefined); }, [load]);

  async function decide(item: Item, decision: "APPROVED" | "REJECTED", comment?: string) {
    setBusy(item.id); setNotice(null);
    try {
      await sendJson(`/api/approvals/${item.id}/decision`, "POST", { decision, ...(comment ? { comment } : {}) });
      setNotice({ tone: "success", text: decision === "APPROVED" ? t(`${item.subjectReference} approved.`, `تم اعتماد ${item.subjectReference}.`) : t(`${item.subjectReference} returned with your reason.`, `أُعيد ${item.subjectReference} مع السبب.`) });
      setRejecting(null);
      await load();
    } catch (problem) {
      setNotice({ tone: "error", text: (problem as ApiProblem).detail ?? t("The decision could not be saved.", "تعذر حفظ القرار.") });
    } finally { setBusy(null); }
  }

  const link = (item: Item) => item.subjectType === "SUPPLIER" ? `/supplier-shipments/${item.subjectId}?locale=${locale}`
    : item.subjectType === "SALES" ? `/sales-shipments/${item.subjectId}?locale=${locale}` : `/projects/${item.projectId}/shipments?locale=${locale}`;

  if (error) return <p className="orb-inbox-notice" role="alert" data-tone="error">{error.status === 403 ? t("Only an owner administrator can decide approvals.", "اتخاذ قرارات الاعتماد متاح للمالك فقط.") : t("Approvals could not be loaded.", "تعذر تحميل الاعتمادات.")} {error.status !== 403 && <button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button>}</p>;
  if (!items) return <p role="status" aria-busy="true">{t("Loading approvals…", "جارٍ تحميل الاعتمادات…")}</p>;

  return <div className="orb-inbox">
    <style>{`
      .orb-inbox{display:grid;gap:12px}.orb-inbox article{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;display:grid;gap:8px}
      .orb-inbox header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:baseline}.orb-inbox .meta{color:var(--orb-color-on-surface-variant);font-size:.85rem}
      .orb-inbox .buttons{display:flex;gap:8px;flex-wrap:wrap}.orb-inbox button{padding:8px 16px;border-radius:999px;border:1px solid var(--orb-color-outline-variant);background:transparent;font:inherit;font-weight:700;cursor:pointer}
      .orb-inbox button[data-primary]{background:var(--orb-color-primary);color:var(--orb-color-on-primary);border-color:transparent}
      .orb-inbox form{display:grid;gap:8px}.orb-inbox textarea{font:inherit;padding:8px;border-radius:10px;border:1px solid var(--orb-color-outline-variant)}
      .orb-inbox-notice{padding:12px 14px;border-radius:12px}.orb-inbox-notice[data-tone=error]{background:var(--orb-color-error-container)}.orb-inbox-notice[data-tone=success]{background:var(--orb-color-primary-container)}
    `}</style>
    {notice && <p className="orb-inbox-notice" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    {items.length === 0 && <p className="orb-muted" role="status">{t("Nothing is waiting for your approval.", "لا يوجد شيء بانتظار اعتمادك.")}</p>}
    {items.map((item) => { const own = me !== null && item.requesterId === me; return <article key={item.id} aria-labelledby={`approval-${item.id}`}>
      <header>
        <strong id={`approval-${item.id}`}>{KIND[item.subjectType][ar ? 1 : 0]}{item.contractKind ? ` (${item.contractKind === "SALES" ? t("sales", "بيع") : t("purchase", "شراء")})` : ""} · <a href={link(item)}><bdi>{item.subjectReference}</bdi></a></strong>
        <span className="meta"><bdi>{item.projectReference}</bdi> · <bdi>{Number(item.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })} MT</bdi></span>
      </header>
      <span className="meta">{t("Requested by", "طلبها")} {item.requesterName}{item.requestedAt ? ` · ${new Date(item.requestedAt).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
      {own ? <p className="meta">{t("You requested this, so another owner must decide it.", "أنت من طلبها، لذلك يجب أن يقرر مالك آخر.")}</p>
        : rejecting === item.id ? <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void decide(item, "REJECTED", String(new FormData(event.currentTarget).get("comment") ?? "")); }}>
            <label>{t("What needs to be corrected?", "ما الذي يجب تصحيحه؟")}<textarea name="comment" required minLength={3} maxLength={500} rows={2}/></label>
            <div className="buttons"><button type="submit" disabled={busy === item.id} data-operation-id="decideFixedApproval">{t("Reject", "رفض")}</button><button type="button" onClick={() => setRejecting(null)}>{t("Back", "رجوع")}</button></div>
          </form>
        : <div className="buttons">
            <button type="button" data-primary disabled={busy === item.id} data-operation-id="decideFixedApproval" onClick={() => void decide(item, "APPROVED")}>{t("Approve", "اعتماد")}</button>
            <button type="button" disabled={busy === item.id} onClick={() => setRejecting(item.id)}>{t("Reject…", "رفض…")}</button>
          </div>}
    </article>; })}
  </div>;
}
