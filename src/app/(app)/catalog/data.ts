import { api } from "@/lib/api";

export type Category = { _id: string; categoryName: string; description?: string; icon?: string; image?: string; isActive: number; subcategoryCount?: number };
export type Steps = { taskLocation?: boolean; yourTask?: boolean; describe?: boolean; vehicle?: boolean; startAddress?: boolean; endAddress?: boolean };
export type Service = { _id: string; serviceName: string; description?: string; icon?: string; image?: string; isActive: number; categoryId: string; categoryName?: string; serviceTaskArr?: Steps | null };
export type Price = { fromPrice: number; priceUnit: "hour" | "day" | null };
export type Catalog = { cats: Category[]; retired: Category[]; services: Service[]; prices: Record<string, Price> };

export const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
// Same order rule as the customer apps (services/user/homepage.ts byCategoryPriority): Plumbing, Electrical, then A–Z.
// The owner can't reorder yet: that needs a sort field on the server (FEA-42).
const rank = (n: string) => (/plumb/i.test(n) ? 0 : /electric/i.test(n) ? 1 : 2);
export const byPriority = (a: Category, b: Category) => rank(a.categoryName) - rank(b.categoryName) || a.categoryName.localeCompare(b.categoryName);
export const pinned = (n: string) => rank(n) < 2;
export const priceText = (p?: Price) => (p ? `From $${p.fromPrice}${p.priceUnit === "hour" ? "/hr" : p.priceUnit === "day" ? "/day" : ""}` : "");

/** The booking steps a customer fills in; the web reads missing flags as on for location/size/describe (book/page.js). */
export const stepsOf = (s?: Steps | null) => ({ describe: s?.describe ?? true, vehicle: !!s?.vehicle, route: !!(s?.startAddress && s?.endAddress) });
export const stepsBody = (x: { describe: boolean; vehicle: boolean; route: boolean }): Steps =>
  ({ taskLocation: true, yourTask: true, describe: x.describe, vehicle: x.vehicle, startAddress: x.route, endAddress: x.route });

export async function loadCatalog(): Promise<Catalog> {
  const [on, off, svcOn, svcOff, home] = await Promise.all([
    api<Category[]>("admin/categories/list", { query: { status: 1, limit: 100 } }),
    api<Category[]>("admin/categories/list", { query: { status: 0, limit: 100 } }).catch(() => ({ data: [] as Category[] })),
    api<Service[]>("admin/services/list", { query: { status: 1, limit: 500 } }),
    api<Service[]>("admin/services/list", { query: { status: 0, limit: 500 } }).catch(() => ({ data: [] as Service[] })),
    api<{ services: { services: { serviceName: string; fromPrice: number; priceUnit: Price["priceUnit"] }[] }[] }>("user/homepage").catch(() => null),
  ]);
  const prices: Record<string, Price> = {};
  for (const g of home?.data.services ?? []) for (const x of g.services) if (x.fromPrice > 0) prices[x.serviceName] = { fromPrice: x.fromPrice, priceUnit: x.priceUnit };
  return { cats: (on.data || []).sort(byPriority), retired: off.data || [], services: [...(svcOn.data || []), ...(svcOff.data || [])], prices };
}

/** Friendlier words for the server's own messages. */
export const say = (e: unknown) => {
  const m = (e as Error).message || "";
  return /already exist/i.test(m) ? "That name is already taken. Pick another one or open the existing one." : m;
};
