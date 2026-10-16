"use client";
import { useState } from "react";
import { Copy, Eye, EyeSlash, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { money, phone } from "@/lib/format";
import { Modal } from "@/components/Modal";
import { ReasonDialog } from "@/components/ReasonDialog";
import { useToast } from "@/components/Toast";
import { type Bank, type Payout, bankOf, jobOf, vendorOf, ageText } from "./data";
import s from "./payouts.module.css";

/** Everything the admin needs to pay one Buddy from Citizens online banking and then record it. The full bank numbers
 *  are fetched only when the admin presses "Show", and are gone again on "Hide" or when the drawer closes. */
export function PaySheet({ p, onClose, onDone }: { p: Payout; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const v = vendorOf(p), job = jobOf(p);
  const [bank, setBank] = useState<Bank | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [mode, setMode] = useState<"pay" | "reject" | "reopen" | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const open = p.status === "requested";
  const type = bank?.accountType || v.type;

  const copy = async (label: string, value?: string) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast(`${label} copied`); } catch { toast(value); }
  };
  const dots = (last4?: string) => (last4 ? "•••• " + last4 : undefined);
  async function reveal() {
    if (bank) return setBank(null);
    setRevealing(true);
    try { setBank(await bankOf(p._id)); } catch (x) { toast((x as Error).message); }
    setRevealing(false);
  }
  async function submit() {
    if (mode === "pay" && !text.trim()) return setErr("Enter the Citizens transfer reference.");
    setBusy(true);
    try {
      // The current backend reads `reference` when a payout is marked paid (see the schema in routes/admin/payouts.ts).
      const body = mode === "pay" ? { status: "paid", reference: text.trim() } : { status: "requested" };
      await api("admin/payouts/status", { method: "PUT", body: { payoutId: p._id, ...body } });
      toast(mode === "pay" ? `Marked paid · ${v.name} is told the money is on its way` : `Back in “To send” for ${v.name}`);
      onDone();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  // Throws on failure, so ReasonDialog shows the error inside the dialog. The backend reads `note` when a payout is
  // rejected.
  async function reject(note: string) {
    await api("admin/payouts/status", { method: "PUT", body: { payoutId: p._id, status: "rejected", note } });
    toast(`Rejected · ${v.name} is asked to fix their bank details`);
    onDone();
  }

  const row = (label: string, value?: string, secret = false) => (
    <div className={s.bank}>
      <span className="muted">{label}</span>
      <b className={secret ? "mono" : ""}>{value || "Not given"}</b>
      {value && (!secret || bank) && <button type="button" className="btn sm ghost" onClick={() => copy(label, value)} aria-label={`Copy ${label}`}><Copy size={14} /></button>}
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
          {row("Account holder", bank?.accountHolder || v.holder)}
          {row("Bank", bank?.bankName || v.bank)}
          {row("Routing number", bank?.routingNumber || dots(v.routing4), true)}
          {row("Account number", bank?.accountNumber || dots(v.account4), true)}
          {type && row("Account type", type[0].toUpperCase() + type.slice(1))}
          {row("Amount", p.amount?.toFixed(2))}
          {job.number && row("Memo", `Any-Buddy job ${job.number}`)}
        </div>
        {open && v.account4 && <button type="button" className="btn sm" style={{ marginTop: 10 }} onClick={reveal} disabled={revealing} aria-busy={revealing}>{bank ? <><EyeSlash size={14} />Hide numbers</> : <><Eye size={14} />Show numbers</>}</button>}
        {open && (!v.routing4 || !v.account4) && <div className="note" style={{ marginTop: 10 }}><Warning size={16} />Bank details are incomplete. Reject with a reason so the Buddy adds them.</div>}
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
        // Matches the backend's notice (controller/admin/payouts.ts), which words job payouts and withdrawals differently.
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
