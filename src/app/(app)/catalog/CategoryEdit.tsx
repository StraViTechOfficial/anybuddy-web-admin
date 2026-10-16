"use client";
import { useState } from "react";
import Link from "next/link";
import { Certificate, Lock, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { fullName, money, plural } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { norm, pinned, rangeText, say, type Catalog, type Category, type OutOfRange } from "./data";
import { PhotoPick } from "./PhotoPick";
import { Toggle } from "./ServiceForm";
import s from "./catalog.module.css";

// The licence switch and name, and the hourly rate range. Rates are typed as text, so input such as "abc" gets the
// server's own error message.
export type Rules = { licenceRequired: boolean; licenceName: string; rateMin: string; rateMax: string };
export const rulesOf = (c?: Category): Rules => ({
  licenceRequired: !!c?.licenceRequired, licenceName: c?.licenceName ?? "",
  rateMin: c?.rateMin == null ? "" : String(c.rateMin), rateMax: c?.rateMax == null ? "" : String(c.rateMax),
});
const dollars = (v: string) => (v.trim() === "" ? null : Number(v.trim()));
export const rulesBody = (r: Rules) => ({ licenceRequired: r.licenceRequired, licenceName: r.licenceName.trim(), rateMin: dollars(r.rateMin), rateMax: dollars(r.rateMax) });
/** Applies the server's checks and wording (categoryRulesSchema, 0 to 100000). Requiring whole dollars is this
 *  screen's own rule. */
export function rulesProblem(r: Rules) {
  const [lo, hi] = [dollars(r.rateMin), dollars(r.rateMax)], set = [lo, hi].filter((v): v is number => v !== null);
  if (set.some((v) => !Number.isFinite(v))) return "Rates must be numbers.";
  if (set.some((v) => v < 0)) return "Rates can't be below $0.";
  if (set.some((v) => !Number.isInteger(v))) return "Enter rates in whole dollars.";
  if (set.some((v) => v > 100000)) return "Rates can't be above $100,000.";
  if (lo !== null && hi !== null && lo > hi) return "The lowest rate must be at or below the highest rate.";
}

export function RulesFields({ name, r, set, err, was, count }: { name: string; r: Rules; set: (r: Rules) => void; err?: string; was?: boolean; count: number }) {
  const n = name.trim() || "this category", label = r.licenceName.trim() || `${name.trim() || "Trade"} license`;
  return (
    <>
      <div className="field"><span>License</span>
        <ul className={s.tog}><Toggle icon={Certificate} label="License required" help={`Buddies upload a license for ${n}. Their ${n} services stay hidden from customers until you approve it.`} on={r.licenceRequired} set={(v) => set({ ...r, licenceRequired: v })} /></ul>
        {count > 0 && was !== undefined && was !== r.licenceRequired && <span className="flag"><Warning size={12} />{r.licenceRequired
          ? `Saving hides Buddies' ${n} services from customers until you approve each Buddy's license.`
          : `Saving shows Buddies' ${n} services to customers again without a license.`}</span>}
      </div>
      {r.licenceRequired && <label className="field"><span>License name</span>
        <input className="input" value={r.licenceName} maxLength={100} placeholder="Example: Electrical license" onChange={(e) => set({ ...r, licenceName: e.target.value })} />
        <span className="hint">Buddies see “{label} · Required for {name.trim() || "this category"}”.</span></label>}
      <div className="field"><span>Hourly rate range</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field"><span>Lowest, $/hr</span><input className="input" inputMode="numeric" value={r.rateMin} placeholder="No limit" aria-invalid={!!err} onChange={(e) => set({ ...r, rateMin: e.target.value })} /></label>
          <label className="field"><span>Highest, $/hr</span><input className="input" inputMode="numeric" value={r.rateMax} placeholder="No limit" aria-invalid={!!err} onChange={(e) => set({ ...r, rateMax: e.target.value })} /></label>
        </div>
        {err ? <span className="err" role="alert">{err}</span> : <span className="hint">Whole dollars. A Buddy&apos;s hourly rate for {n} must be in this range, and a new Buddy&apos;s rate starts in the middle. An empty box means no limit.</span>}
      </div>
    </>
  );
}

/** Lists Buddy prices that fall outside their category's range. The admin sees them here, and the server never
 *  changes them. */
export function OutOfRangeNote({ rows, where }: { rows: OutOfRange[]; where?: string }) {
  if (!rows.length) return null;
  return (
    <div className="note"><Warning size={16} style={{ flex: "none" }} />
      <details style={{ minWidth: 0 }}><summary style={{ cursor: "pointer" }}>{plural(rows.length, "Buddy service")} {rows.length === 1 ? "is" : "are"} outside {where ? `the ${where} rate range` : "their category's rate range"}. Their rates stay as they are until the Buddy changes them.</summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 4 }}>{rows.map((o) => <li key={o.serviceId}>
          <Link href={`/buddies/${o.vendorId}`}>{fullName(o)}</Link> · {o.serviceName} · {money(o.price)}/hr <span className="muted">· {o.categoryName} {rangeText(o.rateMin, o.rateMax)}</span></li>)}</ul>
      </details>
    </div>
  );
}

/** Edits a category's name, description, photo, licence and rate range, and retires or restores it. Retiring only
 *  toggles isActive through update-status, so nothing is deleted. */
export function CategoryEdit({ data, cat, onClose, onSaved }: { data: Catalog; cat: Category; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: cat.categoryName, desc: cat.description ?? "", photo: cat.image || cat.icon });
  const [rules, setRules] = useState(rulesOf(cat));
  const [err, setErr] = useState("");
  const [rateErr, setRateErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [retire, setRetire] = useState(false);
  const retired = cat.isActive !== 1;
  const count = data.services.filter((x) => x.categoryId === cat._id).length;
  const renamed = norm(f.name) !== norm(cat.categoryName);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = f.name.trim();
    if (!n) return setErr("Enter a category name.");
    if (renamed && [...data.cats, ...data.retired].some((c) => norm(c.categoryName) === norm(n))) return setErr(`${n} already exists.`);
    const bad = rulesProblem(rules);
    if (bad) return setRateErr(bad);
    setBusy(true);
    try {
      await api("admin/categories/update", { method: "PUT", body: { categoryId: cat._id, categoryName: n, description: f.desc.trim(), image: f.photo, icon: f.photo, isActive: cat.isActive, ...rulesBody(rules) } });
      toast(`${n} saved`);
      onSaved();
    } catch (x) { setErr(say(x)); setBusy(false); }
  }
  async function toggle() {
    setBusy(true);
    try {
      await api("admin/categories/update-status", { method: "PATCH", body: { categoryId: cat._id } });
      toast(retired ? `${cat.categoryName} is back in the app` : `${cat.categoryName} retired`);
      onSaved();
    } catch (x) { toast(say(x)); setBusy(false); }
  }

  if (retire) return (
    <Modal title={`Retire ${cat.categoryName}`} onClose={() => setRetire(false)}
      footer={<><button className="btn" onClick={() => setRetire(false)}>Back</button><button className="btn ds" onClick={toggle} disabled={busy}>Retire {cat.categoryName}</button></>}>
      <p>Customers stop seeing {cat.categoryName}. Nothing is deleted: restore it any time from Retired.</p>
      {count > 0 && <div className="note"><Warning size={16} />Its {count} services can still be booked until the server hides them with the category. Turn them off one by one if that matters today.</div>}
    </Modal>
  );

  return (
    <Modal drawer title={cat.categoryName} sub={`${count} services${retired ? " · retired" : ""}`} onClose={onClose}
      footer={<>
        {!pinned(cat.categoryName) && (retired ? <button className="btn" onClick={toggle} disabled={busy}>Restore</button> : <button className="btn d" onClick={() => setRetire(true)}>Retire category</button>)}
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>Cancel</button><button className="btn p" form="ceF" disabled={busy} aria-busy={busy}>Save changes</button></>}>
      <form id="ceF" onSubmit={save} noValidate className={s.form}>
        <label className="field"><span>Category name</span><input className="input" value={f.name} aria-invalid={!!err} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} />
          {renamed && count > 0 && <span className="flag"><Warning size={12} />Renaming can leave this category&apos;s page empty in the app for now. Check it after saving.</span>}</label>
        <label className="field"><span>Description</span><input className="input" value={f.desc} placeholder="Example: Leaks, clogs and fixtures" onChange={(e) => setF({ ...f, desc: e.target.value })} /><span className="hint">One line under the name in the app.</span></label>
        <PhotoPick id="cePhoto" url={f.photo} onChange={(photo) => setF({ ...f, photo })} />
        <RulesFields name={f.name} r={rules} set={(r) => { setRules(r); setRateErr(""); }} err={rateErr} was={!!cat.licenceRequired} count={count} />
        <OutOfRangeNote rows={data.outOfRange.filter((o) => o.categoryId === cat._id)} where={cat.categoryName} />
        {pinned(cat.categoryName) && <div className="note"><Lock size={16} />{cat.categoryName} is pinned to the top of the app and can&apos;t be retired.</div>}
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
