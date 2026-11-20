"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { fetchCurrentSession, problemOf, sendForm, sendJson, type ApiProblem } from "../../session-client";

/**
 * A saved project's claims. Raised on one shipment with the evidence; moved to review; the outcome (settled with an
 * amount, or rejected / withdrawn) goes to another owner. A settled customer claim lowers revenue, a settled supplier
 * claim lowers cost, both in the Actual margin.
 */
type Side = "CUSTOMER" | "SUPPLIER";
type ClaimType = "QUANTITY" | "WEIGHT" | "QUALITY" | "DELIVERY" | "PRICE" | "DOCUMENT";
interface Proposal { id: string; outcome: "RESOLVED" | "REJECTED"; amount: string | null; reason: string; state: string; approvalId: string | null; proposedById: string | null; proposedByName: string; decisionComment: string | null }
interface Claim {
  id: string; side: Side; type: ClaimType; state: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED"; shipmentId: string; shipmentReference: string; partyName: string;
  description: string; quantity: string | null; amount: string | null; currency: string | null; settledAmount: string | null; openedByName: string; openedAt: string | null;
  document: { id: string; filename: string } | null; proposal: Proposal | null;
}
interface Data {
  project: { id: string; reference: string; customerName: string; currency: string; finalState: "OPEN" | "FINAL_CLOSED" };
  claims: Claim[]; shipments: { id: string; side: Side; reference: string; partyName: string }[];
}
type Open = null | "NEW" | `OUTCOME:${string}` | `REJECT:${string}`;

const TYPES: Record<ClaimType, [string, string]> = {
  QUANTITY: ["Quantity", "الكمية"], WEIGHT: ["Weight", "الوزن"], QUALITY: ["Quality", "الجودة"], DELIVERY: ["Delivery", "التسليم"], PRICE: ["Price", "السعر"], DOCUMENT: ["Documents", "المستندات"],
};
const STATES: Record<Claim["state"], [string, string, string]> = {
  OPEN: ["Open", "مفتوحة", "warning"], UNDER_REVIEW: ["Under review", "قيد المراجعة", "warning"], RESOLVED: ["Settled", "مسوّاة", "success"], REJECTED: ["Rejected / withdrawn", "مرفوضة / مسحوبة", "error"],
};
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectClaimsWorkspace({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState<ApiProblem | null>(null);
  const [me, setMe] = useState<{ id: string; roles: readonly string[] } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/claims`, { cache: "no-store" });
    if (!response.ok) { setLoadError(await problemOf(response)); return; }
    setLoadError(null);
    setData(await response.json() as Data);
  }, [projectId]);
  useEffect(() => { void load(); void fetchCurrentSession().then((session) => session && setMe({ id: session.userId, roles: session.roles })); }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); setOpen(null); await load(); setNotice({ tone: "success", text: success }); }
    catch (error) { setNotice({ tone: "error", text: (error as ApiProblem).detail ?? t("The action could not be completed.", "تعذر تنفيذ العملية.") }); }
    finally { setBusy(false); }
  }

  const shell = (body: React.ReactNode) => <section className="orb-erp orb-claims" dir={ar ? "rtl" : "ltr"} aria-labelledby="claims-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} projectLabel={data?.project.reference} current="claims"/>
    {body}
  </section>;

  if (loadError) return shell(<>
    <ErpPageHeader titleId="claims-title" eyebrow={t("Project", "المشروع")} title={loadError.status === 404 ? t("Project not found", "المشروع غير موجود") : t("Claims unavailable", "المطالبات غير متاحة")}
      description={loadError.status === 403 ? t("Your role cannot see this project's claims.", "دورك لا يسمح برؤية مطالبات هذا المشروع.") : t("Try again in a moment.", "حاول مرة أخرى بعد قليل.")}/>
    <p><button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
  </>);
  if (!data) return shell(<><h1 id="claims-title" className="orb-sr-only">{t("Claims", "المطالبات")}</h1><p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p></>);

  const d = data;
  const closed = d.project.finalState === "FINAL_CLOSED";
  const owner = Boolean(me?.roles.includes("OWNER_ADMIN"));
  const writer = !closed && Boolean(me?.roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS"));
  const live = d.claims.filter((c) => c.state === "OPEN" || c.state === "UNDER_REVIEW");
  const settled = (side: Side) => d.claims.filter((c) => c.side === side && c.state === "RESOLVED" && c.currency === d.project.currency).reduce((total, c) => total + Number(c.settledAmount ?? 0), 0);
  const chip = (state: Claim["state"]) => <span className="orb-chip" data-tone={STATES[state][2]}>{STATES[state][ar ? 1 : 0]}</span>;
  const sideLabel = (side: Side, party: string) => side === "CUSTOMER" ? t(`Customer claim · ${party}`, `مطالبة من العميل · ${party}`) : t(`Our claim on supplier · ${party}`, `مطالبتنا على المورد · ${party}`);

  const newForm = <form className="claims-form" aria-labelledby="new-claim-title" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!String(form.get("amount") ?? "")) { form.delete("amount"); form.delete("currency"); }
    if (!String(form.get("quantity") ?? "")) form.delete("quantity");
    void run(() => sendForm(`/api/projects/${projectId}/claims`, form), t("Claim opened.", "تم فتح المطالبة."));
  }}>
    <h3 id="new-claim-title">{t("Open a claim", "فتح مطالبة")}</h3>
    <div className="grid">
      <label>{t("Shipment", "الشحنة")}<select name="shipmentId" required defaultValue="">
        <option value="" disabled>{t("Choose…", "اختر…")}</option>
        {d.shipments.map((s) => <option key={s.id} value={s.id}>{s.side === "CUSTOMER" ? t("Customer shipment", "شحنة عميل") : t("Supplier shipment", "شحنة مورد")} {s.reference} · {s.partyName}</option>)}
      </select></label>
      <label>{t("Claim about", "نوع المطالبة")}<select name="type" required defaultValue="QUALITY">{(Object.keys(TYPES) as ClaimType[]).map((k) => <option key={k} value={k}>{TYPES[k][ar ? 1 : 0]}</option>)}</select></label>
      <label>{t("Quantity (MT, optional)", "الكمية (طن، اختياري)")}<input name="quantity" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,3})?"/></label>
      <label>{t("Amount claimed (optional)", "المبلغ المطالب به (اختياري)")}<input name="amount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?"/></label>
      <label>{t("Currency", "العملة")}<input name="currency" defaultValue={d.project.currency} maxLength={3} pattern="[A-Za-z]{3}"/></label>
    </div>
    <label>{t("What happened?", "ماذا حدث؟")}<textarea name="description" required minLength={3} maxLength={1000} rows={3}/></label>
    <label>{t("Evidence (survey report, photos, letter)", "الدليل (تقرير المعاينة، صور، خطاب)")}<input name="file" type="file" required accept="application/pdf,image/png,image/jpeg"/></label>
    <div className="claims-buttons"><button type="submit" className="orb-button-filled" disabled={busy} data-operation-id="openSimpleClaim">{t("Open claim", "فتح المطالبة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
  </form>;

  const outcomeForm = (c: Claim) => <form className="claims-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const outcome = String(form.get("outcome"));
    void run(() => sendJson(`/api/claims/${c.id}/submit-outcome`, "POST", { outcome, reason: String(form.get("reason") ?? "").trim(), ...(outcome === "RESOLVED" ? { amount: String(form.get("amount") ?? "").trim(), currency: c.currency ?? d.project.currency } : {}) }),
      t("Outcome saved — the claim is closed.", "تم حفظ النتيجة — أُغلقت المطالبة."));
  }}>
    <fieldset><legend>{t("Outcome", "النتيجة")}</legend>
      <label className="inline"><input type="radio" name="outcome" value="RESOLVED" defaultChecked/> {c.side === "CUSTOMER" ? t("Settle — we credit the customer", "تسوية — نخصم للعميل") : t("Settle — supplier credits us", "تسوية — المورد يخصم لنا")}</label>
      <label className="inline"><input type="radio" name="outcome" value="REJECTED"/> {t("Reject or withdraw", "رفض أو سحب")}</label>
    </fieldset>
    <label>{t(`Settled amount (${c.currency ?? d.project.currency}) — leave empty when rejecting`, `المبلغ المسوّى (${c.currency ?? d.project.currency}) — اتركه فارغاً عند الرفض`)}<input name="amount" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" defaultValue={c.amount ?? ""}/></label>
    <label>{t("Reason", "السبب")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
    <div className="claims-buttons"><button type="submit" className="orb-button-filled" disabled={busy} data-operation-id="submitClaimOutcomeForApproval">{t("Save outcome", "حفظ النتيجة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
  </form>;

  return shell(<>
    <ErpPageHeader titleId="claims-title" eyebrow={<><bdi>{d.project.reference}</bdi><span>•</span>{d.project.customerName}</>} title={t("Claims", "المطالبات")}
      description={t("Claims on this project's shipments. An owner approves every outcome; settled amounts change the Actual margin.", "مطالبات على شحنات هذا المشروع. المالك يعتمد كل نتيجة، والمبالغ المسوّاة تغيّر الهامش الفعلي.")}
      meta={closed ? <span className="orb-chip" data-tone="success">{t("Project closed", "المشروع مغلق")}</span> : undefined}/>
    {notice && <p className="claims-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    {closed && <p className="claims-banner" role="status">{t("This project is closed, so claims can't be opened or changed. Reopen it from Closure.", "هذا المشروع مغلق، لذلك لا يمكن فتح المطالبات أو تعديلها. أعد فتحه من صفحة الإغلاق.")}</p>}
    <div className="orb-summary-grid">
      <Kpi label={t("Open claims", "مطالبات مفتوحة")} value={String(live.length)} detail={t(`${live.filter((c) => c.state === "UNDER_REVIEW").length} under review`, `${live.filter((c) => c.state === "UNDER_REVIEW").length} قيد المراجعة`)}/>
      <Kpi label={t("Settled with customer", "مسوّى مع العميل")} value={<bdi>{d.project.currency} {fmt(settled("CUSTOMER"))}</bdi>} detail={t("Lowers revenue", "يخفض الإيراد")}/>
      <Kpi label={t("Settled by suppliers", "مسوّى من الموردين")} value={<bdi>{d.project.currency} {fmt(settled("SUPPLIER"))}</bdi>} detail={t("Lowers cost", "يخفض التكلفة")}/>
    </div>
    {writer && open !== "NEW" && <div className="claims-actions"><button type="button" className="orb-button-filled" disabled={!d.shipments.length} onClick={() => setOpen("NEW")} data-operation-id="openSimpleClaim">{t("Open a claim", "فتح مطالبة")}</button>
      {!d.shipments.length && <small className="orb-muted">{t("Confirm a shipment first.", "أكّد شحنة أولاً.")}</small>}</div>}
    {open === "NEW" && newForm}

    {d.claims.length === 0 ? <p className="orb-muted" role="status">{t("No claims on this project.", "لا توجد مطالبات على هذا المشروع.")}</p>
      : <ul className="claims-list" aria-label={t("Claims", "المطالبات")}>{d.claims.map((c) => {
        const pending = c.proposal?.state === "PENDING_APPROVAL" ? c.proposal : null;
        const returned = c.state === "UNDER_REVIEW" && c.proposal?.state === "REJECTED" ? c.proposal : null;
        return <li key={c.id} className="claims-card" aria-labelledby={`claim-${c.id}`}>
          <header><strong id={`claim-${c.id}`}>{TYPES[c.type][ar ? 1 : 0]} · <a href={`/${c.side === "CUSTOMER" ? "sales" : "supplier"}-shipments/${c.shipmentId}?locale=${locale}`}><bdi>{c.shipmentReference}</bdi></a></strong>{chip(c.state)}</header>
          <span className="orb-muted">{sideLabel(c.side, c.partyName)} · {t("opened by", "فتحها")} {c.openedByName}{c.openedAt ? ` · ${new Date(c.openedAt).toLocaleDateString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium" })}` : ""}</span>
          <p>{c.description}</p>
          <span className="orb-muted">
            {c.quantity && <>{t("Quantity", "الكمية")} <bdi>{Number(c.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })} MT</bdi> · </>}
            {c.amount && <>{t("Claimed", "المطالب به")} <bdi>{c.currency} {fmt(c.amount)}</bdi> · </>}
            {c.document && <a href={`/api/evidence/${c.document.id}/content`} target="_blank" rel="noreferrer">{t("Evidence", "الدليل")}: {c.document.filename}</a>}
          </span>
          {c.state === "RESOLVED" && <strong>{t("Settled", "المبلغ المسوّى")} <bdi>{c.currency} {fmt(c.settledAmount ?? 0)}</bdi></strong>}
          {(c.state === "RESOLVED" || c.state === "REJECTED") && c.proposal && <span className="orb-muted">{c.proposal.reason}</span>}
          {pending && <span className="orb-muted">{t("Waiting for an owner to approve:", "بانتظار اعتماد المالك:")} {pending.outcome === "RESOLVED" ? t(`settle ${c.currency ?? ""} ${fmt(pending.amount ?? 0)}`, `تسوية ${c.currency ?? ""} ${fmt(pending.amount ?? 0)}`) : t("reject / withdraw", "رفض / سحب")} — {pending.reason}</span>}
          {returned && <span className="claims-returned">{t("Returned by the owner:", "أعادها المالك:")} {returned.decisionComment}</span>}
          <div className="claims-buttons">
            {writer && c.state === "OPEN" && <button type="button" disabled={busy} data-operation-id="moveClaimUnderReview" onClick={() => void run(() => sendJson(`/api/claims/${c.id}/transition`, "POST", { toState: "UNDER_REVIEW", reason: "Review started" }), t("Claim is under review.", "المطالبة قيد المراجعة."))}>{t("Start review", "بدء المراجعة")}</button>}
            {writer && c.state === "UNDER_REVIEW" && !pending && open !== `OUTCOME:${c.id}` && <button type="button" onClick={() => setOpen(`OUTCOME:${c.id}`)} data-operation-id="submitClaimOutcomeForApproval">{t("Propose outcome…", "اقتراح النتيجة…")}</button>}
            {owner && pending?.approvalId && (pending.proposedById === me?.id ? <small className="orb-muted">{t("You proposed this, so another owner must approve it.", "أنت من اقترحها، لذلك يجب أن يعتمدها مالك آخر.")}</small> : <>
              <button type="button" className="orb-button-filled" disabled={busy} data-operation-id="decideFixedApproval" onClick={() => void run(() => sendJson(`/api/approvals/${pending.approvalId}/decision`, "POST", { decision: "APPROVED" }), t("Outcome approved.", "تم اعتماد النتيجة."))}>{t("Approve outcome", "اعتماد النتيجة")}</button>
              <button type="button" data-operation-id="decideFixedApproval" onClick={() => setOpen(`REJECT:${c.id}`)}>{t("Return…", "إعادة…")}</button></>)}
          </div>
          {open === `OUTCOME:${c.id}` && outcomeForm(c)}
          {open === `REJECT:${c.id}` && pending?.approvalId && <form className="claims-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run(() => sendJson(`/api/approvals/${pending.approvalId}/decision`, "POST", { decision: "REJECTED", comment: String(new FormData(event.currentTarget).get("reason") ?? "").trim() }), t("Outcome returned.", "أُعيدت النتيجة.")); }}>
            <label>{t("What needs to change?", "ما الذي يجب تغييره؟")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
            <div className="claims-buttons"><button type="submit" disabled={busy} data-operation-id="decideFixedApproval">{t("Return", "إعادة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
          </form>}
        </li>;
      })}</ul>}
  </>);
}

const STYLES = `
  .orb-claims .claims-banner{padding:12px 16px;border-radius:14px;margin-block:12px;background:var(--orb-color-surface-container)}
  .orb-erp.orb-claims .claims-banner[data-tone=error]{background:var(--orb-color-error-container)!important}
  .orb-erp.orb-claims .claims-banner[data-tone=success]{background:#e6f4ea!important;color:#0d3d17}
  .orb-claims .claims-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-block:16px}
  .orb-erp.orb-claims button{padding:8px 14px;font:inherit;font-weight:700}
  .orb-claims .claims-buttons{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .orb-claims .claims-form{display:grid;gap:10px;padding:16px;border:1px solid var(--orb-color-outline-variant);border-radius:16px;margin-block:12px;background:var(--orb-color-surface-bright)}
  .orb-claims .claims-form h3{margin:0;font-size:1rem}
  .orb-claims .claims-form label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-claims .claims-form label.inline{display:flex;gap:6px;align-items:center;font-weight:500}
  .orb-claims .claims-form fieldset{border:0;padding:0;margin:0;display:grid;gap:6px}
  .orb-claims .claims-form .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .orb-claims .claims-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}
  .orb-claims .claims-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;display:grid;gap:6px}
  .orb-claims .claims-card header{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:baseline}
  .orb-claims .claims-card p{margin:0}
  .orb-claims .claims-returned{padding:8px 12px;border-radius:10px;background:var(--orb-color-error-container)}
`;
