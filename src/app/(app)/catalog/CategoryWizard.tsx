"use client";
import { useState } from "react";
import { Check, X, Plus } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { byPriority, norm, say, stepsBody, type Catalog, type Category } from "./data";
import { PhotoPick } from "./PhotoPick";
import s from "./catalog.module.css";

const STEPS = ["Name & look", "Services", "Check & create"];

/** New category in 3 steps; it can't be empty, so step 2 needs at least one service. */
export function CategoryWizard({ data, onClose, onCreated }: { data: Catalog; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [w, setW] = useState({ name: "", desc: "", photo: "" as string | undefined, services: [] as string[] });
  const [svc, setSvc] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string>();

  const taken = (n: string) => [...data.cats, ...data.retired].find((c) => norm(c.categoryName) === norm(n));
  function next(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) {
      if (!w.name.trim()) return setErr("Enter a category name.");
      const t = taken(w.name);
      if (t) return setErr(`${t.categoryName} already exists${data.retired.includes(t) ? " in Retired. Open it there to restore it." : "."}`);
      if (!w.desc.trim()) return setErr("Add a one-line description.");
    }
    if (step === 2 && !w.services.length) return setErr("Add at least one service.");
    setErr("");
    if (step < 3) setStep(step + 1); else create();
  }
  function addSvc() {
    const v = svc.trim();
    if (!v) return;
    const dup = data.services.find((x) => norm(x.serviceName) === norm(v));
    if (dup) return setErr(`${dup.serviceName} already exists in ${data.cats.find((c) => c._id === dup.categoryId)?.categoryName ?? "another category"}.`);
    if (w.services.some((x) => norm(x) === norm(v))) return setErr("Already in the list.");
    setW({ ...w, services: [...w.services, v] }); setSvc(""); setErr("");
  }
  async function create() {
    const name = w.name.trim();
    try {
      setBusy("Creating the category…");
      await api("admin/categories/add", { method: "POST", body: { categoryName: name, description: w.desc.trim(), image: w.photo, icon: w.photo } });
      // The add reply has no id, so look the new category up by name.
      const { data: found } = await api<Category[]>("admin/categories/list", { query: { search: name, status: 1, limit: 10 } });
      const cat = found.find((c) => norm(c.categoryName) === norm(name));
      if (!cat) throw new Error("The category was created but couldn't be found. Refresh and add its services.");
      for (let i = 0; i < w.services.length; i++) {
        setBusy(`Adding services ${i + 1} of ${w.services.length}…`);
        await api("admin/services/add", { method: "POST", body: { serviceName: w.services[i], categoryId: cat._id, description: "", serviceTaskArr: stepsBody({ describe: true, vehicle: false, route: false }) } });
      }
      toast(`${name} created with ${w.services.length} service${w.services.length === 1 ? "" : "s"}. It shows once a Buddy offers one.`);
      onCreated(cat._id);
    } catch (x) { setErr(say(x)); setBusy(undefined); }
  }
  const order = [...data.cats, { _id: "new", categoryName: w.name || "New", isActive: 1 }].sort(byPriority);

  return (
    <Modal drawer onClose={onClose}
      title={<><span className="hint">New category</span><h2 style={{ fontSize: "var(--fs-h3)" }}>{w.name || "Add a category"}</h2>
        <ol className={s.stepper} aria-label="Progress">{STEPS.map((t, i) => <li key={t} className={i + 1 < step ? s.done : i + 1 === step ? s.cur : ""} aria-current={i + 1 === step ? "step" : undefined}><span>{i + 1 < step ? <Check size={11} weight="bold" /> : i + 1}</span>{t}</li>)}</ol></>}
      footer={<>{step > 1 ? <button className="btn" onClick={() => { setStep(step - 1); setErr(""); }} disabled={!!busy}>Back</button> : <button className="btn" onClick={onClose}>Cancel</button>}
        <span className="hint" style={{ marginRight: "auto", alignSelf: "center" }}>Step {step} of 3</span>
        <button className="btn p" form="wz" disabled={!!busy} aria-busy={!!busy}>{busy ?? (step < 3 ? "Continue" : "Create category")}</button></>}>
      <form id="wz" onSubmit={next} noValidate className={s.form}>
        {step === 1 && <>
          <p className="muted">A category is a group customers browse, like Plumbing or Cleaning.</p>
          <label className="field"><span>Category name</span><input className="input" autoFocus value={w.name} aria-invalid={!!err} placeholder="Example: Handyman" onChange={(e) => { setW({ ...w, name: e.target.value }); setErr(""); }} /></label>
          <label className="field"><span>Description</span><input className="input" value={w.desc} placeholder="Example: Small repairs around the house" onChange={(e) => setW({ ...w, desc: e.target.value })} /><span className="hint">One line under the name in the app.</span></label>
          <PhotoPick id="wzPhoto" url={w.photo} onChange={(photo) => setW({ ...w, photo })} />
        </>}
        {step === 2 && <>
          <p className="muted">Add the jobs customers can book in <b>{w.name}</b>. Photos and booking steps for each come after, from its service list.</p>
          <div className="field"><label htmlFor="wS" style={{ fontWeight: 600 }}>Service name</label>
            <div style={{ display: "flex", gap: 8 }}><input id="wS" className="input" autoFocus value={svc} placeholder="Example: Door repair" autoComplete="off" onChange={(e) => { setSvc(e.target.value); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSvc(); } }} />
              <button type="button" className="btn" onClick={addSvc}><Plus size={14} />Add</button></div>
            <span className="hint">Press Enter to add each one.</span></div>
          <ul className={s.chiplist} aria-label="Services to add">{w.services.map((n, i) => <li key={n}>{n}<button type="button" aria-label={`Remove ${n}`} onClick={() => setW({ ...w, services: w.services.filter((_, j) => j !== i) })}><X size={12} /></button></li>)}</ul>
        </>}
        {step === 3 && <>
          <div className={s.money}><div><span>Name</span><b>{w.name}</b></div><div><span>Services</span><span>{w.services.join(", ")}</span></div><div><span>Place in the app</span><span>#{order.findIndex((c) => c._id === "new") + 1}, by name after Plumbing and Electrical</span></div><div><span>Shows to customers</span><span>When a Buddy offers one of its services</span></div></div>
          <div className={s.chips}>{order.map((c) => <span key={c._id} className={c._id === "new" ? s.on : ""}>{c.categoryName}</span>)}</div>
        </>}
        {err && <p className="err" role="alert">{err}</p>}
      </form>
    </Modal>
  );
}
