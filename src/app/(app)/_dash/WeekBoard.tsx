import Link from "next/link";
import { bookingState, clock, TZ } from "@/lib/format";
import type { Booking } from "@/lib/types";
import s from "./charts.module.css";

const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD in New York

// Mon–Sun of the current week; requests are dashed until a Buddy accepts (same language as the provider web board).
export function WeekBoard({ bookings }: { bookings: (Booking & { status?: number })[] }) {
  const today = ymd(new Date());
  const t = new Date(today + "T12:00:00");
  const monday = new Date(t);
  monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  return (
    <>
      <div className={s.week}>
        {days.map((d) => {
          const key = ymd(d);
          const list = bookings.filter((b) => b.scheduledDate.slice(0, 10) === key).sort((a, b) => a.selectedSlot.localeCompare(b.selectedSlot));
          return (
            <div key={key} className={`${s.day} ${key === today ? s.today : ""}`}>
              <h4>{d.toLocaleDateString("en-US", { weekday: "short" })}{key === today && " · Today"}<span>{d.getDate()}</span></h4>
              {list.length ? list.map((b) => {
                const st = bookingState({ status: b.status ?? 0, cancelledBy: b.cancelledBy });
                return (
                  <Link key={b._id} href={`/bookings?open=${b._id}`} className={`${s.blk} ${s[st]}`} title={`${b.serviceName} · ${st}`}>
                    <b>{b.serviceName}</b>{clock(b.selectedSlot)} · {b.serviceProvider?.firstName ?? "—"}
                  </Link>
                );
              }) : <span className="hint">No bookings</span>}
            </div>
          );
        })}
      </div>
      <div className={s.wkl}>
        <span><i className={s.Request} />Request, dashed until a Buddy accepts</span><span><i className={s.Scheduled} />Scheduled</span>
        <span><i className={s.Completed} />Completed</span><span><i className={s.Canceled} />Canceled or expired</span>
      </div>
    </>
  );
}
