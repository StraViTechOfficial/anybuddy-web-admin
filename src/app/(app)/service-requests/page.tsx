"use client";
import { useState } from "react";
import { Check, ListPlus, X } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date, fullName, phone } from "@/lib/format";
import { PageHead, Empty, LoadError, SkeletonRows } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ReasonDialog } from "@/components/ReasonDialog";
import { byPriority, norm, rangeText, type Category, type Service } from "../catalog/data";

// "Request a new service": a Buddy asks for a service missing from the catalogue at their hourly rate. Approve adds it
// (new, or mapped to one already in the list) and the Buddy's offer at that rate; Decline sends the Buddy a reason.
// categoryId and hourlyRate are null when the Buddy picked "Not in the list": Approve then needs a category.
type Row = {
  _id: string; name: string; categoryId: string | null; hourlyRate: number | null; status: "pending" | "approved" | "declined"; declineReason?: string | null; createdAt: string;
  category?: { categoryName: string; rateMin?: number | null; rateMax?: number | null };
  buddy?: { _id: string; firstName?: string; lastName?: string; nickname?: string | null; phone?: string; countryCode?: string };
};
const TABS = [["pending", "Waiting"], ["approved", "Approved"], ["declined", "Declined"]] as const;

export default function ServiceRequests() {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pending");
  const [approving, setApproving] = useState<Row>();
  const [declining, setDeclining] = useState<Row>();
  const { data, error, loading, reload } = useLoad(async () => {
    const [list, cats, svcs] = await Promise.all([
      api<Row[]>("admin/service-requests", { query: { status: tab } }),
      api<Category[]>("admin/categories/list", { query: { status: 1, limit: 100 } }),
      api<Service[]>("admin/services/list", { query: { status: 1, limit: 500 } }),
    ]);
    return { rows: list.data ?? [], pending: list.count ?? 0, cats: (cats.data ?? []).sort(byPriority), services: svcs.data ?? [] };
  }, [tab]);
  const rows = data?.rows ?? [];

  async function decline(r: Row, reason: string) {
    await api(`admin/service-requests/${r._id}/decline`, { method: "POST", body: { reason } });
    toast(`Declined · ${fullName(r.buddy)} gets your reason`);
    setDeclining(undefined);
    reload();
  }

  return (
    <>
      <PageHead title="Service requests" sub={data?.pending ? `${data.pending} waiting for review.` : "Services Buddies asked for that aren't in the list yet."} />
      <section className="box">
        <div className="tbar" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`btn sm ${tab === k ? "p" : ""}`} onClick={() => setTab(k)}>
              {label}{k === "pending" && data?.pending ? ` · ${data.pending}` : ""}
            </button>
          ))}
        </div>
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ overflowX: "auto" }}>
            <table className="stack">
              <thead><tr><th>Buddy</th><th>Requested service</th><th>Category</th><th>Rate</th><th>Asked</th><th>{tab === "declined" ? "Reason" : ""}</th></tr></thead>
              <tbody>
                {loading && !rows.length ? <SkeletonRows cols={6} /> : rows.map((r) => (
                  <tr key={r._id}>
                    <td><b>{fullName(r.buddy)}</b><small className="muted" style={{ display: "block" }}>{phone(r.buddy?.phone, r.buddy?.countryCode)}</small></td>
                    <td><b>{r.name}</b></td>
                    <td>{r.category?.categoryName ?? <span className="muted">No category</span>}</td>
                    <td>{r.hourlyRate != null ? `$${r.hourlyRate}/hr` : <span className="muted">Not set</span>}</td>
                    <td className="muted">{date(r.createdAt)}</td>
                    <td>{r.status === "pending"
                      ? <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button className="btn sm" onClick={() => setDeclining(r)}><X size={14} />Decline</button>
                          <button className="btn sm p" onClick={() => setApproving(r)}><Check size={14} weight="bold" />Approve</button>
                        </span>
                      : r.status === "declined" ? <span className="muted">{r.declineReason}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !rows.length && <Empty icon={ListPlus} title={tab === "pending" ? "No requests waiting" : "Nothing here yet"}>Buddies can ask for a service that isn't in the list when they add services.</Empty>}
          </div>
        )}
      </section>
      {approving && data && <Approve row={approving} cats={data.cats} services={data.services} onClose={() => setApproving(undefined)} onDone={(name) => {
        toast(`${name} approved · added to ${fullName(approving.buddy)}'s services`);
        setApproving(undefined);
        reload();
      }} />}
      {declining && <ReasonDialog title={`Decline "${declining.name}"?`} next={`${fullName(declining.buddy)} sees this reason in the app and by email.`}
        label="Reason for the Buddy" hint="Up to 500 characters." max={500} required missing="Add a reason for the Buddy." confirm="Decline"
        onConfirm={(reason) => decline(declining, reason)} onClose={() => setDeclining(undefined)} />}
    </>
  );
}

/** Approve as a new service (name and category can be edited) or map it to a service already in the list. */
function Approve({ row, cats, services, onClose, onDone }: { row: Row; cats: Category[]; services: Service[]; onClose: () => void; onDone: (name: string) => void }) {
  const same = services.find((s) => norm(s.serviceName) === norm(row.name));
  const [mode, setMode] = useState<"new" | "existing">(same ? "existing" : "new");
  const [name, setName] = useState(row.name);
  const [categoryId, setCategoryId] = useState(row.categoryId ?? "");
  const [existing, setExisting] = useState(same?._id ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cat = cats.find((c) => c._id === (mode === "new" ? categoryId : services.find((s) => s._id === existing)?.categoryId));
  const range = cat && rangeText(cat.rateMin, cat.rateMax);
  // No rate asked: the server uses the middle of the category's range (controller/admin/serviceRequests.ts).
  const mid = cat && (cat.rateMin != null && cat.rateMax != null ? Math.round((cat.rateMin + cat.rateMax) / 2) : cat.rateMin ?? cat.rateMax);
  const rate = row.hourlyRate ?? mid;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "existing" && !existing) { setErr("Pick a service from the list."); return; }
    if (mode === "new" && name.trim().length < 2) { setErr("Use a name of 2 to 60 characters."); return; }
    if (mode === "new" && !categoryId) { setErr("Pick a category for this service."); return; }
    setBusy(true);
    try {
      const body = mode === "existing" ? { existingSubCategoryId: existing } : { name: name.trim(), categoryId };
      const { data } = await api<{ serviceName: string }>(`admin/service-requests/${row._id}/approve`, { method: "POST", body });
      onDone(data.serviceName);
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }

  return (
    <Modal title={`Approve "${row.name}"`} onClose={() => !busy && onClose()} sub={`${fullName(row.buddy)} · ${row.category?.categoryName ?? "No category"}${row.hourlyRate != null ? ` · $${row.hourlyRate}/hr` : ""}`}
      footer={<><button type="button" className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn p" form="aprF" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Approve"}</button></>}>
      <form id="aprF" onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
        <div role="radiogroup" style={{ display: "flex", gap: 16 }}>
          <label><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> Add as a new service</label>
          <label><input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> Map to an existing service</label>
        </div>
        {mode === "new" ? <>
          <div className="field"><label htmlFor="aprN" style={{ fontWeight: 600 }}>Service name</label>
            <input id="aprN" className="input" value={name} maxLength={60} onChange={(e) => { setName(e.target.value); setErr(""); }} /></div>
          <div className="field"><label htmlFor="aprC" style={{ fontWeight: 600 }}>Category</label>
            <select id="aprC" className="input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setErr(""); }}>
              {!categoryId && <option value="">Pick a category</option>}
              {cats.map((c) => <option key={c._id} value={c._id}>{c.categoryName}</option>)}
            </select></div>
        </> : <div className="field"><label htmlFor="aprE" style={{ fontWeight: 600 }}>Service</label>
          <select id="aprE" className="input" value={existing} onChange={(e) => { setExisting(e.target.value); setErr(""); }}>
            <option value="">Pick a service</option>
            {cats.map((c) => <optgroup key={c._id} label={c.categoryName}>
              {services.filter((s) => s.categoryId === c._id).map((s) => <option key={s._id} value={s._id}>{s.serviceName}</option>)}
            </optgroup>)}
          </select></div>}
        {err ? <span className="err" role="alert">{err}</span>
          : <span className="hint">The Buddy&apos;s offer is added{rate != null ? ` at $${rate}/hr` : ""}{row.hourlyRate == null && rate != null ? " (the middle of the category range)" : range ? ` (category range ${range})` : ""}, and they get a notice.</span>}
      </form>
    </Modal>
  );
}
