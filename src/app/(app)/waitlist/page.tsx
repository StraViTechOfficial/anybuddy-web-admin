"use client";
import { useState } from "react";
import { DownloadSimple, UserList } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, downloadCsv, phone } from "@/lib/format";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { useToast } from "@/components/Toast";

// Buddies who signed up outside the operating area. One row per phone, newest first.
type Row = { _id: string; phone: string; countryCode?: string; state?: string; postalCode?: string; createdAt: string };
const LIMIT = 50;

const csv = (rows: Row[]) => [["Country code", "Phone", "State", "ZIP", "Joined (UTC)"], ...rows.map((r) =>
  [(r.countryCode ?? "+1").replace(/\D/g, ""), r.phone, r.state, r.postalCode, r.createdAt])];

export default function Waitlist() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useLoad(() => api<Row[]>("admin/service-provider/waitlist", { query: { page, limit: LIMIT } }), [page]);
  const rows = data?.data ?? [], total = data?.count ?? 0, pages = Math.max(1, Math.ceil(total / LIMIT));

  // Exports the whole list, not just this page. The server returns up to 1000 rows per call.
  async function exportCsv() {
    setBusy(true);
    try {
      const all: Row[] = [];
      for (let p = 1; ; p++) {
        const r = await api<Row[]>("admin/service-provider/waitlist", { query: { page: p, limit: 1000 } });
        all.push(...(r.data ?? []));
        if (!r.data?.length || all.length >= (r.count ?? 0)) break;
      }
      downloadCsv("anybuddy-waitlist", csv(all));
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Waitlist" sub={total ? `${total === 1 ? "1 Buddy is" : `${total} Buddies are`} waiting for Any-Buddy to launch in their area.` : "Buddies who sign up outside the operating area."}>
        <button className="btn" onClick={exportCsv} disabled={busy || !total} aria-busy={busy}><DownloadSimple size={16} />{busy ? "Preparing…" : "Export CSV"}</button>
      </PageHead>
      <section className="box">
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="stack">
              <thead><tr><th>Phone</th><th>State</th><th>ZIP</th><th>Joined</th></tr></thead>
              <tbody>
                {loading && !rows.length ? <SkeletonRows cols={4} /> : rows.map((r) => (
                  <tr key={r._id}><td><b>{phone(r.phone, r.countryCode)}</b></td><td>{r.state || "—"}</td><td>{r.postalCode || "—"}</td><td className="muted">{date(r.createdAt)}</td></tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <Empty icon={UserList} title="No one is on the waitlist yet">Buddies outside the operating area can join it when they sign up.</Empty>}
            {pages > 1 && <div className="tbar" style={{ borderBottom: 0, justifyContent: "flex-end" }}><span className="hint">Page {page} of {pages}</span>
              <button className="btn sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="btn sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div>}
          </div>
        )}
      </section>
    </>
  );
}
