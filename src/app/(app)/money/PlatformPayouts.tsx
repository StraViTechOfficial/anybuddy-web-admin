"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Bank, CheckCircle, Clock, Info, XCircle } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import s from "./money.module.css";

// Payouts to AnyBuddy's account at Citizens. The Stripe payout schedule is deliberately set to Manual, so AnyBuddy's own
// money (commission and the sales tax it holds) reaches its bank only from this screen. The backend recalculates the
// safe amount on every payout.
type Balance = {
  available: number; pending: number; held: number; reserve: number; safeToPayOut: number;
  lines: { label: string; amount: number; href?: string }[]; bank: { bankName: string | null; last4: string } | null; schedule: string | null;
};
type Payout = { id: string; amount: number; created: string; arrivalDate: string | null; status: string; failureMessage: string | null };
const STATUS: Record<string, [string, string, React.ElementType]> = {
  pending: ["c-info", "In transit", Clock], in_transit: ["c-info", "In transit", Clock], paid: ["c-ok", "Paid", CheckCircle],
  failed: ["c-bad", "Failed", XCircle], canceled: ["c-mut", "Canceled", XCircle],
};

export function PlatformPayouts() {
  const bal = useLoad(() => api<Balance>("admin/money/platform-balance").then((r) => r.data));
  const hist = useLoad(() => api<Payout[]>("admin/money/platform-payouts", { query: { limit: 10 } }).then((r) => r.data));
  const [paying, setPaying] = useState(false);
  const b = bal.data;
  const bankName = `${b?.bank?.bankName ? titleCase(b.bank.bankName) : "Citizens"} ••${b?.bank?.last4 ?? "7901"}`;
  const refresh = () => { bal.reload(); hist.reload(); };

  return (
    <section className="box">
      <header className="bh">
        <h2>Payouts to Citizens</h2>
        <button className="btn p" type="button" disabled={!b || b.safeToPayOut <= 0} onClick={() => setPaying(true)}><Bank size={16} aria-hidden />Pay out to {bankName}</button>
      </header>
      <div style={{ padding: "16px 18px 18px" }}>
        {bal.error ? <p className="err">{bal.error}</p> : <>
          {b?.schedule && b.schedule !== "manual" && <div className="note" style={{ marginBottom: 14 }}><Info size={16} />Stripe is paying out automatically every day. Switch the payout schedule to Manual in Stripe to control payouts here.</div>}
          <div className={s.kpis}>
            <div><small>Available in Stripe</small><b>{b ? money(b.available) : "—"}</b><span className="hint">Ready to move to the bank</span></div>
            <div><small>On the way from customers</small><b>{b ? money(b.pending) : "—"}</b><span className="hint">Pending at Stripe, available in a few days</span></div>
            <div><small>Held for open jobs</small><b>{b ? money(b.held + b.reserve) : "—"}</b><span className="hint">Unfinished jobs, Buddy payouts not sent, refund reserve</span></div>
            <div><small>Safe to pay out</small><b>{b ? money(b.safeToPayOut) : "—"}</b><span className="hint">Available minus what is held</span></div>
          </div>
          {b && <div className={s.fees}>{b.lines.slice(1, -1).map((l) => <span key={l.label}>{l.href ? <Link href={l.href}>{l.label}</Link> : l.label} <b>{money(l.amount)}</b></span>)}</div>}
        </>}
        <h3 style={{ fontSize: 13, fontWeight: 600, margin: "18px 0 8px" }}>Latest payouts</h3>
        {hist.error ? <p className="err">{hist.error}</p> : hist.data && !hist.data.length ? <p className="hint">No payouts to the bank yet.</p> : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Date</th><th className="r">Amount</th><th>Status</th><th>Expected arrival</th></tr></thead>
              <tbody>{(hist.data ?? []).map((p) => {
                const [c, word, Icon] = STATUS[p.status] ?? ["c-mut", p.status, Clock];
                return (
                  <tr key={p.id}>
                    <td>{date(p.created)}</td>
                    <td className="r">{money(p.amount)}</td>
                    <td><span className={`chip ${c}`}><Icon size={12} weight="bold" aria-hidden />{word}</span>{p.failureMessage && <><br /><span className="hint">{p.failureMessage}</span></>}</td>
                    <td>{p.arrivalDate ? date(p.arrivalDate) : "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>
      {paying && b && <PayOut safe={b.safeToPayOut} bankName={bankName} onClose={() => setPaying(false)} onDone={() => { setPaying(false); refresh(); }} />}
    </section>
  );
}

const titleCase = (x: string) => x.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** The confirm step. The amount starts at the safe maximum and can be lowered, but never raised above it. */
function PayOut({ safe, bankName, onClose, onDone }: { safe: number; bankName: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(safe.toFixed(2));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // A stable close function, so Modal's focus effect runs only once. Closing is blocked while the payout is sending, as
  // in ReasonDialog.
  const busyRef = useRef(false), closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => { if (!busyRef.current) closeRef.current(); }, []);
  // One key per confirm step, so a double click or a retry after a network error pays only once.
  const [key] = useState(() => crypto.randomUUID());
  const amount = Number(text);
  const problem = !/^\d+(\.\d{1,2})?$/.test(text.trim()) ? "Enter an amount in dollars, like 250.00."
    : amount <= 0 ? "Enter an amount above $0."
    : amount > safe ? `Enter ${money(safe)} or less. The rest is held for open jobs.` : "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return setErr(problem);
    setBusy(busyRef.current = true);
    try {
      await api("admin/money/platform-payouts", { method: "POST", body: { amount, idempotencyKey: key } });
      toast(`${money(amount)} is on its way to ${bankName}`);
      onDone();
    } catch (x) { setErr((x as Error).message); setBusy(busyRef.current = false); }
  }

  return (
    <Modal title={`Pay out to ${bankName}`} onClose={close}
      footer={<><button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button><button className="btn p" form="poF" disabled={busy} aria-busy={busy}>{busy ? "Sending…" : `Pay out ${problem ? "" : money(amount)}`}</button></>}>
      <p>Moves Any-Buddy&apos;s own money from Stripe to {bankName}. It usually lands in 1–2 business days.</p>
      <form id="poF" className="field" onSubmit={submit} noValidate>
        <label htmlFor="poA" style={{ fontWeight: 600 }}>Amount (USD)</label>
        <input id="poA" className="input" inputMode="decimal" autoFocus value={text} aria-invalid={!!err} aria-describedby="poH"
          onChange={(e) => { setText(e.target.value); setErr(""); }} />
        {err ? <span id="poH" className="err" role="alert">{err}</span> : <span id="poH" className="hint">Up to {money(safe)}, what is safe to pay out now.</span>}
      </form>
    </Modal>
  );
}
