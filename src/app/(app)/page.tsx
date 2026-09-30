"use client";
import Link from "next/link";
import { UserCheck, Clock, Percent, CheckCircle, ChatCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { money, bookingState, plural, type BookingState } from "@/lib/format";
import type { Booking, Graph, Summary } from "@/lib/types";
import { PageHead, LoadError } from "@/components/ui";
import { ValueChart } from "./_dash/ValueChart";
import { StatusBar } from "./_dash/StatusBar";
import { WeekBoard } from "./_dash/WeekBoard";
import s from "./_dash/dashboard.module.css";

const STATUSES = [1, 2, 3, 4] as const;

async function loadAll() {
  const [summary, graph, fees, pending, support, toPay, ...lists] = await Promise.all([
    api<Summary>("admin/dashboard-management/summary"),
    api<Graph>("admin/dashboard-management/revenue-graph", { query: { filterType: "weekly" } }),
    api<Record<string, unknown>>("admin/platform-config/get-all").catch(() => ({ data: {} })),
    api("admin/service-provider/list", { query: { status: 0, limit: 1 } }).catch(() => ({ count: undefined })),
    api("admin/cms-management/list-supportUs-queries", { query: { type: 1, limit: 1 } }).catch(() => ({ count: undefined })),
    api<{ amount: number }[]>("admin/payouts", { query: { status: "requested", limit: 100 } }).catch(() => ({ data: [] as { amount: number }[], count: 0 })),
    ...STATUSES.map((st) => api<Booking[]>("admin/booking-management/list-bookings", { query: { status: st, limit: 100 } })),
  ]);
  const bookings = lists.flatMap((l, i) => (l.data || []).map((b) => ({ ...b, status: STATUSES[i] })));
  return {
    summary: summary.data, graph: graph.data, bookings,
    feesSet: !!fees.data && Object.keys(fees.data).length > 0,
    pending: pending.count, support: support.count,
    toPay: { n: toPay.count ?? toPay.data?.length ?? 0, sum: (toPay.data || []).reduce((a, p) => a + (p.amount || 0), 0) },
  };
}

export default function Dashboard() {
  const { data, error, reload, loading } = useLoad(loadAll);
  if (error) return <LoadError message={error} retry={reload} />;
  const d = data;
  const now = new Date();
  const count = (st: BookingState) => d?.bookings.filter((b) => bookingState(b as { status: number }) === st).length ?? 0;
  const pastRequests = d?.bookings.filter((b) => b.status === 1 && new Date(`${b.scheduledDate.slice(0, 10)}T${b.selectedSlot}`) < now).length ?? 0;
  const vals = d?.graph.averageOverallAppointment ?? [];
  const last = vals.at(-1) ?? 0, prev = vals.at(-2) ?? 0;

  return (
    <>
      <PageHead title="Dashboard" sub={now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })} />
      <div className={s.sum} aria-busy={loading}>
        {!!d?.toPay.n && <Link href="/payouts"><b className={s.badText}>{plural(d.toPay.n, "payout")} to send</b></Link>}
        <Link href="/buddies"><b>{d?.pending ?? "–"}</b> {d?.pending === 1 ? "Buddy" : "Buddies"} to review</Link>
        <Link href="/bookings?tab=Request"><b>{count("Request")}</b> {count("Request") === 1 ? "request" : "requests"} waiting for a Buddy</Link>
        <Link href="/support"><b>{d?.support ?? "–"}</b> support {d?.support === 1 ? "ticket" : "tickets"}</Link>
        <Link href="/fees">{d && !d.feesSet ? <b className={s.badText}>Fees not set</b> : "Fees & tax"}</Link>
      </div>

      <section className={s.kpis} aria-label="Key figures">
        <Link className={s.kpi} href="/bookings"><small>Bookings</small><span><b>{d?.summary.totalBookings ?? "–"}</b>{d && <em>▲ {d.summary.totalBookings - d.summary.comparisons.totalBookings}</em>}</span><span className="hint">vs {d?.summary.comparisons.totalBookings ?? "–"} last period</span></Link>
        <Link className={s.kpi} href="/bookings?tab=Completed"><small>Completed</small><span><b>{d?.summary.totalCompleted ?? "–"}</b>{d && <em>▲ {d.summary.totalCompleted - d.summary.comparisons.totalCompleted}</em>}</span><span className="hint">vs {d?.summary.comparisons.totalCompleted ?? "–"} last period</span></Link>
        <Link className={s.kpi} href="/bookings?tab=Expired"><small>Canceled</small><span><b>{d?.summary.totalCancelled ?? "–"}</b></span><span className="hint">{count("Expired")} expired with no Buddy reply</span></Link>
        <div className={s.kpi}><small>Booking value this week</small><span><b>{money(last, true)}</b>{prev > 0 && <em className={last < prev ? s.neg : ""}>{last < prev ? "▼" : "▲"} {Math.abs(Math.round((1 - last / prev) * 100))}%</em>}</span><span className="hint">vs {money(prev, true)} last week</span></div>
      </section>

      <div className={s.grid}>
        <section className="box"><header className={s.bh}><h2>Booking value per week</h2><span className="hint">Hover a week</span></header>
          <p className={`flag ${s.pad}`}>Booking counts include canceled ones for now. Money shows only what was kept.</p>
          {d ? <ValueChart graph={d.graph} /> : <div className="skeleton" style={{ height: 220, margin: 18 }} />}
        </section>
        <section className="box"><header className={s.bh}><h2>Bookings by status</h2><span className="hint">{d?.bookings.length ?? "–"} total</span></header>
          {d ? <StatusBar counts={(["Request", "Scheduled", "Completed", "Expired", "Canceled"] as BookingState[]).map((k) => [k, count(k)])} /> : <div className="skeleton" style={{ height: 160, margin: 18 }} />}
        </section>
      </div>

      <div className={s.grid}>
        <section className="box"><header className={s.bh}><h2>This week</h2><span className="hint">Click a booking to open it</span></header>
          {d ? <WeekBoard bookings={d.bookings} /> : <div className="skeleton" style={{ height: 160, margin: 18 }} />}
        </section>
        <section className={`box ${s.att}`}><header className={s.bh}><h2>Needs attention</h2></header>
          <ul>
            {!!d?.toPay.n && <Att icon={CheckCircle} tone="bad" title={`${plural(d.toPay.n, "payout")} to send · ${money(d.toPay.sum)}`} sub="Buddies are paid by hand after each job" href="/payouts" cta="Pay" />}
            <Att icon={UserCheck} tone="warn" title={`${plural(d?.pending, "Buddy", "Buddies")} waiting for review`} sub="Oldest first, with their documents" href="/buddies" cta="Review" />
            {pastRequests > 0 && <Att icon={Clock} tone="bad" title={`${plural(pastRequests, "request")} past the start time`} sub="Still open: the expiry sweep didn't close them" href="/bookings?tab=Request" cta="Open" />}
            {d && !d.feesSet && <Att icon={Percent} tone="bad" title="Fees & tax not set" sub="New bookings charge 0% commission" href="/fees" cta="Set" />}
            {!!d?.support && <Att icon={ChatCircle} tone="info" title={plural(d.support, "support ticket")} sub="From the Contact form" href="/support" cta="Open" />}
            <Att icon={CheckCircle} tone="ok" title="Payouts" sub="Failed and waiting payouts" href="/payouts" cta="View" />
          </ul>
        </section>
      </div>
    </>
  );
}

function Att({ icon: Icon, tone, title, sub, href, cta }: { icon: React.ElementType; tone: string; title: string; sub: string; href: string; cta: string }) {
  return (
    <li>
      <span className={`${s.ico} ${s[tone]}`}><Icon size={18} aria-hidden /></span>
      <span className={s.t}><b>{title}</b><span className="hint">{sub}</span></span>
      <Link className={`btn sm ${cta === "Review" ? "p" : ""}`} href={href}>{cta}</Link>
    </li>
  );
}
