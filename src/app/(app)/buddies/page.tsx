"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MagnifyingGlass, UserCheck } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { fullName, initials, phone, plural } from "@/lib/format";
import type { Buddy } from "@/lib/types";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Review, docCount } from "./Review";
import s from "./buddies.module.css";

const TABS = [["0", "Waiting for review"], ["1", "Approved"], ["2", "Rejected"]] as const;
const PAGE = 20;
const isTest = (b: Buddy) => /^pw-test-auth-/.test(b.email ?? "");

export default function Page() { return <Suspense><Buddies /></Suspense>; }

function Buddies() {
  const q = useSearchParams(), router = useRouter(), toast = useToast();
  const tab = (q.get("tab") ?? "0") as "0" | "1" | "2";
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Buddy[]>([]);
  const [total, setTotal] = useState<number>();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ running?: number } | null>(null);

  const load = useCallback(async (more = false) => {
    setLoading(true); setErr("");
    try {
      const r = await api<Buddy[]>("admin/service-provider/list", { query: { status: tab, search: search.trim(), page: more ? Math.floor(rows.length / PAGE) + 1 : 1, limit: PAGE } });
      const next = more ? [...rows, ...(r.data || [])] : r.data || [];
      setRows(next); setTotal(r.count);
      if (!more) setSel(next[0]?._id ?? null);
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }, [tab, search, rows]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => load(), search ? 250 : 0); return () => clearTimeout(t); }, [tab, search]);
  useEffect(() => {
    Promise.all(TABS.map(([k]) => api("admin/service-provider/list", { query: { status: k, limit: 1 } }).then((r) => [k, r.count ?? 0] as const).catch(() => [k, 0] as const)))
      .then((c) => setCounts(Object.fromEntries(c)));
  }, [rows.length]);

  // j / k move, A approves, R jumps to the reason box (waiting tab only).
  useEffect(() => {
    if (tab !== "0") return;
    const key = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      const i = rows.findIndex((r) => r._id === sel);
      if (e.key === "j" && i < rows.length - 1) setSel(rows[i + 1]._id);
      else if (e.key === "k" && i > 0) setSel(rows[i - 1]._id);
      else if (e.key.toLowerCase() === "a") (document.getElementById("approve") as HTMLButtonElement | null)?.click();
      else if (e.key.toLowerCase() === "r") { e.preventDefault(); document.getElementById("rej")?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tab, rows, sel]);

  const decided = (id: string) => {
    const i = rows.findIndex((r) => r._id === id);
    const next = rows.filter((r) => r._id !== id);
    setRows(next); setTotal((t) => (t ?? 1) - 1);
    setSel(next[i]?._id ?? next[i - 1]?._id ?? null);
  };
  async function rejectChecked() {
    const ids = [...checked];
    for (let n = 0; n < ids.length; n++) {
      setBulk({ running: n + 1 });
      await api("admin/service-provider/update-verification-status", { method: "PATCH", body: { serviceProviderId: ids[n], status: 2, reason: "Test account, not a real applicant" } }).catch(() => {});
    }
    setBulk(null); setChecked(new Set());
    toast(`${plural(ids.length, "application")} rejected`);
    load();
  }
  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const tests = rows.filter(isTest);

  return (
    <>
      <PageHead title="Buddies" sub={tab === "0" ? <>A Buddy takes bookings only after approval · <kbd>A</kbd> approve, <kbd>R</kbd> reject, <kbd>j</kbd> <kbd>k</kbd> move</> : "Open a Buddy to see their documents, services and hours."} />
      <section className="box">
        <div className="tbar">
          <div className="seg" role="tablist" aria-label="Status">
            {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => router.replace(`/buddies?tab=${k}`)}>{label}<em>{counts[k] ?? "–"}</em></button>)}
          </div>
          <label className="search"><span className="sr">Find a Buddy</span><MagnifyingGlass size={16} aria-hidden /><input className="input" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        </div>
        {err ? <LoadError message={err} retry={() => load()} /> : tab === "0" ? (
          rows.length || loading ? (
            <div className={s.split}>
              <div className={s.qlist} role="listbox" aria-label="Waiting for review">
                <div className={s.qbar}>
                  <label><input type="checkbox" checked={rows.length > 0 && checked.size === rows.length} onChange={(e) => setChecked(new Set(e.target.checked ? rows.map((r) => r._id) : []))} /> All shown</label>
                  {tests.length > 0 && <button className="btn sm ghost" onClick={() => setChecked(new Set(tests.map((t) => t._id)))}>Select {plural(tests.length, "test sign-up")}</button>}
                </div>
                {rows.map((b) => (
                  <div key={b._id} role="option" aria-selected={b._id === sel} tabIndex={0} className={s.qi} onClick={() => setSel(b._id)} onKeyDown={(e) => e.key === "Enter" && setSel(b._id)}>
                    <input type="checkbox" checked={checked.has(b._id)} onChange={() => toggle(b._id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${fullName(b)}`} />
                    <span className={s.av}>{initials(fullName(b))}</span>
                    <span className={s.m}><b>{fullName(b)}</b><small>{b.email}</small></span>
                    <span className={s.meter} title={`${docCount(b)} of 4 documents`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < docCount(b) ? s.on : ""} />)}</span>
                  </div>
                ))}
                {loading && <div className="skeleton" style={{ height: 56, margin: 12 }} />}
                {total != null && rows.length < total && !loading && <button className={`btn sm ${s.more}`} onClick={() => load(true)}>Show more · {total - rows.length} left</button>}
              </div>
              {sel ? <Review key={sel} id={sel} known={{ status: 0, active: rows.find((r) => r._id === sel)?.isActive ?? 1 }} onDecided={decided} /> : <div />}
            </div>
          ) : <Empty icon={UserCheck} title="Everyone is reviewed">New sign-ups appear here with their documents.</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>Buddy</th><th>Phone</th><th>Area</th><th>Documents</th><th>Status</th></tr></thead>
              <tbody>
                {loading && !rows.length ? <SkeletonRows cols={5} /> : rows.map((b) => (
                  <tr key={b._id} className="click" onClick={() => router.push(`/buddies/${b._id}?s=${tab}&a=${b.isActive ?? 1}`)}>
                    <td><Link href={`/buddies/${b._id}?s=${tab}&a=${b.isActive ?? 1}`} className={s.who} onClick={(e) => e.stopPropagation()}><span className={s.av}>{initials(fullName(b))}</span><span><b>{fullName(b)}</b><small>{b.email}</small></span></Link></td>
                    <td>{phone(b.phone, b.countryCode)}</td>
                    <td>{b.address?.city ? `${b.address.city}, ${b.address.state ?? ""}` : <span className="muted">Not added</span>}</td>
                    <td><span className={`chip ${docCount(b) === 4 ? "c-ok" : "c-warn"}`}>{docCount(b)} of 4</span></td>
                    <td>{b.isActive === 0 ? <span className="chip c-bad">Blocked</span> : tab === "1" ? <span className="chip c-ok">Approved</span> : <span className="chip c-mut">Rejected</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <Empty title={search ? `No Buddy matches “${search}”` : tab === "2" ? "No rejected Buddies" : "No approved Buddies yet"} />}
            {total != null && rows.length < total && <div className={s.foot}><button className="btn sm" onClick={() => load(true)}>Show more · {total - rows.length} left</button></div>}
          </div>
        )}
      </section>
      {checked.size > 0 && (
        <div className={s.bulk} role="region" aria-label="Bulk actions">
          <b>{checked.size} selected</b><button className="btn sm" onClick={() => setChecked(new Set())}>Clear</button><span style={{ flex: 1 }} />
          <button className="btn sm ds" onClick={() => setBulk({})}>Reject {checked.size}</button>
        </div>
      )}
      {bulk && (
        <Modal title={`Reject ${plural(checked.size, "application")}`} onClose={() => !bulk.running && setBulk(null)}
          footer={<><button className="btn" onClick={() => setBulk(null)} disabled={!!bulk.running}>Back</button><button className="btn ds" onClick={rejectChecked} disabled={!!bulk.running}>{bulk.running ? `Rejecting ${bulk.running} of ${checked.size}…` : `Reject ${checked.size}`}</button></>}>
          <p>Each one gets the rejection email. Reason recorded: “Test account, not a real applicant”.</p>
        </Modal>
      )}
    </>
  );
}
