"use client";
import { useRef, useState } from "react";
import { money } from "@/lib/format";
import type { Graph } from "@/lib/types";
import s from "./charts.module.css";

// One series → area + line, no legend (the title names it). Crosshair + tooltip on hover (dataviz skill).
const W = 640, H = 240, L = 46, R = 16, T = 18, B = 30;

export function ValueChart({ graph }: { graph: Graph }) {
  const v = graph.averageOverallAppointment, n = v.length;
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  if (!n) return <p className="muted" style={{ padding: 18 }}>No bookings in this range.</p>;
  const top = Math.max(500, Math.ceil(Math.max(...v) / 500) * 500);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (val: number) => T + (H - T - B) * (1 - val / top);
  const line = v.map((val, i) => `${i ? "L" : "M"}${x(i)},${y(val)}`).join("");
  const area = `${line}L${x(n - 1)},${H - B}L${x(0)},${H - B}Z`;
  const move = (e: React.MouseEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) * W) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) * (n - 1)) / (W - L - R)))));
  };
  const scale = svg.current ? svg.current.getBoundingClientRect().width / W : 1;
  const label = (l: string) => l.split(" - ")[0];

  return (
    <div className={s.wrap}>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Booking value per week: ${graph.labels.map((l, i) => `${l} ${money(v[i], true)}`).join("; ")}`}>
        <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--navy)" stopOpacity=".18" /><stop offset="1" stopColor="var(--navy)" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line className={s.grid} x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{t >= 1000 ? `$${t / 1000}k` : `$${t}`}</text></g>)}
        <path d={area} fill="url(#ga)" />
        <path d={line} className={s.ln} />
        {v.map((val, i) => <circle key={i} cx={x(i)} cy={y(val)} r={i === n - 1 ? 5 : 4} className={i === n - 1 ? s.end : s.pt} />)}
        <text x={x(n - 1) - 10} y={y(v[n - 1]) + 22} textAnchor="end" className={s.val}>{money(v[n - 1], true)} so far</text>
        {graph.labels.map((l, i) => <text key={l} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{label(l)}</text>)}
        {hover != null && <line className={s.xh} x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={move} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover != null && (
        <div className={s.tip} style={{ left: 18 + x(hover) * scale, top: 6 + y(v[hover]) * scale }}>
          <b>{money(v[hover], true)}</b>{graph.labels[hover]} · avg {money(graph.averagePerAppointment[hover], true)} per booking
        </div>
      )}
    </div>
  );
}
