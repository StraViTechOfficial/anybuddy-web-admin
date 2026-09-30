"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlass, Warning, Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { TZ, bookingState, fullName, money, when } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { PageHead, LoadError, StateChip } from "@/components/ui";
import { MoneyDrawer } from "./MoneyDrawer";
import s from "./money.module.css";

// The booking figures add up what bookings record. Stripe fees and the net to AnyBuddy come from the money ledger
// (FEA-47, GET admin/money/*). Bookings from before the ledger have no entries: they show "—", never a guessed fee.
type Row = Booking & { status: number };
type Ledger = { _id: string; in: number; out: number; recovered: number; net: number; fees: number; feesLost: number; refundedFully: boolean };
type Period = { entries: number; bookings: number; in: number; out: number; recovered: number; net: number; commission: number; fees: number; feesLost: number; feesUnattributed: number };
const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date()); // "2026-09"
const monthDays = (m: string) => { const [y, mo] = m.split("-").map(Number); return { from: `${m}-01`, to: `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}` }; };
const split = (b: Row) => {
  const st = bookingState(b), paid = b.price, tax = b.taxAmount ?? 0, fee = b.commissionAmount ?? 0;
  const refunded = st === "Expired" || st === "Canceled" ? paid : 0;
  const held = st === "Request" || st === "Scheduled" ? paid : 0;
  const earned = st === "Completed" ? b.vendorPriceAfterDetection ?? 0 : 0;
  const gap = st === "Completed" ? Math.max(0, paid - earned - tax - fee) : 0;
  return { st, paid, tax, fee, refunded, held, earned, gap };
};
const SEG = [["refunded", "Refunded to customers", "--mo-ref"], ["held", "Held for upcoming jobs", "--mo-held"], ["earned", "Earned by Buddies", "--mo-paid"], ["fee", "Kept by AnyBuddy", "--mo-owed"], ["tax", "Sales tax set aside", "--m-cxl"], ["gap", "Not traced to anyone", "--bad"]] as const;

export default function Page() { return <Suspense><Money /></Suspense>; }

function Money() {
  const q = useSearchParams();
  const [search, setSearch] = useState(q.get("q") ?? "");
  const [month, setMonth] = useState(thisMonth);
  const [open, setOpen] = useState<Row | null>(null);
  // Each status page (up to 200 bookings) asks the ledger for its own rows. A ledger error leaves the column at "—".
  const { data, error, reload } = useLoad(async () => {
    const pages = await Promise.all([1, 2, 3, 4].map((st) => api<Booking[]>("admin/booking-management/list-bookings", { query: { status: st, limit: 200 } }).then((r) => (r.data || []).map((b) => ({ ...b, status: st })) as Row[])));
    const ledger = await Promise.all(pages.map((p) => (p.length ? api<Ledger[]>("admin/money/bookings", { query: { ids: p.map((b) => b._id).join(",") } }).then((r) => r.data) : [])))
      .then((l) => new Map(l.flat().map((x) => [x._id, x])), () => new Map<string, Ledger>());
    return { rows: pages.flat(), ledger };
  });
  const period = useLoad(() => api<Period>("admin/money/summary", { query: monthDays(month) }).then((r) => r.data), [month]);
  const rows = useMemo(() => (data?.rows ?? []).map((b) => ({ b, m: split(b), l: data?.ledger.get(b._id) })), [data]);
  const p = period.data?.entries ? period.data : null;
  if (error) return <LoadError message={error} retry={reload} />;
  const sum = (k: keyof ReturnType<typeof split>) => rows.reduce((a, r) => a + (r.m[k] as number), 0);
  const paidIn = sum("paid"), total = paidIn || 1;
  const shown = rows.filter(({ b }) => !search || `${b.bookingId} ${fullName(b.userDetails)} ${fullName(b.serviceProvider)}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHead title="Money" sub="Every dollar from the customer's card to the Buddy's bank." />
      <div className="note"><Info size={16} />The cards and the chart add up what each booking records. Stripe fees and the net to AnyBuddy come from the money ledger.</div>
      <section className={s.kpis}>
        <div><small>Customers paid</small><b>{money(paidIn, true)}</b><span className="hint">{rows.length} bookings, charged up front</span></div>
        <div><small>Refunded</small><b>{money(sum("refunded"), true)}</b><span className="hint">Canceled or expired</span></div>
        <div><small>Earned by Buddies</small><b>{money(sum("earned"), true)}</b><span className="hint">Completed jobs</span></div>
        <div><small>Kept by AnyBuddy</small><b>{money(sum("fee"), true)}</b><span className="hint">Commission{sum("fee") === 0 && " · fees not set"}</span></div>
      </section>
      <section className="box">
        <header className="bh"><h2>Ledger for the month</h2><label><span className="sr">Month</span><input className="input" type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label></header>
        <div style={{ padding: "16px 18px 18px" }}>
          {period.error ? <p className="err">{period.error}</p> : <>
            <div className={s.kpis}>
              <div><small>In</small><b>{p ? money(p.in) : "—"}</b><span className="hint">Paid by customers</span></div>
              <div><small>Out</small><b>{p ? money(p.out) : "—"}</b><span className="hint">Refunds, Stripe fees, Buddies&apos; share, tax held</span></div>
              <div><small>Recovered</small><b>{p ? money(p.recovered) : "—"}</b><span className="hint">Fees taken back from Buddies</span></div>
              <div><small>Net to AnyBuddy</small><b>{p ? money(p.net) : "—"}</b><span className="hint">Commission − Stripe fees + recoveries</span></div>
            </div>
            <div className={s.fees}>
              <span>Stripe fees <b>{p ? money(p.fees) : "—"}</b></span>
              <span>lost on refunds <b>{p ? money(p.feesLost) : "—"}</b></span>
              <span>recovered from Buddies <b>{p ? money(p.recovered) : "—"}</b></span>
              <span>not tied to a booking <b>{p ? money(p.feesUnattributed) : "—"}</b></span>
              <span>net fee cost <b>{p ? money(p.fees - p.recovered) : "—"}</b></span>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>{period.loading ? "Loading…" : p ? `Money the ledger recorded on New York business days this month, across ${p.bookings} bookings. Stripe keeps its fee when a payment is refunded in full; a Buddy who cancels pays it back.` : "No ledger entries this month. Bookings from before the ledger show only their booking record."}</p>
          </>}
        </div>
      </section>
      <section className="box">
        <header className="bh"><h2>Where the money is now</h2><span className="hint">{money(paidIn, true)} paid in</span></header>
        <div style={{ padding: "16px 18px 18px" }}>
          <div className={s.stack} role="img" aria-label={SEG.map(([k, l]) => `${l} ${money(sum(k), true)}`).join(", ")}>
            {SEG.map(([k, l, c]) => sum(k) > 0 && <i key={k} style={{ flex: sum(k), background: `var(${c})` }} title={`${l}: ${money(sum(k), true)}`}><span>{Math.round((sum(k) / total) * 100)}%</span></i>)}
          </div>
          <ul className={s.legend}>{SEG.map(([k, l, c]) => <li key={k}><span style={{ background: `var(${c})` }} />{l}<b>{money(sum(k), true)}</b></li>)}</ul>
          {sum("gap") > 0 && <div className="note" style={{ marginTop: 14 }}><Warning size={16} />{money(sum("gap"), true)} isn&apos;t traced: {rows.filter((r) => r.m.gap).map((r) => r.b.bookingId).join(", ")} record less for the Buddy than the customer paid, with no commission or tax (BUG-87). The ledger rejects bookings that don&apos;t add up.</div>}
        </div>
      </section>
      <section className="box">
        <header className="bh"><h2>Money trail by booking</h2><label className="search"><span className="sr">Find a booking</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Booking ID, customer or Buddy" value={search} onChange={(e) => setSearch(e.target.value)} /></label></header>
        <div style={{ overflowX: "auto" }}>
          <table className="stack">
            <thead><tr><th>Booking</th><th className="hs">Buddy</th><th className="r">Customer paid</th><th className="r hs">Refund</th><th className="r hs">Tax</th><th className="r hs">Commission</th><th className="r">Buddy earns</th><th className="r hs">Stripe fee</th><th className="r">Net to AnyBuddy</th><th>Status</th></tr></thead>
            <tbody>{shown.map(({ b, m, l }) => (
              <tr key={b._id} className="click" tabIndex={0} aria-label={`Money for ${b.bookingId}`} onClick={() => setOpen(b)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setOpen(b)}>
                <td><Link href={`/bookings?open=${b._id}`} className="mono" onClick={(e) => e.stopPropagation()}>{b.bookingId}</Link><br /><span className="hint">{b.serviceName} · {when(b.scheduledDate)}</span></td>
                <td className="hs">{fullName(b.serviceProvider)}</td>
                <td className="r">{money(m.paid)}</td>
                <td className="r hs">{m.refunded ? `− ${money(m.refunded)}` : "—"}</td>
                <td className="r hs">{money(m.tax)}</td>
                <td className="r hs">{money(m.fee)}</td>
                <td className="r">{m.earned ? money(m.earned) : "—"}{m.gap > 0 && <><br /><span className="flag bad">{money(m.gap)} not traced</span></>}</td>
                <td className="r hs">{!l ? "—" : l.refundedFully ? <>Fee lost {money(l.fees)}{l.recovered > 0 && <><br /><span className="hint">Recovered from Buddy</span></>}</> : money(l.fees)}</td>
                <td className="r">{l ? money(l.net) : "—"}</td>
                <td><StateChip state={m.st} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="hint" style={{ padding: "10px 18px 14px" }}>“—” in Stripe fee and Net: the booking came before the money ledger, so there is no recorded fee. Open a row for its full statement.</p>
      </section>
      {open && <MoneyDrawer id={open._id} code={open.bookingId} recorded={split(open)} onClose={() => setOpen(null)} />}
    </>
  );
}
