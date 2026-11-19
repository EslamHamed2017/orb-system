"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "./EnterpriseUx";
import { SessionList, type SessionListItem } from "./SessionList";
import { filterUsers, summarizeUsers, type UserDirectoryRecord, type UserLocaleFilter, type UserStatusFilter } from "./user-directory";
import { problemOf, sendJson, type ApiProblem } from "../../session-client";

type Locale = "en" | "ar";
type RoleCode = "OWNER_ADMIN" | "OPERATIONS" | "FINANCE_VIEWER";
const ROLE_CODES: readonly RoleCode[] = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"];
const ROLE_LABELS: Record<RoleCode, [string, string]> = {
  OWNER_ADMIN: ["Owner administrator", "المالك / مدير النظام"],
  OPERATIONS: ["Operations", "العمليات"],
  FINANCE_VIEWER: ["Finance", "المالية"],
};

interface ApiUser {
  readonly id: string;
  readonly login: string | null;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly locale: "en" | "ar";
  readonly status: "ACTIVE" | "SUSPENDED";
  readonly roleCodes: readonly RoleCode[];
  readonly activeSessionCount: number;
  readonly lastActiveAt: string | null;
  readonly mustChangePassword: boolean;
}

type SessionRow = SessionListItem;

interface UsersManagementPageProps {
  readonly locale: Locale;
  readonly query?: string;
  readonly status?: UserStatusFilter;
  readonly userLocale?: UserLocaleFilter;
  readonly role?: string | "ALL";
}

const toDirectory = (user: ApiUser): UserDirectoryRecord => ({ ...user, authSubject: user.login ?? "" });
const formatDate = (value: string, ar: boolean) => new Date(value).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

export function UsersManagementPage({ locale, query = "", status = "ALL", userLocale = "ALL", role = "ALL" }: UsersManagementPageProps) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [users, setUsers] = useState<readonly ApiUser[] | null>(null);
  const [loadError, setLoadError] = useState<ApiProblem | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<Record<string, readonly SessionRow[]>>({});

  const load = useCallback(async () => {
    const response = await fetch("/api/users", { cache: "no-store" });
    if (!response.ok) { setLoadError(await problemOf(response)); return; }
    setLoadError(null);
    setUsers((await response.json() as { items: ApiUser[] }).items);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const directory = useMemo(() => (users ?? []).map(toDirectory), [users]);
  const summary = summarizeUsers(directory);
  const visible = filterUsers(directory, { query, status, locale: userLocale, role });
  const byId = new Map((users ?? []).map((user) => [user.id, user]));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      setNotice({ tone: "success", text: success });
      await load();
      return true;
    } catch (error) {
      const problem = error as ApiProblem;
      setNotice({ tone: "error", text: problem.detail ?? t(`Action failed (${problem.code ?? "error"}).`, `تعذر تنفيذ العملية (${problem.code ?? "خطأ"}).`) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function selectedRoles(data: FormData): RoleCode[] {
    return ROLE_CODES.filter((code) => data.getAll("roleCodes").includes(code));
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const ok = await run(() => sendJson("/api/users", "POST", {
      login: data.get("login"), nameEn: data.get("nameEn"), nameAr: data.get("nameAr"), locale: data.get("locale"),
      roleCodes: selectedRoles(data), password: data.get("password"),
    }), t("User created. Share the temporary password with them privately; they must change it at first sign-in.", "تم إنشاء المستخدم. أرسل له كلمة المرور المؤقتة بشكل خاص، وسيُطلب منه تغييرها عند أول دخول."));
    if (ok) form.reset();
  }

  async function updateUser(event: FormEvent<HTMLFormElement>, user: ApiUser) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(() => sendJson(`/api/users/${user.id}`, "PATCH", { nameEn: data.get("nameEn"), nameAr: data.get("nameAr"), locale: data.get("locale"), status: data.get("status") }),
      t("User saved.", "تم حفظ المستخدم."));
  }

  async function saveRoles(event: FormEvent<HTMLFormElement>, user: ApiUser) {
    event.preventDefault();
    await run(() => sendJson(`/api/users/${user.id}/roles`, "PUT", { roleCodes: selectedRoles(new FormData(event.currentTarget)) }),
      t("Roles saved. The user must sign in again.", "تم حفظ الأدوار. يجب على المستخدم تسجيل الدخول من جديد."));
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>, user: ApiUser) {
    event.preventDefault();
    const form = event.currentTarget;
    const ok = await run(() => sendJson(`/api/users/${user.id}/password`, "POST", { password: new FormData(form).get("password"), mustChangePassword: true }),
      t("Temporary password set. All of this user's sessions were ended.", "تم تعيين كلمة مرور مؤقتة وإنهاء كل جلسات المستخدم."));
    if (ok) form.reset();
  }

  async function loadSessions(user: ApiUser) {
    const response = await fetch(`/api/users/${user.id}/sessions`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json() as { items: SessionRow[] };
    setSessions((current) => ({ ...current, [user.id]: body.items }));
  }

  async function revoke(user: ApiUser, sessionId: string) {
    const ok = await run(() => sendJson(`/api/users/${user.id}/sessions/${sessionId}/revoke`, "POST", {}), t("Session ended.", "تم إنهاء الجلسة."));
    if (ok) await loadSessions(user);
  }

  const roleBoxes = (selected: readonly RoleCode[]) => <fieldset className="role-boxes">
    <legend>{t("Roles", "الأدوار")}</legend>
    {ROLE_CODES.map((code) => <label key={code}><input type="checkbox" name="roleCodes" value={code} defaultChecked={selected.includes(code)} />{ROLE_LABELS[code][ar ? 1 : 0]}</label>)}
  </fieldset>;

  return <section aria-labelledby="users-title" dir={ar ? "rtl" : "ltr"} className="orb-erp orb-users">
    <EnterpriseStyles/><style>{`
      .orb-users .users-toolbar{grid-template-columns:minmax(220px,2fr) repeat(3,minmax(140px,1fr)) auto}
      .orb-users .table-wrap{overflow-x:auto;margin-block-start:16px}.orb-users table{inline-size:100%;border-collapse:collapse}.orb-users th,.orb-users td{text-align:start;padding:13px 12px;border-block-end:1px solid var(--orb-color-outline-variant)}
      .orb-users th{color:var(--orb-color-on-surface-variant);font-size:.75rem}.orb-users .identity{display:grid;gap:3px}.orb-users .identity span{color:var(--orb-color-on-surface-variant);font-size:.82rem}.orb-users .roles{display:flex;gap:6px;flex-wrap:wrap}
      .orb-users .status{display:inline-flex;border-radius:999px;padding:5px 9px;font-size:.75rem;font-weight:800;background:var(--orb-color-primary-container);color:var(--orb-color-on-primary-container)}.orb-users .status[data-status=SUSPENDED]{background:var(--orb-color-error-container);color:var(--orb-color-error)}
      .orb-users details{border:1px solid var(--orb-color-outline-variant);border-radius:14px;padding:14px}.orb-users details+details{margin-block-start:12px}.orb-users summary{cursor:pointer;font-weight:800}
      .orb-users .user-forms{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-block-start:12px}.orb-users .user-forms form{display:grid;gap:8px;align-content:start}
      .orb-users .role-boxes{border:0;padding:0;margin:0;display:grid;gap:6px}.orb-users .role-boxes label{display:flex;gap:8px;align-items:center;font-weight:500}
      .orb-users .notice{padding:12px 14px;border-radius:12px;margin-block:12px}.orb-users .notice[data-tone=error]{background:var(--orb-color-error-container)}.orb-users .notice[data-tone=success]{background:var(--orb-color-primary-container)}
      .orb-users .empty{padding:30px;text-align:center}
      @media(max-width:1050px){.orb-users .users-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.orb-users .users-toolbar{grid-template-columns:1fr}.orb-users th:nth-child(3),.orb-users td:nth-child(3),.orb-users th:nth-child(5),.orb-users td:nth-child(5){display:none}}
    `}</style>
    <ErpPageHeader titleId="users-title" eyebrow={t("Access administration", "إدارة الوصول")} title={t("Users and access", "المستخدمون والوصول")}
      description={t("Create users, set temporary passwords, assign roles, and end sessions. Every change is recorded in the access audit trail.", "إنشاء المستخدمين وتعيين كلمات مرور مؤقتة وتوزيع الأدوار وإنهاء الجلسات. كل تغيير يُسجل في سجل تدقيق الوصول.")}
      meta={users ? <a className="orb-button-filled" href="#create-user" data-operation-id="createUser">{t("Add user", "إضافة مستخدم")}</a> : undefined}/>

    {loadError && <div className="notice" data-tone="error" role="alert">
      {loadError.status === 403 ? t("Only an owner administrator can manage users.", "إدارة المستخدمين متاحة للمالك / مدير النظام فقط.")
        : loadError.status === 401 ? t("Your session ended. Sign in again.", "انتهت جلستك. سجّل الدخول مرة أخرى.")
        : t("Users could not be loaded. Try again.", "تعذر تحميل المستخدمين. حاول مرة أخرى.")}
    </div>}
    {!users && !loadError && <p role="status" aria-busy="true">{t("Loading users…", "جارٍ تحميل المستخدمين…")}</p>}
    {notice && <div className="notice" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</div>}

    {users && <>
      <div className="orb-summary-grid" aria-label={t("User summary", "ملخص المستخدمين")}>
        <Kpi label={t("All users", "كل المستخدمين")} value={summary.total}/><Kpi label={t("Active users", "المستخدمون النشطون")} value={summary.active}/>
        <Kpi label={t("Suspended", "موقوفون")} value={summary.suspended}/><Kpi label={t("Active sessions", "الجلسات النشطة")} value={summary.activeSessions}/>
      </div>

      <section role="region" aria-labelledby="directory-title"><header className="orb-section-title"><div><h2 id="directory-title">{t("User directory", "دليل المستخدمين")}</h2><p className="orb-muted">{ar ? `${visible.length} مستخدم مطابق` : `${visible.length} matching users`}</p></div></header>
        <form className="users-toolbar" method="get"><input type="hidden" name="locale" value={locale}/>
          <label>{t("Search", "بحث")}<input type="search" name="q" defaultValue={query} placeholder={t("Name, login, or role", "الاسم أو اسم الدخول أو الدور")}/></label>
          <label>{t("Status", "الحالة")}<select name="status" defaultValue={status}><option value="ALL">{t("All statuses", "كل الحالات")}</option><option value="ACTIVE">{t("Active", "نشط")}</option><option value="SUSPENDED">{t("Suspended", "موقوف")}</option></select></label>
          <label>{t("User language", "لغة المستخدم")}<select name="userLocale" defaultValue={userLocale}><option value="ALL">{t("All languages", "كل اللغات")}</option><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label>{t("Role", "الدور")}<select name="assignedRole" defaultValue={role}><option value="ALL">{t("All roles", "كل الأدوار")}</option>{ROLE_CODES.map((code) => <option key={code} value={code}>{ROLE_LABELS[code][ar ? 1 : 0]}</option>)}</select></label>
          <button type="submit">{t("Apply", "تطبيق")}</button>
        </form>
        {visible.length ? <div className="table-wrap"><table><thead><tr><th>{t("User", "المستخدم")}</th><th>{t("Roles", "الأدوار")}</th><th>{t("Language", "اللغة")}</th><th>{t("Status", "الحالة")}</th><th>{t("Last sign-in", "آخر دخول")}</th><th><span className="orb-sr-only">{t("Actions", "إجراءات")}</span></th></tr></thead>
          <tbody>{visible.map((row) => { const user = byId.get(row.id)!; return <tr key={user.id}>
            <td><div className="identity"><strong>{ar ? user.nameAr : user.nameEn}</strong><span>{ar ? user.nameEn : user.nameAr}</span><bdi>{user.login}</bdi>{user.mustChangePassword && <span>{t("Temporary password", "كلمة مرور مؤقتة")}</span>}</div></td>
            <td><div className="roles">{user.roleCodes.map((code) => <span className="orb-chip" key={code}>{ROLE_LABELS[code][ar ? 1 : 0]}</span>)}</div></td>
            <td>{user.locale === "ar" ? "العربية" : "English"}</td>
            <td><span className="status" data-status={user.status}>{user.status === "ACTIVE" ? t("Active", "نشط") : t("Suspended", "موقوف")}</span></td>
            <td>{user.lastActiveAt ? <time dateTime={user.lastActiveAt}>{formatDate(user.lastActiveAt, ar)}</time> : t("Never", "لم يسجل")}</td>
            <td><a href={`#manage-${user.id}`} data-operation-id="updateUser">{t("Manage", "إدارة")}</a></td>
          </tr>; })}</tbody></table></div>
          : <div className="empty" role="status"><h3>{t("No matching users", "لا يوجد مستخدمون مطابقون")}</h3><a href={`/admin/users?locale=${locale}`}>{t("Clear filters", "مسح المرشحات")}</a></div>}
      </section>

      <section role="region" aria-labelledby="management-title"><h2 id="management-title">{t("Manage user accounts", "إدارة حسابات المستخدمين")}</h2>
        <details id="create-user" open={users.length <= 1}><summary>{t("Create user", "إنشاء مستخدم")}</summary>
          <form className="user-forms" onSubmit={createUser}>
            <div style={{ display: "grid", gap: 8 }}>
              <label>{t("Login (email or user name)", "اسم الدخول (بريد أو اسم مستخدم)")}<input name="login" required dir="ltr" autoComplete="off"/></label>
              <label>{t("English name", "الاسم بالإنجليزية")}<input name="nameEn" required dir="ltr"/></label>
              <label>{t("Arabic name", "الاسم بالعربية")}<input name="nameAr" required dir="rtl"/></label>
              <label>{t("Default language", "اللغة الافتراضية")}<select name="locale" defaultValue={locale}><option value="en">English</option><option value="ar">العربية</option></select></label>
            </div>
            <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
              {roleBoxes(["OPERATIONS"])}
              <label>{t("Temporary password (10+ characters, letters and digits)", "كلمة مرور مؤقتة (10 أحرف على الأقل، حروف وأرقام)")}<input name="password" type="password" required minLength={10} autoComplete="new-password"/></label>
              <button type="submit" disabled={busy} data-operation-id="createUser">{t("Create user", "إنشاء المستخدم")}</button>
            </div>
          </form>
        </details>
        {users.map((user) => <details id={`manage-${user.id}`} key={user.id} onToggle={(event) => { if ((event.currentTarget as HTMLDetailsElement).open) void loadSessions(user); }}>
          <summary>{ar ? `إدارة ${user.nameAr}` : `Manage ${user.nameEn}`} · <bdi>{user.login}</bdi></summary>
          <div className="user-forms">
            <form onSubmit={(event) => updateUser(event, user)}>
              <strong>{t("Identity and status", "الهوية والحالة")}</strong>
              <label>{t("English name", "الاسم بالإنجليزية")}<input name="nameEn" defaultValue={user.nameEn} required/></label>
              <label>{t("Arabic name", "الاسم بالعربية")}<input name="nameAr" defaultValue={user.nameAr} required dir="rtl"/></label>
              <label>{t("Language", "اللغة")}<select name="locale" defaultValue={user.locale}><option value="en">English</option><option value="ar">العربية</option></select></label>
              <label>{t("Status", "الحالة")}<select name="status" defaultValue={user.status}><option value="ACTIVE">{t("Active", "نشط")}</option><option value="SUSPENDED">{t("Suspended (ends all sessions)", "موقوف (ينهي كل الجلسات)")}</option></select></label>
              <button type="submit" disabled={busy} data-operation-id="updateUser">{t("Save", "حفظ")}</button>
            </form>
            <form onSubmit={(event) => saveRoles(event, user)}>
              {roleBoxes(user.roleCodes)}
              <button type="submit" disabled={busy} data-operation-id="assignFixedPilotRoles">{t("Save roles", "حفظ الأدوار")}</button>
            </form>
            <form onSubmit={(event) => resetPassword(event, user)}>
              <strong>{t("Reset password", "إعادة تعيين كلمة المرور")}</strong>
              <label>{t("New temporary password", "كلمة مرور مؤقتة جديدة")}<input name="password" type="password" required minLength={10} autoComplete="new-password"/></label>
              <button type="submit" disabled={busy} data-operation-id="updateUser">{t("Set temporary password", "تعيين كلمة مرور مؤقتة")}</button>
            </form>
            <SessionList locale={locale} sessions={sessions[user.id] ?? []} busy={busy} onRevoke={(sessionId) => void revoke(user, sessionId)}/>
          </div>
        </details>)}
      </section>
    </>}
  </section>;
}
