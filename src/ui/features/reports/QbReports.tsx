"use client";

import { useEffect, useMemo, useState } from "react";
import { QB_GROUPS, buildQbReport, catalogItem, periodPreset, sourcesOf, type QbLocale, type QbRecord, type QbReportKey } from "./qb-reports";
import { downloadXlsx } from "./xlsx-export";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Reports center, grouped like QuickBooks. Every report opens on its own page with a period, drill-down and export. */
export function QbReportsCenter({ locale }: { readonly locale: QbLocale }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [q, setQ] = useState("");
  const groups = QB_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !q.trim() || `${i.en} ${i.ar} ${i.descEn}`.toLowerCase().includes(q.trim().toLowerCase())) })).filter((g) => g.items.length);
  return <section className="orb-erp qbr" dir={ar ? "rtl" : "ltr"} aria-labelledby="qbr-title">
    <style>{QBR_STYLES}</style>
    <h1 id="qbr-title">{t("Reports", "التقارير")}</h1>
    <p className="orb-muted">{t("Every amount is in AED, read live from your invoices, bills, payments and expenses. Operational reports, not a general ledger.", "كل المبالغ بالدرهم، من الفواتير والمدفوعات والمصروفات الفعلية. تقارير تشغيلية وليست دفتر أستاذ عام.")}</p>
    <label className="qbr-search">{t("Find a report by name", "ابحث عن تقرير بالاسم")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)}/></label>
    {groups.map((g) => <section key={g.en} className="qbr-group" aria-labelledby={`g-${g.en}`}>
      <h2 id={`g-${g.en}`}>{ar ? g.ar : g.en}</h2>
      <ul>{g.items.map((i) => <li key={i.key}><a href={`${i.href ?? `/reports/view/${i.key}`}?locale=${locale}`}><strong>{ar ? i.ar : i.en}</strong></a><span>{ar ? i.descAr : i.descEn}</span></li>)}</ul>
    </section>)}
  </section>;
}

/** One report: period (or "as of") picker, the table with drill-down links, Excel export and Print / PDF. */
export function QbReportPage({ reportKey, locale, from: initialFrom, to: initialTo, asOf: initialAsOf, projectId }: { readonly reportKey: QbReportKey; readonly locale: QbLocale; readonly from?: string; readonly to?: string; readonly asOf?: string; readonly projectId?: string }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const item = catalogItem(reportKey)!;
  const preset0 = initialFrom || initialTo ? "custom" : "this-year";
  const [preset, setPreset] = useState(preset0);
  const [from, setFrom] = useState(initialFrom ?? periodPreset("this-year", today()).from ?? "");
  const [to, setTo] = useState(initialTo ?? periodPreset("this-year", today()).to ?? "");
  const [asOf, setAsOf] = useState(initialAsOf ?? today());
  const [records, setRecords] = useState<QbRecord[] | null>(null);
  const [problem, setProblem] = useState<number | null>(null);
  const [company, setCompany] = useState<string>("");
  useEffect(() => {
    const scope = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    void Promise.all(sourcesOf(reportKey).map(async (src) => { const r = await fetch(`/api/accounts/${src}${scope}`, { cache: "no-store" }); if (!r.ok) throw r.status; return ((await r.json()) as { items: QbRecord[] }).items; }))
      .then((lists) => setRecords(lists.flat())).catch((status) => setProblem(typeof status === "number" ? status : 503));
    void fetch("/api/company/document-profile", { cache: "no-store" }).then(async (r) => r.ok && setCompany(((await r.json()) as { legalNameEn?: string; legalNameAr?: string }).legalNameEn ?? "")).catch(() => undefined);
  }, [reportKey, projectId]);
  const isPeriod = item.kind === "period";
  const table = useMemo(() => records ? buildQbReport(reportKey, records, { ...(isPeriod ? { from: from || undefined, to: to || undefined } : {}), asOf, locale, partyHref: (type, id) => `/${type === "customer" ? "customers" : "suppliers"}/${id}?locale=${locale}` }) : null, [records, reportKey, from, to, asOf, locale, isPeriod]);
  const periodLabel = isPeriod ? (from || to ? `${from || "…"} → ${to || "…"}` : t("All dates", "كل التواريخ")) : `${t("As of", "حتى")} ${asOf}`;
  const choose = (p: string) => { setPreset(p); if (p !== "custom") { const r = periodPreset(p, today()); setFrom(r.from ?? ""); setTo(r.to ?? ""); } };
  const exportXlsx = () => {
    if (!table) return;
    const title = ar ? item.ar : item.en;
    downloadXlsx(`${item.key}-${isPeriod ? `${from || "start"}-${to || today()}` : asOf}`, title, [[title], [company], [`${periodLabel} · AED`], [], [...table.columns], ...table.rows.map((r) => r.cells.map((c) => (c === "" ? null : c)))], ar);
  };

  return <section className="orb-erp qbr qbr-report" dir={ar ? "rtl" : "ltr"} aria-labelledby="qbr-report-title">
    <style>{QBR_STYLES}</style>
    <nav className="qbr-crumb no-print" aria-label={t("Breadcrumb", "مسار التنقل")}><a href={`/reports?locale=${locale}`}>{t("Reports", "التقارير")}</a> / <span>{ar ? item.ar : item.en}</span></nav>
    <div className="qbr-controls no-print" role="group" aria-label={t("Report period", "فترة التقرير")}>
      {isPeriod ? <>
        <label>{t("Report period", "فترة التقرير")}<select value={preset} onChange={(e) => choose(e.target.value)} data-testid="period-preset">
          <option value="this-month">{t("This month", "هذا الشهر")}</option><option value="last-month">{t("Last month", "الشهر الماضي")}</option>
          <option value="this-quarter">{t("This quarter", "هذا الربع")}</option><option value="this-year">{t("This year", "هذه السنة")}</option>
          <option value="last-year">{t("Last year", "السنة الماضية")}</option><option value="last-30">{t("Last 30 days", "آخر 30 يوماً")}</option>
          <option value="all">{t("All dates", "كل التواريخ")}</option><option value="custom">{t("Custom", "مخصص")}</option></select></label>
        <label>{t("From", "من")}<input type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }}/></label>
        <label>{t("To", "إلى")}<input type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }}/></label>
      </> : <label>{t("As of", "حتى تاريخ")}<input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value || today())}/></label>}
      <span className="qbr-spacer"/>
      <button type="button" onClick={exportXlsx} disabled={!table} data-testid="export-xlsx">{t("Export to Excel", "تصدير إلى Excel")}</button>
      <button type="button" onClick={() => window.print()} disabled={!table}>{t("Print or save as PDF", "طباعة أو حفظ PDF")}</button>
    </div>
    <article className="qbr-paper">
      <header className="qbr-head"><p>{company}</p><h1 id="qbr-report-title">{ar ? item.ar : item.en}</h1><p>{periodLabel} · {t("Amounts in AED", "المبالغ بالدرهم")}</p></header>
      {problem ? <p role="alert">{problem === 403 ? t("Reports are for finance and owners.", "التقارير للمالية والمالك.") : t("The report could not be loaded. Try again in a moment.", "تعذر تحميل التقرير. حاول بعد قليل.")}</p>
        : !table ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
        : <table data-testid="qb-report-table">
          <thead><tr>{table.columns.map((c, i) => <th key={i} className={table.numeric[i] ? "num" : undefined}>{c}</th>)}</tr></thead>
          <tbody>{table.rows.map((r, ri) => <tr key={ri} className={r.strong ? "qbr-strong" : undefined}>{r.cells.map((c, ci) => {
            const text = typeof c === "number" && table.numeric[ci] ? fmt(c) : String(c);
            return <td key={ci} className={`${table.numeric[ci] ? "num" : ""}${ci === 0 && r.indent ? " qbr-indent" : ""}`}>{ci === 0 && r.href ? <a href={r.href.includes("?") ? r.href : `${r.href}?locale=${locale}`}>{text}</a> : r.href && table.numeric[ci] && typeof c === "number" && !r.strong ? <a href={r.href.includes("?") ? r.href : `${r.href}?locale=${locale}`}>{text}</a> : text}</td>;
          })}</tr>)}</tbody>
        </table>}
      {table && table.unconverted > 0 && <p className="orb-muted">{t(`${table.unconverted} record(s) have no AED rate and are not included.`, `${table.unconverted} سجل بدون سعر صرف للدرهم وغير مشمول.`)}</p>}
      <footer className="qbr-foot">{t("Generated", "أُنشئ في")} {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</footer>
    </article>
  </section>;
}

const QBR_STYLES = `
.qbr h1{margin:0}.qbr-search{display:grid;gap:4px;max-width:420px;margin-block:12px;font-weight:600}.qbr-search input{min-height:40px;border-radius:10px;border:1px solid var(--orb-color-outline-variant);padding:0 10px;font:inherit}
.qbr-group{margin-block:18px}.qbr-group h2{font-size:1.05rem;margin:0 0 8px}
.qbr-group ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
.qbr-group li{border:1px solid var(--orb-color-outline-variant);border-radius:14px;padding:12px 14px;background:var(--orb-color-surface);display:grid;gap:4px}
.qbr-group li span{color:var(--orb-color-on-surface-variant);font-size:.88rem}
.qbr-crumb{margin-bottom:8px}.qbr-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-block:8px 16px}
.qbr-controls label{display:grid;gap:4px;font-weight:600;font-size:.85rem}.qbr-controls input,.qbr-controls select{min-height:40px;border-radius:10px;border:1px solid var(--orb-color-outline-variant);padding:0 8px;font:inherit}
.qbr-controls button{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--orb-color-outline);background:var(--orb-color-surface);font:inherit;font-weight:600;cursor:pointer}
.qbr-spacer{flex:1}
.qbr-paper{background:#fff;border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:24px;max-width:1100px}
.qbr-head{text-align:center;margin-bottom:16px}.qbr-head p{margin:2px 0;color:#555}.qbr-head h1{font-size:1.4rem}
.qbr-report table{width:100%;border-collapse:collapse;font-size:.92rem}.qbr-report th,.qbr-report td{padding:7px 10px;text-align:start;border-bottom:1px solid #e3e6e8}
.qbr-report th{font-size:.75rem;text-transform:uppercase;color:#555;border-bottom:2px solid #c9ced2}.qbr-report .num{text-align:end;white-space:nowrap}
.qbr-strong td{font-weight:700;background:#f6f8f9}.qbr-indent{padding-inline-start:28px!important}.qbr-foot{margin-top:16px;color:#777;font-size:.8rem;text-align:center}
@media print{.no-print,header.orb-topbar,nav.orb-rail,.orb-bottom-nav,aside{display:none!important}.qbr-paper{border:0;padding:0;max-width:none}body{background:#fff}}
`;
