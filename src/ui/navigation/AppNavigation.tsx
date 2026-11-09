"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ar } from "../i18n/ar";
import { en } from "../i18n/en";
import { AsyncState, type AsyncStateName } from "../components/AsyncState";

type Locale = "ar" | "en";
const allowedStates = new Set<AsyncStateName>(["loading", "empty", "error", "permission-denied", "offline", "stale-version"]);

function NavLink({ href, label, current }: { readonly href: string; readonly label: string; readonly current: boolean }) {
  return <a className="orb-nav-link" href={href} aria-current={current ? "page" : undefined}>
    <span className="orb-nav-label">{label}</span>
  </a>;
}

export function AppNavigation({ children }: { readonly children: ReactNode }) {
  const search = useSearchParams();
  const pathname = usePathname();
  const locale: Locale = search.get("locale") === "ar" ? "ar" : "en";
  const direction = locale === "ar" ? "rtl" : "ltr";
  const copy = locale === "ar" ? ar : en;
  const requestedState = search.get("demoState") as AsyncStateName | null;
  const state = requestedState && allowedStates.has(requestedState) ? requestedState : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const suffix = `?locale=${locale}`;

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [direction, locale]);

  function openMore(): void { dialogRef.current?.showModal(); }
  function closeMore(): void { dialogRef.current?.close(); }

  const links = <>
    <NavLink href={`/${suffix}`} label={copy.today} current={pathname === "/"} />
    <NavLink href={`/projects${suffix}`} label={copy.projects} current={pathname.startsWith("/projects")} />
    <NavLink href={`/approvals${suffix}`} label={copy.approvals} current={pathname === "/approvals"} />
  </>;

  return <div className="orb-shell">
    <header className="orb-top-bar">
      <a className="orb-brand" href={`/${suffix}`} aria-label={`ORB — ${copy.shellTitle}`}>
        <img src="/orb-logo.svg" alt="" width="40" height="40" />
        <span>ORB</span>
      </a>
    </header>
    <nav className="orb-rail" data-navigation="rail" data-variant="compact" aria-label={copy.primaryNavigation}>{links}</nav>
    <main className="orb-main">
      <span className="orb-reference" data-orb-reference>{copy.reference}</span>
      <span className="orb-directional-icon" aria-hidden="true">→</span>
      {state ? <AsyncState state={state} copy={copy} /> : children}
    </main>
    <nav className="orb-bottom" data-navigation="bottom" aria-label={copy.primaryNavigation}>
      {links}
      <button className="orb-more" ref={moreRef} type="button" onClick={openMore}>{copy.more}</button>
    </nav>
    <dialog className="orb-dialog" ref={dialogRef} aria-labelledby="orb-more-title" onClose={() => moreRef.current?.focus()}>
      <h2 id="orb-more-title">{copy.menuTitle}</h2>
      <p>{copy.shellTitle}</p>
      <div className="orb-dialog-actions"><button type="button" data-operation-id="signOutCurrentSession">{locale === "ar" ? "تسجيل الخروج" : "Sign out"}</button><button type="button" onClick={closeMore}>{copy.close}</button></div>
    </dialog>
  </div>;
}
