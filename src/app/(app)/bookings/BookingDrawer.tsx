"use client";
import { useState } from "react";
import Link from "next/link";
import { Warning, Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { bookingState, clock, date, dateAt, fullName, money, phone, when } from "@/lib/format";
import type { Person } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { StateChip } from "@/components/ui";
import { useToast } from "@/components/Toast";
import s from "./bookings.module.css";

type Detail = {
  _id: string; bookingId: string; serviceName: string; categoryName?: string; scheduledDate: string; selectedSlot: string; endTime?: string; address?: string; userDesc?: string;
  status: number; cancelledBy?: string | null; cancelReason?: string | null; price: number; taxAmount?: number; commissionAmount?: number; vendorPriceAfterDetection?: number;
  createdAt?: string; acceptedAt?: string; checkInAt?: string; checkOutAt?: string; hoursBilled?: number; hoursWorked?: number; expiresAt?: string;
  checkoutRefundAmount?: number; checkoutRefundStatus?: string | null; checkInImages?: string[]; checkOutImages?: string[];
  payoutStatus?: string | null; payoutAmount?: number | null; payoutSentAt?: string | null; payoutArrivesBy?: string | null; payoutPaidAt?: string | null;
  serviceProvider?: Person; userDetails?: Person;
};
const at = dateAt;
// The Buddy's payout. In Stripe mode it goes to their Stripe account and is then paid out to their bank. In manual
// mode the admin pays it by hand.
const payout = (b: Detail) => {
  const amt = money(b.payoutAmount ?? b.vendorPriceAfterDetection ?? 0);
  const when = (d?: string | null) => (d ? ` · ${at(d)}` : "");
  switch (b.payoutStatus) {
    case "pending": return `${amt} not sent yet`;
    case "sent": return `${amt} sent to the Buddy's Stripe account${when(b.payoutSentAt)}${b.payoutArrivesBy ? ` · reaches their bank by ${date(b.payoutArrivesBy)}` : ""}`;
    case "paid": return `${amt} paid${b.payoutPaidAt ? when(b.payoutPaidAt) : b.payoutArrivesBy ? ` · ${date(b.payoutArrivesBy)}` : ""}`;
    case "failed": return `${amt} · payout failed`;
    case "reversed": return `Part taken back after a refund · ${amt} kept by the Buddy`;
    default: return "";
  }
};

/** Shows everything about one booking. Cancelling or refunding from here would need the admin endpoint. */
export function BookingDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const { data: b, error, reload } = useLoad(() => api<Detail | Detail[]>("admin/booking-management/detail", { query: { bookingId: id } }).then((r) => (Array.isArray(r.data) ? r.data[0] : r.data)), [id]);
  const [busy, setBusy] = useState(false);
  const st = b && bookingState(b);

  async function retry() {
    setBusy(true);
    try { await api("admin/booking-management/retry-checkout-refund", { method: "POST", body: { bookingId: id } }); toast("Refund sent again"); reload(); }
    catch (e) { toast((e as Error).message); }
    setBusy(false);
  }
  const steps: [string, string | undefined, "done" | "bad" | ""][] = !b ? [] : [
    ["Requested and paid", at(b.createdAt), "done"],
    ...(st === "Expired" ? [["No Buddy reply in time · full refund", b.cancelReason ?? "", "bad"] as [string, string, "bad"]]
      : st === "Canceled" ? [[`Canceled by ${b.cancelledBy === "provider" ? "the Buddy" : b.cancelledBy ?? "someone"}`, b.cancelReason ?? "", "bad"] as [string, string, "bad"]]
      : [
        ["Buddy accepted", at(b.acceptedAt), b.status >= 2 ? "done" : ""],
        ["Checked in", at(b.checkInAt), b.checkInAt ? "done" : ""],
        ["Checked out", b.checkOutAt ? `${at(b.checkOutAt)} · ${b.hoursWorked ?? "–"} h worked, ${b.hoursBilled ?? "–"} h billed` : "", b.checkOutAt ? "done" : ""],
        ["Paid out to the Buddy", payout(b), b.payoutStatus === "paid" ? "done" : b.payoutStatus === "failed" ? "bad" : ""],
      ] as [string, string, "done" | "bad" | ""][]),
  ];

  return (
    <Modal drawer onClose={onClose}
      title={<><span className="hint">Booking</span><h2 className="mono" style={{ fontSize: 20, margin: "2px 0 8px" }}>{b?.bookingId ?? "…"}</h2>{st && <StateChip state={st} />}</>}
      footer={<><Link className="btn" href={`/money?q=${b?.bookingId ?? ""}`}>Money trail</Link><button className="btn p" onClick={onClose}>Done</button></>}>
      {error && <p className="err">{error}</p>}
      {!b && !error && <div className="skeleton" style={{ height: 240 }} />}
      {b && <>
        {b.status === 1 && new Date(`${b.scheduledDate.slice(0, 10)}T${b.selectedSlot}`) < new Date() && <div className="note"><Warning size={16} />The start time passed and this request is still open. The expiry sweep normally cancels it with a full refund.</div>}
        <dl className="kv">
          <dt>Service</dt><dd>{b.serviceName}{b.categoryName && <span className="muted"> · {b.categoryName}</span>}</dd>
          <dt>When</dt><dd>{when(b.scheduledDate, b.selectedSlot)}{b.endTime && ` – ${clock(b.endTime)}`} ET</dd>
          <dt>Where</dt><dd>{b.address || "—"}</dd>
          <dt>Customer</dt><dd><Link className={s.link} href={`/customers/${b.userDetails?._id}`}>{fullName(b.userDetails)}</Link></dd>
          <dt>Buddy</dt><dd><Link className={s.link} href={`/buddies/${b.serviceProvider?._id}?s=1`}>{fullName(b.serviceProvider)}</Link> <span className="muted">{phone(b.serviceProvider?.phone, b.serviceProvider?.countryCode)}</span></dd>
          {b.userDesc && <><dt>Job notes</dt><dd>{b.userDesc}</dd></>}
        </dl>
        <section><h3 className={s.h3}>Money</h3>
          <div className={s.money}>
            <div><span>Customer paid</span><b>{money(b.price)}</b></div>
            <div><span>Sales tax</span><span>{money(b.taxAmount ?? 0)}</span></div>
            <div><span>Commission</span><span>{money(b.commissionAmount ?? 0)}</span></div>
            {!!b.checkoutRefundAmount && <div><span>Refund at check-out</span><span>{money(b.checkoutRefundAmount)} · {b.checkoutRefundStatus}</span></div>}
            {(st === "Expired" || st === "Canceled") && <div><span>Refund</span><span>Full refund</span></div>}
            <div className={s.tot}><span>Buddy earns</span><span>{money(b.vendorPriceAfterDetection ?? 0)}</span></div>
          </div>
          {b.checkoutRefundStatus === "failed" && <div className="note" style={{ marginTop: 10 }}><Warning size={16} /><span>The check-out refund failed. <button className="btn sm" onClick={retry} disabled={busy}>Retry refund</button></span></div>}
        </section>
        <section><h3 className={s.h3}>Timeline</h3>
          <ol className={s.tl}>{steps.map(([t, sub, c]) => <li key={t} className={c ? s[c] : ""}>{t}{sub && <small>{sub}</small>}</li>)}</ol>
        </section>
        {!!(b.checkInImages?.length || b.checkOutImages?.length) && (
          <section><h3 className={s.h3}>Job photos</h3><div className={s.photos}>{[...(b.checkInImages ?? []), ...(b.checkOutImages ?? [])].map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="Job photo" /></a>)}</div></section>
        )}
        {(b.status === 1 || b.status === 2) && <div className="note"><Info size={16} />Canceling or refunding from here isn't available yet. The customer or Buddy can cancel in their app.</div>}
      </>}
    </Modal>
  );
}
