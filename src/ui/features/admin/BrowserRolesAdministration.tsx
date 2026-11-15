"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BROWSER_ROLES_STORAGE_KEY, createBrowserRole, parseBrowserRoles, replaceBrowserRolePermissions, type BrowserRole } from "../../../modules/access/browser-roles";
import { PERMISSION_CATALOG } from "./role-permission-fixtures";
import styles from "./BrowserRolesAdministration.module.css";

type LoadState = "loading" | "ready" | "error";
type Message = "created" | "saved" | "duplicate" | "invalid" | "write" | "stale" | "unsaved" | "lock" | null;
const permissionCodes = PERMISSION_CATALOG.map(({ code }) => code);

export function BrowserRolesAdministration({ locale, canManage = true }: Readonly<{ locale: "en" | "ar"; canManage?: boolean }>) {
  const ar = locale === "ar";
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [roles, setRoles] = useState<readonly BrowserRole[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<Message>(null);
  const permissionCount = (count: number) => ar ? (count === 1 ? "صلاحية واحدة" : `${count} صلاحيات`) : `${count} permission${count === 1 ? "" : "s"}`;

  const load = () => { try { const loaded = parseBrowserRoles(localStorage.getItem(BROWSER_ROLES_STORAGE_KEY), permissionCodes); setRoles(loaded); setSelectedId((current) => current && loaded.some(({ id }) => id === current) ? current : loaded[0]?.id ?? null); setLoadState("ready"); } catch { setLoadState("error"); } };
  useEffect(load, []);
  const selected = useMemo(() => roles.find(({ id }) => id === selectedId) ?? null, [roles, selectedId]);
  useEffect(() => setDraftPermissions(selected?.permissionCodes ?? []), [selected]);
  const dirty = Boolean(selected && (selected.permissionCodes.length !== draftPermissions.length || selected.permissionCodes.some((code) => !draftPermissions.includes(code))));

  function persist(next: readonly BrowserRole[]): boolean {
    try { localStorage.setItem(BROWSER_ROLES_STORAGE_KEY, JSON.stringify(next)); setRoles(next); return true; }
    catch { setMessage("write"); return false; }
  }
  async function withRolesLock<T>(work: () => T | Promise<T>): Promise<T> {
    if (!("locks" in navigator)) throw new Error("LOCK_UNAVAILABLE");
    return navigator.locks.request(BROWSER_ROLES_STORAGE_KEY, { mode: "exclusive" }, work);
  }
  async function create(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (dirty) { setMessage("unsaved"); return; }
    setMessage(null);
    const form = new FormData(formElement);
    try {
      await withRolesLock(() => {
      const latest = parseBrowserRoles(localStorage.getItem(BROWSER_ROLES_STORAGE_KEY), permissionCodes);
      const next = createBrowserRole(latest, { code: String(form.get("code") ?? ""), nameEn: String(form.get("nameEn") ?? ""), nameAr: String(form.get("nameAr") ?? ""), descriptionEn: String(form.get("descriptionEn") ?? ""), descriptionAr: String(form.get("descriptionAr") ?? "") }, permissionCodes, crypto.randomUUID(), new Date().toISOString());
      const created = next.find(({ code }) => code === String(form.get("code")).trim().toUpperCase())!;
      if (persist(next)) { setSelectedId(created.id); setMessage("created"); formElement.reset(); }
      });
    } catch (error) { setMessage(error instanceof Error && error.message === "DUPLICATE_ROLE" ? "duplicate" : error instanceof Error && error.message === "LOCK_UNAVAILABLE" ? "lock" : "invalid"); }
  }
  async function savePermissions(): Promise<void> {
    if (!selected) return; setMessage(null);
    try {
      await withRolesLock(() => {
      const latest = parseBrowserRoles(localStorage.getItem(BROWSER_ROLES_STORAGE_KEY), permissionCodes);
      const next = replaceBrowserRolePermissions(latest, selected.id, selected.updatedAt, draftPermissions, permissionCodes, new Date().toISOString());
      if (persist(next)) { setSelectedId(selected.id); setMessage("saved"); }
      });
    } catch (error) { setMessage(error instanceof Error && error.message === "STALE_ROLE" ? "stale" : error instanceof Error && error.message === "LOCK_UNAVAILABLE" ? "lock" : "invalid"); load(); }
  }
  function toggle(code: string): void { setDraftPermissions((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code].sort()); setMessage(null); }
  function selectRole(roleId: string): void { if (dirty && roleId !== selectedId) { setMessage("unsaved"); return; } setMessage(null); setSelectedId(roleId); }

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="roles-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "إدارة الوصول" : "Access administration"}</p><h1 id="roles-title">{ar ? "الأدوار والصلاحيات" : "Roles and permissions"}</h1><p>{ar ? "أنشئ دوراً واضحاً ثم اختر أقل الصلاحيات اللازمة لعمله." : "Create a clear role, then choose the minimum permissions it needs."}</p></div>{!canManage && <span className={styles.chip}>{ar ? "عرض فقط" : "View only"}</span>}</header>
    <aside className={styles.notice}><strong>{ar ? "إعداد محلي للتقييم — لا يفرض صلاحيات النظام" : "Local evaluation setup — not enforced access"}</strong><p>{ar ? "الأدوار التي تنشئها محفوظة في هذا المتصفح فقط. لا ترتبط بالمستخدمين ولا تحمي بيانات الخادم، ولا تُرسل أي بيانات إلى ORB." : "Roles created here are saved only in this browser. They are not assigned to users, do not protect server data, and nothing is sent to ORB."}</p></aside>
    {loadState === "loading" && <p role="status">{ar ? "جارٍ قراءة الأدوار المحفوظة…" : "Reading saved roles…"}</p>}
    {loadState === "error" && <div className={styles.alert} role="alert"><strong>{ar ? "تعذر قراءة الأدوار المحفوظة" : "Saved roles could not be read"}</strong><p>{ar ? "لن نستبدل بيانات المتصفح التالفة. امسح مفتاح أدوار ORB أو استعد نسخة سليمة قبل المتابعة." : "Corrupt browser data will not be overwritten. Clear the ORB roles key or restore a valid copy before continuing."}</p></div>}
    {loadState === "ready" && <>
      <section className={styles.systemCard} aria-labelledby="owner-role-title"><div><span className={styles.chip}>{ar ? "دور نظام محمي" : "Protected system role"}</span><h2 id="owner-role-title">{ar ? "مدير المالك" : "Owner administrator"}</h2><p>{ar ? "يحتفظ بكل صلاحيات الدليل. لا يمكن تعديله في صفحة التقييم." : "Keeps every catalog permission and cannot be edited on this evaluation page."}</p></div><strong>{permissionCount(permissionCodes.length)}</strong></section>
      <div className={styles.workspace}>
        <section className={styles.roleList} aria-labelledby="saved-roles-title"><div className={styles.sectionHeader}><div><h2 id="saved-roles-title">{ar ? "الأدوار المحفوظة هنا" : "Roles saved here"}</h2><p>{ar ? `${roles.length} دور قابل للتهيئة` : `${roles.length} configurable role${roles.length === 1 ? "" : "s"}`}</p></div></div>
          {roles.length === 0 ? <div className={styles.empty}><strong>{ar ? "لا توجد أدوار مهيأة بعد" : "No configurable roles yet"}</strong><p>{ar ? "أنشئ أول دور بالأسفل، ثم امنحه الصلاحيات المطلوبة." : "Create the first role below, then grant only the permissions it needs."}</p></div> : <div className={styles.roleButtons}>{roles.map((role) => <button type="button" key={role.id} className={role.id === selectedId ? styles.selectedRole : styles.roleButton} onClick={() => selectRole(role.id)} aria-pressed={role.id === selectedId}><strong>{ar ? role.nameAr : role.nameEn}</strong><bdi>{role.code}</bdi><small>{permissionCount(role.permissionCodes.length)}</small></button>)}</div>}
        </section>
        <section className={styles.editor} aria-labelledby="permission-editor-title"><h2 id="permission-editor-title">{ar ? "صلاحيات الدور" : "Role permissions"}</h2>
          {!selected ? <div className={styles.empty}><p>{ar ? "اختر دوراً محفوظاً أو أنشئ دوراً لبدء إعداد الصلاحيات." : "Select a saved role or create one to configure permissions."}</p></div> : <><div className={styles.selectedSummary}><div><strong>{ar ? selected.nameAr : selected.nameEn}</strong><p>{ar ? selected.descriptionAr : selected.descriptionEn}</p></div><bdi>{selected.code}</bdi></div><div className={styles.permissions}>{PERMISSION_CATALOG.map((permission) => <label className={styles.permission} key={permission.code}><input type="checkbox" checked={draftPermissions.includes(permission.code)} disabled={!canManage} onChange={() => toggle(permission.code)}/><span><strong>{ar ? permission.nameAr : permission.nameEn}</strong><small>{ar ? permission.descriptionAr : permission.descriptionEn}</small></span></label>)}</div>{canManage && <div className={styles.editorActions}><button className={styles.primary} type="button" onClick={savePermissions} disabled={!dirty}>{ar ? "حفظ صلاحيات هذا الدور" : "Save this role’s permissions"}</button>{dirty && <button className={styles.secondary} type="button" onClick={() => { setDraftPermissions(selected.permissionCodes); setMessage(null); }}>{ar ? "تجاهل التغييرات" : "Discard changes"}</button>}</div>}</>}
        </section>
      </div>
      {canManage && <section className={styles.createCard} aria-labelledby="create-role-title"><div><h2 id="create-role-title">{ar ? "إنشاء دور" : "Create a role"}</h2><p>{ar ? "يبدأ الدور بلا صلاحيات. يمكنك اختيارها بعد الحفظ." : "The role starts with no permissions. Choose them after saving."}</p></div><form onSubmit={create} className={styles.form}><label>{ar ? "رمز الدور" : "Role code"}<input name="code" required dir="ltr" pattern="[A-Za-z][A-Za-z0-9_]{2,49}" placeholder="CONTRACT_REVIEWER"/><small>{ar ? "حروف وأرقام وشرطة سفلية؛ سيُحفظ الرمز بأحرف إنجليزية كبيرة." : "Letters, numbers, and underscores; saved in uppercase."}</small></label><label>{ar ? "الاسم بالإنجليزية" : "English name"}<input name="nameEn" required dir="ltr" maxLength={100}/></label><label>{ar ? "الاسم بالعربية" : "Arabic name"}<input name="nameAr" required dir="rtl" maxLength={100}/></label><label>{ar ? "الوصف بالإنجليزية" : "English description"}<textarea name="descriptionEn" required dir="ltr" maxLength={240}/></label><label>{ar ? "الوصف بالعربية" : "Arabic description"}<textarea name="descriptionAr" required dir="rtl" maxLength={240}/></label><button className={styles.primary} type="submit">{ar ? "حفظ الدور" : "Save role"}</button></form></section>}
      {message === "created" && <div className={styles.success} role="status">{ar ? "تم حفظ الدور في هذا المتصفح. اختر صلاحياته الآن." : "Role saved in this browser. Choose its permissions now."}</div>}
      {message === "saved" && <div className={styles.success} role="status">{ar ? "تم حفظ صلاحيات الدور في هذا المتصفح." : "Role permissions saved in this browser."}</div>}
      {(message === "duplicate" || message === "invalid" || message === "write" || message === "stale" || message === "unsaved" || message === "lock") && <div className={styles.alert} role="alert">{message === "duplicate" ? (ar ? "رمز الدور مستخدم بالفعل." : "That role code is already used.") : message === "write" ? (ar ? "تعذر الحفظ في المتصفح. لم نؤكد التغيير." : "This browser could not save the change. It was not confirmed.") : message === "unsaved" ? (ar ? "احفظ تغييرات الصلاحيات أو تجاهلها قبل الانتقال إلى دور آخر." : "Save or discard permission changes before switching roles.") : message === "lock" ? (ar ? "لا يدعم هذا المتصفح قفل التعديل الآمن. لم نحفظ التغيير حتى لا نستبدل أدواراً من علامة تبويب أخرى." : "This browser does not support safe edit locking. The change was not saved to avoid replacing roles from another tab.") : message === "stale" ? (ar ? "تغير الدور في علامة تبويب أخرى. أعدنا تحميل أحدث نسخة؛ راجعها ثم احفظ مجدداً." : "The role changed in another tab. The latest copy was reloaded; review it before saving again.") : (ar ? "راجع حقول الدور والصلاحيات ثم حاول مجدداً." : "Review the role fields and permissions, then try again.")}</div>}
    </>}
  </section>;
}
