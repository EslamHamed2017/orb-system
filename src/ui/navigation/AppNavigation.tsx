"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ar } from "../i18n/ar";
import { en } from "../i18n/en";
import { AsyncState, type AsyncStateName } from "../components/AsyncState";

type Locale = "ar" | "en";
type IconName = "today" | "projects" | "approvals" | "shipments" | "finance" | "documents" | "reports" | "admin" | "search" | "help" | "bell" | "menu" | "plus";
const allowedStates = new Set<AsyncStateName>(["loading", "empty", "error", "permission-denied", "offline", "stale-version"]);

function Icon({ name, size = 22 }: { readonly name: IconName; readonly size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></>,
    projects: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/></>,
    approvals: <><path d="M6 3h12v18H6z"/><path d="m9 12 2 2 4-5"/></>,
    shipments: <><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    finance: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M7 6V4h10v2M8 13h8"/></>,
    documents: <><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></>,
    reports: <><path d="M4 20V10M10 20V5M16 20v-8M22 20V3"/></>,
    admin: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></>,
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
  const suffix = `?locale=${locale}`;
  const label = (english: string, arabic: string) => locale === "ar" ? arabic : english;
  const specializedProjectSection = /\/(shipments|money|expenses|statements|profit)(?:\/|$)/.test(pathname);
  const projectsCurrent = pathname.startsWith("/projects") && !specializedProjectSection;

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [direction, locale]);

  function openMore(): void { dialogRef.current?.showModal(); }
  function closeMore(): void { dialogRef.current?.close(); }

  if (isUnauthenticatedShell) {
    return <>{children}</>;
  }

  const primaryLinks = <>
    <NavLink href={`/${suffix}`} label={copy.today} current={pathname === "/"} icon="today" />
    <NavLink href={`/projects${suffix}`} label={copy.projects} current={projectsCurrent} icon="projects" />
    <NavLink href={`/approvals${suffix}`} label={copy.approvals} current={pathname === "/approvals"} icon="approvals" />
  </>;

  return <div className="orb-shell">
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
      <a className="orb-top-action orb-language" href={`${pathname}?locale=${locale === "ar" ? "en" : "ar"}`}>{locale === "ar" ? "EN" : "ع"}</a>
      <button className="orb-top-action" type="button" aria-label={label("Help", "المساعدة")}><Icon name="help" /></button>
      <button className="orb-top-action" type="button" aria-label={label("Notifications", "الإشعارات")}><Icon name="bell" /></button>
      <button className="orb-avatar" type="button" aria-label={label("Account: Eslam", "الحساب: إسلام")}>EB</button>
    </header>
    <nav className="orb-rail" data-navigation="rail" data-variant="compact" aria-label={copy.primaryNavigation}>
      <div className="orb-nav-group"><span className="orb-nav-heading">{label("Workspace", "مساحة العمل")}</span>{primaryLinks}
        <NavLink href={`/projects/demo/shipments${suffix}`} label={label("Shipments", "الشحنات")} current={pathname.includes("shipments")} icon="shipments" />
        <NavLink href={`/projects/demo/money${suffix}`} label={label("Finance", "المالية")} current={pathname.includes("money") || pathname.includes("expenses") || pathname.includes("statements")} icon="finance" />
        <NavLink href={`/documents/demo${suffix}`} label={label("Documents", "المستندات")} current={pathname.startsWith("/documents")} icon="documents" />
        <NavLink href={`/projects/demo/profit${suffix}`} label={label("Reports", "التقارير")} current={pathname.includes("profit")} icon="reports" />
      </div>
      <div className="orb-nav-group orb-nav-bottom-group"><NavLink href={`/admin/users${suffix}`} label={label("Admin", "الإدارة")} current={pathname.startsWith("/admin")} icon="admin" /></div>
    </nav>
    <nav className="orb-bottom" data-navigation="bottom" aria-label={copy.primaryNavigation}>
      {primaryLinks}
      <button className="orb-more" ref={moreRef} type="button" onClick={openMore}><Icon name="menu" /><span>{copy.more}</span></button>
    </nav>
    <dialog className="orb-dialog" ref={dialogRef} aria-labelledby="orb-more-title" onClose={() => moreRef.current?.focus()}>
      <h2 id="orb-more-title">{copy.menuTitle}</h2><p>{copy.shellTitle}</p>
      <nav className="orb-dialog-links" aria-label={label("More destinations", "وجهات إضافية")}>
        <a href={`/projects/demo/shipments${suffix}`}><Icon name="shipments" />{label("Shipments", "الشحنات")}</a>
        <a href={`/projects/demo/money${suffix}`}><Icon name="finance" />{label("Finance", "المالية")}</a>
        <a href={`/documents/demo${suffix}`}><Icon name="documents" />{label("Documents", "المستندات")}</a>
      </nav>
      <div className="orb-dialog-actions"><button className="orb-button-text" type="button" data-operation-id="signOutCurrentSession">{label("Sign out", "تسجيل الخروج")}</button><button className="orb-button-filled" type="button" onClick={closeMore}>{copy.close}</button></div>
    </dialog>
  </div>;
}
