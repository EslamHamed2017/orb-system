"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import { createBrowserProjectBackup, parseBrowserProjectBackup, type BrowserProjectBackup } from "../../../modules/projects/browser-project-backup";
import { parseProjectRecords, PROJECT_STORAGE_KEY } from "../../../modules/projects/daily-projects";
import styles from "./BrowserProjectBackup.module.css";

type State = "loading" | "ready" | "error";
type Message = "invalid" | "too-large" | "restored" | "export-error" | "stale" | "write-error" | null;
const MAX_BACKUP_BYTES = 5_000_000;

export function BrowserProjectBackupPage({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  const [state, setState] = useState<State>("loading");
  const [currentCount, setCurrentCount] = useState(0);
  const [preview, setPreview] = useState<BrowserProjectBackup | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const loadCount = () => { try { setCurrentCount(parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).length); setState("ready"); } catch { setState("error"); } };
  useEffect(loadCount, []);

  function clearPreview(): void { setPreview(null); setPreviewSnapshot(undefined); setAcknowledged(false); }
  function download(): void {
    try {
      const backup = createBrowserProjectBackup(localStorage.getItem(PROJECT_STORAGE_KEY), new Date().toISOString());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const href = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = href; link.download = `orb-projects-${backup.exportedAt.slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(href);
      setMessage(null);
    } catch { setMessage("export-error"); }
  }
  async function choose(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    clearPreview(); setMessage(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) { setMessage("too-large"); return; }
      const backup = parseBrowserProjectBackup(await file.text());
      setPreviewSnapshot(localStorage.getItem(PROJECT_STORAGE_KEY));
      setPreview(backup);
    } catch { setMessage("invalid"); }
    finally { event.target.value = ""; }
  }
  function restore(): void {
    if (!preview || !acknowledged || previewSnapshot === undefined) return;
    if (localStorage.getItem(PROJECT_STORAGE_KEY) !== previewSnapshot) { clearPreview(); setMessage("stale"); loadCount(); return; }
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(preview.projects));
      setCurrentCount(preview.projects.length); clearPreview(); setMessage("restored"); setState("ready");
    } catch { setMessage("write-error"); }
  }

  const projectNoun = (count: number) => ar ? (count === 1 ? "مشروع واحد" : `${count} مشاريع`) : `${count} project${count === 1 ? "" : "s"}`;
  const replaceLabel = preview?.projects.length === 0
    ? (ar ? "استبدال كل المشاريع بنسخة فارغة" : "Replace all projects with an empty backup")
    : (ar ? `استبدال كل المشاريع بـ ${projectNoun(preview?.projects.length ?? 0)}` : `Replace all projects with ${projectNoun(preview?.projects.length ?? 0)}`);
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="backup-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "إدارة بيانات هذا المتصفح" : "This browser’s data"}</p><h1 id="backup-title">{ar ? "نسخة احتياطية للمشاريع" : "Project backup"}</h1><p className={styles.subtitle}>{ar ? "نزّل نسخة من المشاريع المحفوظة هنا أو راجع نسخة سابقة واستعدها." : "Download projects saved here or review and restore a previous copy."}</p></div></header>
    <div className={styles.localNotice}><strong>{ar ? "نسخة محلية للتقييم وليست استعادة خادم" : "Local evaluation copy — not server recovery"}</strong><p>{ar ? "البيانات محفوظة في هذا المتصفح فقط، والملف غير مشفر. صفحة التقييم هذه لا تفرض صلاحيات دخول موثقة؛ أي شخص يستخدم ملف المتصفح هذا يمكنه الوصول إلى مشاريعه. لا تُرسل أي بيانات إلى ORB." : "Data is saved in this browser only, and the file is unencrypted. This evaluation page does not enforce authenticated roles; anyone using this browser profile can access its projects. Nothing is sent to ORB."}</p></div>
    {state === "loading" && <p role="status">{ar ? "جارٍ قراءة المشاريع…" : "Reading saved projects…"}</p>}
    {state === "error" && <section className={styles.alert} role="alert"><strong>{ar ? "تعذر قراءة المشاريع المحفوظة" : "Saved projects could not be read"}</strong><p>{ar ? "لن يتم تنزيل أو استبدال أي بيانات. أصلح بيانات المتصفح أولاً." : "No data will be downloaded or replaced. Repair the browser data first."}</p></section>}
    {state === "ready" && <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="download-title"><h2 id="download-title">{ar ? "تنزيل نسخة" : "Download a copy"}</h2><p className={styles.count}>{ar ? `${projectNoun(currentCount)} محفوظ في هذا المتصفح` : `${projectNoun(currentCount)} saved in this browser`}</p><p className={styles.muted}>{ar ? "يشمل الملف كل تفاصيل دورة العمل المحفوظة لهذه المشاريع." : "The file includes every saved lifecycle detail for these projects."}</p><button className={styles.button} type="button" onClick={download}>{ar ? "تنزيل النسخة الاحتياطية" : "Download backup"}</button></section>
      <section className={styles.card} aria-labelledby="restore-title"><h2 id="restore-title">{ar ? "استعادة نسخة" : "Restore a copy"}</h2><p className={styles.muted}>{ar ? "اختر ملف ORB. سنفحصه ونعرض ملخصه قبل استبدال كل مشاريع هذا المتصفح." : "Choose an ORB file. It is validated and summarized before every project in this browser is replaced."}</p><label className={styles.fileButton}>{ar ? "اختيار ملف النسخة" : "Choose backup file"}<input type="file" accept="application/json,.json" aria-label={ar ? "اختيار ملف النسخة" : "Choose backup file"} onChange={choose}/></label>
        {message === "invalid" && <div className={styles.alert} role="alert">{ar ? "هذا الملف ليس نسخة مشاريع ORB صالحة. لم تتغير مشاريعك الحالية." : "This file is not a valid ORB project backup. Your current projects were not changed."}</div>}
        {message === "too-large" && <div className={styles.alert} role="alert">{ar ? "حجم الملف أكبر من 5 ميجابايت. لم تتغير مشاريعك الحالية." : "This file is larger than 5 MB. Your current projects were not changed."}</div>}
        {preview && <div className={styles.preview}><h3>{ar ? "جاهز للمراجعة" : "Ready to review"}</h3><p className={styles.warning}>{ar ? `سيتم حذف ${projectNoun(currentCount)} حالي واستبداله بـ ${projectNoun(preview.projects.length)} من هذا الملف.` : `${currentCount} existing project${currentCount === 1 ? "" : "s"} will be deleted and replaced by ${projectNoun(preview.projects.length)} from this file.`}</p>{preview.projects.length ? <ul>{preview.projects.map((project) => <li key={project.id}><bdi>{project.code}</bdi> · {project.customer}</li>)}</ul> : <p>{ar ? "هذا الملف لا يحتوي على مشاريع." : "This file contains no projects."}</p>}<label className={styles.confirm}><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>{ar ? "أفهم أن هذا سيستبدل كل المشاريع المحفوظة حالياً في هذا المتصفح" : "I understand that this replaces every project currently saved in this browser"}</span></label><div className={styles.previewActions}><button className={styles.dangerButton} type="button" disabled={!acknowledged} onClick={restore}>{replaceLabel}</button><button className={styles.secondary} type="button" onClick={() => { clearPreview(); setMessage(null); }}>{ar ? "إلغاء" : "Cancel"}</button></div></div>}
      </section>
    </div>}
    {message === "export-error" && <div className={styles.alert} role="alert">{ar ? "تعذر إنشاء الملف. لم تتغير بياناتك." : "The file could not be created. Your data was not changed."}</div>}
    {message === "stale" && <div className={styles.alert} role="alert">{ar ? "تغيرت المشاريع بعد عرض المعاينة. لم يتم استبدال أي شيء؛ اختر النسخة مرة أخرى لمراجعتها مع أحدث بيانات." : "Projects changed after this preview. Nothing was replaced; choose the backup again to review it against the latest data."}</div>}
    {message === "write-error" && <div className={styles.alert} role="alert">{ar ? "تعذر حفظ النسخة في المتصفح. راجع المساحة المتاحة؛ لم نؤكد الاستعادة." : "The backup could not be saved in this browser. Check available storage; restore was not confirmed."}</div>}
    {message === "restored" && <div className={styles.success} role="status"><strong>{ar ? `تمت استعادة ${projectNoun(currentCount)} في هذا المتصفح.` : `${projectNoun(currentCount)} restored in this browser.`}</strong><div className={styles.actions}><a href={`/projects?locale=${locale}`}>{ar ? "فتح المشاريع" : "Open projects"}</a><a href={`/?locale=${locale}`}>{ar ? "فتح إجراءات اليوم" : "Open Today"}</a></div></div>}
  </section>;
}
