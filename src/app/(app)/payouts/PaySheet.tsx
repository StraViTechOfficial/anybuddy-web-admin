"use client";
import { useState } from "react";
import { Copy, Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { money, phone } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ReasonDialog } from "@/components/ReasonDialog";
import { useToast } from "@/components/Toast";
import { type Payout, jobOf, vendorOf, ageText } from "./data";
import s from "./payouts.module.css";

/** Everything needed to pay one Buddy from Citizens online banking, then record it. Bank numbers stay hidden until "Show". */
export function PaySheet({ p, onClose, onDone }: { p: Payout; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const v = vendorOf(p), job = jobOf(p);
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<"pay" | "reject" | "reopen" | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const open = p.status === "requested";

  const copy = async (label: string, value?: string) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast(`${label} copied`); } catch { toast(value); }
  };
  const hide = (x?: string) => (x ? (show ? x : "•••• " + x.slice(-4)) : "Not given");
  async function submit() {
    if (mode === "pay" && !text.trim()) return setErr("Enter the Citizens transfer reference.");
    setBusy(true);
    try {
      // Today's backend reads `reference` for paid (routes/admin/payouts.ts schema).
      const body = mode === "pay" ? { status: "paid", reference: text.trim() } : { status: "requested" };
      await api("admin/payouts/status", { method: "PUT", body: { payoutId: p._id, ...body } });
      toast(mode === "pay" ? `Marked paid · ${v.name} is told the money is on its way` : `Back in “To send” for ${v.name}`);
      onDone();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  // Throws on failure so ReasonDialog shows the error inside itself. The backend reads `note` for rejected.
  async function reject(note: string) {
    await api("admin/payouts/status", { method: "PUT", body: { payoutId: p._id, status: "rejected", note } });
    toast(`Rejected · ${v.name} is asked to fix their bank details`);
    onDone();
  }

  const row = (label: string, value?: string, secret = false) => (
    <div className={s.bank}>
      <span className="muted">{label}</span>
      <b className={secret ? "mono" : ""}>{secret ? hide(value) : value || "Not given"}</b>
      {value && (!secret || show) && <button type="button" className="btn sm ghost" onClick={() => copy(label, value)} aria-label={`Copy ${label}`}><Copy size={14} /></button>}
    </div>
  );

  return (
    <Modal drawer onClose={onClose}
      title={<><span className="hint">{open ? "Payout to send" : p.status === "paid" ? "Paid payout" : "Rejected payout"}</span><h2 style={{ fontSize: "var(--fs-h3)" }}>{money(p.amount)} to {v.name}</h2></>}
      sub={<>{job.number && <span className="mono">{job.number}</span>}{job.service && ` · ${job.service}`}{job.doneAt && ` · done ${ageText(job.doneAt)} ago`}</>}
      footer={mode && mode !== "reject" ? undefined : open ? <><button className="btn d" onClick={() => { setMode("reject"); setText(""); setErr(""); }}>Reject</button><button className="btn p" onClick={() => { setMode("pay"); setText(""); setErr(""); }}>Mark as paid</button></>
        : p.status === "rejected" && p.auto !== false ? <button className="btn p" onClick={() => { setMode("reopen"); setErr(""); }}>Reopen to send again</button> : undefined}>
      <section>
        <h3 className={s.h3}>Send from Citizens online banking</h3>
        <div className={s.bankbox}>
          {row("Account holder", v.holder)}
          {row("Bank", v.bank)}
          {row("Routing number", v.routing, true)}
          {v.account ? row("Account number", v.account, true) : row("Account number", v.last4 ? `•••• ${v.last4}` : undefined)}
          {v.type && row("Account type", v.type[0].toUpperCase() + v.type.slice(1))}
          {row("Amount", p.amount?.toFixed(2))}
          {job.number && row("Memo", `Any-Buddy job ${job.number}`)}
        </div>
        {v.account && <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={() => setShow(!show)}>{show ? <><EyeSlash size={14} />Hide numbers</> : <><Eye size={14} />Show numbers</>}</button>}
        {open && (!v.routing || !v.account) && <div className="note" style={{ marginTop: 10 }}><Warning size={16} />Bank details are incomplete. Reject with a reason so the Buddy adds them.</div>}
      </section>
      <dl className="kv">
        <dt>Buddy</dt><dd>{v.name}{v.phone && <> · {phone(v.phone)}</>}</dd>
        {v.email && <><dt>Email</dt><dd>{v.email}</dd></>}
        {p.reference && <><dt>Reference</dt><dd className="mono">{p.reference}</dd></>}
        {p.note && <><dt>Reason</dt><dd>{p.note}</dd></>}
      </dl>
      {mode === "reopen" && (
        <section className="field" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <p>Use this once {v.name} has fixed their bank details. The payout goes back to “To send”.</p>
          {err && <span className="err">{err}</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button className="btn" onClick={() => setMode(null)} disabled={busy}>Back</button><button className="btn p" onClick={submit} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Reopen"}</button></div>
        </section>
      )}
      {mode === "pay" && (
        <section className="field" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <label htmlFor="ps" style={{ fontWeight: 600 }}>Citizens transfer reference</label>
          <input id="ps" className="input mono" autoFocus value={text} aria-invalid={!!err} placeholder="From the Citizens confirmation" onChange={(e) => { setText(e.target.value); setErr(""); }} />
          {err ? <span className="err">{err}</span> : <span className="hint">Record it only after Citizens shows the transfer as sent.</span>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setMode(null)} disabled={busy}>Back</button>
            <button className="btn p" onClick={submit} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : `Mark ${money(p.amount)} as paid`}</button>
          </div>
        </section>
      )}
      {mode === "reject" && (
        // Mirrors the backend notice (controller/admin/payouts.ts): job payouts vs withdrawals word it differently.
        <ReasonDialog title={`Reject ${money(p.amount)} payout to ${v.name}`} onClose={() => setMode(null)} onConfirm={reject}
          next={p.auto === false
            ? <>{v.name} gets an email and app notice that the withdrawal wasn&apos;t paid, with your reason. The amount goes back to their balance.</>
            : <>{v.name} gets an email and app notice that the payout wasn&apos;t sent, with your reason, and is asked to check their bank details. Reopen it from Rejected once they fix them.</>}
          label="Reason (sent to the Buddy)" placeholder="Example: The routing number doesn't match the bank. Check it in your Any-Buddy Pro account."
          hint="Name what's wrong and what to change, in one or two sentences." required missing="Add a reason so the Buddy knows what to fix."
          confirm="Reject payout" />
      )}
    </Modal>
  );
}
