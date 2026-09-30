"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Warning, Clock } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, fullName, money, phone } from "@/lib/format";
import type { Person } from "@/lib/types";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { type Payout, vendorOf, jobOf, ageText, isLate, LATE_HOURS } from "./data";
import { PaySheet } from "./PaySheet";

type Tab = "requested" | "paid" | "rejected" | "stripe";
type StripeIssue = { _id: string; bookingId: string; payoutAmount?: number; checkOutAt?: string; vendorId?: Person & { payoutAccountStatus?: string } };
const TABS: [Tab, string][] = [["requested", "To send"], ["paid", "Paid"], ["rejected", "Rejected"], ["stripe", "Stripe (when enabled)"]];

export default function Page() { return <Suspense><Payouts /></Suspense>; }

function Payouts() {
  const q = useSearchParams(), router = useRouter();
  const tab = (q.get("tab") ?? "requested") as Tab;
  const [open, setOpen] = useState<Payout | null>(null);
  const counts = useLoad(() => api<Payout[]>("admin/payouts", { query: { status: "requested", limit: 1 } }).then((r) => r.count ?? 0));
  const list = useLoad(async () => {
    if (tab === "stripe") return { stripe: (await api<StripeIssue[]>("admin/payouts/stripe", { query: { status: "failed" } }).catch(() => ({ data: [] as StripeIssue[] }))).data ?? [] };
    const r = await api<Payout[]>("admin/payouts", { query: { status: tab, limit: 100 } });
    // Oldest first on "To send": the longest wait gets paid first.
    const rows = (r.data || []).sort((a, b) => (tab === "requested" ? 1 : -1) * (new Date(jobOf(a).doneAt ?? 0).getTime() - new Date(jobOf(b).doneAt ?? 0).getTime()));
    return { rows };
  }, [tab]);
  const rows = (list.data && "rows" in list.data ? list.data.rows : undefined) ?? [];
  const stripe = (list.data && "stripe" in list.data ? list.data.stripe : undefined) ?? [];
  const due = rows.reduce((a, p) => a + (p.amount || 0), 0);
  const late = rows.filter((p) => isLate(jobOf(p).doneAt)).length;

  return (
    <>
      <PageHead title="Payouts" sub="Buddies are paid by hand after each job while Stripe payouts are on hold. Pay from Citizens, then record it here." />
      {tab === "requested" && rows.length > 0 && (
        <div className={`note`} style={late ? { borderColor: "var(--bad)", background: "var(--bad-soft)" } : undefined}>
          {late ? <Warning size={16} color="var(--bad)" /> : <Clock size={16} />}
          <span><b>{rows.length} to send · {money(due)}</b>{late > 0 && <> · {late} waiting over {LATE_HOURS} hours</>}. Oldest first.</span>
        </div>
      )}
      <section className="box">
        <div className="tbar"><div className="seg" role="tablist">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => router.replace(`/payouts?tab=${k}`)}>{l}{k === "requested" && <em>{counts.data ?? "–"}</em>}</button>)}
        </div></div>
        {list.error ? <LoadError message={list.error} retry={list.reload} /> : tab === "stripe" ? (
          <>
            <p className="hint" style={{ padding: "12px 18px 0" }}>Jobs whose Stripe payout failed. Ask the Buddy to update their bank details.</p>
            {stripe.length ? <table className="stack"><thead><tr><th>Buddy</th><th>Job</th><th className="r">Amount</th><th className="hs">Checked out</th></tr></thead>
              <tbody>{stripe.map((r) => <tr key={r._id}><td>{fullName(r.vendorId)}</td><td><Link className="mono" href={`/bookings?open=${r._id}`}>{r.bookingId}</Link></td><td className="r">{money(r.payoutAmount ?? 0)}</td><td className="hs">{r.checkOutAt ? date(r.checkOutAt) : "—"}</td></tr>)}</tbody></table>
              : <Empty icon={CheckCircle} title="No failed Stripe payouts" />}
          </>
        ) : (
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
                      <td className="hs">{tab === "paid" && p.paidAt ? date(p.paidAt) : j.doneAt ? `${date(j.doneAt)} · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(j.doneAt))} ET` : "—"}</td>
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
      {open && <PaySheet p={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); list.reload(); counts.reload(); }} />}
    </>
  );
}
