/**
 * QuickBooks-style reports center: the catalog (grouped like QuickBooks) and the pure calculations behind each
 * report. Every figure is in AED, built from the live accounts records (invoices, bills, payments, expenses).
 */
export type QbLocale = "en" | "ar";
export type QbReportKey =
  | "profit-and-loss" | "ar-aging" | "open-invoices" | "sales-by-customer" | "invoice-list" | "payments-received"
  | "ap-aging" | "unpaid-bills" | "expenses-by-category" | "expenses-by-supplier" | "bill-payments";

export interface QbRecord {
  readonly id: string; readonly projectId: string; readonly type: string; readonly occurredOn: string; readonly state: string; readonly partyId?: string;
  readonly reference: string; readonly currency: string; readonly amount: string; readonly outstandingAmount: string; readonly projectReference: string;
  readonly partyName: string; readonly href: string; readonly dueDate?: string; readonly vatAmount?: string; readonly aedAmount: string | null; readonly aedOutstanding: string | null;
}

export interface QbCatalogItem { readonly key: QbReportKey | string; readonly en: string; readonly ar: string; readonly descEn: string; readonly descAr: string; readonly href?: string; readonly kind: "period" | "asof" | "link" }
export const QB_GROUPS: readonly { readonly en: string; readonly ar: string; readonly items: readonly QbCatalogItem[] }[] = [
  { en: "Business overview", ar: "نظرة عامة على العمل", items: [
    { key: "profit-and-loss", en: "Profit and loss", ar: "الأرباح والخسائر", descEn: "Income, cost of sales and expenses for a period.", descAr: "الإيرادات وتكلفة المبيعات والمصروفات لفترة.", kind: "period" },
  ] },
  { en: "Who owes you", ar: "المستحق لك", items: [
    { key: "ar-aging", en: "Accounts receivable aging", ar: "أعمار ذمم العملاء", descEn: "What each customer owes, by how late it is.", descAr: "ما على كل عميل حسب مدة التأخير.", kind: "asof" },
    { key: "open-invoices", en: "Open invoices", ar: "الفواتير المفتوحة", descEn: "Every invoice not fully paid.", descAr: "كل فاتورة لم تُسدد بالكامل.", kind: "asof" },
  ] },
  { en: "Sales and customers", ar: "المبيعات والعملاء", items: [
    { key: "sales-by-customer", en: "Sales by customer", ar: "المبيعات حسب العميل", descEn: "Invoiced sales per customer for a period.", descAr: "المبيعات المفوترة لكل عميل خلال فترة.", kind: "period" },
    { key: "invoice-list", en: "Invoice list", ar: "قائمة الفواتير", descEn: "All invoices issued in a period.", descAr: "كل الفواتير الصادرة في فترة.", kind: "period" },
    { key: "payments-received", en: "Payments received", ar: "المدفوعات المستلمة", descEn: "Money received from customers in a period.", descAr: "المبالغ المستلمة من العملاء في فترة.", kind: "period" },
  ] },
  { en: "What you owe", ar: "المستحق عليك", items: [
    { key: "ap-aging", en: "Accounts payable aging", ar: "أعمار ذمم الموردين", descEn: "What you owe each supplier, by how late it is.", descAr: "ما عليك لكل مورد حسب مدة التأخير.", kind: "asof" },
    { key: "unpaid-bills", en: "Unpaid bills", ar: "فواتير الموردين غير المدفوعة", descEn: "Every bill not fully paid.", descAr: "كل فاتورة مورد لم تُدفع بالكامل.", kind: "asof" },
  ] },
  { en: "Expenses and suppliers", ar: "المصروفات والموردون", items: [
    { key: "expenses-by-category", en: "Expenses by category", ar: "المصروفات حسب الفئة", descEn: "Project expenses per category for a period.", descAr: "مصروفات المشاريع لكل فئة خلال فترة.", kind: "period" },
    { key: "expenses-by-supplier", en: "Expenses by supplier", ar: "المصروفات حسب المورد", descEn: "Bills and expenses per supplier for a period.", descAr: "فواتير الموردين والمصروفات لكل مورد خلال فترة.", kind: "period" },
    { key: "bill-payments", en: "Bill payments", ar: "مدفوعات الموردين", descEn: "Money paid to suppliers in a period.", descAr: "المبالغ المدفوعة للموردين في فترة.", kind: "period" },
  ] },
  { en: "Projects", ar: "المشاريع", items: [
    { key: "project-profitability", en: "Project profitability", ar: "ربحية المشاريع", descEn: "Income, costs and margin for each project.", descAr: "الإيرادات والتكاليف والهامش لكل مشروع.", href: "/reports/project-profitability", kind: "link" },
    { key: "contract-fulfillment", en: "Contract fulfillment", ar: "تنفيذ العقود", descEn: "Contracted against shipped quantities and values.", descAr: "الكميات والقيم المتعاقد عليها مقابل المشحونة.", href: "/reports/contract-fulfillment", kind: "link" },
  ] },
  { en: "Shipments", ar: "الشحنات", items: [
    { key: "product-movement", en: "Product movement", ar: "حركة المنتجات", descEn: "Product received from suppliers and shipped to customers.", descAr: "المنتجات المستلمة من الموردين والمشحونة للعملاء.", href: "/reports/product-movement", kind: "link" },
  ] },
];

export const QB_REPORT_KEYS = QB_GROUPS.flatMap((g) => g.items).filter((i) => i.kind !== "link").map((i) => i.key as QbReportKey);
export function catalogItem(key: string) { return QB_GROUPS.flatMap((g) => g.items).find((i) => i.key === key); }

/** Which accounts registers a report reads. */
export function sourcesOf(key: QbReportKey): readonly string[] {
  switch (key) {
    case "profit-and-loss": return ["sales-invoices", "supplier-invoices", "expenses"];
    case "ar-aging": case "open-invoices": case "sales-by-customer": case "invoice-list": return ["sales-invoices"];
    case "payments-received": return ["collections"];
    case "ap-aging": case "unpaid-bills": return ["supplier-invoices"];
    case "expenses-by-category": return ["expenses"];
    case "expenses-by-supplier": return ["supplier-invoices", "expenses"];
    case "bill-payments": return ["supplier-payments"];
  }
}

export interface QbRow { readonly cells: readonly (string | number)[]; readonly href?: string; readonly strong?: boolean; readonly indent?: boolean }
export interface QbTable { readonly columns: readonly string[]; readonly numeric: readonly boolean[]; readonly rows: readonly QbRow[]; readonly unconverted: number }

const cents = (v: string | null | undefined) => Math.round(Number(v ?? 0) * 100);
const money = (c: number) => Math.round(c) / 100;
const LIVE_INVOICE = new Set(["ISSUED", "CONFIRMED"]);
const LIVE_MOVEMENT = new Set(["CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED"]);
const inPeriod = (d: string, from?: string, to?: string) => (!from || d >= from) && (!to || d <= to);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Ages one open amount on `asOf`: 0 = current, 1 = 1–30, 2 = 31–60, 3 = 61–90, 4 = 91+. */
export function agingBucket(dueDate: string | undefined, asOf: string): number {
  if (!dueDate || dueDate >= asOf) return 0;
  const late = daysBetween(dueDate, asOf);
  return late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
}

/** Builds a report's table from the records, in AED. `L(en, ar)` picks the label language. */
export function buildQbReport(key: QbReportKey, records: readonly QbRecord[], opts: { from?: string; to?: string; asOf: string; locale: QbLocale; partyHref: (type: string, id: string) => string }): QbTable {
  const L = (en: string, ar: string) => (opts.locale === "ar" ? ar : en);
  let unconverted = 0;
  const aed = (r: QbRecord, open = false) => { const v = open ? r.aedOutstanding : r.aedAmount; if (v === null) { unconverted += 1; return 0; } return cents(v); };
  const of = (type: string) => records.filter((r) => r.type === type);
  const period = (r: QbRecord) => inPeriod(r.occurredOn, opts.from, opts.to);

  if (key === "profit-and-loss") {
    const income = of("SALES_INVOICE").filter((r) => r.state === "ISSUED" && period(r));
    const bills = of("SUPPLIER_INVOICE").filter((r) => r.state === "CONFIRMED" && period(r));
    const expenses = of("EXPENSE").filter((r) => r.state === "APPROVED" && period(r));
    const byCat = new Map<string, number>();
    for (const e of expenses) byCat.set(e.reference, (byCat.get(e.reference) ?? 0) + aed(e));
    // Income is net of VAT: VAT collected is owed to the authority, not earned.
    const net = (r: QbRecord) => { const total = Number(r.amount), vat = Number(r.vatAmount ?? 0); return total > 0 ? Math.round(aed(r) * (total - vat) / total) : 0; };
    const inc = income.reduce((x, r) => x + net(r), 0), cos = bills.reduce((x, r) => x + aed(r), 0), exp = [...byCat.values()].reduce((x, v) => x + v, 0);
    const rows: QbRow[] = [
      { cells: [L("Income", "الإيرادات"), ""], strong: true },
      { cells: [L("Sales (customer invoices, before VAT)", "المبيعات (فواتير العملاء، قبل الضريبة)"), money(inc)], indent: true, href: "/accounts/sales-invoices" },
      { cells: [L("Total income", "إجمالي الإيرادات"), money(inc)], strong: true },
      { cells: [L("Cost of sales", "تكلفة المبيعات"), ""], strong: true },
      { cells: [L("Supplier bills", "فواتير الموردين"), money(cos)], indent: true, href: "/accounts/supplier-invoices" },
      { cells: [L("Gross profit", "إجمالي الربح"), money(inc - cos)], strong: true },
      { cells: [L("Expenses", "المصروفات"), ""], strong: true },
      ...[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ cells: [name, money(v)], indent: true, href: "/accounts/expenses" })),
      { cells: [L("Total expenses", "إجمالي المصروفات"), money(exp)], strong: true },
      { cells: [L("Net profit", "صافي الربح"), money(inc - cos - exp)], strong: true },
    ];
    return { columns: [L("Account", "البند"), L("Total (AED)", "الإجمالي (درهم)")], numeric: [false, true], rows, unconverted };
  }

  if (key === "ar-aging" || key === "ap-aging") {
    const type = key === "ar-aging" ? "SALES_INVOICE" : "SUPPLIER_INVOICE", live = key === "ar-aging" ? "ISSUED" : "CONFIRMED";
    const by = new Map<string, { id?: string; name: string; b: number[] }>();
    for (const r of of(type).filter((x) => x.state === live && Number(x.outstandingAmount) > 0 && x.occurredOn <= opts.asOf)) {
      const k = r.partyId ?? r.partyName, row = by.get(k) ?? { id: r.partyId, name: r.partyName, b: [0, 0, 0, 0, 0] };
      row.b[agingBucket(r.dueDate, opts.asOf)] += aed(r, true); by.set(k, row);
    }
    const parties = [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
    const totals = [0, 0, 0, 0, 0];
    const rows: QbRow[] = parties.map((p) => { p.b.forEach((v, i) => { totals[i] += v; }); return { cells: [p.name, ...p.b.map(money), money(p.b.reduce((x, v) => x + v, 0))], href: p.id ? opts.partyHref(key === "ar-aging" ? "customer" : "supplier", p.id) : undefined }; });
    rows.push({ cells: [L("Total", "الإجمالي"), ...totals.map(money), money(totals.reduce((x, v) => x + v, 0))], strong: true });
    return { columns: [key === "ar-aging" ? L("Customer", "العميل") : L("Supplier", "المورد"), L("Current", "غير مستحق"), "1–30", "31–60", "61–90", L("91 and over", "أكثر من 90"), L("Total (AED)", "الإجمالي (درهم)")],
      numeric: [false, true, true, true, true, true, true], rows, unconverted };
  }

  if (key === "open-invoices" || key === "unpaid-bills") {
    const type = key === "open-invoices" ? "SALES_INVOICE" : "SUPPLIER_INVOICE", live = key === "open-invoices" ? "ISSUED" : "CONFIRMED";
    const list = of(type).filter((x) => x.state === live && Number(x.outstandingAmount) > 0 && x.occurredOn <= opts.asOf).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    let total = 0;
    const rows: QbRow[] = list.map((r) => { const open = aed(r, true); total += open; const late = r.dueDate && r.dueDate < opts.asOf ? daysBetween(r.dueDate, opts.asOf) : 0;
      return { cells: [r.occurredOn, r.reference, r.partyName, r.projectReference, r.dueDate ?? "", late, `${r.currency} ${Number(r.amount).toFixed(2)}`, money(open)], href: r.href }; });
    rows.push({ cells: [L("Total", "الإجمالي"), "", "", "", "", "", "", money(total)], strong: true });
    return { columns: [L("Date", "التاريخ"), L("No.", "الرقم"), key === "open-invoices" ? L("Customer", "العميل") : L("Supplier", "المورد"), L("Project", "المشروع"), L("Due date", "تاريخ الاستحقاق"), L("Days late", "أيام التأخير"), L("Amount", "المبلغ"), L("Open balance (AED)", "الرصيد المفتوح (درهم)")],
      numeric: [false, false, false, false, false, true, false, true], rows, unconverted };
  }

  if (key === "sales-by-customer" || key === "expenses-by-supplier") {
    const pick = key === "sales-by-customer" ? of("SALES_INVOICE").filter((r) => r.state === "ISSUED") : [...of("SUPPLIER_INVOICE").filter((r) => r.state === "CONFIRMED"), ...of("EXPENSE").filter((r) => r.state === "APPROVED")];
    const by = new Map<string, { id?: string; name: string; v: number; n: number }>();
    for (const r of pick.filter(period)) { const k = r.partyId ?? r.partyName, row = by.get(k) ?? { id: r.partyId, name: r.partyName || L("Other", "أخرى"), v: 0, n: 0 }; row.v += aed(r); row.n += 1; by.set(k, row); }
    const list = [...by.values()].sort((a, b) => b.v - a.v), total = list.reduce((x, r) => x + r.v, 0);
    const rows: QbRow[] = list.map((p) => ({ cells: [p.name, p.n, money(p.v), total ? Math.round((p.v / total) * 1000) / 10 : 0], href: p.id ? opts.partyHref(key === "sales-by-customer" ? "customer" : "supplier", p.id) : undefined }));
    rows.push({ cells: [L("Total", "الإجمالي"), list.reduce((x, r) => x + r.n, 0), money(total), total ? 100 : 0], strong: true });
    return { columns: [key === "sales-by-customer" ? L("Customer", "العميل") : L("Supplier", "المورد"), L("Transactions", "المعاملات"), L("Total (AED)", "الإجمالي (درهم)"), "%"], numeric: [false, true, true, true], rows, unconverted };
  }

  if (key === "expenses-by-category") {
    const by = new Map<string, { v: number; n: number }>();
    for (const r of of("EXPENSE").filter((x) => x.state === "APPROVED" && period(x))) { const row = by.get(r.reference) ?? { v: 0, n: 0 }; row.v += aed(r); row.n += 1; by.set(r.reference, row); }
    const list = [...by.entries()].sort((a, b) => b[1].v - a[1].v), total = list.reduce((x, [, r]) => x + r.v, 0);
    const rows: QbRow[] = list.map(([name, r]) => ({ cells: [name, r.n, money(r.v), total ? Math.round((r.v / total) * 1000) / 10 : 0], href: "/accounts/expenses" }));
    rows.push({ cells: [L("Total", "الإجمالي"), list.reduce((x, [, r]) => x + r.n, 0), money(total), total ? 100 : 0], strong: true });
    return { columns: [L("Category", "الفئة"), L("Expenses", "المصروفات"), L("Total (AED)", "الإجمالي (درهم)"), "%"], numeric: [false, true, true, true], rows, unconverted };
  }

  // Lists for a period: invoices, payments received, bill payments.
  const type = key === "invoice-list" ? "SALES_INVOICE" : key === "payments-received" ? "COLLECTION" : "SUPPLIER_PAYMENT";
  const list = of(type).filter((r) => period(r) && (type === "SALES_INVOICE" ? LIVE_INVOICE.has(r.state) || r.state === "CANCELLED" : LIVE_MOVEMENT.has(r.state) || r.state === "REVERSED"))
    .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.reference.localeCompare(b.reference));
  let total = 0;
  const rows: QbRow[] = list.map((r) => { const counted = r.state !== "CANCELLED" && r.state !== "REVERSED"; const v = counted ? aed(r) : 0; total += v;
    return { cells: [r.occurredOn, r.reference, r.partyName, r.projectReference, counted ? "" : L("Cancelled", "ملغاة"), `${r.currency} ${Number(r.amount).toFixed(2)}`, money(v)], href: r.href }; });
  rows.push({ cells: [L("Total", "الإجمالي"), "", "", "", "", "", money(total)], strong: true });
  return { columns: [L("Date", "التاريخ"), L("No.", "الرقم"), type === "SUPPLIER_PAYMENT" ? L("Supplier", "المورد") : L("Customer", "العميل"), L("Project", "المشروع"), L("Note", "ملاحظة"), L("Amount", "المبلغ"), L("AED", "بالدرهم")],
    numeric: [false, false, false, false, false, false, true], rows, unconverted };
}

/** Period presets, QuickBooks-style. */
export function periodPreset(preset: string, today: string): { from?: string; to?: string } {
  const d = new Date(`${today}T00:00:00Z`), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const iso = (x: Date) => x.toISOString().slice(0, 10), first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)), last = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0));
  switch (preset) {
    case "this-month": return { from: iso(first(y, m)), to: iso(last(y, m)) };
    case "last-month": return { from: iso(first(y, m - 1)), to: iso(last(y, m - 1)) };
    case "this-quarter": { const q = Math.floor(m / 3) * 3; return { from: iso(first(y, q)), to: iso(last(y, q + 2)) }; }
    case "this-year": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last-year": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "last-30": { const f = new Date(d); f.setUTCDate(f.getUTCDate() - 29); return { from: iso(f), to: today }; }
    default: return {};
  }
}
