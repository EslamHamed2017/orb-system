"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { fetchCurrentSession, problemOf, sendForm, sendJson, type ApiProblem } from "../../session-client";

/**
 * A saved project's money: receipts from the customer, payments to suppliers (owner approves), matching them to
 * invoices, reversals, and project expenses with their bills (owner approves). `focus="expenses"` shows expenses only.
 */
type Kind = "CUSTOMER_RECEIPT" | "SUPPLIER_PAYMENT" | "CUSTOMER_REFUND" | "SUPPLIER_REFUND";
interface Doc { id: string; filename: string }
interface Decision { decision: string; comment: string | null; approverName: string | null }
interface Allocation { id: string; targetType: "CINV" | "SUPPLIER_INVOICE"; targetId: string; invoiceReference: string; amount: string; state: "ACTIVE" | "REVERSED"; allocatedAt: string; allocatedByName: string; reversalReason: string | null }
interface Movement {
  id: string; kind: Kind; direction: "IN" | "OUT"; counterparty: { type: "CUSTOMER" | "SUPPLIER"; id: string; name: string };
  amount: string; currency: string; fxRate: string; aedAmount: string; occurredOn: string; reference: string; notes: string | null; state: string;
  allocated: string; unallocated: string; allocations: Allocation[]; document: Doc | null; recordedByName: string;
  pendingApprovalId: string | null; requesterId: string | null; lastDecision: Decision | null; reversalReason: string | null;
}
interface Expense {
  id: string; category: { code: string; name: string; nameAr: string }; payee: { supplierId: string | null; name: string }; description: string | null;
  shipment: { type: "SUPPLIER" | "SALES"; id: string; reference: string } | null; amount: string; currency: string; fxRate: string; aedAmount: string; occurredOn: string;
  state: string; document: Doc | null; recordedByName: string; pendingApprovalId: string | null; requesterId: string | null; lastDecision: Decision | null; cancellationReason: string | null;
}
interface OpenInvoice { type: "CINV" | "SUPPLIER_INVOICE"; id: string; reference: string; counterpartyId: string; counterpartyName: string; invoiceDate: string; currency: string; amount: string; allocated: string; outstanding: string }
interface Totals {
  currency: string; receivedFromCustomer: string; refundedToCustomer: string; paidToSuppliers: string; refundedBySuppliers: string; customerInvoiced: string; customerOutstanding: string;
  customerAdvance: string; supplierInvoiced: string; supplierOutstanding: string; supplierAdvance: string; expensesApproved: string; expensesPending: string; paymentsPendingApproval: string;
}
interface ProjectMoney {
  project: { id: string; reference: string; lifecycleState: string; currency: string }; customer: { id: string; name: string }; suppliers: { id: string; name: string }[];
  categories: { code: string; name: string; nameAr: string }[]; shipments: { type: "SUPPLIER" | "SALES"; id: string; reference: string }[];
  movements: Movement[]; expenses: Expense[]; invoices: OpenInvoice[]; totals: Totals[]; canManageMoney: boolean;
}
type Open = null | "RECEIPT" | "PAYMENT" | "REFUND" | "EXPENSE" | `ALLOCATE:${string}` | `REVERSE:${string}` | `UNDO:${string}` | `REJECT:${string}` | `CANCEL:${string}`;

const KINDS: Record<Kind, [string, string]> = {
  CUSTOMER_RECEIPT: ["Receipt from customer", "تحصيل من العميل"], SUPPLIER_PAYMENT: ["Payment to supplier", "دفعة للمورد"],
  CUSTOMER_REFUND: ["Refund to customer", "رد مبلغ للعميل"], SUPPLIER_REFUND: ["Refund from supplier", "استرداد من المورد"],
};
const STATES: Record<string, [string, string, string]> = {
  PENDING_APPROVAL: ["Waiting for approval", "بانتظار الاعتماد", "warning"], CONFIRMED: ["Not matched", "غير مطابق", "warning"],
  PARTIALLY_ALLOCATED: ["Partly matched", "مطابق جزئياً", "warning"], FULLY_ALLOCATED: ["Matched", "مطابق", "success"],
  REVERSED: ["Reversed", "معكوس", "error"], REJECTED: ["Rejected", "مرفوض", "error"], APPROVED: ["Approved", "معتمد", "success"], CANCELLED: ["Cancelled", "ملغى", "error"],
};
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export function ProjectMoneyWorkspace({ projectId, locale, focus = "money" }: { readonly projectId: string; readonly locale: "en" | "ar"; readonly focus?: "money" | "expenses" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [data, setData] = useState<ProjectMoney | null>(null);
  const [loadError, setLoadError] = useState<ApiProblem | null>(null);
  const [me, setMe] = useState<{ id: string; roles: readonly string[] } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/money-movements`, { cache: "no-store" });
    if (!response.ok) { setLoadError(await problemOf(response)); return; }
    setLoadError(null);
    setData(await response.json() as ProjectMoney);
  }, [projectId]);
  useEffect(() => { void load(); void fetchCurrentSession().then((session) => session && setMe({ id: session.userId, roles: session.roles })); }, [load]);

  const owner = Boolean(me?.roles.includes("OWNER_ADMIN"));
  const finance = Boolean(data?.canManageMoney);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); setOpen(null); await load(); setNotice({ tone: "success", text: success }); }
    catch (error) { setNotice({ tone: "error", text: (error as ApiProblem).detail ?? t("The action could not be completed.", "تعذر تنفيذ العملية.") }); }
    finally { setBusy(false); }
  }

  const title = focus === "expenses" ? t("Expenses", "المصروفات") : t("Money", "الأموال");
  const shell = (body: React.ReactNode) => <section className="orb-erp orb-money" dir={ar ? "rtl" : "ltr"} aria-labelledby="money-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} projectLabel={data?.project.reference} current={focus === "expenses" ? "expenses" : "accounts"}/>
    {body}
  </section>;

  if (loadError) return shell(<>
    <ErpPageHeader titleId="money-title" eyebrow={t("Project", "المشروع")} title={loadError.status === 404 ? t("Project not found", "المشروع غير موجود") : t("Money unavailable", "الأموال غير متاحة")}
      description={loadError.status === 403 ? t("Your role cannot see this project's money.", "دورك لا يسمح برؤية أموال هذا المشروع.") : t("Try again in a moment.", "حاول مرة أخرى بعد قليل.")}/>
    <p><button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
  </>);
  if (!data) return shell(<><h1 id="money-title" className="orb-sr-only">{title}</h1><p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p></>);

  const d = data;
  const main = d.totals.find((row) => row.currency === d.project.currency) ?? d.totals[0];
  const reasonForm = (label: string, submit: string, onReason: (reason: string) => void) => <form className="money-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); onReason(String(new FormData(event.currentTarget).get("reason") ?? "").trim());
  }}>
    <label>{label}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
    <div className="money-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{submit}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
  </form>;
  const decisionButtons = (item: { pendingApprovalId: string | null; requesterId: string | null; id: string }, approvedText: string) => owner && item.pendingApprovalId && (item.requesterId === me?.id
    ? <small className="orb-muted">{t("Another owner must approve.", "يجب أن يعتمدها مالك آخر.")}</small>
    : <><button type="button" data-operation-id="decideFixedApproval" disabled={busy} onClick={() => void run(() => sendJson(`/api/approvals/${item.pendingApprovalId}/decision`, "POST", { decision: "APPROVED" }), approvedText)}>{t("Approve", "اعتماد")}</button>
      <button type="button" data-operation-id="decideFixedApproval" onClick={() => setOpen(`REJECT:${item.id}`)}>{t("Reject", "رفض")}</button></>);
  const chip = (state: string) => { const s = STATES[state] ?? [state, state, "warning"]; return <span className="orb-chip" data-tone={s[2]}>{s[ar ? 1 : 0]}</span>; };

  return shell(<>
    <ErpPageHeader titleId="money-title" eyebrow={<><bdi>{d.project.reference}</bdi><span>•</span>{d.customer.name}</>} title={title}
      description={focus === "expenses"
        ? t("Costs paid for this project. Each expense needs its bill and an owner's approval before it counts.", "تكاليف دُفعت لهذا المشروع. كل مصروف يحتاج فاتورته واعتماد المالك قبل احتسابه.")
        : t("Money received and paid for this project, matched to invoices. Supplier payments need an owner's approval.", "المبالغ المحصلة والمدفوعة لهذا المشروع ومطابقتها مع الفواتير. دفعات الموردين تحتاج اعتماد المالك.")}/>
    {notice && <p className="money-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

    {focus === "money" && finance && main && <div className="orb-summary-grid" data-testid="money-totals">
      <Kpi label={t("Received from customer", "المحصّل من العميل")} value={<bdi>{main.currency} {fmt(main.receivedFromCustomer)}</bdi>} detail={Number(main.customerAdvance) > 0 ? t(`Advance not yet matched: ${fmt(main.customerAdvance)}`, `دفعة مقدمة غير مطابقة: ${fmt(main.customerAdvance)}`) : t(`Invoiced ${fmt(main.customerInvoiced)}`, `المفوتر ${fmt(main.customerInvoiced)}`)}/>
      <Kpi label={t("Customer still owes", "المتبقي على العميل")} value={<bdi>{main.currency} {fmt(main.customerOutstanding)}</bdi>} detail={t("On issued invoices", "على الفواتير الصادرة")}/>
      <Kpi label={t("Paid to suppliers", "المدفوع للموردين")} value={<bdi>{main.currency} {fmt(main.paidToSuppliers)}</bdi>} detail={Number(main.paymentsPendingApproval) > 0 ? t(`${fmt(main.paymentsPendingApproval)} waiting for approval`, `${fmt(main.paymentsPendingApproval)} بانتظار الاعتماد`) : Number(main.supplierAdvance) > 0 ? t(`Advance not yet matched: ${fmt(main.supplierAdvance)}`, `دفعة مقدمة غير مطابقة: ${fmt(main.supplierAdvance)}`) : undefined}/>
      <Kpi label={t("Still owed to suppliers", "المتبقي للموردين")} value={<bdi>{main.currency} {fmt(main.supplierOutstanding)}</bdi>} detail={t(`Approved expenses ${fmt(main.expensesApproved)}`, `مصروفات معتمدة ${fmt(main.expensesApproved)}`)}/>
    </div>}
    {focus === "money" && d.totals.length > 1 && <p className="orb-muted">{t("Other currencies:", "عملات أخرى:")} {d.totals.filter((row) => row !== main).map((row) => `${row.currency} — ${t("received", "محصّل")} ${fmt(row.receivedFromCustomer)}, ${t("paid", "مدفوع")} ${fmt(row.paidToSuppliers)}`).join(" · ")}</p>}

    <div className="money-actions" role="group" aria-label={t("Money actions", "إجراءات الأموال")}>
      {focus === "money" && finance && <>
        <button type="button" data-primary data-operation-id="recordMoneyMovement" onClick={() => setOpen("RECEIPT")}>{t("Record customer receipt", "تسجيل تحصيل من العميل")}</button>
        <button type="button" data-operation-id="recordMoneyMovement" onClick={() => setOpen("PAYMENT")} disabled={!d.suppliers.length}>{t("Record supplier payment", "تسجيل دفعة للمورد")}</button>
        <button type="button" data-operation-id="recordMoneyMovement" onClick={() => setOpen("REFUND")}>{t("Record refund", "تسجيل استرداد")}</button>
      </>}
      <button type="button" data-primary={focus === "expenses" ? true : undefined} data-operation-id="createDirectExpense" onClick={() => setOpen("EXPENSE")}>{t("Record expense", "تسجيل مصروف")}</button>
      {focus === "money" && <a href={`/projects/${projectId}/expenses?locale=${locale}`}>{t("All expenses", "كل المصروفات")}</a>}
      {focus === "expenses" && finance && <a href={`/projects/${projectId}/money?locale=${locale}`}>{t("Receipts and payments", "التحصيلات والمدفوعات")}</a>}
    </div>

    {(open === "RECEIPT" || open === "PAYMENT" || open === "REFUND") && <MovementForm key={open} mode={open} data={d} busy={busy} t={t} onCancel={() => setOpen(null)}
      onSubmit={(form, needsApproval) => void run(() => sendForm(`/api/projects/${projectId}/money-movements`, form), needsApproval ? t("Saved and sent to the owner for approval.", "تم الحفظ والإرسال للمالك للاعتماد.") : t("Saved. Match it to an invoice when ready.", "تم الحفظ. طابقه مع فاتورة عند الجاهزية."))}/>}
    {open === "EXPENSE" && <ExpenseForm data={d} busy={busy} t={t} ar={ar} onCancel={() => setOpen(null)}
      onSubmit={(form) => void run(() => sendForm(`/api/projects/${projectId}/expenses`, form), t("Expense saved and sent to the owner for approval.", "تم حفظ المصروف وإرساله للمالك للاعتماد."))}/>}

    {focus === "money" && finance && <section className="money-card" aria-labelledby="movements-title" data-testid="money-movements">
      <h2 id="movements-title">{t("Receipts and payments", "التحصيلات والمدفوعات")}</h2>
      {d.movements.length === 0 ? <p className="orb-muted">{t("Nothing recorded yet.", "لم يُسجّل شيء بعد.")}</p> : <div className="money-scroll"><table>
        <thead><tr><th>{t("Date", "التاريخ")}</th><th>{t("Type", "النوع")}</th><th>{t("From / to", "من / إلى")}</th><th>{t("Amount", "المبلغ")}</th><th>{t("Status", "الحالة")}</th><th>{t("Actions", "الإجراءات")}</th></tr></thead>
        <tbody>{d.movements.map((m) => {
          const allocatable = (m.kind === "CUSTOMER_RECEIPT" || m.kind === "SUPPLIER_PAYMENT") && ["CONFIRMED", "PARTIALLY_ALLOCATED"].includes(m.state) && Number(m.unallocated) > 0;
          return <tr key={m.id} data-movement={m.reference}>
            <td><bdi>{m.occurredOn}</bdi></td>
            <td>{KINDS[m.kind][ar ? 1 : 0]}<br/><small><bdi>{m.reference}</bdi>{m.document && <> · <a href={`/api/evidence/${m.document.id}/content`} target="_blank" rel="noreferrer">{t("Slip", "الإيصال")}</a></>}</small></td>
            <td>{m.counterparty.name}{m.notes && <><br/><small className="orb-muted">{m.notes}</small></>}</td>
            <td><bdi>{m.currency} {fmt(m.amount)}</bdi><br/><small className="orb-muted"><bdi>AED {fmt(m.aedAmount)} @ {m.fxRate}</bdi></small></td>
            <td>{chip(m.state)}
              {["PARTIALLY_ALLOCATED", "CONFIRMED"].includes(m.state) && (m.kind === "CUSTOMER_RECEIPT" || m.kind === "SUPPLIER_PAYMENT") && <><br/><small>{t(`Unmatched ${fmt(m.unallocated)}`, `غير مطابق ${fmt(m.unallocated)}`)}</small></>}
              {m.state === "REJECTED" && m.lastDecision?.comment && <><br/><small>{m.lastDecision.comment}</small></>}
              {m.state === "REVERSED" && m.reversalReason && <><br/><small>{m.reversalReason}</small></>}
              {m.allocations.length > 0 && <ul className="money-allocs">{m.allocations.map((a) => <li key={a.id} data-state={a.state}>
                <bdi>{a.invoiceReference}</bdi> · <bdi>{fmt(a.amount)}</bdi>{a.state === "REVERSED" ? <> · <em>{t("undone", "أُلغيت")}{a.reversalReason ? `: ${a.reversalReason}` : ""}</em></>
                  : finance && <> · <button type="button" className="money-link" data-operation-id="reverseSettlementAllocation" onClick={() => setOpen(`UNDO:${a.id}`)}>{t("Undo", "تراجع")}</button></>}
              </li>)}</ul>}
            </td>
            <td><div className="money-buttons">
              {decisionButtons(m, t("Payment approved.", "تم اعتماد الدفعة."))}
              {allocatable && <button type="button" data-operation-id="allocateMoneyMovement" onClick={() => setOpen(`ALLOCATE:${m.id}`)}>{t("Match to invoice", "مطابقة مع فاتورة")}</button>}
              {!["REVERSED", "REJECTED"].includes(m.state) && <button type="button" data-danger data-operation-id="reverseMoneyMovement" onClick={() => setOpen(`REVERSE:${m.id}`)}>{m.state === "PENDING_APPROVAL" ? t("Withdraw", "سحب") : t("Reverse", "عكس")}</button>}
            </div></td>
          </tr>;
        })}</tbody></table></div>}
      {d.movements.map((m) => <div key={m.id}>
        {open === `ALLOCATE:${m.id}` && <AllocateForm movement={m} invoices={d.invoices} busy={busy} t={t} onCancel={() => setOpen(null)}
          onSubmit={(body) => void run(() => sendJson(`/api/money-movements/${m.id}/allocations`, "POST", body), t("Matched to the invoice.", "تمت المطابقة مع الفاتورة."))}/>}
        {open === `REVERSE:${m.id}` && reasonForm(t(`Why is ${m.reference} being reversed? Matches to invoices are undone too.`, `لماذا يُعكس ${m.reference}؟ ستُلغى المطابقات مع الفواتير أيضاً.`), t("Reverse", "عكس"),
          (reason) => void run(() => sendJson(`/api/money-movements/${m.id}/reverse`, "POST", { reason }), t("Reversed. The history is kept.", "تم العكس مع الاحتفاظ بالسجل.")))}
        {open === `REJECT:${m.id}` && reasonForm(t("What needs to be corrected?", "ما الذي يجب تصحيحه؟"), t("Reject payment", "رفض الدفعة"),
          (comment) => void run(() => sendJson(`/api/approvals/${m.pendingApprovalId}/decision`, "POST", { decision: "REJECTED", comment }), t("Payment rejected.", "تم رفض الدفعة.")))}
        {m.allocations.filter((a) => open === `UNDO:${a.id}`).map((a) => <div key={a.id}>{reasonForm(t(`Why undo the match to ${a.invoiceReference}?`, `لماذا تُلغى المطابقة مع ${a.invoiceReference}؟`), t("Undo match", "إلغاء المطابقة"),
          (reason) => void run(() => sendJson(`/api/allocations/${a.id}/reverse`, "POST", { reason }), t("Match undone.", "تم إلغاء المطابقة.")))}</div>)}
      </div>)}
    </section>}

    {focus === "money" && finance && <section className="money-card" aria-labelledby="invoices-title" data-testid="money-invoices">
      <h2 id="invoices-title">{t("Invoices and balances", "الفواتير والأرصدة")}</h2>
      {d.invoices.length === 0 ? <p className="orb-muted">{t("No issued customer invoices or approved supplier invoices yet. Invoices are created on the shipment pages.", "لا توجد فواتير عملاء صادرة أو فواتير موردين معتمدة بعد. تُنشأ الفواتير من صفحات الشحنات.")}</p> : <div className="money-scroll"><table>
        <thead><tr><th>{t("Invoice", "الفاتورة")}</th><th>{t("Party", "الطرف")}</th><th>{t("Amount", "المبلغ")}</th><th>{t("Paid", "المدفوع")}</th><th>{t("Due", "المتبقي")}</th></tr></thead>
        <tbody>{d.invoices.map((i) => <tr key={i.id}><td>{i.type === "CINV" ? t("Customer", "عميل") : t("Supplier", "مورد")} · <bdi>{i.reference}</bdi><br/><small className="orb-muted"><bdi>{i.invoiceDate}</bdi></small></td>
          <td>{i.counterpartyName}</td><td><bdi>{i.currency} {fmt(i.amount)}</bdi></td><td><bdi>{fmt(i.allocated)}</bdi></td>
          <td>{Number(i.outstanding) <= 0 ? <span className="orb-chip" data-tone="success">{t("Paid", "مدفوعة")}</span> : <strong><bdi>{fmt(i.outstanding)}</bdi></strong>}</td></tr>)}</tbody></table></div>}
    </section>}

    <section className="money-card" aria-labelledby="expenses-title" data-testid="money-expenses">
      <h2 id="expenses-title">{t("Project expenses", "مصروفات المشروع")}</h2>
      {d.expenses.length === 0 ? <p className="orb-muted">{t("No expenses recorded yet.", "لم تُسجّل مصروفات بعد.")}</p> : <div className="money-scroll"><table>
        <thead><tr><th>{t("Date", "التاريخ")}</th><th>{t("Category", "الفئة")}</th><th>{t("Paid to", "المدفوع له")}</th><th>{t("Amount", "المبلغ")}</th><th>{t("Status", "الحالة")}</th><th>{t("Actions", "الإجراءات")}</th></tr></thead>
        <tbody>{d.expenses.map((x) => <tr key={x.id}>
          <td><bdi>{x.occurredOn}</bdi></td>
          <td>{ar ? x.category.nameAr : x.category.name}{x.description && <><br/><small className="orb-muted">{x.description}</small></>}{x.shipment && <><br/><small><a href={`/${x.shipment.type === "SUPPLIER" ? "supplier" : "sales"}-shipments/${x.shipment.id}?locale=${locale}`}><bdi>{x.shipment.reference}</bdi></a></small></>}</td>
          <td>{x.payee.name}{x.document && <><br/><small><a href={`/api/evidence/${x.document.id}/content`} target="_blank" rel="noreferrer">{t("Bill", "الفاتورة")}</a></small></>}</td>
          <td><bdi>{x.currency} {fmt(x.amount)}</bdi><br/><small className="orb-muted"><bdi>AED {fmt(x.aedAmount)}</bdi></small></td>
          <td>{chip(x.state)}{x.state === "REJECTED" && x.lastDecision?.comment && <><br/><small>{x.lastDecision.comment}</small></>}{x.state === "CANCELLED" && x.cancellationReason && <><br/><small>{x.cancellationReason}</small></>}</td>
          <td><div className="money-buttons">
            {decisionButtons(x, t("Expense approved.", "تم اعتماد المصروف."))}
            {finance && ["PENDING_APPROVAL", "APPROVED"].includes(x.state) && <button type="button" data-danger data-operation-id="cancelDirectExpense" onClick={() => setOpen(`CANCEL:${x.id}`)}>{t("Cancel", "إلغاء")}</button>}
          </div></td>
        </tr>)}</tbody></table></div>}
      {d.expenses.map((x) => <div key={x.id}>
        {open === `REJECT:${x.id}` && reasonForm(t("What needs to be corrected?", "ما الذي يجب تصحيحه؟"), t("Reject expense", "رفض المصروف"),
          (comment) => void run(() => sendJson(`/api/approvals/${x.pendingApprovalId}/decision`, "POST", { decision: "REJECTED", comment }), t("Expense rejected.", "تم رفض المصروف.")))}
        {open === `CANCEL:${x.id}` && reasonForm(t("Why is this expense cancelled?", "سبب إلغاء المصروف؟"), t("Cancel expense", "إلغاء المصروف"),
          (reason) => void run(() => sendJson(`/api/expenses/${x.id}/cancel`, "POST", { reason }), t("Expense cancelled.", "تم إلغاء المصروف.")))}
      </div>)}
    </section>
    {focus === "money" && !finance && <p className="orb-muted">{t("Receipts, payments and invoice balances are visible to finance and owners.", "التحصيلات والمدفوعات وأرصدة الفواتير تظهر للمالية والمالك.")}</p>}
  </>);
}

type T = (en: string, ar: string) => string;

function RateFields({ t, currency, onCurrency, amount, rate, onRate }: { t: T; currency: string; onCurrency: (value: string) => void; amount: string; rate: string; onRate: (value: string) => void }) {
  const aed = currency === "AED" ? Number(amount.replaceAll(",", "")) : Number(amount.replaceAll(",", "")) * Number(rate);
  return <>
    <label>{t("Currency", "العملة")}<input name="currency" value={currency} onChange={(event) => onCurrency(event.target.value.toUpperCase())} maxLength={3} required dir="ltr"/></label>
    <label>{t("AED rate (bank)", "سعر الصرف للدرهم (البنك)")}<input name="fxRate" value={currency === "AED" ? "1" : rate} onChange={(event) => onRate(event.target.value)} inputMode="decimal" required readOnly={currency === "AED"} dir="ltr" placeholder="3.6725"/>
      {Number.isFinite(aed) && aed > 0 && <small className="orb-muted">≈ AED {fmt(aed)}</small>}</label>
  </>;
}

function MovementForm({ mode, data, busy, t, onCancel, onSubmit }: { mode: "RECEIPT" | "PAYMENT" | "REFUND"; data: ProjectMoney; busy: boolean; t: T; onCancel: () => void; onSubmit: (form: FormData, needsApproval: boolean) => void }) {
  const [kind, setKind] = useState<Kind>(mode === "RECEIPT" ? "CUSTOMER_RECEIPT" : mode === "PAYMENT" ? "SUPPLIER_PAYMENT" : "CUSTOMER_REFUND");
  const [currency, setCurrency] = useState(data.project.currency);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const customerSide = kind === "CUSTOMER_RECEIPT" || kind === "CUSTOMER_REFUND";
  const needsApproval = kind === "SUPPLIER_PAYMENT" || kind === "CUSTOMER_REFUND";
  return <form className="money-form" data-testid="movement-form" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget), needsApproval); }}>
    <h3>{t(KINDS[kind][0], KINDS[kind][1])}</h3>
    <div className="grid">
      {mode === "REFUND" && <label>{t("Refund type", "نوع الاسترداد")}<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as Kind)}>
        <option value="CUSTOMER_REFUND">{t("We refund the customer", "نرد مبلغاً للعميل")}</option><option value="SUPPLIER_REFUND">{t("Supplier refunds us", "المورد يرد لنا مبلغاً")}</option></select></label>}
      {mode !== "REFUND" && <input type="hidden" name="kind" value={kind}/>}
      {customerSide ? <><input type="hidden" name="counterpartyId" value={data.customer.id}/><label>{t("Customer", "العميل")}<input value={data.customer.name} readOnly/></label></>
        : <label>{t("Supplier", "المورد")}<select name="counterpartyId" required defaultValue={data.suppliers.length === 1 ? data.suppliers[0].id : ""}>
          <option value="" disabled>{t("Choose…", "اختر…")}</option>{data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <label>{t("Amount", "المبلغ")}<input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required dir="ltr"/></label>
      <RateFields t={t} currency={currency} onCurrency={setCurrency} amount={amount} rate={rate} onRate={setRate}/>
      <label>{t("Date on the bank", "تاريخ البنك")}<input name="occurredOn" type="date" required max={today()} defaultValue={today()}/></label>
      <label>{t("Bank reference", "مرجع البنك")}<input name="reference" required minLength={2} maxLength={80} dir="ltr"/></label>
    </div>
    <label>{t("Notes (optional)", "ملاحظات (اختياري)")}<input name="notes" maxLength={500}/></label>
    <label>{t("Bank slip / transfer confirmation (PDF, JPG or PNG)", "إيصال البنك / تأكيد التحويل (PDF أو JPG أو PNG)")}<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png"/></label>
    {needsApproval && <p className="orb-muted">{t("Money going out needs an owner's approval before it counts.", "الأموال الخارجة تحتاج اعتماد المالك قبل احتسابها.")}</p>}
    <div className="money-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{needsApproval ? t("Save and send for approval", "حفظ وإرسال للاعتماد") : t("Save", "حفظ")}</button><button type="button" onClick={onCancel}>{t("Back", "رجوع")}</button></div>
  </form>;
}

function AllocateForm({ movement, invoices, busy, t, onCancel, onSubmit }: { movement: Movement; invoices: OpenInvoice[]; busy: boolean; t: T; onCancel: () => void; onSubmit: (body: Record<string, unknown>) => void }) {
  const type = movement.kind === "CUSTOMER_RECEIPT" ? "CINV" : "SUPPLIER_INVOICE";
  const choices = useMemo(() => invoices.filter((i) => i.type === type && i.counterpartyId === movement.counterparty.id && i.currency === movement.currency && Number(i.outstanding) > 0), [invoices, type, movement]);
  const [targetId, setTargetId] = useState(choices[0]?.id ?? "");
  const target = choices.find((i) => i.id === targetId);
  const suggested = target ? Math.min(Number(movement.unallocated), Number(target.outstanding)).toFixed(2) : "";
  return <form className="money-form" data-testid="allocate-form" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); onSubmit({ targetType: type, targetId, amount: String(f.get("amount") ?? ""), currency: movement.currency }); }}>
    <h3>{t(`Match ${movement.reference} (${movement.currency} ${fmt(movement.unallocated)} unmatched)`, `مطابقة ${movement.reference} (${movement.currency} ${fmt(movement.unallocated)} غير مطابق)`)}</h3>
    {choices.length === 0 ? <p className="orb-muted">{t("No open invoices for this party in this currency. The amount stays as an advance.", "لا توجد فواتير مفتوحة لهذا الطرف بهذه العملة. يبقى المبلغ دفعة مقدمة.")}</p> : <div className="grid">
      <label>{t("Invoice", "الفاتورة")}<select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>
        {choices.map((i) => <option key={i.id} value={i.id}>{i.reference} · {t("due", "المتبقي")} {fmt(i.outstanding)}</option>)}</select></label>
      <label>{t("Amount to match", "المبلغ المطابق")}<input key={targetId} name="amount" defaultValue={suggested} inputMode="decimal" required dir="ltr"/></label>
    </div>}
    <div className="money-buttons"><button type="submit" className="orb-button-filled" disabled={busy || !choices.length}>{t("Match", "مطابقة")}</button><button type="button" onClick={onCancel}>{t("Back", "رجوع")}</button></div>
  </form>;
}

function ExpenseForm({ data, busy, t, ar, onCancel, onSubmit }: { data: ProjectMoney; busy: boolean; t: T; ar: boolean; onCancel: () => void; onSubmit: (form: FormData) => void }) {
  const [currency, setCurrency] = useState(data.project.currency);
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [payee, setPayee] = useState<string>("");
  return <form className="money-form" data-testid="expense-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const shipment = String(form.get("shipment") ?? "");
    form.delete("shipment");
    if (shipment) { const [type, id] = shipment.split(":"); form.set("shipmentType", type); form.set("shipmentId", id); }
    if (payee && payee !== "OTHER") { form.set("supplierId", payee); form.delete("payeeName"); }
    onSubmit(form);
  }}>
    <h3>{t("Record expense", "تسجيل مصروف")}</h3>
    <div className="grid">
      <label>{t("Category", "الفئة")}<select name="categoryCode" required defaultValue=""><option value="" disabled>{t("Choose…", "اختر…")}</option>
        {data.categories.map((c) => <option key={c.code} value={c.code}>{ar ? c.nameAr : c.name}</option>)}</select></label>
      <label>{t("Paid to", "المدفوع له")}<select value={payee} onChange={(event) => setPayee(event.target.value)} required>
        <option value="" disabled>{t("Choose…", "اختر…")}</option>{data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="OTHER">{t("Someone else (type the name)", "جهة أخرى (اكتب الاسم)")}</option></select></label>
      {payee === "OTHER" && <label>{t("Name of who was paid", "اسم الجهة المدفوع لها")}<input name="payeeName" required minLength={2} maxLength={120}/></label>}
      <label>{t("For shipment (optional)", "للشحنة (اختياري)")}<select name="shipment" defaultValue=""><option value="">{t("Whole project", "المشروع كله")}</option>
        {data.shipments.map((s) => <option key={s.id} value={`${s.type}:${s.id}`}>{s.reference} · {s.type === "SUPPLIER" ? t("supplier", "مورد") : t("customer", "عميل")}</option>)}</select></label>
      <label>{t("Amount", "المبلغ")}<input name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required dir="ltr"/></label>
      <RateFields t={t} currency={currency} onCurrency={setCurrency} amount={amount} rate={rate} onRate={setRate}/>
      <label>{t("Expense date", "تاريخ المصروف")}<input name="occurredOn" type="date" required max={today()} defaultValue={today()}/></label>
    </div>
    <label>{t("Description (optional)", "الوصف (اختياري)")}<input name="description" maxLength={300}/></label>
    <label>{t("Bill or receipt (PDF, JPG or PNG)", "الفاتورة أو الإيصال (PDF أو JPG أو PNG)")}<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png"/></label>
    <div className="money-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Save and send for approval", "حفظ وإرسال للاعتماد")}</button><button type="button" onClick={onCancel}>{t("Back", "رجوع")}</button></div>
  </form>;
}

const STYLES = `
  .orb-money .money-banner{padding:12px 16px;border-radius:14px;margin-block:12px;background:var(--orb-color-surface-container)}
  .orb-erp.orb-money .money-banner[data-tone=error]{background:var(--orb-color-error-container)!important}
  .orb-erp.orb-money .money-banner[data-tone=success]{background:#e6f4ea!important;color:#0d3d17}
  .orb-money .money-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-block:16px}
  .orb-erp.orb-money .money-actions button,.orb-erp.orb-money .money-buttons button{padding:8px 14px;font:inherit;font-weight:700}
  .orb-money .money-buttons{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .orb-money .money-form{display:grid;gap:10px;padding:16px;border:1px solid var(--orb-color-outline-variant);border-radius:16px;margin-block:12px;background:var(--orb-color-surface-bright)}
  .orb-money .money-form h3{margin:0;font-size:1rem}
  .orb-money .money-form label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-money .money-form .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
  .orb-money .money-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;margin-block:12px}
  .orb-money .money-card h2{font-size:1rem;margin:0 0 10px}
  .orb-money .money-scroll{overflow-x:auto}
  .orb-money table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-money th,.orb-money td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top}
  .orb-money ul.money-allocs{margin:6px 0 0;padding-inline-start:16px;font-size:.82rem}
  .orb-money ul.money-allocs li[data-state=REVERSED]{color:var(--orb-color-on-surface-variant)}
  .orb-erp.orb-money .money-buttons .money-link,.orb-erp.orb-money .money-link{border:0!important;padding:0!important;background:none!important;color:var(--orb-color-primary)!important;text-decoration:underline;font-weight:600;min-height:0}
  @media (max-width:900px){.orb-money .orb-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;
