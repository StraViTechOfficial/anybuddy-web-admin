"use client";
import { useState } from "react";
import { Lock, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { norm, pinned, say, type Catalog, type Category } from "./data";
import { PhotoPick } from "./PhotoPick";
import s from "./catalog.module.css";

/** Rename, describe, photo; retire or restore (update-status toggles isActive, nothing is deleted). */
export function CategoryEdit({ data, cat, onClose, onSaved }: { data: Catalog; cat: Category; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: cat.categoryName, desc: cat.description ?? "", photo: cat.image || cat.icon });
  const [err, setErr] = useState("");
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
    setBusy(true);
    try {
      await api("admin/categories/update", { method: "PUT", body: { categoryId: cat._id, categoryName: n, description: f.desc.trim(), image: f.photo, icon: f.photo, isActive: cat.isActive } });
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
      {count > 0 && <div className="note"><Warning size={16} />Its {count} services can still be booked until the server hides them with the category (BUG-91). Turn them off one by one if that matters today.</div>}
    </Modal>
  );

  return (
    <Modal drawer title={cat.categoryName} sub={`${count} services${retired ? " · retired" : ""}`} onClose={onClose}
      footer={<>
        {!pinned(cat.categoryName) && (retired ? <button className="btn" onClick={toggle} disabled={busy}>Restore</button> : <button className="btn d" onClick={() => setRetire(true)}>Retire category</button>)}
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>Cancel</button><button className="btn p" form="ceF" disabled={busy} aria-busy={busy}>Save changes</button></>}>
      <form id="ceF" onSubmit={save} noValidate className={s.form}>
        <label className="field"><span>Category name</span><input className="input" value={f.name} aria-invalid={!!err} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr(""); }} />
          {renamed && count > 0 && <span className="flag"><Warning size={12} />Until BUG-90 is fixed, a rename can empty this category&apos;s page in the app.</span>}</label>
        <label className="field"><span>Description</span><input className="input" value={f.desc} placeholder="Example: Leaks, clogs and fixtures" onChange={(e) => setF({ ...f, desc: e.target.value })} /><span className="hint">One line under the name in the app.</span></label>
        <PhotoPick id="cePhoto" url={f.photo} onChange={(photo) => setF({ ...f, photo })} />
        {pinned(cat.categoryName) && <div className="note"><Lock size={16} />{cat.categoryName} is pinned to the top of the app (owner decision) and can&apos;t be retired.</div>}
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
