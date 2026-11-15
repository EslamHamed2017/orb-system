"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { actionStateForOperation, navigationAccessForRole, permissionAwareQuery, type NavigationDestination } from "./permission-aware-access";
import { usePathname, useSearchParams } from "next/navigation";
import { ar } from "../i18n/ar";
import { en } from "../i18n/en";
import { AsyncState, type AsyncStateName } from "../components/AsyncState";

type Locale = "ar" | "en";
type IconName = "today" | "projects" | "approvals" | "products" | "shipments" | "finance" | "documents" | "reports" | "admin" | "settings" | "search" | "help" | "bell" | "menu" | "plus";
const allowedStates = new Set<AsyncStateName>(["loading", "empty", "error", "permission-denied", "offline", "stale-version"]);

function Icon({ name, size = 22 }: { readonly name: IconName; readonly size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></>,
    projects: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></>,
    approvals: <><path d="M6 3h12v18H6z"/><path d="m9 12 2 2 4-5"/></>,
    products: <><path d="M4 7 12 3l8 4-8 4z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4z"/><path d="M12 11v10"/></>,
    shipments: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    finance: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2M8 13h8"/></>,
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
  const role = search.get("role");
  const suffix = permissionAwareQuery(locale, role);
  const canOpen = (destination: NavigationDestination) => navigationAccessForRole(role, destination);
  const label = (english: string, arabic: string) => locale === "ar" ? arabic : english;
  const specializedProjectSection = /\/(shipments|money|expenses|statements|profit)(?:\/|$)/.test(pathname);
  const projectsCurrent = pathname.startsWith("/projects") && !specializedProjectSection;

  useEffect(() => {
    const applyPermissionState = () => {
      document.documentElement.lang = locale;
      document.documentElement.dir = direction;
      const controls = document.querySelectorAll<HTMLElement>("[data-operation-id]");
      for (const control of controls) {
        const state = actionStateForOperation(role, control.dataset.operationId ?? "");
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
  }, [direction, locale, pathname, role]);

  function openMore(): void { dialogRef.current?.showModal(); }
  function closeMore(): void { dialogRef.current?.close(); }

  if (isUnauthenticatedShell) {
    return <>{children}</>;
  }

  const primaryLinks = <>
    {canOpen("today") && <NavLink href={`/${suffix}`} label={copy.today} current={pathname === "/"} icon="today" />}
    {canOpen("projects") && <NavLink href={`/projects${suffix}`} label={copy.projects} current={projectsCurrent} icon="projects" />}
    {canOpen("approvals") && <NavLink href={`/approvals${suffix}`} label={copy.approvals} current={pathname === "/approvals"} icon="approvals" />}
  </>;

  return <div className="orb-shell" dir={direction}>
    <main className="orb-main">
      <span className="orb-reference orb-sr-only" data-orb-reference>ORB-R1</span>
      {state ? <AsyncState state={state} copy={copy} /> : children}
    </main>
    <header className="orb-top-bar">
      <button className="orb-menu-button" type="button" aria-label={label("Open navigation", "فتح التنقل")}><Icon name="menu" /></button>
      <a className="orb-brand" href={`/${suffix}`} aria-label={`ORB — ${copy.shellTitle}`}>
        <span className="orb-brand-mark" aria-hidden="true">O</span><span>ORB Operations</span>
      </a>
      <label className="orb-global-search">
        <span className="orb-sr-only">{label("Search ORB", "البحث في ORB")}</span><Icon name="search" />
        <input type="search" placeholder={label("Search projects, shipments, invoices…", "ابحث في المشاريع والشحنات والفواتير…")} />
        <kbd>⌘ K</kbd>
      </label>
      <span className="orb-top-spacer" />
      <a className="orb-top-action orb-language" href={`${pathname}${permissionAwareQuery(locale === "ar" ? "en" : "ar", role)}`}>{locale === "ar" ? "EN" : "ع"}</a>
      <button className="orb-top-action" type="button" aria-label={label("Help", "المساعدة")}><Icon name="help" /></button>
      <button className="orb-top-action" type="button" aria-label={label("Notifications", "الإشعارات")}><Icon name="bell" /></button>
      <button className="orb-avatar" type="button" aria-label={label("Account: Eslam", "الحساب: إسلام")}>EB</button>
    </header>
    <nav className="orb-rail" data-navigation="rail" data-variant="compact" aria-label={copy.primaryNavigation}>
      <div className="orb-nav-group"><span className="orb-nav-heading">{label("Workspace", "مساحة العمل")}</span>{primaryLinks}
        {canOpen("products") && <NavLink href={`/masters/coffee${suffix}`} label={label("Products", "المنتجات")} current={pathname === "/masters/coffee" || pathname.startsWith("/products/")} icon="products" />}
        {canOpen("shipments") && <NavLink href={`/shipments${suffix}`} label={label("Shipments", "الشحنات")} current={pathname.includes("shipments")} icon="shipments" />}
        {canOpen("accounts") && <NavLink href={`/accounts${suffix}`} label={label("Accounts", "الحسابات")} current={pathname.startsWith("/accounts") || pathname.includes("money") || pathname.includes("expenses") || pathname.includes("statements")} icon="finance" />}
        {canOpen("documents") && <NavLink href={`/attachments${suffix}`} label={label("Attachments", "المرفقات")} current={pathname.startsWith("/attachments") || pathname.startsWith("/evidence")} icon="documents" />}
        {canOpen("reports") && <NavLink href={`/reports${suffix}`} label={label("Reports", "التقارير")} current={pathname.startsWith("/reports") || pathname.includes("profit")} icon="reports" />}
      </div>
      <div className="orb-nav-group orb-nav-bottom-group">{canOpen("settings") && <NavLink href={`/settings${suffix}`} label={label("Settings", "الإعدادات")} current={pathname.startsWith("/settings")} icon="settings" />}{canOpen("admin") && <NavLink href={`/admin/users${suffix}`} label={label("Admin", "الإدارة")} current={pathname.startsWith("/admin")} icon="admin" />}</div>
    </nav>
    <nav className="orb-bottom" data-navigation="bottom" aria-label={copy.primaryNavigation}>
      {primaryLinks}
      <button className="orb-more" ref={moreRef} type="button" onClick={openMore}><Icon name="menu" /><span>{copy.more}</span></button>
    </nav>
    <dialog className="orb-dialog" ref={dialogRef} aria-labelledby="orb-more-title" onClose={() => moreRef.current?.focus()}>
      <h2 id="orb-more-title">{copy.menuTitle}</h2><p>{copy.shellTitle}</p>
      <nav className="orb-dialog-links" aria-label={label("More destinations", "وجهات إضافية")}>
        {canOpen("products") && <a href={`/masters/coffee${suffix}`}><Icon name="products" />{label("Products", "المنتجات")}</a>}
        {canOpen("shipments") && <a href={`/shipments${suffix}`}><Icon name="shipments" />{label("Shipments", "الشحنات")}</a>}
        {canOpen("accounts") && <a href={`/accounts${suffix}`}><Icon name="finance" />{label("Accounts", "الحسابات")}</a>}
        {canOpen("documents") && <a href={`/attachments${suffix}`}><Icon name="documents" />{label("Attachments", "المرفقات")}</a>}
        {canOpen("reports") && <a href={`/reports${suffix}`}><Icon name="reports" />{label("Reports", "التقارير")}</a>}
        {canOpen("settings") && <a href={`/settings${suffix}`}><Icon name="settings" />{label("Settings", "الإعدادات")}</a>}
        {canOpen("admin") && <a href={`/admin/users${suffix}`}><Icon name="admin" />{label("Admin", "الإدارة")}</a>}
      </nav>
      <div className="orb-dialog-actions"><button className="orb-button-text" type="button" data-operation-id="signOutCurrentSession">{label("Sign out", "تسجيل الخروج")}</button><button className="orb-button-filled" type="button" onClick={closeMore}>{copy.close}</button></div>
    </dialog>
  </div>;
}
