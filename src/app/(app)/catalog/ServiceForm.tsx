"use client";
import { useState } from "react";
import { MapPin, Ruler, TextAlignLeft, Truck, Lock, Info } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { norm, priceText, say, stepsBody, stepsOf, type Catalog, type Service } from "./data";
import { PhotoPick } from "./PhotoPick";
import s from "./catalog.module.css";

/** Add or edit one service. The category comes pre-picked from where the admin started (owner: no confusion). */
export function ServiceForm({ data, svc, catId, name, onClose, onSaved }: {
  data: Catalog; svc?: Service; catId?: string; name?: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ name: svc?.serviceName ?? name ?? "", cat: svc?.categoryId ?? catId ?? data.cats[0]?._id, desc: svc?.description ?? "", photo: svc?.image, ...stepsOf(svc?.serviceTaskArr) });
  const [errs, setErrs] = useState<{ name?: string; desc?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const catName = data.cats.find((c) => c._id === f.cat)?.categoryName ?? "";
  const dup = data.services.find((x) => x._id !== svc?._id && norm(x.serviceName) === norm(f.name));
  const price = svc && data.prices[svc.serviceName];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = f.name.trim();
    if (!n) return setErrs({ name: "Enter a service name." });
    if (dup) return setErrs({ name: `${dup.serviceName} already exists.` });
    setBusy(true);
    const body = { serviceName: n, categoryId: f.cat, description: f.desc.trim(), image: f.photo, icon: f.photo, serviceTaskArr: stepsBody(f) };
    try {
      if (svc) await api("admin/services/update", { method: "PUT", body: { serviceId: svc._id, ...body } });
      else await api("admin/services/add", { method: "POST", body });
      toast(svc ? `${n} saved` : `${n} added to ${catName}. It shows once a Buddy offers it.`);
      onSaved();
    } catch (x) { toast(say(x)); setBusy(false); }
  }
  const steps = [f.route ? "Pick-up and drop-off" : "Job address", "Job size", ...(f.vehicle ? ["Vehicle needed"] : []), ...(f.describe ? ["Describe the job"] : []), "Pick a Buddy and time", "Pay"];

  return (
    <Modal drawer title={svc ? svc.serviceName : "Add a service"} sub={svc ? undefined : "A service is one job customers book, like “Toilet” in Plumbing."} onClose={onClose}
      footer={<><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn p" form="svF" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : svc ? "Save changes" : "Add service"}</button></>}>
      <form id="svF" onSubmit={save} noValidate className={s.form}>
        <label className="field"><span>Category</span>
          <select className="input" value={f.cat} onChange={(e) => set({ cat: e.target.value })}>{data.cats.map((c) => <option key={c._id} value={c._id}>{c.categoryName}</option>)}</select>
          <span className="hint">Customers find it under {catName}.</span></label>
        <label className="field"><span>Service name</span>
          <input className="input" value={f.name} autoFocus={!svc} aria-invalid={!!errs.name || !!dup} placeholder="Example: Toilet" autoComplete="off" onChange={(e) => { set({ name: e.target.value }); setErrs({}); }} />
          {dup ? <span className="err">{dup.serviceName} already exists in {data.cats.find((c) => c._id === dup.categoryId)?.categoryName ?? "another category"}.</span>
            : errs.name ? <span className="err">{errs.name}</span> : <span className="hint">Short and plain, the way a customer would say it.</span>}</label>
        <label className="field"><span>Description</span>
          <textarea className="input" rows={2} value={f.desc} placeholder="Example: Fix leaks, running toilets and clogs." onChange={(e) => set({ desc: e.target.value })}
            onBlur={() => setErrs({ desc: f.desc.trim() && norm(f.desc) === norm(f.name) ? "Say what the job includes instead of repeating the name." : undefined })} />
          {errs.desc ? <span className="err">{errs.desc}</span> : <span className="hint">One sentence under the name in the app.</span>}</label>
        <PhotoPick id="svPhoto" url={f.photo} onChange={(photo) => set({ photo })} />

        <div className="field"><span>Booking steps</span><span className="hint">What the customer fills in when they book this service.</span>
          <div className={s.stepgrid}>
            <ul className={s.tog}>
              <li><MapPin size={18} /><span><b>Job address</b><small>Always asked</small></span><span className="chip c-mut"><Lock size={12} />On</span></li>
              <li><Ruler size={18} /><span><b>Job size: Small, Medium, Large</b><small>Always asked. Sets the upfront charge.</small></span><span className="chip c-mut"><Lock size={12} />On</span></li>
              <Toggle icon={TextAlignLeft} label="Customer describes the job" help="A text box for details and photos" on={f.describe} set={(v) => set({ describe: v })} />
              <Toggle icon={Truck} label="Buddy brings a vehicle" help="For hauling, delivery or moving" on={f.vehicle} set={(v) => set({ vehicle: v })} />
              <Toggle icon={MapPin} label="Pick-up and drop-off addresses" help="Instead of one job address" on={f.route} set={(v) => set({ route: v })} />
            </ul>
            <div className={s.bkpv} aria-label="What the customer sees"><span className="hint">Customer sees</span><ol>{steps.map((x) => <li key={x}>{x}</li>)}</ol></div>
          </div>
        </div>
        <div className="note"><Info size={16} />There&apos;s no price to set here. Each Buddy who offers this service sets their own rate; customers see the lowest as “From $X/hr”. {price ? <>Right now: <b>{priceText(price)}</b>.</> : "Until a Buddy offers it, the service stays hidden."}</div>
      </form>
    </Modal>
  );
}

export function Toggle({ icon: Icon, label, help, on, set }: { icon: React.ElementType; label: string; help: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <li><Icon size={18} /><span><b>{label}</b><small>{help}</small></span>
      <label className={s.switch}><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} aria-label={label} /><span /></label></li>
  );
}
