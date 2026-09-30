// Manual payouts while Stripe Connect is on hold (owner, 30 Sep, relayed by the main session): one "requested"
// payout per completed job; the admin pays it from Citizens online banking and records the reference.
// The backend reply is still settling, so every field is read defensively in one place.
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
    // Full number only on "requested" rows; paid/rejected rows carry accountLast4 (backend, 30 Sep).
    account: v.accountNumber ?? v.account_number, last4: v.accountLast4, type: v.accountType,
  };
};
export const jobOf = (p: Payout) => {
  const b = p.booking ?? (typeof p.bookingId === "object" ? p.bookingId : null);
  return { number: b?.bookingId, service: b?.serviceName, doneAt: b?.checkOutAt ?? p.requestedAt ?? p.createdAt };
};

/** "3 hr 10 min", "45 min", "2 days" since a time. Hours and minutes only (owner D-58). */
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
