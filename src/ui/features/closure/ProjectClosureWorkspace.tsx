"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { fetchCurrentSession, problemOf, sendJson, type ApiProblem } from "../../session-client";

/**
 * Closing a saved project: run the check on the live records, accept any open item with a written reason, then ask
 * another owner to approve closing. A closed project is read-only; reopening needs a reason and another owner.
 */
interface Blocker { id: string; code: string; subjectType: string; reference: string; detail: string; href: string; exceptionReason: string | null; exceptionByName: string | null }
interface Closure {
  project: { id: string; reference: string; customerName: string; finalState: "OPEN" | "FINAL_CLOSED"; lifecycleState: string; closedAt: string | null; closedByName: string | null; reopenedAt: string | null; reopenReason: string | null };
  assessment: { id: string; assessedAt: string; assessedByName: string | null; blockers: Blocker[]; current: boolean } | null;
  pending: { approvalId: string; action: "FINAL_CLOSE" | "REOPEN"; requesterId: string; requesterName: string; reason: string | null } | null;
  lastDecision: { action: string; decision: string; comment: string | null; decidedAt: string | null } | null;
}
type Open = null | "ACCEPT" | "REOPEN" | "REJECT";

const GROUPS: Record<string, [string, string]> = {
  SALES_SHIPMENT_NOT_DELIVERED: ["Customer shipment not delivered", "شحنة العميل لم تُسلَّم"], SUPPLIER_SHIPMENT_NOT_RECEIVED: ["Supplier shipment not received", "شحنة المورد لم تُستلم"],
  SALES_SHIPMENT_NOT_INVOICED: ["Customer shipment not invoiced", "شحنة عميل بدون فاتورة"], SUPPLIER_SHIPMENT_NOT_INVOICED: ["Supplier shipment not invoiced", "شحنة مورد بدون فاتورة"],
  SALES_INVOICE_NOT_ISSUED: ["Sales invoice not issued", "فاتورة مبيعات غير صادرة"], SUPPLIER_INVOICE_NOT_APPROVED: ["Supplier invoice not approved", "فاتورة مورد غير معتمدة"],
  SALES_INVOICE_UNPAID: ["Customer has not paid in full", "العميل لم يسدد بالكامل"], SUPPLIER_INVOICE_UNPAID: ["Supplier not paid in full", "المورد لم يُسدَّد بالكامل"],
  APPROVAL_PENDING: ["Waiting for approval", "بانتظار الاعتماد"], CLAIM_OPEN: ["Claim still open", "مطالبة ما زالت مفتوحة"],
};

export function ProjectClosureWorkspace({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [data, setData] = useState<Closure | null>(null);
  const [loadError, setLoadError] = useState<ApiProblem | null>(null);
  const [me, setMe] = useState<{ id: string; roles: readonly string[] } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/closure-assessment`, { cache: "no-store" });
    if (!response.ok) { setLoadError(await problemOf(response)); return; }
    setLoadError(null);
    setData(await response.json() as Closure);
  }, [projectId]);
  useEffect(() => { void load(); void fetchCurrentSession().then((session) => session && setMe({ id: session.userId, roles: session.roles })); }, [load]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); setOpen(null); setChosen([]); await load(); setNotice({ tone: "success", text: success }); }
    catch (error) { setNotice({ tone: "error", text: (error as ApiProblem).detail ?? t("The action could not be completed.", "تعذر تنفيذ العملية.") }); }
    finally { setBusy(false); }
  }

  const shell = (body: React.ReactNode) => <section className="orb-erp orb-closure" dir={ar ? "rtl" : "ltr"} aria-labelledby="closure-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} projectLabel={data?.project.reference} current="closure"/>
    {body}
  </section>;

  if (loadError) return shell(<>
    <ErpPageHeader titleId="closure-title" eyebrow={t("Project", "المشروع")} title={loadError.status === 404 ? t("Project not found", "المشروع غير موجود") : t("Closure unavailable", "الإغلاق غير متاح")}
      description={loadError.status === 403 ? t("Your role cannot see this project.", "دورك لا يسمح برؤية هذا المشروع.") : t("Try again in a moment.", "حاول مرة أخرى بعد قليل.")}/>
    <p><button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
  </>);
  if (!data) return shell(<><h1 id="closure-title" className="orb-sr-only">{t("Closure", "الإغلاق")}</h1><p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p></>);

  const d = data;
  const roles = me?.roles ?? [];
  const owner = roles.includes("OWNER_ADMIN");
  const canAssess = roles.some((role) => role === "OWNER_ADMIN" || role === "OPERATIONS");
  const canRequest = roles.length > 0;
  const closed = d.project.finalState === "FINAL_CLOSED";
  const a = d.assessment;
  const blockers = a?.blockers ?? [];
  const missing = blockers.filter((b) => !b.exceptionReason);
  const ownRequest = d.pending?.requesterId === me?.id;
  const when = (value: string | null) => value ? new Date(value).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";

  const decide = d.pending && owner && (ownRequest
    ? <p className="orb-muted">{t("You asked for this, so another owner must decide it.", "أنت من طلب ذلك، لذلك يجب أن يقرر مالك آخر.")}</p>
    : open === "REJECT" ? <form className="closure-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run(() => sendJson(`/api/approvals/${d.pending!.approvalId}/decision`, "POST", { decision: "REJECTED", comment: String(new FormData(event.currentTarget).get("reason") ?? "").trim() }), t("Request returned.", "أُعيد الطلب.")); }}>
        <label>{t("Why not?", "لماذا لا؟")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
        <div className="closure-buttons"><button type="submit" disabled={busy} data-operation-id="decideFixedApproval">{t("Return", "إعادة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
      </form>
    : <div className="closure-buttons">
        <button type="button" className="orb-button-filled" disabled={busy} data-operation-id="decideFixedApproval" onClick={() => void run(() => sendJson(`/api/approvals/${d.pending!.approvalId}/decision`, "POST", { decision: "APPROVED" }), d.pending!.action === "FINAL_CLOSE" ? t("Project closed.", "تم إغلاق المشروع.") : t("Project reopened.", "تمت إعادة فتح المشروع."))}>
          {d.pending.action === "FINAL_CLOSE" ? t("Approve closing", "اعتماد الإغلاق") : t("Approve reopening", "اعتماد إعادة الفتح")}</button>
        <button type="button" data-operation-id="decideFixedApproval" onClick={() => setOpen("REJECT")}>{t("Return…", "إعادة…")}</button>
      </div>);

  return shell(<>
    <ErpPageHeader titleId="closure-title" eyebrow={<><bdi>{d.project.reference}</bdi><span>•</span>{d.project.customerName}</>} title={t("Close project", "إغلاق المشروع")}
      description={t("Closing checks shipments, invoices, payments and claims. Anything still open needs a written reason.", "الإغلاق يفحص الشحنات والفواتير والمدفوعات والمطالبات. أي بند مفتوح يحتاج سبباً مكتوباً.")}
      meta={<span className="orb-chip" data-tone={closed ? "success" : "warning"}>{closed ? t("Closed", "مغلق") : t("Open", "مفتوح")}</span>}/>
    {notice && <p className="closure-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    {d.lastDecision?.decision === "REJECTED" && !d.pending && <p className="closure-banner" data-tone="error" role="status">{d.lastDecision.action === "FINAL_CLOSE" ? t("Closing was returned:", "أُعيد طلب الإغلاق:") : t("Reopening was returned:", "أُعيد طلب إعادة الفتح:")} {d.lastDecision.comment}</p>}

    {closed ? <>
      <div className="orb-summary-grid">
        <Kpi label={t("Closed on", "تاريخ الإغلاق")} value={<bdi>{when(d.project.closedAt)}</bdi>} detail={d.project.closedByName ? t(`Approved by ${d.project.closedByName}`, `اعتمده ${d.project.closedByName}`) : undefined}/>
        <Kpi label={t("Accepted open items", "بنود مقبولة مفتوحة")} value={String(blockers.length)}/>
      </div>
      <p className="closure-banner" role="status">{t("This project is read-only. Shipments, invoices, money, expenses and claims can't change until it is reopened.", "هذا المشروع للقراءة فقط. لا يمكن تغيير الشحنات أو الفواتير أو الأموال أو المصروفات أو المطالبات حتى تتم إعادة فتحه.")}</p>
      {d.pending?.action === "REOPEN" ? <div className="closure-card"><strong>{t("Reopening is waiting for an owner", "إعادة الفتح بانتظار المالك")}</strong><span className="orb-muted">{d.pending.requesterName} — {d.pending.reason}</span>{decide}</div>
        : canRequest && (open === "REOPEN" ? <form className="closure-form" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void run(() => sendJson(`/api/projects/${projectId}/reopen/submit`, "POST", { reason: String(new FormData(event.currentTarget).get("reason") ?? "").trim() }), t("Project reopened.", "أُعيد فتح المشروع.")); }}>
            <label>{t("Why reopen?", "لماذا إعادة الفتح؟")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
            <div className="closure-buttons"><button type="submit" className="orb-button-filled" disabled={busy} data-operation-id="submitReopenForApproval">{t("Reopen", "إعادة الفتح")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
          </form> : <div className="closure-actions"><button type="button" onClick={() => setOpen("REOPEN")} data-operation-id="submitReopenForApproval">{t("Reopen…", "إعادة الفتح…")}</button></div>)}
    </> : <>
      {d.project.reopenedAt && <p className="orb-muted">{t(`Reopened ${when(d.project.reopenedAt)}: ${d.project.reopenReason ?? ""}`, `أُعيد فتحه ${when(d.project.reopenedAt)}: ${d.project.reopenReason ?? ""}`)}</p>}
      <div className="orb-summary-grid">
        <Kpi label={t("Last check", "آخر فحص")} value={a ? <bdi>{when(a.assessedAt)}</bdi> : t("Not run yet", "لم يُجرَ بعد")} detail={a?.assessedByName ?? undefined}/>
        <Kpi label={t("Open items", "بنود مفتوحة")} value={a ? String(blockers.length) : "—"} detail={a ? t(`${missing.length} without a reason`, `${missing.length} بدون سبب`) : undefined}/>
      </div>
      {a && !a.current && <p className="closure-banner" data-tone="error" role="status">{t("The project changed since this check. Run it again before closing.", "تغيّر المشروع منذ هذا الفحص. أعد تشغيله قبل الإغلاق.")}</p>}
      {d.pending?.action === "FINAL_CLOSE" && <div className="closure-card"><strong>{t("Closing is waiting for an owner", "الإغلاق بانتظار المالك")}</strong><span className="orb-muted">{d.pending.requesterName} — {d.pending.reason}</span>{decide}</div>}
      {!d.pending && <div className="closure-actions">
        {canAssess && <button type="button" className={a && a.current ? undefined : "orb-button-filled"} disabled={busy} data-operation-id="assessProjectClosure" onClick={() => void run(() => sendJson(`/api/projects/${projectId}/closure-assessment`, "POST", {}), t("Closure check done.", "تم فحص الإغلاق."))}>{a ? t("Run the check again", "إعادة الفحص") : t("Run closure check", "فحص الإغلاق")}</button>}
        {a && a.current && missing.length === 0 && canRequest && <button type="button" className="orb-button-filled" disabled={busy} data-operation-id="submitFinalCloseForApproval" onClick={() => void run(() => sendJson(`/api/projects/${projectId}/final-close/submit`, "POST", { assessmentId: a.id }), t("Project closed.", "أُغلق المشروع."))}>{t("Close project", "إغلاق المشروع")}</button>}
      </div>}

      {a && (blockers.length === 0 ? <p className="closure-banner" data-tone="success" role="status">{t("Everything is delivered, invoiced and paid, with nothing waiting. Ready to close.", "كل شيء مُسلَّم ومفوتر ومدفوع ولا شيء معلق. جاهز للإغلاق.")}</p>
        : <form className="closure-list" aria-label={t("Open items", "البنود المفتوحة")} onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void run(() => sendJson(`/api/projects/${projectId}/closure-exceptions`, "POST", { assessmentId: a.id, blockerIds: chosen, reason: String(new FormData(event.currentTarget).get("reason") ?? "").trim() }), t("Reason saved.", "تم حفظ السبب."));
        }}>
          <ul>{blockers.map((b) => <li key={b.id} className="closure-item" data-accepted={b.exceptionReason ? "true" : "false"}>
            {!d.pending && a.current && canRequest && !b.exceptionReason && <input type="checkbox" aria-label={t(`Accept ${b.reference}`, `قبول ${b.reference}`)} checked={chosen.includes(b.id)} onChange={(event) => setChosen(event.currentTarget.checked ? [...chosen, b.id] : chosen.filter((x) => x !== b.id))}/>}
            <div>
              <strong>{(GROUPS[b.code] ?? [b.code, b.code])[ar ? 1 : 0]} · <a href={`${b.href}?locale=${locale}`}><bdi>{b.reference}</bdi></a></strong>
              <span className="orb-muted">{b.detail}</span>
              {b.exceptionReason && <span className="closure-accepted">{t("Accepted:", "مقبول:")} {b.exceptionReason}{b.exceptionByName ? ` — ${b.exceptionByName}` : ""}</span>}
            </div>
          </li>)}</ul>
          {!d.pending && a.current && canRequest && missing.length > 0 && <div className="closure-form">
            <div className="closure-buttons"><button type="button" onClick={() => setChosen(missing.map((b) => b.id))}>{t("Select all without a reason", "تحديد كل البنود بدون سبب")}</button></div>
            <label>{t(`Reason for the ${chosen.length} selected item(s)`, `السبب لعدد ${chosen.length} بند محدد`)}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
            <div className="closure-buttons"><button type="submit" disabled={busy || chosen.length === 0} data-operation-id="requestClosureException">{t("Accept with this reason", "قبول بهذا السبب")}</button></div>
          </div>}
        </form>)}
    </>}
  </>);
}

const STYLES = `
  .orb-closure .closure-banner{padding:12px 16px;border-radius:14px;margin-block:12px;background:var(--orb-color-surface-container)}
  .orb-erp.orb-closure .closure-banner[data-tone=error]{background:var(--orb-color-error-container)!important}
  .orb-erp.orb-closure .closure-banner[data-tone=success]{background:#e6f4ea!important;color:#0d3d17}
  .orb-closure .closure-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-block:16px}
  .orb-erp.orb-closure button{padding:8px 14px;font:inherit;font-weight:700}
  .orb-closure .closure-buttons{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .orb-closure .closure-form{display:grid;gap:10px;padding:16px;border:1px solid var(--orb-color-outline-variant);border-radius:16px;margin-block:12px;background:var(--orb-color-surface-bright)}
  .orb-closure .closure-form label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-closure .closure-card{display:grid;gap:8px;padding:16px;border:1px solid var(--orb-color-outline-variant);border-radius:16px;margin-block:12px}
  .orb-erp.orb-closure form.closure-list{display:block}
  .orb-closure .closure-list ul{list-style:none;padding:0;margin:0;display:grid;gap:8px}
  .orb-closure .closure-item{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--orb-color-outline-variant);border-radius:14px;padding:12px}
  .orb-closure .closure-item>div{display:grid;gap:4px}
  .orb-closure .closure-item[data-accepted=true]{background:var(--orb-color-surface-container)}
  .orb-closure .closure-accepted{font-size:.88rem}
`;
