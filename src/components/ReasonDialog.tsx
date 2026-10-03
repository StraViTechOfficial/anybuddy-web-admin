"use client";
import { useCallback, useRef, useState } from "react";
import { Modal } from "./Modal";

/** Confirm step for one negative action (reject, cancel…) with its reason. Opens only after the admin picks that action. */
export function ReasonDialog({ title, next, label, placeholder, hint, required, missing, max, confirm, onConfirm, onClose }: {
  title: string; next: React.ReactNode; label: string; placeholder?: string; hint: string; max?: number;
  required?: boolean; missing?: string; confirm: string; onConfirm: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Stable close so Modal's focus effect runs once; blocked while saving.
  const busyRef = useRef(false), closeRef = useRef(onClose);
  closeRef.current = onClose;
  const close = useCallback(() => { if (!busyRef.current) closeRef.current(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (required && !text.trim()) { setErr(missing ?? "Add a reason to continue."); document.getElementById("rsn")?.focus(); return; }
    setBusy(busyRef.current = true);
    try { await onConfirm(text.trim()); } catch (x) { setErr((x as Error).message); setBusy(busyRef.current = false); }
  }

  return (
    <Modal title={title} onClose={close}
      footer={<><button type="button" className="btn" onClick={close} disabled={busy}>Cancel</button><button className="btn ds" form="rsnF" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : confirm}</button></>}>
      <p>{next}</p>
      <form id="rsnF" className="field" onSubmit={submit} noValidate>
        <label htmlFor="rsn" style={{ fontWeight: 600 }}>{label}{!required && <span className="hint"> · optional</span>}</label>
        <textarea id="rsn" className="input" rows={3} autoFocus value={text} maxLength={max} placeholder={placeholder} aria-invalid={!!err} aria-describedby="rsnH"
          onChange={(e) => { setText(e.target.value); setErr(""); }} />
        {err ? <span id="rsnH" className="err" role="alert">{err}</span> : <span id="rsnH" className="hint">{hint}</span>}
      </form>
    </Modal>
  );
}
