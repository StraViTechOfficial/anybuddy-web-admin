"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, Warning, CalendarBlank } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { bookingState, fullName, money, when, type BookingState } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { PageHead, StateChip, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { BookingDrawer } from "./BookingDrawer";
import s from "./bookings.module.css";

const TABS: ("All" | BookingState)[] = ["All", "Request", "Scheduled", "Completed", "Canceled", "Expired"];
type Row = Booking & { status: number; state: BookingState };
type SortKey = "bookingId" | "serviceName" | "when" | "price";

export default function Page() { return <Suspense><Bookings /></Suspense>; }

function Bookings() {
  const q = useSearchParams(), router = useRouter();
  const tab = (q.get("tab") ?? "All") as (typeof TABS)[number];
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [sort, setSort] = useState<[SortKey, 1 | -1]>(["when", -1]);
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState<string | null>(q.get("open"));
  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 250); return () => clearTimeout(t); }, [search]);

  // The list endpoint takes one status at a time; status 4 holds both customer/Buddy cancels and expiries.
  const { data, error, loading, reload } = useLoad(async () => {
    const lists = await Promise.all([1, 2, 3, 4].map((st) => api<Booking[]>("admin/booking-management/list-bookings", { query: { status: st, search: term, limit: 200 } }).then((r) => (r.data || []).map((b) => ({ ...b, status: st })))));
    return lists.flat().map((b) => ({ ...b, state: bookingState(b) })) as Row[];
  }, [term]);

  const rows = useMemo(() => {
    const r = (data ?? []).filter((b) => tab === "All" || b.state === tab);
    const [k, d] = sort;
    const key = (b: Row) => (k === "when" ? b.scheduledDate.slice(0, 10) + b.selectedSlot : k === "price" ? b.price : String(b[k]));
    return r.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * d);
  }, [data, tab, sort]);
  const count = (t: (typeof TABS)[number]) => (t === "All" ? data?.length : data?.filter((b) => b.state === t).length);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || e.metaKey || e.ctrlKey || open) return;
      if (e.key === "j") setSel((i) => Math.min(i + 1, rows.length - 1));
      else if (e.key === "k") setSel((i) => Math.max(i - 1, 0));
      else if (e.key === "Enter" && rows[sel] && !/BUTTON|^A$/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); setOpen(rows[sel]._id); } // preventDefault: the same keypress must not "click" the drawer's first button
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [rows, sel, open]);
  useEffect(() => { document.querySelector(`.${s.sel}`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const th = (k: SortKey, label: string, cls = "") => (
    <th className={cls} aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : undefined}>
      <button className={s.sortb} onClick={() => setSort([k, sort[0] === k ? (-sort[1] as 1 | -1) : 1])}>{label}{sort[0] === k ? (sort[1] > 0 ? " ↑" : " ↓") : ""}</button>
    </th>
  );
  const past = (b: Row) => b.status === 1 && new Date(`${b.scheduledDate.slice(0, 10)}T${b.selectedSlot}`) < new Date();

  return (
    <>
      <PageHead title="Bookings" sub={<>{data?.length ?? "–"} bookings · <kbd>j</kbd> <kbd>k</kbd> to move, <kbd>Enter</kbd> to open</>} />
      <section className="box">
        <div className="tbar">
          <div className="seg" role="tablist" aria-label="Status">
            {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { router.replace(`/bookings?tab=${t}`); setSel(0); }}>{t}<em>{count(t) ?? "–"}</em></button>)}
          </div>
          <label className="search"><span className="sr">Find a booking</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Booking ID, customer or Buddy" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        </div>
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className={s.table}>
              <thead><tr>{th("bookingId", "Booking")}{th("serviceName", "Service")}<th className={s.hs}>Customer</th><th className={s.hs}>Buddy</th>{th("when", "When")}{th("price", "Total", "r")}<th>Status</th></tr></thead>
              <tbody>
                {loading && !data ? <SkeletonRows cols={7} /> : rows.map((b, i) => (
                  <tr key={b._id} className={`click ${i === sel ? s.sel : ""}`} tabIndex={0} onClick={() => { setSel(i); setOpen(b._id); }} onKeyDown={(e) => e.key === "Enter" && setOpen(b._id)}>
                    <td><span className="mono">{b.bookingId}</span></td>
                    <td>{b.serviceName}</td>
                    <td className={s.hs}>{fullName(b.userDetails)}</td>
                    <td className={s.hs}>{fullName(b.serviceProvider)}</td>
                    <td>{when(b.scheduledDate, b.selectedSlot)}{past(b) && <><br /><span className="flag bad"><Warning size={12} />Start passed, still open</span></>}</td>
                    <td className="r">{money(b.price)}</td>
                    <td><StateChip state={b.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <Empty icon={CalendarBlank} title={term ? `No booking matches “${term}”` : `No ${tab === "All" ? "" : tab.toLowerCase() + " "}bookings`}>{term && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setSearch("")}>Clear search</button>}</Empty>}
          </div>
        )}
      </section>
      {open && <BookingDrawer id={open} onClose={() => { setOpen(null); if (q.get("open")) router.replace(`/bookings?tab=${tab}`); }} />}
    </>
  );
}
