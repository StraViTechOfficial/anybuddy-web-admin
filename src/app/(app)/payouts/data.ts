// Manual payouts, used while Stripe Connect is on hold. Each completed job creates one "requested" payout. The admin
// pays it from Citizens online banking and records the reference. The backend's reply format may still change, so
// every field is read defensively here, in one place.
import { api } from "@/lib/api";

type Maybe<T> = T | null | undefined;
export type Payout = {
  _id: string; amount: number; status: "requested" | "paid" | "rejected"; auto?: boolean; requestedAt?: string; paidAt?: string; createdAt?: string;
  reference?: string; note?: string; reason?: string;
  bookingId?: Maybe<string | { bookingId?: string; serviceName?: string; checkOutAt?: string }>;
  booking?: Maybe<{ bookingId?: string; serviceName?: string; checkOutAt?: string }>;
  vendor?: Maybe<{ name?: string; phone?: string; email?: string; bankName?: string; accountHolder?: string; account_holder_name?: string; routingNumber?: string; routing_number?: string; accountNumber?: string; account_number?: string; accountLast4?: string; accountType?: string }>;
};

export const vendorOf = (p: Payout) => {
  const v = p.vendor ?? {};
  return {
    name: v.name || "Buddy", phone: v.phone, email: v.email, bank: v.bankName,
    holder: v.accountHolder ?? v.account_holder_name, routing: v.routingNumber ?? v.routing_number,
    // The backend sends the full account number only on "requested" rows. Paid and rejected rows carry accountLast4.
    account: v.accountNumber ?? v.account_number, last4: v.accountLast4, type: v.accountType,
  };
};
export const jobOf = (p: Payout) => {
  const b = p.booking ?? (typeof p.bookingId === "object" ? p.bookingId : null);
  return { number: b?.bookingId, service: b?.serviceName, doneAt: b?.checkOutAt ?? p.requestedAt ?? p.createdAt };
};

/** How long ago a time was, such as "3 hr 10 min" or "45 min". From 48 hours on it shows whole days, such as "2 days". */
export const ageText = (since?: string) => {
  if (!since) return "";
  const min = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 6e4));
  if (min >= 48 * 60) return `${Math.floor(min / 1440)} days`;
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
};
/** Waiting longer than this shows in red: Buddies were promised payment right after the job. */
export const LATE_HOURS = 3;
export const isLate = (since?: string) => !!since && Date.now() - new Date(since).getTime() > LATE_HOURS * 36e5;

// When the backend sets PAYOUTS_MODE=stripe, Buddies are paid by a Stripe transfer at check-out, and Stripe then pays
// it out to their bank.
export type Mode = "manual" | "stripe";
export type StripePayout = {
  _id: string; bookingId: string | null; serviceName: string | null; checkOutAt: string | null; amount: number | null;
  status: "pending" | "sent" | "paid" | "failed" | "reversed"; reason: "bank_failed" | "buddy_not_set_up" | "waiting" | null;
  sentAt: string | null; arrivesBy: string | null; paidAt: string | null; transferId: string | null;
  vendor: { name: string; email: string | null; phone: string | null; payoutAccountStatus: string } | null;
};
/** Returns manual unless the backend says stripe. An older backend has no /config, so it counts as manual. */
export const payoutMode = () =>
  api<{ mode?: string }>("admin/payouts/config").then((r): Mode => (r.data?.mode === "stripe" ? "stripe" : "manual"), (): Mode => "manual");

/** The number shown on the sidebar badge and the dashboard. In manual mode it counts payouts still to send. In Stripe
 *  mode it counts payouts that need attention plus old manual payouts still to send. Normal Stripe payouts never count. */
export async function payoutAlerts() {
  const mode = await payoutMode();
  const lists = await Promise.all([
    api<{ amount: number | null }[]>("admin/payouts", { query: { status: "requested", limit: 100 } }),
    ...(mode === "stripe" ? [api<StripePayout[]>("admin/payouts/stripe", { query: { status: "attention", limit: 100 } })] : []),
  ]);
  return {
    mode,
    n: lists.reduce((a, l) => a + (l.count ?? l.data?.length ?? 0), 0),
    sum: lists.flatMap((l): { amount: number | null }[] => l.data || []).reduce((a, p) => a + (p.amount || 0), 0),
  };
}
