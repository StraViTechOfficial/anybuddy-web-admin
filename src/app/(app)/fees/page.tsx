"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { money } from "@/lib/format";
import { PageHead, LoadError } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Config = { _id?: string; commission?: number; tax?: number };
// The server saves any value (BUG-88), so the limits are checked here: commission 0–50 %, tax 0–20 %.
const check = (v: string, max: number) => v.trim() !== "" && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max;

export default function Fees() {
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api<Config | Config[]>("admin/platform-config/get-all").then((r) => (Array.isArray(r.data) ? r.data[0] : r.data) ?? {}));
  const [f, setF] = useState({ c: "", t: "", ex: "100.00" });
  const [errs, setErrs] = useState<{ c?: boolean; t?: boolean }>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF((x) => ({ ...x, c: data.commission?.toString() ?? "", t: data.tax?.toString() ?? "" })); }, [data]);
  if (error) return <LoadError message={error} retry={reload} />;
  const set = data?.commission != null;
  const p = parseFloat(f.ex) || 0, c = parseFloat(f.c) || 0, t = parseFloat(f.t) || 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad = { c: !check(f.c, 50), t: !check(f.t, 20) };
    setErrs(bad);
    if (bad.c || bad.t) return document.getElementById(bad.c ? "fc" : "ft")?.focus();
    setBusy(true);
    try { await api("admin/platform-config/add-edit", { method: "POST", body: { id: data?._id, commission: Number(f.c), tax: Number(f.t) } }); toast("Rates saved. New bookings use them from now on."); reload(); }
    catch (x) { toast((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Fees & tax" sub="Applies to new bookings from the moment you save. Past bookings keep their rates." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
        <section className="box">
          <header className="bh"><h2>Platform fees</h2><span className={`chip ${set ? "c-ok" : "c-bad"}`}>{set ? "Set" : "Not set"}</span></header>
          <form onSubmit={save} noValidate style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <label className="field"><span>Commission (%)</span><input id="fc" className="input" inputMode="decimal" placeholder="0.0" value={f.c} aria-invalid={errs.c} onChange={(e) => setF({ ...f, c: e.target.value })} />
              {errs.c ? <span className="err">Enter a number from 0 to 50, like 12.5.</span> : <span className="hint">Kept from each booking before the Buddy is paid.</span>}</label>
            <label className="field"><span>Sales tax (%)</span><input id="ft" className="input" inputMode="decimal" placeholder="0.0" value={f.t} aria-invalid={errs.t} onChange={(e) => setF({ ...f, t: e.target.value })} />
              {errs.t ? <span className="err">Enter a number from 0 to 20.</span> : <span className="hint">Added to the customer&apos;s total; AnyBuddy pays it to the state.</span>}</label>
            <button className="btn p" style={{ alignSelf: "flex-start" }} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Save rates"}</button>
          </form>
        </section>
        <section className="box">
          <header className="bh"><h2>Example booking</h2></header>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="field"><span>Booking price</span><input className="input" inputMode="decimal" value={f.ex} onChange={(e) => setF({ ...f, ex: e.target.value })} /></label>
            <div className="sum-rows">
              <div><span>Booking price</span><span>{money(p)}</span></div>
              <div><span>Sales tax {t}%</span><span>+ {money((p * t) / 100)}</span></div>
              <div className="tot"><span>Customer pays</span><span>{money(p * (1 + t / 100))}</span></div>
              <div><span>Commission {c}%</span><span>− {money((p * c) / 100)}</span></div>
              <div className="tot"><span>Buddy receives</span><span>{money(p * (1 - c / 100))}</span></div>
            </div>
            <p className="hint">Updates as you type.</p>
          </div>
        </section>
      </div>
    </>
  );
}
