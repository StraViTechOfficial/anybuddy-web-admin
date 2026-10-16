// Formatting for money, dates, phone numbers, names and CSV files, all in one place. Business time is New York time
// (America/New_York).
export const TZ = "America/New_York";

export const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts });
/** "Sep 30, 2026" */
export const date = (d: string | Date) => fmt({ month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
/** "Oct 3, 10:23 AM" */
export const dateTime = (d: string | Date) => fmt({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d));
/** "Sep 30, 2026 · 1:00 PM" (empty for no date). */
export const dateAt = (d?: string | Date | null) =>
  d ? `${date(d)} · ${fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(d))}` : "";
/** Turns a backend slot such as "13:00" into "1:00 PM". */
export const clock = (hhmm?: string | null) => {
  const [h, m] = String(hhmm ?? "").split(":").map(Number);
  return Number.isFinite(h) ? `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` : "";
};
/** A booking's date and slot, such as "Sep 30, 2026 · 1:00 PM". */
export const when = (d: string, slot?: string | null) => date(d) + (slot ? " · " + clock(slot) : "");

/** Formats a US phone number, so 6175557201 becomes "+1 (617) 555-7201". Anything else is returned as given. */
export const phone = (p?: string | null, cc?: string | null) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1); // a number like "+1 6175557201" arrives with the country code included
  return d.length === 10 && (!cc || cc === "+1") ? `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : [cc, p].filter(Boolean).join(" ") || "—";
};
/** "First Middle Last". Buddies may have a middle name. */
export const fullName = (p?: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | null) =>
  [p?.firstName, p?.middleName, p?.lastName].filter(Boolean).join(" ").trim() || "—";
/** First and last initial, so a middle name doesn't take the second letter. */
export const initials = (name: string) => { const w = name.split(/\s+/).filter(Boolean); return ((w[0]?.[0] ?? "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };

/** Booking status in the words every AnyBuddy screen uses (1 request, 2 scheduled, 3 completed, 4 canceled/expired). */
export type BookingState = "Request" | "Scheduled" | "Completed" | "Canceled" | "Expired";
export const bookingState = (b: { status: number; cancelledBy?: string | null }): BookingState =>
  b.status === 1 ? "Request" : b.status === 2 ? "Scheduled" : b.status === 3 ? "Completed" : b.cancelledBy === "system" ? "Expired" : "Canceled";
/** "1 request", "3 requests". */
export const plural = (n: number | undefined, one: string, many = one + "s") => `${n ?? "–"} ${n === 1 ? one : many}`;

// Every CSV cell is quoted. A cell that starts with = + - or @ gets a leading ' so a spreadsheet never runs it as a
// formula.
const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
/** Saves rows (header first) as a UTF-8 CSV that Excel opens correctly: "<name>-YYYY-MM-DD.csv". */
export const downloadCsv = (name: string, rows: unknown[][]) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + rows.map((l) => l.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};
