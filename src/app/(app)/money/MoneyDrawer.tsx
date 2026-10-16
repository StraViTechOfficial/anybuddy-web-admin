"use client";
import Link from "next/link";
import { Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { dateAt, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import b from "../bookings/bookings.module.css";
import s from "./money.module.css";

// Every line's amount is positive, and its section gives the direction (see sign below). totals.held is different: it
// is signed, and a negative value means money was released.
type Section = "in" | "out" | "held" | "released" | "recovered";
type Line = { at: string; section: Section; label: string; amount: number; held: boolean; status: string | null; ref: string | null };
type Trail = { _id: string; bookingId: string | null; hasLedger: boolean; lines: Line[]; totals: { in: number; out: number; held: number; recovered: number; net: number; commission: number; fees: number } };
/** What the booking record itself says, for bookings made before the money ledger existed. */
export type Recorded = { paid: number; refunded: number; tax: number; fee: number; earned: number };

const time = dateAt;
const SECTIONS: [Section, string, string, string][] = [
  ["in", "Money in", "From the customer", ""],
  ["out", "Money out", "Refunds, Stripe fees, the Buddy's share, sales tax", "− "],
  ["held", "Held for the job", "Until the job is done", "− "],
  ["released", "Released", "Held money freed when the job was done", "+ "],
  ["recovered", "Taken back from Buddies", "Stripe fees the Buddy paid back", "+ "],
];
// The Buddy payout's status in plain words. In manual mode it is paid or failed by the admin's bank transfer.
const STATUS: Record<string, string> = {
  owed: "not sent yet", pending: "not sent yet", sent: "sent to the Buddy's Stripe account", paid: "paid to the Buddy's bank",
  failed: "payout failed", reversed: "part taken back after a refund",
};

/** One booking's money statement from the ledger. Money in, minus money out, minus money held, plus money taken back,
 *  equals what AnyBuddy keeps. */
export function MoneyDrawer({ id, code, recorded, onClose }: { id: string; code: string; recorded: Recorded; onClose: () => void }) {
  const { data: t, error } = useLoad(() => api<Trail>(`admin/money/bookings/${id}/trail`).then((r) => r.data), [id]);
  return (
    <Modal drawer onClose={onClose}
      title={<><span className="hint">Money for</span><h2 className="mono" style={{ fontSize: 20, margin: "2px 0 0" }}>{code}</h2></>}
      footer={<><Link className="btn" href={`/bookings?open=${id}`}>Booking</Link><button className="btn p" onClick={onClose}>Done</button></>}>
      {error && <p className="err">{error}</p>}
      {!t && !error && <div className="skeleton" style={{ height: 240 }} />}
      {t?.hasLedger && <>
        {SECTIONS.map(([k, title, sub, sign]) => {
          const lines = t.lines.filter((l) => l.section === k);
          return lines.length > 0 && (
            <section key={k}><h3 className={b.h3}>{title} <span className="hint">· {sub}</span></h3>
              <div className={b.money}>
                {lines.map((l, i) => (
                  <div key={i}>
                    <span>{l.label}<small className={s.sub}>{time(l.at)}{l.held && " · still held by Any-Buddy"}{l.status && ` · ${STATUS[l.status] ?? l.status}`}{l.ref && <> · <span className="mono">{l.ref}</span></>}</small></span>
                    <span>{sign}{money(l.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section><h3 className={b.h3}>Kept by Any-Buddy</h3>
          <div className={b.money}>
            <div><span>Money in</span><span>{money(t.totals.in)}</span></div>
            <div><span>Money out</span><span>− {money(t.totals.out)}</span></div>
            {t.totals.held > 0 && <div><span>Held for the job</span><span>− {money(t.totals.held)}</span></div>}
            {t.totals.held < 0 && <div><span>Released when the job was done</span><span>+ {money(-t.totals.held)}</span></div>}
            {t.totals.recovered > 0 && <div><span>Taken back from Buddies</span><span>+ {money(t.totals.recovered)}</span></div>}
            <div className={b.tot}><span>Kept by Any-Buddy</span><span>{money(t.totals.net)}</span></div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>The commission ({money(t.totals.commission)}) minus Stripe fees ({money(t.totals.fees)}), plus fees taken back from the Buddy. &ldquo;Still held&rdquo; is money Any-Buddy holds for the Buddy, the state or the job.</p>
        </section>
      </>}
      {t && !t.hasLedger && <>
        <div className="note"><Info size={16} />This booking came before the money ledger. The figures below are from the booking record, not the ledger, and its Stripe fee isn&apos;t known.</div>
        <div className={b.money}>
          <div><span>Customer paid</span><span>{money(recorded.paid)}</span></div>
          <div><span>Refund to customer</span><span>{recorded.refunded ? `− ${money(recorded.refunded)}` : "—"}</span></div>
          <div><span>Stripe fee</span><span>—</span></div>
          <div><span>Sales tax</span><span>{money(recorded.tax)}</span></div>
          <div><span>Commission</span><span>{money(recorded.fee)}</span></div>
          <div className={b.tot}><span>Buddy earns</span><span>{recorded.earned ? money(recorded.earned) : "—"}</span></div>
        </div>
      </>}
    </Modal>
  );
}
