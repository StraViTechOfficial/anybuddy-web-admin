"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gear, List, MagnifyingGlass, Moon, SignOut, DotsThree, CaretDown, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { payoutAlerts } from "@/app/(app)/payouts/data";
import { Palette } from "./Palette";
import s from "./Shell.module.css";

import { main, more, type Counts, type Item } from "./nav";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [counts, setCounts] = useState<Counts>({});
  const [open, setOpen] = useState(false);
  const [pal, setPal] = useState(false);

  useEffect(() => {
    // Badges come from the list counts; a failed one just shows no badge.
    const count = (p: string, query: Record<string, string | number>) => api(p, { query: { page: 1, limit: 1, ...query } }).then((r) => r.count || 0).catch(() => undefined);
    Promise.all([
      count("admin/service-provider/list", { status: 0 }),
      count("admin/booking-management/list-bookings", { status: 1 }),
      count("admin/cms-management/list-supportUs-queries", { type: 1 }),
      payoutAlerts().then((a) => a.n, () => undefined),
      api<Record<string, unknown>>("admin/platform-config/get-all").then((r) => !!r.data && Object.keys(r.data).length > 0).catch(() => undefined),
      count("admin/service-requests", { status: "pending" }),
    ]).then(([buddies, requests, support, payouts, fees, serviceRequests]) => setCounts({ buddies, requests, support, payouts: payouts as number | undefined, fees: fees as boolean | undefined, serviceRequests: serviceRequests as number | undefined }));
  }, []);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal(true); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setPal(true); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const theme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    r.dataset.theme = dark ? "light" : "dark";
    localStorage.setItem("ab_theme", r.dataset.theme);
  };
  async function logout() {
    await api("admin/auth/logout", { method: "POST", body: {} }).catch(() => {});
    window.location.assign("/login");
  }
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const extra = more(counts);
  const inMore = extra.some((i) => active(i.href));
  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreOpen || inMore;
  // On a laptop the menu can shrink to an icon rail and back. The choice is saved per browser, and the head script
  // applies it before the first paint. The icon follows data-side in CSS, so it is right even before hydration. The
  // label follows this state.
  const [rail, setRail] = useState(false);
  useEffect(() => { setRail(document.documentElement.dataset.side === "rail"); }, []);
  const toggleSide = () => {
    const r = document.documentElement;
    r.dataset.side = r.dataset.side === "rail" ? "" : "rail";
    setRail(r.dataset.side === "rail");
    try { localStorage.setItem("ab_side", r.dataset.side); } catch {}
  };
  const link = ({ href, label, icon: Icon, badge, tone }: Item) => (
    <Link key={href} href={href} className={s.nav} aria-current={active(href) ? "page" : undefined} title={label}>
      <Icon size={18} weight={active(href) ? "fill" : "regular"} aria-hidden />
      <span className={s.lbl}>{label}</span>
      {badge ? <span className={`${s.n} ${tone ? s[tone] : ""}`}>{badge}</span> : null}
    </Link>
  );

  return (
    <div className={s.app}>
      <a className={s.skip} href="#main">Skip to content</a>
      <aside className={`${s.side} ${open ? s.open : ""}`} aria-label="Admin menu">
        <Link href="/" className={s.brand}><img src="/mark.png" alt="" width={32} height={32} /><b>Any-Buddy</b></Link>
        <button type="button" className={s.edge} aria-label={rail ? "Expand menu" : "Collapse menu"} title={rail ? "Expand menu" : "Collapse menu"} onClick={toggleSide}>
          <CaretLeft size={14} weight="bold" className={s.collapse} aria-hidden /><CaretRight size={14} weight="bold" className={s.expand} aria-hidden />
        </button>
        <nav className={s.navs}>
          <div className={s.grp}>{main(counts).map(link)}</div>
          <div className={s.grp}>
            <button type="button" className={s.nav} aria-expanded={showMore} onClick={() => setMoreOpen(!showMore)} title="More">
              <DotsThree size={18} weight="bold" aria-hidden />
              <span className={s.lbl}>More</span>
              {!showMore && extra.some((i) => i.badge) ? <span className={`${s.n} ${s.r}`}>!</span> : <CaretDown size={14} className={`${s.caret} ${showMore ? s.up : ""}`} aria-hidden />}
            </button>
            {showMore && extra.map(link)}
          </div>
        </nav>
        <div className={s.foot}>
          {link({ href: "/account", label: "Account & security", icon: Gear })}
          <button type="button" className={`${s.nav} ${s.out}`} onClick={logout} title="Log out"><SignOut size={18} aria-hidden /><span className={s.lbl}>Log out</span></button>
        </div>
      </aside>
      <div className={s.main}>
        <header className={s.top}>
          <button type="button" className={`${s.ib} ${s.menuBtn}`} aria-label="Open menu" onClick={() => setOpen(!open)}><List size={20} /></button>
          <button type="button" className={s.cmdk} onClick={() => setPal(true)}>
            <MagnifyingGlass size={16} aria-hidden /><span>Search or jump to…</span><kbd>⌘K</kbd>
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" className={s.ib} aria-label="Switch light or dark" onClick={theme}><Moon size={18} /></button>
        </header>
        <main id="main" className={s.view} tabIndex={-1}>{children}</main>
      </div>
      {open && <div className={s.scrim} onClick={() => setOpen(false)} />}
      {pal && <Palette onClose={() => setPal(false)} />}
    </div>
  );
}
