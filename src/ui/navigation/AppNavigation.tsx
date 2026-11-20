"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { actionStateForOperation, navigationAccessForRole, permissionAwareQuery, type NavigationDestination } from "./permission-aware-access";
import { usePathname, useSearchParams } from "next/navigation";
import { ar } from "../i18n/ar";
import { en } from "../i18n/en";
import { AsyncState, type AsyncStateName } from "../components/AsyncState";
import { AccountMenu } from "./AccountMenu";
import { fetchCurrentSession, sendJson, signInUrl, type CurrentSession } from "../session-client";
import { GEAR, NEW_MENU, SECTIONS, allowed, sectionFor, sectionHref } from "./qb-navigation";

type Locale = "ar" | "en";
type IconName = "today" | "projects" | "approvals" | "products" | "shipments" | "finance" | "expenses" | "documents" | "reports" | "admin" | "settings" | "search" | "help" | "bell" | "menu" | "plus";
const allowedStates = new Set<AsyncStateName>(["loading", "empty", "error", "permission-denied", "offline", "stale-version"]);

function Icon({ name, size = 22 }: { readonly name: IconName; readonly size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></>,
    projects: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></>,
    approvals: <><path d="M6 3h12v18H6z"/><path d="m9 12 2 2 4-5"/></>,
    products: <><path d="M4 7 12 3l8 4-8 4z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4z"/><path d="M12 11v10"/></>,
    shipments: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    finance: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2M8 13h8"/></>,
    expenses: <><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
    documents: <><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></>,
    reports: <><path d="M4 20V10M10 20V5M16 20v-8M22 20V3"/></>,
    admin: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.6 2.6 0 1 1 4.1 2.1c-1 .7-1.7 1.2-1.7 2.4M12 17h.01"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
  };
  return <svg aria-hidden="true" className="orb-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function NavLink({ href, label, current, icon }: { readonly href: string; readonly label: string; readonly current: boolean; readonly icon: IconName }) {
  return <a className="orb-nav-link" href={href} aria-current={current ? "page" : undefined}>
    <Icon name={icon} /><span className="orb-nav-label">{label}</span>
  </a>;
}

export function AppNavigation({ children }: { readonly children: ReactNode }) {
  const search = useSearchParams();
  const pathname = usePathname();
  const locale: Locale = search.get("locale") === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  const copy = locale === "ar" ? ar : en;
  const isUnauthenticatedShell = pathname === "/sign-in";
  const requestedState = search.get("demoState") as AsyncStateName | null;
  const state = requestedState && allowedStates.has(requestedState) ? requestedState : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Roles come from the signed-in session on the server, never from the URL.
  const [session, setSession] = useState<CurrentSession | null>(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const roles: readonly string[] = session?.roles ?? [];
  const role = roles.includes("OWNER_ADMIN") ? "OWNER_ADMIN" : roles.length === 1 ? roles[0] : roles.length > 1 ? "MULTIPLE" : "PENDING";
  const suffix = permissionAwareQuery(locale, null);
  const canOpen = (destination: NavigationDestination) => roles.some((value) => navigationAccessForRole(value, destination));
  const operationState = (operationId: string) => {
    if (roles.length === 0) return actionStateForOperation("PENDING", operationId);
    const states = roles.map((value) => actionStateForOperation(value, operationId));
    return states.find((item) => item.allowed) ?? states.find((item) => item.visibility === "disabled") ?? states[0];
  };
  const label = (english: string, arabic: string) => locale === "ar" ? arabic : english;

  useEffect(() => {
    if (isUnauthenticatedShell) return;
    let cancelled = false;
    fetchCurrentSession().then((current) => {
      if (cancelled) return;
      if (!current) { window.location.assign(signInUrl(locale)); return; }
      setSession(current);
    }).catch(() => { /* keep the shell; API calls will surface their own errors */ });
    return () => { cancelled = true; };
  }, [isUnauthenticatedShell, locale, sessionVersion]);

  useEffect(() => {
    const applyPermissionState = () => {
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
      // Nothing to shape on the sign-in page, and nothing to shape until the session's roles are known.
      if (isUnauthenticatedShell || roles.length === 0) return;
      const controls = document.querySelectorAll<HTMLElement>("[data-operation-id]");
      for (const control of controls) {
        const state = operationState(control.dataset.operationId ?? "");
        control.hidden = state.visibility === "hidden";
        control.dataset.permissionState = state.allowed ? "allowed" : state.visibility;
        if (state.allowed) {
          control.removeAttribute("aria-disabled");
          for (const item of control.querySelectorAll<HTMLElement>("[data-permission-disabled=true]")) {
            if (item instanceof HTMLButtonElement || item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement) item.disabled = false;
            item.removeAttribute("data-permission-disabled");
          }
        } else if (state.visibility === "disabled") {
          control.setAttribute("aria-disabled", "true");
          const items = control.matches("button,input,select,textarea") ? [control] : [...control.querySelectorAll<HTMLElement>("button,input,select,textarea")];
          for (const item of items) {
            if ((item instanceof HTMLButtonElement || item instanceof HTMLInputElement || item instanceof HTMLSelectElement || item instanceof HTMLTextAreaElement) && !item.disabled) {
              item.disabled = true;
              item.dataset.permissionDisabled = "true";
            }
          }
        }
      }
    };
    applyPermissionState();
    const observer = new MutationObserver(applyPermissionState);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [direction, isUnauthenticatedShell, locale, pathname, role, roles.length]);

  function openMore(): void { dialogRef.current?.showModal(); }
  function closeMore(): void { dialogRef.current?.close(); }

  if (isUnauthenticatedShell) {
    return <>{children}</>;
  }

  const t = label;
  const located = sectionFor(pathname);
  const sectionLinks = SECTIONS.map((section) => {
    const href = sectionHref(section, canOpen);
    return href ? <NavLink key={section.key} href={`${href}${suffix}`} label={t(section.en, section.ar)} current={located?.section.key === section.key} icon={section.icon} /> : null;
  });
  const tabPages = located?.page && located.section.pages ? located.section.pages.filter((page) => allowed(page.access, canOpen)) : [];
  const sectionTabs = located && tabPages.length > 1
    ? <nav className="orb-section-tabs" aria-label={t(located.section.en, located.section.ar)}>
        {tabPages.map((page) => <a key={page.key} href={`${page.href}${suffix}`} aria-current={page.key === located.page?.key ? "page" : undefined}>{t(page.en, page.ar)}</a>)}
      </nav>
    : null;
  const gearGroups = GEAR.map((group) => ({ ...group, links: group.links.filter((link) => allowed(link.access, canOpen)) })).filter((group) => group.links.length);
  const newColumns = NEW_MENU.map((column) => ({ ...column, items: column.items.filter((item) => allowed(item.access, canOpen)) })).filter((column) => column.items.length);

  return <div className="orb-shell" dir={direction}>
    <style>{QB_STYLES}</style>
    <main className="orb-main">
      <span className="orb-reference orb-sr-only" data-orb-reference>ORB-R1</span>
      {sectionTabs}
      {state ? <AsyncState state={state} copy={copy} /> : children}
    </main>
    <header className="orb-top-bar">
      <button className="orb-menu-button" type="button" aria-label={label("Open navigation", "فتح التنقل")}><Icon name="menu" /></button>
      <a className="orb-brand" href={`/${suffix}`} aria-label={`ORB — ${copy.shellTitle}`}>
        <span className="orb-brand-mark" aria-hidden="true">O</span><span>ORB</span>
      </a>
      {newColumns.length > 0 && <details className="orb-new">
        <summary className="orb-new-button"><Icon name="plus" size={20} /><span>{t("New", "جديد")}</span></summary>
        <div className="orb-new-menu" role="menu" aria-label={t("Create new", "إنشاء جديد")}>
          {newColumns.map((column) => <section key={column.en}><h2>{t(column.en, column.ar)}</h2>
            {column.items.map((item) => <a key={item.key} role="menuitem" href={`${item.href}${suffix}`}>{t(item.en, item.ar)}</a>)}
          </section>)}
        </div>
      </details>}
      <label className="orb-global-search">
        <span className="orb-sr-only">{label("Search ORB", "البحث في ORB")}</span><Icon name="search" />
        <input type="search" placeholder={label("Search projects, invoices, customers…", "ابحث في المشاريع والفواتير والعملاء…")} />
      </label>
      <span className="orb-top-spacer" />
      <a className="orb-top-action orb-language" href={`${pathname}${permissionAwareQuery(locale === "ar" ? "en" : "ar", null)}`}>{locale === "ar" ? "EN" : "ع"}</a>
      {gearGroups.length > 0 && <details className="orb-gear">
        <summary className="orb-top-action" aria-label={t("Settings", "الإعدادات")}><Icon name="settings" /></summary>
        <div className="orb-gear-menu" role="menu" aria-label={t("Settings", "الإعدادات")}>
          {gearGroups.map((group) => <section key={group.en}><h2>{t(group.en, group.ar)}</h2>
            {group.links.map((link) => <a key={link.key} role="menuitem" href={`${link.href}${suffix}`}>{t(link.en, link.ar)}</a>)}
          </section>)}
        </div>
      </details>}
      {session ? <AccountMenu session={session} locale={locale} onPasswordChanged={() => setSessionVersion((value) => value + 1)} /> : <span className="orb-avatar" aria-hidden="true">…</span>}
    </header>
    <nav className="orb-rail" data-navigation="rail" data-variant="compact" aria-label={copy.primaryNavigation}>
      <div className="orb-nav-group">{sectionLinks}</div>
    </nav>
    <nav className="orb-bottom" data-navigation="bottom" aria-label={copy.primaryNavigation}>
      {sectionLinks.slice(0, 4)}
      <button className="orb-more" ref={moreRef} type="button" onClick={openMore}><Icon name="menu" /><span>{copy.more}</span></button>
    </nav>
    <dialog className="orb-dialog" ref={dialogRef} aria-labelledby="orb-more-title" onClose={() => moreRef.current?.focus()}>
      <h2 id="orb-more-title">{copy.menuTitle}</h2><p>{copy.shellTitle}</p>
      <nav className="orb-dialog-links" aria-label={label("More destinations", "وجهات إضافية")}>
        {SECTIONS.slice(4).map((section) => { const href = sectionHref(section, canOpen); return href ? <a key={section.key} href={`${href}${suffix}`}><Icon name={section.icon} />{t(section.en, section.ar)}</a> : null; })}
        {gearGroups.flatMap((group) => group.links).map((link) => <a key={`gear-${link.key}`} href={`${link.href}${suffix}`}><Icon name="settings" />{t(link.en, link.ar)}</a>)}
      </nav>
      <div className="orb-dialog-actions"><button className="orb-button-text" type="button" data-operation-id="signOutCurrentSession" onClick={async () => { try { await sendJson("/api/sessions/current", "DELETE"); } catch { /* cookies are cleared either way */ } window.location.assign(`/sign-in?locale=${locale}`); }}>{label("Sign out", "تسجيل الخروج")}</button><button className="orb-button-text" type="button" onClick={closeMore}>{label("Close", "إغلاق")}</button></div>
    </dialog>
  </div>;
}

const QB_STYLES = `
  .orb-new{position:relative}
  .orb-new-button{list-style:none;display:inline-flex;align-items:center;gap:6px;padding:8px 18px;border-radius:999px;background:var(--orb-color-primary);color:var(--orb-color-on-primary);font-weight:700;cursor:pointer;user-select:none}
  .orb-new-button::-webkit-details-marker,.orb-gear summary::-webkit-details-marker{display:none}
  .orb-gear summary{list-style:none;cursor:pointer;inline-size:40px;block-size:40px}
  .orb-new-menu,.orb-gear-menu{position:absolute;inset-block-start:calc(100% + 8px);z-index:60;background:var(--orb-color-surface-bright,#fff);border:1px solid var(--orb-color-outline-variant);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,.14);padding:16px;display:grid;gap:18px}
  .orb-new-menu{inset-inline-start:0;grid-template-columns:repeat(4,minmax(150px,1fr));min-inline-size:640px}
  .orb-gear{position:relative}.orb-gear-menu{inset-inline-end:0;grid-template-columns:repeat(3,minmax(160px,1fr));min-inline-size:520px}
  .orb-new-menu section,.orb-gear-menu section{display:grid;gap:2px;align-content:start}
  .orb-new-menu h2,.orb-gear-menu h2{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin:0 0 6px}
  .orb-new-menu a,.orb-gear-menu a{padding:7px 10px;border-radius:10px;color:inherit;text-decoration:none}
  .orb-new-menu a:hover,.orb-gear-menu a:hover{background:var(--orb-color-surface-container)}
  @media (max-width:760px){.orb-new-menu,.orb-gear-menu{position:fixed;inset-inline:8px;min-inline-size:0;grid-template-columns:repeat(2,1fr)}.orb-new-button span{display:none}}
  .orb-section-tabs{display:flex;gap:4px;flex-wrap:wrap;border-block-end:1px solid var(--orb-color-outline-variant);margin-block-end:16px}
  .orb-section-tabs a{padding:14px 14px;min-block-size:48px;box-sizing:border-box;display:inline-flex;align-items:center;color:#41464d;text-decoration:none;font-weight:600;border-block-end:3px solid transparent;margin-block-end:-1px}
  .orb-section-tabs a[aria-current=page]{color:var(--orb-color-primary);border-block-end-color:var(--orb-color-primary)}
`;
