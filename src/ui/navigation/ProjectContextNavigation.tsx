"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCurrentSession, sendJson, type ApiProblem } from "../session-client";
import styles from "./ProjectContextNavigation.module.css";
import { GROUPS } from "../features/closure/closure-labels";
import { buildProjectContextLinks, projectContextCopy, projectTabFor, type ProjectContextDestination, type ProjectContextLocale } from "./project-context-links";

/**
 * QuickBooks-style project header shown on every project page: name and customer, status (In progress / Completed /
 * Cancelled) with its change menu, "Add to project", and the five project tabs.
 */
interface Head { reference: string; customerName: string; lifecycleState: string; finalState: string }
interface Blocker { id: string; code: string; label?: string; reference?: string; exceptionReason: string | null }
interface Closure { project: { finalState: string; lifecycleState?: string; reference: string; customerName: string }; assessment: { id: string; current: boolean; blockers: Blocker[] } | null }
type Status = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export function statusOf(head: Pick<Head, "lifecycleState" | "finalState">): Status {
  return head.lifecycleState === "CANCELLED" ? "CANCELLED" : head.finalState === "FINAL_CLOSED" ? "COMPLETED" : "IN_PROGRESS";
}

export function ProjectContextNavigation({ locale, projectId, projectLabel, current, recordId }: Readonly<{ locale: ProjectContextLocale; projectId: string; projectLabel?: string; current: ProjectContextDestination; recordId?: string }>) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const text = projectContextCopy[locale];
  const root = `/projects/${encodeURIComponent(projectId)}`, suffix = `?locale=${locale}`;
  const tabs = buildProjectContextLinks(locale, projectId), active = projectTabFor(current);
  const [head, setHead] = useState<Head | null>(null);
  const [roles, setRoles] = useState<readonly string[]>([]);
  const [dialog, setDialog] = useState<null | "COMPLETE" | "REOPEN" | "CANCEL">(null);
  const [closure, setClosure] = useState<Closure | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetch(`/api/projects/${projectId}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/projects/${projectId}/closure-assessment`, { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]) as [{ reference: string; lifecycleState: string; customer?: { legalName: string; legalNameAr?: string | null } } | null, Closure | null];
    if (!p && !c) return;
    setClosure(c);
    setHead({ reference: p?.reference ?? c?.project.reference ?? "", customerName: (ar && p?.customer?.legalNameAr) || p?.customer?.legalName || c?.project.customerName || "",
      lifecycleState: p?.lifecycleState ?? c?.project.lifecycleState ?? "ACTIVE", finalState: c?.project.finalState ?? "OPEN" });
  }, [ar, projectId]);
  useEffect(() => { void load(); void fetchCurrentSession().then((s) => s && setRoles(s.roles)); }, [load]);

  const status = head ? statusOf(head) : null;
  const owner = roles.includes("OWNER_ADMIN"), ops = owner || roles.includes("OPERATIONS"), finance = owner || roles.includes("FINANCE_VIEWER");
  const STATUS: Record<Status, [string, string, string]> = { IN_PROGRESS: ["In progress", "قيد التنفيذ", "info"], COMPLETED: ["Completed", "مكتمل", "success"], CANCELLED: ["Cancelled", "ملغى", "error"] };

  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await work(); setDialog(null); window.location.reload(); }
    catch (e) { setError((e as ApiProblem)?.detail ?? t("That could not be saved. Try again.", "تعذر الحفظ. حاول مرة أخرى.")); }
    finally { setBusy(false); }
  }
  async function openComplete() {
    setDialog("COMPLETE"); setError(null); setBusy(true);
    try { setClosure(await sendJson<Closure>(`/api/projects/${projectId}/closure-assessment`, "POST", {})); }
    catch (e) { setError((e as ApiProblem)?.detail ?? t("The project could not be checked.", "تعذر فحص المشروع.")); }
    finally { setBusy(false); }
  }
  const openItems = closure?.assessment?.blockers ?? [];
  async function complete(reason: string) {
    const assessment = closure?.assessment;
    if (!assessment) return;
    const missing = assessment.blockers.filter((b) => !b.exceptionReason).map((b) => b.id);
    if (missing.length) await sendJson(`/api/projects/${projectId}/closure-exceptions`, "POST", { assessmentId: assessment.id, blockerIds: missing, reason });
    await sendJson(`/api/projects/${projectId}/final-close/submit`, "POST", { assessmentId: assessment.id });
  }

  const add = (href: string) => `${root}/${href}${href.includes("?") ? "&" : "?"}locale=${locale}`;
  const addGroups: [string, [string, string, boolean][]][] = [
    [t("Customer", "العميل"), [[t("Invoice", "فاتورة"), "shipments?flow=sales", finance], [t("Receive payment", "استلام دفعة"), "money?new=RECEIPT", finance], [t("Refund to customer", "رد مبلغ للعميل"), "money?new=REFUND", finance], [t("Customer shipment", "شحنة للعميل"), "shipments?flow=sales", ops]]],
    [t("Supplier", "المورد"), [[t("Bill", "فاتورة مورد"), "shipments?flow=supplier", finance], [t("Pay bill", "دفع فاتورة"), "money?new=PAYMENT", finance], [t("Supplier shipment", "شحنة من المورد"), "shipments?flow=supplier", ops], [t("Purchase contract", "عقد شراء"), "contracts", ops]]],
    [t("Other", "أخرى"), [[t("Expense", "مصروف"), "expenses?new=1", ops || finance], [t("Claim", "مطالبة"), "claims?new=1", ops]]],
  ];

  return <div className={styles.context} dir={ar ? "rtl" : "ltr"} data-project-context-navigation>
    <style>{HEADER_STYLES}</style>
    <nav aria-label={text.breadcrumb}><ol className={styles.breadcrumb}>
      <li><a href={`/projects${suffix}`}>{t("Projects", "المشاريع")}</a></li>
      <li className={recordId ? undefined : styles.current} aria-current={recordId ? undefined : "page"}><a href={`${root}/overview${suffix}`}><bdi>{head?.reference || projectLabel || projectId}</bdi></a></li>
      {recordId ? <li className={styles.current} aria-current="page"><bdi>{recordId}</bdi></li> : null}
    </ol></nav>
    <div className="pj-head">
      <div>
        <p className="pj-customer">{head?.customerName ?? ""}</p>
        <p className="pj-title"><bdi>{head?.reference || projectLabel || ""}</bdi>
          {status && <span className="orb-chip" data-tone={STATUS[status][2]} data-testid="project-status">{STATUS[status][ar ? 1 : 0]}</span>}</p>
      </div>
      <div className="pj-actions">
        {status && (owner || ops) && status !== "CANCELLED" && <details className="pj-menu" data-testid="project-status-menu">
          <summary>{t("Status", "الحالة")}</summary>
          <div className="pj-pop" role="menu">
            {status === "IN_PROGRESS" && <button type="button" role="menuitem" onClick={() => void openComplete()} data-operation-id="submitFinalCloseForApproval">{t("Mark as completed", "تعيين كمكتمل")}</button>}
            {status === "COMPLETED" && <button type="button" role="menuitem" onClick={() => setDialog("REOPEN")} data-operation-id="submitReopenForApproval">{t("Back to in progress", "إرجاع إلى قيد التنفيذ")}</button>}
            {status === "IN_PROGRESS" && owner && <button type="button" role="menuitem" onClick={() => setDialog("CANCEL")} data-operation-id="cancelUnexecutedProject">{t("Cancel project", "إلغاء المشروع")}</button>}
          </div>
        </details>}
        {status === "IN_PROGRESS" && (ops || finance) && <details className="pj-menu pj-add" data-testid="add-to-project">
          <summary>{t("Add to project", "إضافة للمشروع")}</summary>
          <div className="pj-pop pj-grid" role="menu">{addGroups.map(([group, items]) => <div key={group}><p>{group}</p>
            {items.filter((i) => i[2]).map(([label, href]) => <a key={label} role="menuitem" href={add(href)}>{label}</a>)}</div>)}</div>
        </details>}
      </div>
    </div>
    {dialog && <section className="pj-dialog" role="dialog" aria-labelledby="pj-dialog-title">
      <form onSubmit={(event) => {
        event.preventDefault();
        const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
        if (dialog === "COMPLETE") void act(() => complete(reason));
        if (dialog === "REOPEN") void act(() => sendJson(`/api/projects/${projectId}/reopen/submit`, "POST", { reason }));
        if (dialog === "CANCEL") void act(() => sendJson(`/api/projects/${projectId}/cancel`, "POST", { reason }));
      }}>
        <h2 id="pj-dialog-title">{dialog === "COMPLETE" ? t("Mark project as completed", "تعيين المشروع كمكتمل") : dialog === "REOPEN" ? t("Back to in progress", "إرجاع إلى قيد التنفيذ") : t("Cancel project", "إلغاء المشروع")}</h2>
        {dialog === "COMPLETE" && (busy && !closure?.assessment ? <p role="status">{t("Checking the project…", "جارٍ فحص المشروع…")}</p>
          : openItems.length === 0 ? <p>{t("Everything is settled. The project will be locked as completed.", "كل شيء مسوّى. سيُقفل المشروع كمكتمل.")}</p>
          : <><p>{t(`${openItems.length} item(s) are still open. Write why the project is completed anyway:`, `${openItems.length} بند ما زال مفتوحاً. اكتب سبب إكمال المشروع رغم ذلك:`)}</p>
            <ul className="pj-open">{openItems.map((b) => <li key={b.id}>{(GROUPS[b.code] ?? [b.code, b.code])[ar ? 1 : 0]}{b.reference ? <> · <bdi>{b.reference}</bdi></> : null}</li>)}</ul></>)}
        {(dialog !== "COMPLETE" || openItems.length > 0) && <label>{t("Reason", "السبب")}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>}
        {dialog === "COMPLETE" && <p className="orb-muted">{t("A completed project is read-only until it is put back in progress.", "المشروع المكتمل للقراءة فقط حتى يُعاد إلى قيد التنفيذ.")}</p>}
        {error && <p role="alert">{error}</p>}
        <div className="pj-buttons"><button type="submit" className="orb-button-filled" disabled={busy || (dialog === "COMPLETE" && !closure?.assessment)}>{dialog === "COMPLETE" ? t("Mark completed", "تعيين كمكتمل") : dialog === "REOPEN" ? t("Put back in progress", "إرجاع إلى قيد التنفيذ") : t("Cancel project", "إلغاء المشروع")}</button>
          <button type="button" onClick={() => { setDialog(null); setError(null); }}>{t("Back", "رجوع")}</button></div>
      </form>
    </section>}
    <nav aria-label={text.related}><ul className={styles.related}>{tabs.map(({ key, label, href }) =>
      <li key={key}><a href={href} aria-current={active === key ? "page" : undefined}>{label}</a></li>
    )}</ul></nav>
  </div>;
}

const HEADER_STYLES = `
.pj-head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between}
.pj-customer{margin:0;color:var(--orb-color-on-surface-variant);font-size:.9rem}
.pj-title{margin:2px 0 0;font-size:1.5rem;font-weight:700;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pj-actions{display:flex;gap:8px;align-items:center}
.pj-menu{position:relative}
.pj-menu>summary{list-style:none;cursor:pointer;min-height:40px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;border:1px solid var(--orb-color-outline);font-weight:600}
.pj-menu>summary::-webkit-details-marker{display:none}
.pj-add>summary{background:var(--orb-color-primary);color:var(--orb-color-on-primary);border-color:transparent}
.pj-pop{position:absolute;inset-inline-end:0;top:calc(100% + 6px);z-index:30;background:var(--orb-color-surface);border:1px solid var(--orb-color-outline-variant);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.14);padding:8px;display:grid;gap:2px;min-width:220px}
.pj-pop button,.pj-pop a{display:block;text-align:start;background:none;border:0;padding:9px 12px;border-radius:8px;color:inherit;text-decoration:none;font:inherit;cursor:pointer}
.pj-pop button:hover,.pj-pop a:hover{background:var(--orb-color-secondary-container)}
.pj-grid{grid-template-columns:repeat(3,minmax(150px,1fr));min-width:520px}
.pj-grid p{margin:4px 12px;font-size:.75rem;font-weight:700;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}
.pj-dialog{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;background:var(--orb-color-surface)}
.pj-dialog form{display:grid;gap:10px}.pj-dialog h2{margin:0;font-size:1.1rem}
.pj-dialog label{display:grid;gap:4px}.pj-open{margin:0;padding-inline-start:20px}
.pj-buttons{display:flex;gap:8px}
@media (max-width:700px){.pj-grid{grid-template-columns:1fr;min-width:240px}.pj-pop{inset-inline-end:auto;inset-inline-start:0}}
`;
