import { CheckCircle, Clock, CalendarCheck, XCircle, Hourglass } from "@phosphor-icons/react/dist/ssr";
import type { BookingState } from "@/lib/format";
import s from "./ui.module.css";

/** The breadcrumb, the page's single h1 and its actions. WEBSITE-STANDARD.md asks for one left-aligned title per page. */
export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={s.head}>
      <div>
        <div className={s.crumb}>Admin / {title}</div>
        <h1>{title}</h1>
        {sub && <p className={s.sub}>{sub}</p>}
      </div>
      {children && <div className={s.acts}>{children}</div>}
    </div>
  );
}

const STATE: Record<BookingState, [string, React.ElementType]> = {
  Request: ["c-warn", Hourglass], Scheduled: ["c-info", CalendarCheck], Completed: ["c-ok", CheckCircle], Canceled: ["c-mut", XCircle], Expired: ["c-bad", Clock],
};
/** Shows a status as an icon, a word and a colour, never colour alone. */
export function StateChip({ state }: { state: BookingState }) {
  const [c, Icon] = STATE[state];
  return <span className={`chip ${c}`}><Icon size={12} weight="bold" aria-hidden />{state}</span>;
}

export function Empty({ icon: Icon, title, children }: { icon?: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      {Icon && <span className={s.eic}><Icon size={22} aria-hidden /></span>}
      <b>{title}</b>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

/** Placeholder rows while a list loads, so the table doesn't jump. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}><div className="skeleton" style={{ height: 14, width: c ? "60%" : "80%" }} /></td>)}</tr>
      ))}
    </>
  );
}

/** A list or screen that failed to load, with a way to try again. */
export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className={s.empty} role="alert">
      <b>This didn’t load</b>
      <span className="muted">{message}</span>
      <button className="btn sm" type="button" onClick={retry}>Try again</button>
    </div>
  );
}
