"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Warning, Clock, XCircle, PaperPlaneTilt, ArrowCounterClockwise } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, dateAt, money, phone } from "@/lib/format";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { type Payout, type StripePayout, vendorOf, jobOf, ageText, isLate, LATE_HOURS, payoutMode } from "./data";
import { PaySheet } from "./PaySheet";

type ManualStatus = "requested" | "paid" | "rejected";
type Tab = [key: string, label: string, count?: number | string];
const MANUAL: [ManualStatus, string][] = [["requested", "To send"], ["paid", "Paid"], ["rejected", "Rejected"]];

export default function Page() { return <Suspense><Payouts /></Suspense>; }

// The page follows the backend's PAYOUTS_MODE: manual (pay by hand from Citizens) or stripe (paid automatically).
function Payouts() {
  const mode = useLoad(payoutMode);
  if (!mode.data) return <><PageHead title="Payouts" /><section className="box"><table className="stack"><tbody><SkeletonRows cols={5} /></tbody></table></section></>;
  return mode.data === "stripe" ? <StripeView /> : <ManualView />;
}

function Seg({ tabs, active, go }: { tabs: Tab[]; active: string; go: (k: string) => void }) {
  return (
    <div className="seg" role="tablist">
      {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={active === k} onClick={() => go(k)}>{l}{n !== undefined && <em>{n}</em>}</button>)}
    </div>
  );
}

function ManualView() {
  const q = useSearchParams(), router = useRouter();
  const tab = q.get("tab") ?? "requested";
  const counts = useLoad(() => api<Payout[]>("admin/payouts", { query: { status: "requested", limit: 1 } }).then((r) => r.count ?? 0));
  const tabs = <Seg tabs={[...MANUAL.map(([k, l]): Tab => [k, l, k === "requested" ? counts.data ?? "–" : undefined]), ["stripe", "Stripe (when enabled)"]]} active={tab} go={(k) => router.replace(`/payouts?tab=${k}`)} />;
  const head = <PageHead title="Payouts" sub="Buddies are paid by hand after each job while Stripe payouts are on hold. Pay from Citizens, then record it here." />;
  if (tab === "stripe") return <>{head}<section className="box"><div className="tbar">{tabs}</div><StripeTable filter="attention" /></section></>;
  return <>{head}<ManualTable status={tab as ManualStatus} tabs={tabs} onChange={counts.reload} /></>;
}

function StripeView() {
  const q = useSearchParams(), router = useRouter();
  const tab = q.get("tab") ?? "recent", sub = (q.get("m") ?? "requested") as ManualStatus;
  const counts = useLoad(() => Promise.all([
    api("admin/payouts/stripe", { query: { status: "attention", limit: 1 } }).then((r) => r.count ?? 0),
    api("admin/payouts", { query: { status: "requested", limit: 1 } }).then((r) => r.count ?? 0),
  ]).then(([attention, manual]) => ({ attention, manual })));
  // Old hand payouts from before the switch: shown only while some are still to send (or while you're on that tab).
  const tabs: Tab[] = [["recent", "Recent payouts"], ["attention", "Needs attention", counts.data?.attention ?? "–"]];
  if (tab === "manual" || counts.data?.manual) tabs.push(["manual", "Manual (old)", counts.data?.manual ?? "–"]);
  const bar = <>
    <Seg tabs={tabs} active={tab} go={(k) => router.replace(`/payouts?tab=${k}`)} />
    {tab === "manual" && <Seg tabs={MANUAL} active={sub} go={(k) => router.replace(`/payouts?tab=manual&m=${k}`)} />}
  </>;
  return (
    <>
      <PageHead title="Payouts" sub="Buddies are paid automatically by Stripe after each job. This page shows each payout and flags any that need attention." />
      {tab === "manual" ? <ManualTable status={sub} tabs={bar} onChange={counts.reload} /> : (
        <section className="box"><div className="tbar">{bar}</div><StripeTable key={tab} filter={tab === "attention" ? "attention" : "all"} /></section>
      )}
    </>
  );
}

// Manual payouts: one per completed job, paid from Citizens and recorded in the PaySheet.
function ManualTable({ status: tab, tabs, onChange }: { status: ManualStatus; tabs: React.ReactNode; onChange: () => void }) {
  const [open, setOpen] = useState<Payout | null>(null);
  const list = useLoad(async () => {
    const r = await api<Payout[]>("admin/payouts", { query: { status: tab, limit: 100 } });
    // Oldest first on "To send": the longest wait gets paid first.
    return (r.data || []).sort((a, b) => (tab === "requested" ? 1 : -1) * (new Date(jobOf(a).doneAt ?? 0).getTime() - new Date(jobOf(b).doneAt ?? 0).getTime()));
  }, [tab]);
  const rows = list.data ?? [];
  const due = rows.reduce((a, p) => a + (p.amount || 0), 0);
  const late = rows.filter((p) => isLate(jobOf(p).doneAt)).length;

  return (
    <>
      {tab === "requested" && rows.length > 0 && (
        <div className={`note`} style={late ? { borderColor: "var(--bad)", background: "var(--bad-soft)" } : undefined}>
          {late ? <Warning size={16} color="var(--bad)" /> : <Clock size={16} />}
          <span><b>{rows.length} to send · {money(due)}</b>{late > 0 && <> · {late} waiting over {LATE_HOURS} hours</>}. Oldest first.</span>
        </div>
      )}
      <section className="box">
        <div className="tbar">{tabs}</div>
        {list.error ? <LoadError message={list.error} retry={list.reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="stack">
              <thead><tr><th>Buddy</th><th>Job</th><th className="r">Amount</th><th className="hs">{tab === "requested" ? "Job done" : tab === "paid" ? "Paid" : "Rejected"}</th><th>{tab === "requested" ? "Waiting" : tab === "paid" ? "Reference" : "Reason"}</th><th /></tr></thead>
              <tbody>
                {list.loading && !list.data ? <SkeletonRows cols={6} /> : rows.map((p) => {
                  const v = vendorOf(p), j = jobOf(p), lateRow = tab === "requested" && isLate(j.doneAt);
                  return (
                    <tr key={p._id} className="click" onClick={() => setOpen(p)} style={lateRow ? { boxShadow: "inset 3px 0 0 var(--bad)" } : undefined}>
                      <td><b>{v.name}</b>{v.phone && <><br /><span className="hint">{phone(v.phone)}</span></>}</td>
                      <td>{j.number ? <span className="mono">{j.number}</span> : "—"}{j.service && <><br /><span className="hint">{j.service}</span></>}</td>
                      <td className="r"><b>{money(p.amount)}</b></td>
                      <td className="hs">{tab === "paid" && p.paidAt ? date(p.paidAt) : j.doneAt ? `${dateAt(j.doneAt)} ET` : "—"}</td>
                      <td>{tab === "requested" ? <span className={`chip ${lateRow ? "c-bad" : "c-warn"}`}><Clock size={12} />{ageText(j.doneAt) || "—"}</span> : tab === "paid" ? <span className="mono">{p.reference || "—"}</span> : <span className="muted">{p.note || p.reason || "—"}</span>}</td>
                      <td className="r">{tab === "requested" && <button className="btn sm p" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>Pay</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.loading && !rows.length && <Empty icon={CheckCircle} title={tab === "requested" ? "Nothing to send" : tab === "paid" ? "No payouts recorded yet" : "No rejected payouts"}>{tab === "requested" ? "Each completed job adds a payout here, and admins get an email and text." : undefined}</Empty>}
          </div>
        )}
      </section>
      {open && <PaySheet p={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); list.reload(); onChange(); }} />}
    </>
  );
}

// Stripe payouts: a transfer to the Buddy's Stripe account at check-out, then Stripe's own payout to their bank.
const STATUS: Record<StripePayout["status"], [string, string, React.ElementType]> = {
  pending: ["c-warn", "Waiting", Clock], sent: ["c-info", "Sent", PaperPlaneTilt], paid: ["c-ok", "Paid", CheckCircle],
  failed: ["c-bad", "Failed", XCircle], reversed: ["c-mut", "Reversed", ArrowCounterClockwise],
};
const REASON: Record<string, [string, string]> = {
  bank_failed: ["Bank rejected the payout: ask the Buddy to update their bank details", "Once they save new bank details in the Buddy app, Stripe pays the money out again."],
  buddy_not_set_up: ["Buddy hasn't finished payout setup", "The payout goes out by itself once they finish it in the Buddy app."],
  waiting: ["Sending shortly", "Retried every 10 minutes."],
};
const landing = (p: StripePayout) =>
  p.status === "paid" ? `Reached bank ${date(p.paidAt ?? p.arrivesBy ?? p.sentAt ?? "")}`
    : p.status === "sent" ? (p.arrivesBy ? `Expected ${date(p.arrivesBy)}` : "Goes out with Stripe's next daily payout")
      : p.status === "pending" ? (p.reason === "buddy_not_set_up" ? "Waits for the Buddy's payout setup" : "Sending shortly")
        : p.status === "failed" ? "Bank rejected it" : "Taken back after a refund or dispute";
const PER = 50;

function StripeTable({ filter }: { filter: "all" | "attention" }) {
  const [page, setPage] = useState(1);
  const list = useLoad(() => api<StripePayout[]>("admin/payouts/stripe", { query: { status: filter, page, limit: PER } }), [filter, page]);
  const rows = list.data?.data ?? [], pages = Math.max(1, Math.ceil((list.data?.count ?? 0) / PER));
  const attention = filter === "attention";
  if (list.error) return <LoadError message={list.error} retry={list.reload} />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="stack">
        <thead><tr><th>Job</th><th>Buddy</th><th className="r">Amount</th>{attention ? <th>What to do</th> : <><th>Status</th><th className="hs">Reached bank / expected</th></>}</tr></thead>
        <tbody>
          {list.loading && !list.data ? <SkeletonRows cols={attention ? 4 : 5} /> : rows.map((p) => {
            const [c, word, Icon] = STATUS[p.status] ?? ["c-mut", p.status, Clock];
            const v = p.vendor, why = REASON[p.reason ?? ""];
            return (
              <tr key={p._id} style={p.status === "failed" ? { boxShadow: "inset 3px 0 0 var(--bad)" } : undefined}>
                <td>{p.bookingId ? <Link className="mono" href={`/bookings?open=${p._id}`}>{p.bookingId}</Link> : "—"}{p.serviceName && <><br /><span className="hint">{p.serviceName}</span></>}</td>
                <td><b>{v?.name || "Buddy"}</b>
                  {attention && v?.email && <><br /><a className="hint" href={`mailto:${v.email}`}>{v.email}</a></>}
                  {v?.phone && <><br /><span className="hint">{phone(v.phone)}</span></>}</td>
                <td className="r"><b>{money(p.amount)}</b>{p.checkOutAt && <><br /><span className="hint">{date(p.checkOutAt)}</span></>}</td>
                {attention ? <td>{why ? <><b>{why[0]}</b><br /><span className="hint">{why[1]}</span></> : "—"}</td> : <>
                  <td><span className={`chip ${c}`}><Icon size={12} weight="bold" aria-hidden />{word}</span></td>
                  <td className="hs">{landing(p)}</td>
                </>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!list.loading && !rows.length && (attention
        ? <Empty icon={CheckCircle} title="Nothing needs attention">Failed payouts and jobs waiting on a Buddy&apos;s payout setup show here.</Empty>
        : <Empty icon={CheckCircle} title="No payouts yet">Each completed job&apos;s payout shows here.</Empty>)}
      {pages > 1 && <div className="tbar" style={{ borderBottom: 0, justifyContent: "flex-end" }}><span className="hint">Page {page} of {pages}</span>
        <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
    </div>
  );
}
