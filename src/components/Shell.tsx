"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFour, UserCheck, User, CalendarBlank, CreditCard, Bank, ChatCircle, GridFour, Bell, Star,
  Percent, FileText, Gear, List, MagnifyingGlass, Moon, SignOut,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { Palette } from "./Palette";
import s from "./Shell.module.css";

type Counts = { buddies?: number; requests?: number; support?: number; fees?: boolean; payouts?: number };
type Item = { href: string; label: string; icon: React.ElementType; badge?: number | string; tone?: "b" | "r" };

// Menu groups match the approved prototype (D-61, D-69).
const menu = (c: Counts): [string | null, Item[]][] => [
  [null, [{ href: "/", label: "Dashboard", icon: SquaresFour }]],
  ["People", [{ href: "/buddies", label: "Buddies", icon: UserCheck, badge: c.buddies }, { href: "/customers", label: "Customers", icon: User }]],
  ["Operations", [
    { href: "/bookings", label: "Bookings", icon: CalendarBlank, badge: c.requests, tone: "b" },
    { href: "/payouts", label: "Payouts", icon: CreditCard, badge: c.payouts, tone: "r" },
    { href: "/money", label: "Money", icon: Bank },
    { href: "/support", label: "Support", icon: ChatCircle, badge: c.support, tone: "b" },
  ]],
  ["Catalog", [{ href: "/catalog", label: "Categories & services", icon: GridFour }]],
  ["Engage", [{ href: "/notifications", label: "Notifications", icon: Bell }, { href: "/reviews", label: "Reviews", icon: Star }]],
  ["Settings", [
    { href: "/fees", label: "Fees & tax", icon: Percent, badge: c.fees === false ? "!" : undefined, tone: "r" },
    { href: "/content", label: "Content pages", icon: FileText },
    { href: "/account", label: "Account & security", icon: Gear },
  ]],
];

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
      count("admin/payouts", { status: "requested" }),
      api<Record<string, unknown>>("admin/platform-config/get-all").then((r) => !!r.data && Object.keys(r.data).length > 0).catch(() => undefined),
    ]).then(([buddies, requests, support, payouts, fees]) => setCounts({ buddies, requests, support, payouts: payouts as number | undefined, fees: fees as boolean | undefined }));
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

  return (
    <div className={s.app}>
      <a className={s.skip} href="#main">Skip to content</a>
      <aside className={`${s.side} ${open ? s.open : ""}`} aria-label="Admin menu">
        <Link href="/" className={s.brand}><img src="/mark.png" alt="" width={32} height={32} /><b>Any-Buddy</b><span className={s.badge}>ADMIN</span></Link>
        <nav className={s.navs}>
          {menu(counts).map(([g, items], i) => (
            <div key={i} className={s.grp}>
              {g && <small>{g}</small>}
              {items.map(({ href, label, icon: Icon, badge, tone }) => (
                <Link key={href} href={href} className={s.nav} aria-current={active(href) ? "page" : undefined} title={label}>
                  <Icon size={18} weight={active(href) ? "fill" : "regular"} aria-hidden />
                  <span className={s.lbl}>{label}</span>
                  {badge ? <span className={`${s.n} ${tone ? s[tone] : ""}`}>{badge}</span> : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" className={s.me} onClick={logout}><SignOut size={18} aria-hidden /><span className={s.lbl}>Log out</span></button>
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
