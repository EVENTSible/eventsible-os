"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { Wordmark } from "@/components/wordmark";
import { activeHqNavigationId, HQ_NAVIGATION, hqContextLabel } from "@/lib/hq-navigation.mjs";

type NavigationItem = (typeof HQ_NAVIGATION)[number];

function navigationHash(href: string) {
  const marker = href.indexOf("#");
  return marker >= 0 ? href.slice(marker) : "";
}

function NavigationIcon({ icon }: { icon: string }) {
  if (icon === "calendar") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>;
  if (icon === "gigs") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v11H4zM8 8V5h8v3M9 13h6" /></svg>;
  if (icon === "leads") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 21v-3a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v3m1-6h1a5 5 0 0 1 5 5v1" /></svg>;
  if (icon === "imports") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 18h16v3H4z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8v9h-6v-6H9v6H3z" /></svg>;
}

function NavigationLink({ item, active, onNavigate, compact = false }: { item: NavigationItem; active: boolean; onNavigate?: () => void; compact?: boolean }) {
  return (
    <Link className={`hq-nav-link${active ? " active" : ""}${compact ? " compact" : ""}`} href={item.href} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <NavigationIcon icon={item.icon} />
      <span>{item.label}</span>
      {active ? <span className="hq-active-marker" aria-hidden="true">Current</span> : null}
    </Link>
  );
}

export function HqShell({ children, role }: { children: ReactNode; role: string }) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [navigationOpen, setNavigationOpen] = useState(false);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeId = activeHqNavigationId(pathname, hash);
  const contextLabel = hqContextLabel(pathname, hash);
  const primaryItems = HQ_NAVIGATION.filter((item) => item.group === "primary");
  const reviewItems = HQ_NAVIGATION.filter((item) => item.group === "review");

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  useEffect(() => {
    if (!navigationOpen) return;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector<HTMLElement>("button, a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavigationOpen(false);
        lastTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [navigationOpen]);

  const closeNavigation = () => {
    setNavigationOpen(false);
    lastTriggerRef.current?.focus();
  };

  const openNavigation = (event: MouseEvent<HTMLButtonElement>) => {
    lastTriggerRef.current = event.currentTarget;
    setNavigationOpen(true);
  };

  const activateNavigation = (item: NavigationItem, closeDialog = false) => {
    setHash(navigationHash(item.href));
    if (closeDialog) closeNavigation();
  };

  return (
    <div className="hq-shell">
      <a className="hq-skip-link" href="#hq-main-content">Skip to content</a>

      <aside className="hq-sidebar" aria-label="EVENTSible HQ">
        <Link className="hq-brand" href="/admin" aria-label="EVENTSible HQ home"><Wordmark compact /><span>HQ operating system</span></Link>
        <nav className="hq-sidebar-navigation" aria-label="HQ primary navigation">
          {primaryItems.map((item) => <NavigationLink key={item.id} item={item} active={activeId === item.id} onNavigate={() => activateNavigation(item)} />)}
        </nav>
        <div className="hq-sidebar-review">
          <span>Review queue</span>
          {reviewItems.map((item) => <NavigationLink key={item.id} item={item} active={activeId === item.id} onNavigate={() => activateNavigation(item)} />)}
        </div>
        <footer className="hq-sidebar-footer"><span className="role-pill">{role}</span><LogoutButton /></footer>
      </aside>

      <div className="hq-workspace">
        <header className="hq-topbar">
          <button type="button" className="hq-tablet-menu" aria-expanded={navigationOpen} aria-controls="hq-navigation-dialog" onClick={openNavigation}>
            <span aria-hidden="true">☰</span><span>Menu</span>
          </button>
          <div><span>HQ workspace</span><strong>{contextLabel}</strong></div>
        </header>
        <main id="hq-main-content" className="hq-main-content" tabIndex={-1}>{children}</main>
      </div>

      <nav className="hq-mobile-navigation" aria-label="HQ mobile navigation">
        {primaryItems.map((item) => <NavigationLink key={item.id} item={item} active={activeId === item.id} onNavigate={() => activateNavigation(item)} compact />)}
        <button type="button" className={`hq-nav-link compact${activeId === "imports" ? " active" : ""}`} aria-expanded={navigationOpen} aria-controls="hq-navigation-dialog" onClick={openNavigation}>
          <span className="hq-more-icon" aria-hidden="true">•••</span><span>More</span>{activeId === "imports" ? <span className="hq-active-marker" aria-hidden="true">Current</span> : null}
        </button>
      </nav>

      {navigationOpen ? (
        <div className="hq-navigation-layer">
          <button type="button" className="hq-navigation-scrim" aria-label="Close navigation" tabIndex={-1} onClick={closeNavigation} />
          <div ref={dialogRef} id="hq-navigation-dialog" className="hq-navigation-dialog" role="dialog" aria-modal="true" aria-labelledby="hq-navigation-title">
            <header><div><span>EVENTSible HQ</span><h2 id="hq-navigation-title">Navigation</h2></div><button type="button" className="hq-dialog-close" aria-label="Close navigation" onClick={closeNavigation}>×</button></header>
            <nav aria-label="HQ menu">
              <div className="hq-dialog-primary">{primaryItems.map((item) => <NavigationLink key={item.id} item={item} active={activeId === item.id} onNavigate={() => activateNavigation(item, true)} />)}</div>
              <div className="hq-dialog-review"><span>Review queue</span>{reviewItems.map((item) => <NavigationLink key={item.id} item={item} active={activeId === item.id} onNavigate={() => activateNavigation(item, true)} />)}</div>
            </nav>
            <footer><span className="role-pill">{role}</span><LogoutButton /></footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
