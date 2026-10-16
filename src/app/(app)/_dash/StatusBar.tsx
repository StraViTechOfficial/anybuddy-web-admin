"use client";
import { useState } from "react";
import Link from "next/link";
import type { BookingState } from "@/lib/format";
import s from "./charts.module.css";

// The colours pass the dataviz validator. Every segment also has a labelled legend row, so colour is never the only cue.
const COLOR: Record<BookingState, string> = { Request: "--m-req", Scheduled: "--m-sch", Completed: "--m-done", Expired: "--m-exp", Canceled: "--m-cxl" };

export function StatusBar({ counts }: { counts: [BookingState, number][] }) {
  const [hl, setHl] = useState<BookingState | null>(null);
  const total = counts.reduce((a, [, n]) => a + n, 0) || 1;
  return (
    <div className={s.sb}>
      <div className={`${s.stack} ${hl ? s.dim : ""}`} role="img" aria-label={counts.map(([k, n]) => `${k} ${n}`).join(", ")}>
        {counts.map(([k, n]) => n ? <i key={k} className={hl === k ? s.hl : ""} style={{ flex: n, background: `var(${COLOR[k]})` }} title={`${k}: ${n}`} /> : null)}
      </div>
      <ul className={s.legend}>
        {counts.map(([k, n]) => (
          <li key={k}>
            <Link href={`/bookings?tab=${k}`} onMouseEnter={() => setHl(k)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(k)} onBlur={() => setHl(null)}>
              <span className={s.sw} style={{ background: `var(${COLOR[k]})` }} />{k}<b>{n}</b><span className="muted">{Math.round((n / total) * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
