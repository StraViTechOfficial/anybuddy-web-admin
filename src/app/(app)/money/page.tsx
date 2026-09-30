"use client";
import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlass, Warning, Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { bookingState, fullName, money, when } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { PageHead, LoadError, StateChip } from "@/components/ui";
import s from "./money.module.css";

// Until the ledger exists (FEA-47, design approved-pending), this adds up what bookings record today.
// Stripe fees, Stripe balance and Stripe payouts aren't stored yet, so they're labelled, never guessed.
type Row = Booking & { status: number };
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
  const { data, error, reload } = useLoad(async () => (await Promise.all([1, 2, 3, 4].map((st) => api<Booking[]>("admin/booking-management/list-bookings", { query: { status: st, limit: 200 } }).then((r) => (r.data || []).map((b) => ({ ...b, status: st })))))).flat() as Row[]);
  const rows = useMemo(() => (data ?? []).map((b) => ({ b, m: split(b) })), [data]);
  if (error) return <LoadError message={error} retry={reload} />;
  const sum = (k: keyof ReturnType<typeof split>) => rows.reduce((a, r) => a + (r.m[k] as number), 0);
  const paidIn = sum("paid"), total = paidIn || 1;
  const shown = rows.filter(({ b }) => !search || `${b.bookingId} ${fullName(b.userDetails)} ${fullName(b.serviceProvider)}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHead title="Money" sub="Every dollar from the customer's card to the Buddy's bank." />
      <div className="note"><Info size={16} />Figures come from what each booking records. Stripe&apos;s card fees, its balance and its payouts join here once the ledger is built (FEA-47).</div>
      <section className={s.kpis}>
        <div><small>Customers paid</small><b>{money(paidIn, true)}</b><span className="hint">{rows.length} bookings, charged up front</span></div>
        <div><small>Refunded</small><b>{money(sum("refunded"), true)}</b><span className="hint">Canceled or expired</span></div>
        <div><small>Earned by Buddies</small><b>{money(sum("earned"), true)}</b><span className="hint">Completed jobs</span></div>
        <div><small>Kept by AnyBuddy</small><b>{money(sum("fee"), true)}</b><span className="hint">Commission{sum("fee") === 0 && " · fees not set"}</span></div>
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
            <thead><tr><th>Booking</th><th className="hs">Buddy</th><th className="r">Customer paid</th><th className="r hs">Refund</th><th className="r hs">Tax</th><th className="r hs">Commission</th><th className="r">Buddy earns</th><th>Status</th></tr></thead>
            <tbody>{shown.map(({ b, m }) => (
              <tr key={b._id}>
                <td><Link href={`/bookings?open=${b._id}`} className="mono">{b.bookingId}</Link><br /><span className="hint">{b.serviceName} · {when(b.scheduledDate)}</span></td>
                <td className="hs">{fullName(b.serviceProvider)}</td>
                <td className="r">{money(m.paid)}</td>
                <td className="r hs">{m.refunded ? `− ${money(m.refunded)}` : "—"}</td>
                <td className="r hs">{money(m.tax)}</td>
                <td className="r hs">{money(m.fee)}</td>
                <td className="r">{m.earned ? money(m.earned) : "—"}{m.gap > 0 && <><br /><span className="flag bad">{money(m.gap)} not traced</span></>}</td>
                <td><StateChip state={m.st} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
