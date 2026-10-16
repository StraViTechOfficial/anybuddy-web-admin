// The admin menu: daily work stays in view; occasional pages sit under More. The side menu and the ⌘K palette both
// read this list, so a new page appears in both.
import {
  SquaresFour, UserCheck, User, CalendarBlank, CreditCard, Bank, ChatCircle, GridFour, Bell, Star,
  Percent, FileText, UserList, UserPlus, ListPlus,
} from "@phosphor-icons/react";

export type Counts = { serviceRequests?: number; buddies?: number; requests?: number; support?: number; fees?: boolean; payouts?: number };
export type Item = { href: string; label: string; icon: React.ElementType; badge?: number | string; tone?: "b" | "r" };

export const main = (c: Counts): Item[] => [
  { href: "/", label: "Dashboard", icon: SquaresFour },
  { href: "/payouts", label: "Payouts", icon: CreditCard, badge: c.payouts, tone: "r" },
  { href: "/bookings", label: "Bookings", icon: CalendarBlank, badge: c.requests, tone: "b" },
  { href: "/buddies", label: "Buddies", icon: UserCheck, badge: c.buddies },
  { href: "/signups", label: "New sign-ups", icon: UserPlus },
  { href: "/service-requests", label: "Service requests", icon: ListPlus, badge: c.serviceRequests },
  { href: "/customers", label: "Customers", icon: User },
  { href: "/support", label: "Support", icon: ChatCircle, badge: c.support, tone: "b" },
];
export const more = (c: Counts): Item[] => [
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/catalog", label: "Categories & services", icon: GridFour },
  { href: "/waitlist", label: "Waitlist", icon: UserList },
  { href: "/content", label: "Content pages", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/money", label: "Money", icon: Bank },
  { href: "/fees", label: "Fees & settings", icon: Percent, badge: c.fees === false ? "!" : undefined, tone: "r" },
];
