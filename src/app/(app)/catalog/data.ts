import { api } from "@/lib/api";

export type Category = {
  _id: string; categoryName: string; description?: string; icon?: string; image?: string; isActive: number; subcategoryCount?: number;
  licenceRequired?: boolean; licenceName?: string; rateMin?: number | null; rateMax?: number | null; // dollars per hour; null means no limit
};
/** A Buddy's hourly price that falls outside its category's rate range. The server lists these but never changes them. */
export type OutOfRange = { serviceId: string; serviceName: string; price: number | null; categoryId: string; categoryName: string; rateMin: number | null; rateMax: number | null; vendorId: string; firstName?: string; lastName?: string };
export type Steps = { taskLocation?: boolean; yourTask?: boolean; describe?: boolean; vehicle?: boolean; startAddress?: boolean; endAddress?: boolean };
export type Service = { _id: string; serviceName: string; description?: string; icon?: string; image?: string; isActive: number; categoryId: string; categoryName?: string; serviceTaskArr?: Steps | null };
export type Price = { fromPrice: number; priceUnit: "hour" | "day" | null };
export type Catalog = { cats: Category[]; retired: Category[]; services: Service[]; prices: Record<string, Price>; outOfRange: OutOfRange[] };

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
// Uses the same order as the customer apps (byCategoryPriority in services/user/homepage.ts): Plumbing, Electrical,
// then the rest from A to Z. Admins can't reorder categories yet, because that needs a sort field on the server.
const rank = (n: string) => (/plumb/i.test(n) ? 0 : /electric/i.test(n) ? 1 : 2);
export const byPriority = (a: Category, b: Category) => rank(a.categoryName) - rank(b.categoryName) || a.categoryName.localeCompare(b.categoryName);
export const pinned = (n: string) => rank(n) < 2;
export const priceText = (p?: Price) => (p ? `From $${p.fromPrice}${p.priceUnit === "hour" ? "/hr" : p.priceUnit === "day" ? "/day" : ""}` : "");

/** The booking steps a customer fills in. When a flag is missing, the customer website treats the location, size and
 *  description steps as switched on (book/page.js). */
export const stepsOf = (s?: Steps | null) => ({ describe: s?.describe ?? true, vehicle: !!s?.vehicle, route: !!(s?.startAddress && s?.endAddress) });
export const stepsBody = (x: { describe: boolean; vehicle: boolean; route: boolean }): Steps =>
  ({ taskLocation: true, yourTask: true, describe: x.describe, vehicle: x.vehicle, startAddress: x.route, endAddress: x.route });

export async function loadCatalog(): Promise<Catalog> {
  const [on, off, svcOn, svcOff, home, out] = await Promise.all([
    api<Category[]>("admin/categories/list", { query: { status: 1, limit: 100 } }),
    api<Category[]>("admin/categories/list", { query: { status: 0, limit: 100 } }).catch(() => ({ data: [] as Category[] })),
    api<Service[]>("admin/services/list", { query: { status: 1, limit: 500 } }),
    api<Service[]>("admin/services/list", { query: { status: 0, limit: 500 } }).catch(() => ({ data: [] as Service[] })),
    api<{ services: { services: { serviceName: string; fromPrice: number; priceUnit: Price["priceUnit"] }[] }[] }>("user/homepage").catch(() => null),
    api<OutOfRange[]>("admin/categories/out-of-range").catch(() => null),
  ]);
  const prices: Record<string, Price> = {};
  for (const g of home?.data.services ?? []) for (const x of g.services) if (x.fromPrice > 0) prices[x.serviceName] = { fromPrice: x.fromPrice, priceUnit: x.priceUnit };
  return { cats: (on.data || []).sort(byPriority), retired: off.data || [], services: [...(svcOn.data || []), ...(svcOff.data || [])], prices, outOfRange: out?.data || [] };
}

/** Formats a rate range as "$40–$90/hr", "From $40/hr" or "Up to $90/hr", or "" when there is no range. */
export const rangeText = (min?: number | null, max?: number | null) =>
  min != null && max != null ? `$${min}–$${max}/hr` : min != null ? `From $${min}/hr` : max != null ? `Up to $${max}/hr` : "";

/** Rewrites the server's own messages in friendlier words. */
export const say = (e: unknown) => {
  const m = (e as Error).message || "";
  return /already exist/i.test(m) ? "That name is already taken. Pick another one or open the existing one." : m;
};
