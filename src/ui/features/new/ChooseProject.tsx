"use client";

import { useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { NEW_IN_PROJECT } from "../../navigation/qb-navigation";
import { problemOf, type ApiProblem } from "../../session-client";

interface Project { id: string; reference: string; lifecycleState: string; customer: { legalName: string; legalNameAr: string | null } }

/** "+ New" for anything that belongs to a project: pick the project, then continue on its page. */
export function ChooseProject({ kind, locale }: { readonly kind: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const target = NEW_IN_PROJECT[kind];
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void fetch("/api/projects", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) { setProblem(await problemOf(response)); return; }
      setProjects(((await response.json()) as { items: Project[] }).items);
    }).catch(() => setProblem({ status: 503, code: "DEPENDENCY_UNAVAILABLE" }));
  }, []);
  if (!target) return <section className="orb-erp"><EnterpriseStyles/><ErpPageHeader titleId="new-title" eyebrow={t("New", "جديد")} title={t("Nothing to create here", "لا يوجد ما يُنشأ هنا")} description=""/></section>;
  const href = (id: string) => { const [path, search] = target.path.split("?"); return `/projects/${id}/${path}?locale=${locale}${search ? `&${search}` : ""}`; };
  const open = (projects ?? []).filter((p) => p.lifecycleState !== "CANCELLED")
    .filter((p) => !query.trim() || `${p.reference} ${p.customer.legalName} ${p.customer.legalNameAr ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="new-title">
    <EnterpriseStyles/>
    <style>{`.new-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}.new-list a{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border:1px solid var(--orb-color-outline-variant);border-radius:14px;text-decoration:none;color:inherit}.new-list a:hover{background:var(--orb-color-surface-container)}.new-search{margin-block:12px;display:grid;gap:4px;max-inline-size:420px}`}</style>
    <ErpPageHeader titleId="new-title" eyebrow={t("New", "جديد")} title={t(target.en, target.ar)} description={t("Choose the project this belongs to.", "اختر المشروع الذي يخصه.")}/>
    {problem ? <p role="alert">{problem.status === 403 ? t("Your role cannot do this.", "دورك لا يسمح بهذا.") : t("Projects could not be loaded. Try again in a moment.", "تعذر تحميل المشاريع. حاول مرة أخرى بعد قليل.")}</p>
      : !projects ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
      : <>
        <label className="new-search">{t("Find a project", "ابحث عن مشروع")}<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)}/></label>
        {open.length === 0 ? <p className="orb-muted" role="status">{t("No projects yet.", "لا توجد مشاريع بعد.")} <a href={`/projects/new?locale=${locale}`}>{t("Create a project", "إنشاء مشروع")}</a></p>
          : <ul className="new-list">{open.map((p) => <li key={p.id}><a href={href(p.id)}><strong><bdi>{p.reference}</bdi></strong><span>{ar ? (p.customer.legalNameAr ?? p.customer.legalName) : p.customer.legalName}</span></a></li>)}</ul>}
      </>}
  </section>;
}
