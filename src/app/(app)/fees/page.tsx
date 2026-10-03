"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { money } from "@/lib/format";
import { PageHead, LoadError } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { X } from "@phosphor-icons/react";

type Config = { _id?: string; commission?: number; tax?: number; phoneCountries?: string[] };
type Country = { code: string; name: string; flag: string; dial: string };
// The server saves any value (BUG-88), so the limits are checked here: commission 0–50 %, tax 0–20 %.
const check = (v: string, max: number) => v.trim() !== "" && !isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max;
// FEA-49: stored ISO codes ("US"); an older "+1" means the US, another dial code the first country with it. Never empty.
const chosenOf = (stored: string[] | undefined, all: Country[]) => {
  const l = (stored ?? []).map((s) => (s === "+1" ? "US" : s.startsWith("+") ? all.find((c) => c.dial === s)?.code : s)).filter((c): c is string => !!c && all.some((k) => k.code === c));
  return l.length ? [...new Set(l)] : ["US"];
};
// Name, ISO code or dial code ("uni", "gb", "+44" or "44"); up to 8, leaving out the ones already chosen.
const matches = (q: string, all: Country[], chosen: string[]) => {
  const t = q.trim().toLowerCase(), d = t.replace(/^\+/, "");
  if (!t) return [];
  return all.filter((c) => !chosen.includes(c.code) && (c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t || (/^\d+$/.test(d) && c.dial.slice(1).startsWith(d)))).slice(0, 8);
};

export default function Fees() {
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api<Config | Config[]>("admin/platform-config/get-all").then((r) => (Array.isArray(r.data) ? r.data[0] : r.data) ?? {}));
  const [f, setF] = useState({ c: "", t: "", ex: "100.00" });
  const [errs, setErrs] = useState<{ c?: boolean; t?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const countries = useLoad(() => api<Country[]>("admin/platform-config/countries").then((r) => r.data ?? []));
  const all = countries.data ?? [];
  const [pc, setPc] = useState<{ chosen: string[]; q: string; busy: boolean }>({ chosen: [], q: "", busy: false });
  useEffect(() => { if (data) setF((x) => ({ ...x, c: data.commission?.toString() ?? "", t: data.tax?.toString() ?? "" })); }, [data]);
  useEffect(() => { if (data && countries.data) setPc((x) => ({ ...x, chosen: chosenOf(data.phoneCountries, countries.data!) })); }, [data, countries.data]);
  if (error || countries.error) return <LoadError message={(error || countries.error)!} retry={() => { reload(); countries.reload(); }} />;
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

  const found = matches(pc.q, all, pc.chosen);
  const pick = (c?: Country) => c && setPc({ ...pc, chosen: [...pc.chosen, c.code], q: "" });
  async function savePhones(e: React.FormEvent) {
    e.preventDefault();
    setPc({ ...pc, busy: true });
    try { await api("admin/platform-config/phone-countries", { method: "POST", body: { phoneCountries: pc.chosen } }); toast("Phone countries saved. Sign-ups and logins use them from now on."); reload(); }
    catch (x) { toast((x as Error).message); }
    setPc((x) => ({ ...x, busy: false }));
  }

  return (
    <>
      <PageHead title="Fees & settings" sub="Fees apply to new bookings from the moment you save. Past bookings keep their rates." />
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
        <section className="box">
          <header className="bh"><h2>Phone numbers</h2></header>
          <form onSubmit={savePhones} noValidate style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <ul aria-label="Allowed countries" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {pc.chosen.map((code) => { const c = all.find((k) => k.code === code); return c && (
                <li key={code} className="chip c-info" style={{ whiteSpace: "normal", paddingRight: 4 }}>{c.flag} {c.name} {c.dial}
                  <button type="button" aria-label={`Remove ${c.name}`} disabled={pc.chosen.length < 2} onClick={() => setPc({ ...pc, chosen: pc.chosen.filter((k) => k !== code) })}
                    style={{ display: "grid", placeItems: "center", border: 0, background: "none", padding: 4, borderRadius: 99, opacity: pc.chosen.length < 2 ? .4 : 1, cursor: pc.chosen.length < 2 ? "not-allowed" : "pointer" }}><X size={14} aria-hidden /></button></li>); })}
            </ul>
            <label className="field"><span>Add a country</span>
              <input className="input" placeholder="Search countries" value={pc.q} aria-controls="fpL" aria-describedby="fpH" onChange={(e) => setPc({ ...pc, q: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pick(found[0]); } else if (e.key === "Escape") setPc({ ...pc, q: "" }); }} /></label>
            {pc.q.trim() && <ul id="fpL" aria-label="Matching countries" style={{ listStyle: "none", padding: 0, marginTop: -8, display: "grid", gap: 2 }}>
              {found.map((c) => <li key={c.code}><button type="button" className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left" }} onClick={() => pick(c)}><span>{c.flag} {c.name} <span className="muted">{c.dial}</span></span></button></li>)}
              {!found.length && <li className="hint">No match for “{pc.q.trim()}”</li>}
            </ul>}
            <span id="fpH" className="hint">Customers and Buddies can only sign up and log in with these. The US and Canada share +1. Also turn on these countries in Twilio: Verify → Geo permissions.</span>
            <button className="btn p" style={{ alignSelf: "flex-start" }} disabled={pc.busy || !pc.chosen.length} aria-busy={pc.busy}>{pc.busy ? "Saving…" : "Save countries"}</button>
          </form>
        </section>
      </div>
    </>
  );
}
