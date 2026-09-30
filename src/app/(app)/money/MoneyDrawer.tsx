"use client";
import Link from "next/link";
import { Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, money } from "@/lib/format";
import { Modal } from "@/components/Modal";
import b from "../bookings/bookings.module.css";
import s from "./money.module.css";

type Line = { at: string; section: "in" | "out" | "recovered"; label: string; amount: number; held: boolean; status: string | null; ref: string | null };
type Trail = { _id: string; bookingId: string | null; hasLedger: boolean; lines: Line[]; totals: { in: number; out: number; recovered: number; net: number; commission: number; fees: number } };
/** What the booking record says, for bookings from before the ledger. */
export type Recorded = { paid: number; refunded: number; tax: number; fee: number; earned: number };

const time = (d: string) => `${date(d)} · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(d))}`;
const SECTIONS = [["in", "In", "From the customer"], ["out", "Out", "Refunds, Stripe fees, the Buddy's share and tax held"], ["recovered", "Recovered", "Stripe fees taken back from the Buddy (D-31)"]] as const;

/** One booking's money statement from the ledger: In − Out + Recovered = Net to AnyBuddy. */
export function MoneyDrawer({ id, code, recorded, onClose }: { id: string; code: string; recorded: Recorded; onClose: () => void }) {
  const { data: t, error } = useLoad(() => api<Trail>(`admin/money/bookings/${id}/trail`).then((r) => r.data), [id]);
  return (
    <Modal drawer onClose={onClose}
      title={<><span className="hint">Money for</span><h2 className="mono" style={{ fontSize: 20, margin: "2px 0 0" }}>{code}</h2></>}
      footer={<><Link className="btn" href={`/bookings?open=${id}`}>Booking</Link><button className="btn p" onClick={onClose}>Done</button></>}>
      {error && <p className="err">{error}</p>}
      {!t && !error && <div className="skeleton" style={{ height: 240 }} />}
      {t?.hasLedger && <>
        {SECTIONS.map(([k, title, sub]) => {
          const lines = t.lines.filter((l) => l.section === k);
          return lines.length > 0 && (
            <section key={k}><h3 className={b.h3}>{title} <span className="hint">· {sub}</span></h3>
              <div className={b.money}>
                {lines.map((l, i) => (
                  <div key={i}>
                    <span>{l.label}<small className={s.sub}>{time(l.at)}{l.held && " · held, not paid out yet"}{l.status && ` · ${l.status}`}{l.ref && <> · <span className="mono">{l.ref}</span></>}</small></span>
                    <span>{k === "out" ? "− " : k === "recovered" ? "+ " : ""}{money(l.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        <section><h3 className={b.h3}>Net to AnyBuddy</h3>
          <div className={b.money}>
            <div><span>In</span><span>{money(t.totals.in)}</span></div>
            <div><span>Out</span><span>− {money(t.totals.out)}</span></div>
            <div><span>Recovered</span><span>+ {money(t.totals.recovered)}</span></div>
            <div className={b.tot}><span>Net to AnyBuddy</span><span>{money(t.totals.net)}</span></div>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Net is the commission kept ({money(t.totals.commission)}) minus Stripe fees ({money(t.totals.fees)}) plus recoveries. Lines marked held are money AnyBuddy still holds for the Buddy, the state or the job.</p>
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
