"use client";

import { useEffect, useState } from "react";
import { parseProjectRecords, PROJECT_STORAGE_KEY, type ProjectRecord } from "../../../modules/projects/daily-projects";
import { shipmentQueueHref, shipmentQueueRows, type ShipmentQueueFact } from "../../../modules/projects/saved-shipments-work-queue";
import styles from "./SavedShipmentsWorkQueue.module.css";

type LoadState = "loading" | "ready" | "corrupt" | "unavailable";

type Props = Readonly<{ locale: "ar" | "en"; role?: string }>;

function contextHref(path: string, locale: "ar" | "en", role?: string): string {
  const query = new URLSearchParams({ locale });
  if (role) query.set("role", role);
  return `${path}?${query.toString()}`;
}

function ShipmentFact({ fact, empty, dateLabel }: { readonly fact: ShipmentQueueFact | null; readonly empty: string; readonly dateLabel: string }) {
  if (!fact) return <span className={styles.notRecorded}>{empty}</span>;
  return <div className={styles.shipmentFact}><strong>{fact.reference}</strong><span>{dateLabel}: <time dateTime={fact.date}>{fact.date}</time></span><bdi>{fact.quantity}</bdi></div>;
}

export function SavedShipmentsWorkQueue({ locale, role }: Props) {
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);

  useEffect(() => {
    try {
      const records = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY));
      setProjects(records);
      setState("ready");
    } catch (error) {
      setState(error instanceof Error && error.message === "CORRUPT_PROJECT_STORAGE" ? "corrupt" : "unavailable");
    }
  }, []);

  const rows = shipmentQueueRows(projects, locale);
  const pendingCount = rows.filter((row) => row.group === "needs-action").length;
  const actionHref = (href: string) => shipmentQueueHref(href, locale, role);
  const newProjectHref = contextHref("/projects/new", locale, role);

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="shipments-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{ar ? "قائمة عمل محفوظة" : "Saved work queue"}</p><h1 id="shipments-title">{ar ? "الشحنات" : "Shipments"}</h1><p>{ar ? "راجع تفاصيل الشحن المحفوظة لكل مشروع وافتح خطوة المشروع المناسبة." : "Review shipment details saved for each project and open the relevant project step."}</p></div>
      <span className={styles.localBadge}>{ar ? "من هذا المتصفح فقط" : "From this browser only"}</span>
    </header>

    {state === "loading" && <section className={styles.stateCard} role="status">{ar ? "جارٍ تحميل الشحنات المحفوظة…" : "Loading saved shipments…"}</section>}
    {state === "corrupt" && <section className={styles.stateCard} role="alert"><h2>{ar ? "تعذر فتح الشحنات المحفوظة" : "Saved shipments could not be opened"}</h2><p>{ar ? "بيانات المشاريع المحفوظة في هذا المتصفح تالفة؛ لذلك لم نعرض أي شحنات أو نفترض قيماً بديلة." : "Saved project storage in this browser is corrupt, so no shipments or replacement values are shown."}</p></section>}
    {state === "unavailable" && <section className={styles.stateCard} role="alert"><h2>{ar ? "تعذر الوصول إلى التخزين" : "Browser storage is unavailable"}</h2><p>{ar ? "اسمح بالتخزين المحلي ثم أعد تحميل الصفحة. لم نعرض بيانات تجريبية." : "Allow local storage, then reload. No demo data is shown."}</p></section>}
    {state === "ready" && rows.length === 0 && <section className={styles.stateCard}><h2>{ar ? "لا توجد مشاريع محفوظة" : "No saved projects"}</h2><p>{ar ? "أنشئ مشروعاً من بياناتك لتظهر حالة شحنه هنا. لن يضيف ORB شحنات تجريبية." : "Create a project from your own data to see its shipment stage here. ORB will not add demo shipments."}</p><a className={styles.primaryAction} href={newProjectHref}>{ar ? "إنشاء مشروع" : "Create project"}</a></section>}

    {state === "ready" && rows.length > 0 && <section className={styles.queuePanel} aria-labelledby="saved-shipments-heading">
      <div className={styles.panelHeader}><div><h2 id="saved-shipments-heading">{ar ? "عمل الشحن والسجلات" : "Shipment work and records"}</h2><p>{ar ? `${pendingCount} يحتاج إلى إجراء من أصل ${rows.length} مشروع محفوظ` : `${pendingCount} need${pendingCount === 1 ? "s" : ""} action · ${rows.length} saved project${rows.length === 1 ? "" : "s"}`}</p></div><p className={styles.truthNote}>{ar ? "تعرض هذه القائمة ما حُفظ فعلياً فقط؛ ولا تفترض وصولاً أو إرسالاً غير مسجل." : "This queue shows only what was actually saved; it does not assume an unrecorded arrival or dispatch."}</p></div>
      <div className={styles.tableWrap}><table className={styles.queueTable}><thead><tr><th>{ar ? "المشروع والأطراف" : "Project and parties"}</th><th>{ar ? "الكمية المتعاقد عليها" : "Contracted quantity"}</th><th>{ar ? "شحنة المورد" : "Supplier shipment"}</th><th>{ar ? "شحنة العميل" : "Customer shipment"}</th><th>{ar ? "المرحلة" : "Stage"}</th><th>{ar ? "خطوة المشروع" : "Project step"}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><div className={styles.identity}><strong><bdi>{row.code}</bdi></strong><span>{row.customer}</span><span>{row.supplier ?? (ar ? "المورد لم يُسجل بعد" : "Supplier not recorded yet")}</span></div></td><td><bdi>{row.contractedQuantity}</bdi></td><td><ShipmentFact fact={row.supplierShipment} empty={ar ? "لم تُسجل" : "Not recorded"} dateLabel={ar ? "الوصول المتوقع" : "Expected arrival"} /></td><td><ShipmentFact fact={row.customerShipment} empty={ar ? "لم تُسجل" : "Not recorded"} dateLabel={ar ? "الإرسال المخطط" : "Planned dispatch"} /></td><td><span className={styles.stage}>{row.stage}</span></td><td><a className={styles.primaryAction} href={actionHref(row.action.href)}>{row.action.label}</a></td></tr>)}</tbody></table></div>
      <div className={styles.mobileCards}>{rows.map((row) => <article className={styles.card} key={row.id}><header><div><p className={styles.code}><bdi>{row.code}</bdi></p><h3>{row.customer}</h3><p>{row.supplier ?? (ar ? "المورد لم يُسجل بعد" : "Supplier not recorded yet")}</p></div><span className={styles.stage}>{row.stage}</span></header><dl><div><dt>{ar ? "الكمية المتعاقد عليها" : "Contracted quantity"}</dt><dd><bdi>{row.contractedQuantity}</bdi></dd></div><div><dt>{ar ? "شحنة المورد" : "Supplier shipment"}</dt><dd><ShipmentFact fact={row.supplierShipment} empty={ar ? "لم تُسجل" : "Not recorded"} dateLabel={ar ? "الوصول المتوقع" : "Expected arrival"} /></dd></div><div><dt>{ar ? "شحنة العميل" : "Customer shipment"}</dt><dd><ShipmentFact fact={row.customerShipment} empty={ar ? "لم تُسجل" : "Not recorded"} dateLabel={ar ? "الإرسال المخطط" : "Planned dispatch"} /></dd></div></dl><a className={styles.primaryAction} href={actionHref(row.action.href)}>{row.action.label}</a></article>)}</div>
      <footer>{ar ? "مصدر القائمة: بيانات المشاريع المحفوظة في هذا المتصفح فقط." : "Queue source: project data saved in this browser only."}</footer>
    </section>}
  </section>;
}
