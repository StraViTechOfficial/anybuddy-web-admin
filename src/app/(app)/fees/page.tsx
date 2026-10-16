"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { money } from "@/lib/format";
import { PageHead, LoadError } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { X } from "@phosphor-icons/react";
import cat from "../catalog/catalog.module.css"; // the switch

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

// Buddy sign-up (API v2.1): the distance choices and the states AnyBuddy works in. The apps read them from /api/config.
type Signup = { travelMin: number; travelMax: number; travelStep: number; travelDefault: number; operatingStates: string[] };
// v3 B4: the Plaid switch comes with the same settings; plaidKeysSet only says whether the keys are on the server.
type SignupView = Signup & { plaidBank?: boolean; plaidKeysSet?: boolean };
const STATES: [string, string][] = [["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"]];
const stateName = (code: string) => STATES.find(([c]) => c === code)?.[1] ?? code;
type Miles = { min: string; max: string; step: string; def: string };
// The server's rules and words (POST admin/platform-config/buddy-signup); returns the field to mark and the message.
function signupProblem(m: Miles, states: string[]): [keyof Miles | "states", string] | undefined {
  const [lo, hi, st, df] = [m.min, m.max, m.step, m.def].map((v) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN));
  const whole = (["min", "max", "step", "def"] as const).find((k) => !/^\d+$/.test(m[k].trim()));
  if (whole) return [whole, "Enter whole miles."];
  if (lo < 1) return ["min", "Lowest distance must be at least 1 mile."];
  if (hi > 200) return ["max", "Highest distance can't be above 200 miles."];
  if (lo >= hi) return ["min", "Lowest distance must be below the highest."];
  if (st < 1 || (hi - lo) % st) return ["step", "The step must fit evenly between lowest and highest."];
  if (df < lo || df > hi || (df - lo) % st) return ["def", "The starting distance must be inside the range and on a step."];
  if (!states.length) return ["states", "Choose at least one state."];
}

export default function Fees() {
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api<Config | Config[]>("admin/platform-config/get-all").then((r) => (Array.isArray(r.data) ? r.data[0] : r.data) ?? {}));
  const [f, setF] = useState({ c: "", t: "", ex: "100.00" });
  const [errs, setErrs] = useState<{ c?: boolean; t?: boolean }>({});
  const [busy, setBusy] = useState(false);
  const countries = useLoad(() => api<Country[]>("admin/platform-config/countries").then((r) => r.data ?? []));
  const all = countries.data ?? [];
  const [pc, setPc] = useState<{ chosen: string[]; q: string; busy: boolean }>({ chosen: [], q: "", busy: false });
  const signup = useLoad(() => api<SignupView>("admin/platform-config/buddy-signup").then((r) => r.data));
  const [plaidBusy, setPlaidBusy] = useState(false);
  const [bs, setBs] = useState<{ m: Miles; states: string[]; q: string; busy: boolean; err?: [keyof Miles | "states", string] }>({ m: { min: "", max: "", step: "", def: "" }, states: [], q: "", busy: false });
  useEffect(() => { const d = signup.data; if (d) setBs((x) => ({ ...x, m: { min: String(d.travelMin), max: String(d.travelMax), step: String(d.travelStep), def: String(d.travelDefault) }, states: d.operatingStates ?? [] })); }, [signup.data]);
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

  const t2 = bs.q.trim().toLowerCase();
  // An exact code ("ri") comes first, then names containing the text.
  const stateHits = t2 ? STATES.filter(([c, n]) => !bs.states.includes(c) && (c.toLowerCase() === t2 || n.toLowerCase().includes(t2)))
    .sort((a, b) => Number(b[0].toLowerCase() === t2) - Number(a[0].toLowerCase() === t2)).slice(0, 8) : [];
  const addState = (c?: string) => c && setBs({ ...bs, states: [...bs.states, c], q: "", err: undefined });
  const setMiles = (k: keyof Miles, v: string) => setBs({ ...bs, m: { ...bs.m, [k]: v }, err: undefined });
  async function saveSignup(e: React.FormEvent) {
    e.preventDefault();
    const bad = signupProblem(bs.m, bs.states);
    if (bad) { setBs({ ...bs, err: bad }); return document.getElementById(`bs-${bad[0]}`)?.focus(); }
    setBs({ ...bs, busy: true });
    const body: Signup = { travelMin: Number(bs.m.min), travelMax: Number(bs.m.max), travelStep: Number(bs.m.step), travelDefault: Number(bs.m.def), operatingStates: bs.states };
    try { await api("admin/platform-config/buddy-signup", { method: "POST", body }); toast("Sign-up settings saved. The apps use them right away."); signup.reload(); }
    catch (x) { toast((x as Error).message); }
    setBs((x) => ({ ...x, busy: false }));
  }
  const ok = !signupProblem(bs.m, bs.states);
  // Saves on the switch itself (no Save button): the apps read it when a Buddy opens Get paid.
  async function setPlaid(on: boolean) {
    setPlaidBusy(true);
    try { const r = await api<SignupView>("admin/platform-config/plaid-bank", { method: "POST", body: { plaidBank: on } }); signup.set(r.data); toast(r.message); }
    catch (x) { toast((x as Error).message); }
    setPlaidBusy(false);
  }
  const mileField = (k: keyof Miles, label: string) => (
    <label className="field"><span>{label}</span><input id={`bs-${k}`} className="input" inputMode="numeric" value={bs.m[k]} aria-invalid={bs.err?.[0] === k} onChange={(e) => setMiles(k, e.target.value)} /></label>
  );

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
            <span id="fpH" className="hint">Customers and Buddies can only sign up and log in with these. The US and Canada share +1.</span>
            {/* Owner, 16 Oct 2026: Twilio doesn't allow SMS geo permissions to change through its API (by design), so the
                admin is told exactly which countries to switch in Twilio, with direct links. */}
            {(() => {
              const saved = chosenOf(data?.phoneCountries, all), name = (k: string) => all.find((x) => x.code === k)?.name ?? k;
              const on = pc.chosen.filter((k) => !saved.includes(k)), off = saved.filter((k) => !pc.chosen.includes(k));
              return (
                <div className={on.length || off.length ? "note" : "hint"} style={{ flexDirection: "column", gap: 4 }} role={on.length || off.length ? "status" : undefined}>
                  {on.length > 0 && <p>After saving, turn <b>on</b> in Twilio: {on.map(name).join(", ")}.</p>}
                  {off.length > 0 && <p>After saving, turn <b>off</b> in Twilio: {off.map(name).join(", ")}.</p>}
                  <p>Twilio settings: <a href="https://console.twilio.com/us1/develop/sms/settings/geo-permissions" target="_blank" rel="noopener noreferrer">SMS geo permissions</a> and <a href="https://console.twilio.com/us1/develop/verify/settings" target="_blank" rel="noopener noreferrer">Verify settings</a>. Twilio only allows this change by hand.</p>
                </div>
              );
            })()}
            <button className="btn p" style={{ alignSelf: "flex-start" }} disabled={pc.busy || !pc.chosen.length} aria-busy={pc.busy}>{pc.busy ? "Saving…" : "Save countries"}</button>
          </form>
        </section>
        <section className="box">
          <header className="bh"><h2>Buddy sign-up</h2></header>
          {signup.error ? <LoadError message={signup.error} retry={signup.reload} /> : !signup.data ? <div className="skeleton" style={{ height: 240, margin: 18 }} /> : (
          <form onSubmit={saveSignup} noValidate style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field"><span>Service area, in miles</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                {mileField("min", "Lowest")}{mileField("max", "Highest")}{mileField("step", "Step")}{mileField("def", "Starting distance")}
              </div>
              {bs.err && bs.err[0] !== "states" ? <span className="err" role="alert">{bs.err[1]}</span>
                : <span className="hint">{ok ? `Buddies pick from ${bs.m.min} to ${bs.m.max} miles in steps of ${bs.m.step}. New Buddies start at ${bs.m.def}.` : "Whole miles."}</span>}
            </div>
            <div className="field"><span>Operating states</span>
              <ul aria-label="Operating states" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {bs.states.map((code) => (
                  <li key={code} className="chip c-info" style={{ whiteSpace: "normal", paddingRight: 4 }}>{stateName(code)} ({code})
                    <button type="button" aria-label={`Remove ${stateName(code)}`} disabled={bs.states.length < 2} onClick={() => setBs({ ...bs, states: bs.states.filter((k) => k !== code) })}
                      style={{ display: "grid", placeItems: "center", border: 0, background: "none", padding: 4, borderRadius: 99, opacity: bs.states.length < 2 ? .4 : 1, cursor: bs.states.length < 2 ? "not-allowed" : "pointer" }}><X size={14} aria-hidden /></button></li>))}
              </ul>
              {bs.err?.[0] === "states" && <span className="err" role="alert">{bs.err[1]}</span>}
            </div>
            <label className="field"><span>Add a state</span>
              <input id="bs-states" className="input" placeholder="Search states" value={bs.q} aria-controls="bsL" onChange={(e) => setBs({ ...bs, q: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addState(stateHits[0]?.[0]); } else if (e.key === "Escape") setBs({ ...bs, q: "" }); }} /></label>
            {t2 && <ul id="bsL" aria-label="Matching states" style={{ listStyle: "none", padding: 0, marginTop: -8, display: "grid", gap: 2 }}>
              {stateHits.map(([c, n]) => <li key={c}><button type="button" className="btn ghost sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => addState(c)}>{n} <span className="muted">{c}</span></button></li>)}
              {!stateHits.length && <li className="hint">No match for “{bs.q.trim()}”</li>}
            </ul>}
            <span className="hint">Apps use these right away. Buddies outside a new range keep their distance until they change it.</span>
            <button className="btn p" style={{ alignSelf: "flex-start" }} disabled={bs.busy} aria-busy={bs.busy}>{bs.busy ? "Saving…" : "Save sign-up settings"}</button>
          </form>)}
          {signup.data && <div style={{ padding: "0 18px 18px", display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div className="field" style={{ gap: 2 }}><span id="plaidL">Bank linking with Plaid</span>
              <span id="plaidH" className="hint">Shows the Plaid button on Get paid. Off: Buddies enter their bank by hand.</span>
              {!signup.data.plaidKeysSet && <span id="plaidK" className="err">Plaid keys aren&apos;t set on the server.</span>}</div>
            <label className={cat.switch} style={signup.data.plaidKeysSet ? undefined : { opacity: .5, cursor: "not-allowed" }}>
              <input type="checkbox" aria-labelledby="plaidL" aria-describedby={signup.data.plaidKeysSet ? "plaidH" : "plaidH plaidK"} checked={!!signup.data.plaidBank} disabled={plaidBusy || !signup.data.plaidKeysSet} aria-busy={plaidBusy}
                onChange={(e) => setPlaid(e.target.checked)} /><span /></label>
          </div>}
        </section>
      </div>
    </>
  );
}
