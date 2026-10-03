"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DownloadSimple, MagnifyingGlass, UserPlus } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { dateTime, phone } from "@/lib/format";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { useToast } from "@/components/Toast";

// Buddy sign-up v3 (B6): everyone who verified their phone, newest first (GET admin/vendors/signups). City only:
// the street and date of birth stay on the Buddy's own page.
type Progress = "phone" | "details" | "services" | "submitted" | "approved" | "rejected";
type Row = { id: string; name: string | null; phone: string; countryCode?: string; email: string | null; city: string | null; state: string | null;
  travelMiles: number | null; notifications: "on" | "off"; progress: Progress; startedAt: string };
type Filter = "all" | "phone" | "details" | "services" | "submitted";
type Reply = { rows: Row[]; counts: Record<Filter, number> };
const FILTERS: [Filter, string][] = [["all", "All"], ["phone", "Phone only"], ["details", "Name and address"], ["services", "Services added"], ["submitted", "Sent for verification"]];
const PROGRESS: Record<Progress, string> = {
  phone: "Phone verified", details: "Name and address", services: "Services added", submitted: "Being verified", approved: "Verified", rejected: "Not approved",
};
const STATUS: Partial<Record<Progress, number>> = { approved: 1, rejected: 2 }; // the Buddy page's ?s= (0 waiting)
const LIMIT = 50;
const NONE = "Not added yet";
const city = (r: Row) => [r.city, r.state].filter(Boolean).join(", ") || null;
const travels = (r: Row) => (r.travelMiles ? `${r.travelMiles} mi` : null);

// Quoted CSV; a cell starting with = + - @ gets a leading ' so a spreadsheet never runs it as a formula.
const cell = (v: unknown) => `"${String(v ?? "").replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
const csv = (rows: Row[]) => [["Name", "Phone", "Email", "Home city", "Travels", "Notifications", "Progress", "Started (UTC)"], ...rows.map((r) =>
  [r.name, phone(r.phone, r.countryCode), r.email, city(r), travels(r), r.notifications === "on" ? "On" : "Off", PROGRESS[r.progress], r.startedAt])]
  .map((l) => l.map(cell).join(",")).join("\r\n");

export default function Signups() {
  const toast = useToast(), router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState(""); // the search, 250 ms after the last key
  useEffect(() => { const t = setTimeout(() => { setTerm(search.trim()); setPage(1); }, 250); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useLoad(() => api<Reply>("admin/vendors/signups", { query: { progress: filter, q: term, page, limit: LIMIT } }), [filter, term, page]);
  const rows = data?.data.rows ?? [], counts = data?.data.counts, total = data?.count ?? 0, pages = Math.max(1, Math.ceil(total / LIMIT));
  const href = (r: Row) => `/buddies/${r.id}?s=${STATUS[r.progress] ?? 0}`;
  const pick = (f: Filter) => { setFilter(f); setPage(1); };

  // The whole current filter, not just this page (the server gives up to 1000 rows per call).
  async function exportCsv() {
    setBusy(true);
    try {
      const all: Row[] = [];
      for (let p = 1; ; p++) {
        const r = await api<Reply>("admin/vendors/signups", { query: { progress: filter, q: term, page: p, limit: 1000 } });
        all.push(...(r.data?.rows ?? []));
        if (!r.data?.rows.length || all.length >= (r.count ?? 0)) break;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv(all)], { type: "text/csv;charset=utf-8" }));
      a.download = `anybuddy-new-signups-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="New sign-ups" sub="Everyone who verified their phone. Details fill in as they finish items in the app.">
        <button className="btn" onClick={exportCsv} disabled={busy || !total} aria-busy={busy}><DownloadSimple size={16} />{busy ? "Preparing…" : "Export CSV"}</button>
      </PageHead>
      <section className="box">
        <div className="tbar"><label className="search" style={{ marginLeft: 0 }}><span className="sr">Find a sign-up</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} /></label></div>
        <div className="tbar">
          <div className="seg" role="group" aria-label="Progress">
            {FILTERS.map(([k, label]) => <button key={k} type="button" aria-pressed={filter === k} onClick={() => pick(k)}>{label}{counts && <em>{counts[k]}</em>}</button>)}
          </div>
        </div>
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="stack">
              <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Home city</th><th>Travels</th><th>Notifications</th><th>Progress</th><th>Started</th></tr></thead>
              <tbody>
                {loading && !rows.length ? <SkeletonRows cols={8} /> : rows.map((r) => (
                  <tr key={r.id} className="click" onClick={() => router.push(href(r))}>
                    <td><Link href={href(r)} onClick={(e) => e.stopPropagation()}>{r.name ? <b>{r.name}</b> : <span className="muted">{NONE}</span>}</Link></td>
                    <td>{phone(r.phone, r.countryCode)}</td>
                    <td>{r.email ?? <span className="muted">{NONE}</span>}</td>
                    <td>{city(r) ?? <span className="muted">{NONE}</span>}</td>
                    <td>{travels(r) ?? <span className="muted">{NONE}</span>}</td>
                    <td>{r.notifications === "on" ? <span className="chip c-ok">On</span> : <span className="chip c-mut">Off</span>}</td>
                    <td>{PROGRESS[r.progress]}</td>
                    <td className="muted">{dateTime(r.startedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && (term ? <Empty title={`No sign-up matches “${term}”`} />
              : <Empty icon={UserPlus} title="No sign-ups here yet">Buddies show up here as soon as they verify their phone.</Empty>)}
            {pages > 1 && <div className="tbar" style={{ borderBottom: 0, justifyContent: "flex-end" }}><span className="hint">Page {page} of {pages}</span>
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
          </div>
        )}
      </section>
    </>
  );
}
