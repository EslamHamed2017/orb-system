"use client";

import { useEffect, useState } from "react";
import { problemOf, type ApiProblem } from "../../session-client";
import { ContractFulfillmentReportPage, type ContractFulfillmentReportPageProps } from "./ContractFulfillmentReportPage";
import { ProductMovementReportPage, type ProductMovementReportPageProps } from "./ProductMovementReportPage";
import { ProductMovementHistoryPage } from "../masters/ProductMovementHistoryPage";
import type { ContractFulfillmentReportRecord } from "./contract-fulfillment-report";
import type { ProductMovementReportRecord } from "./product-movement-report";
import type { ProductMovementDirectionFilter, ProductMovementHistoryRecord } from "../masters/product-movement-history";

/** Live wrappers: the report screens keep their filters and layout, and read their rows from the database APIs. */
type Movement = ProductMovementReportRecord & ProductMovementHistoryRecord;

function useJson<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  useEffect(() => {
    let live = true;
    setData(null); setProblem(null);
    void fetch(url, { cache: "no-store" }).then(async (response) => {
      if (!live) return;
      if (!response.ok) { setProblem(await problemOf(response)); return; }
      setData(await response.json() as T);
    }).catch(() => live && setProblem({ status: 503, code: "DEPENDENCY_UNAVAILABLE" }));
    return () => { live = false; };
  }, [url]);
  return { data, problem };
}

function Status({ locale, problem, title }: { readonly locale: "en" | "ar"; readonly problem: ApiProblem | null; readonly title: [string, string] }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="report-status-title">
    <h1 id="report-status-title">{ar ? title[1] : title[0]}</h1>
    {problem
      ? <p role="alert">{problem.status === 403 ? t("Your role cannot see this report.", "دورك لا يسمح برؤية هذا التقرير.") : problem.status === 404 ? t("Not found.", "غير موجود.") : t("The report could not be loaded. Try again in a moment.", "تعذر تحميل التقرير. حاول مرة أخرى بعد قليل.")}</p>
      : <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>}
  </section>;
}

const unique = <T,>(rows: readonly T[], key: (row: T) => string) => [...new Map(rows.map((row) => [key(row), row])).values()];

export function ContractFulfillmentReportLive(props: ContractFulfillmentReportPageProps) {
  const { data, problem } = useJson<{ rows: ContractFulfillmentReportRecord[] }>("/api/reports/contract-fulfillment");
  if (!data) return <Status locale={props.locale} problem={problem} title={["Contract fulfillment report", "تقرير تنفيذ العقود"]}/>;
  const projects = unique(data.rows, (row) => row.projectId).map((row) => ({ id: row.projectId, label: row.projectReference })).sort((a, b) => a.label.localeCompare(b.label));
  return <ContractFulfillmentReportPage {...props} lines={data.rows} projects={projects}/>;
}

export function ProductMovementReportLive(props: ProductMovementReportPageProps) {
  const { data, problem } = useJson<{ rows: ProductMovementReportRecord[] }>("/api/reports/product-movement");
  if (!data) return <Status locale={props.locale} problem={problem} title={["Product movement report", "تقرير حركة المنتج"]}/>;
  const projects = unique(data.rows, (row) => row.projectId).map((row) => ({ id: row.projectId, label: row.projectReference })).sort((a, b) => a.label.localeCompare(b.label));
  const products = unique(data.rows, (row) => row.productId).map((row) => ({ id: row.productId, en: `${row.productReference} · ${row.productName}`, ar: `${row.productReference} · ${row.productName}` }));
  return <ProductMovementReportPage {...props} movements={data.rows} projects={projects} products={products}/>;
}

export function ProductMovementHistoryLive(props: { readonly productId: string; readonly locale: "en" | "ar"; readonly projectId?: string; readonly direction?: ProductMovementDirectionFilter; readonly query?: string }) {
  const { data, problem } = useJson<{ product: { reference: string; nameEn: string; nameAr: string }; items: Movement[] }>(`/api/products/${encodeURIComponent(props.productId)}/movements`);
  if (!data) return <Status locale={props.locale} problem={problem} title={["Product movement", "حركة المنتج"]}/>;
  const projects = unique(data.items, (row) => row.projectId).map((row) => ({ id: row.projectId, reference: row.projectReference, name: row.projectName }));
  return <ProductMovementHistoryPage {...props} movements={data.items} projects={projects} product={data.product}/>;
}
