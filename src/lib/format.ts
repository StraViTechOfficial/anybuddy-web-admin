// Money, dates, phones and names: one place. Business time zone is America/New_York (D-32).
export const TZ = "America/New_York";

export const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });
/** "Sep 30, 2026" */
export const date = (d: string | Date) => fmt({ month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
/** "13:00" (backend slot) → "1:00 PM". */
export const clock = (hhmm?: string | null) => {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) ? `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` : "";
};
/** Booking date + slot: "Sep 30, 2026 · 1:00 PM". */
export const when = (d: string, slot?: string | null) => date(d) + (slot ? " · " + clock(slot) : "");

/** US phone: 6175557201 → "+1 (617) 555-7201"; anything else as given. */
export const phone = (p?: string | null, cc?: string | null) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1); // "+1 6175557201" arrives with the country code inside
  return d.length === 10 && (!cc || cc === "+1") ? `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : [cc, p].filter(Boolean).join(" ") || "—";
};
export const fullName = (p?: { firstName?: string | null; lastName?: string | null } | null) =>
  [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim() || "—";
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

/** Booking status in the words every AnyBuddy screen uses (1 request, 2 scheduled, 3 completed, 4 canceled/expired). */
export type BookingState = "Request" | "Scheduled" | "Completed" | "Canceled" | "Expired";
export const bookingState = (b: { status: number; cancelledBy?: string | null }): BookingState =>
  b.status === 1 ? "Request" : b.status === 2 ? "Scheduled" : b.status === 3 ? "Completed" : b.cancelledBy === "system" ? "Expired" : "Canceled";
/** "1 request", "3 requests". */
export const plural = (n: number | undefined, one: string, many = one + "s") => `${n ?? "–"} ${n === 1 ? one : many}`;
