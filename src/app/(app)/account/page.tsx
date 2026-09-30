"use client";
import { useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { PageHead } from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function Account() {
  const toast = useToast();
  const [f, setF] = useState({ old: "", pw: "", pw2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.old) return setErr("Enter your current password.");
    if (f.pw.length < 8) return setErr("Use at least 8 characters for the new password.");
    if (f.pw !== f.pw2) return setErr("The two new passwords don't match.");
    setBusy(true); setErr("");
    try {
      await api("admin/auth/change-password", { method: "PUT", body: { oldPassword: f.old, newPassword: f.pw, confirmPassword: f.pw2 } });
      toast("Password updated"); setF({ old: "", pw: "", pw2: "" });
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Account & security" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>
        <section className="box">
          <header className="bh"><h2>Change password</h2></header>
          <form onSubmit={save} noValidate style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" value={f.old} onChange={(e) => setF({ ...f, old: e.target.value })} /></label>
            <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /><span className="hint">At least 8 characters.</span></label>
            <label className="field"><span>New password again</span><input className="input" type="password" autoComplete="new-password" value={f.pw2} onChange={(e) => setF({ ...f, pw2: e.target.value })} /></label>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn p" style={{ alignSelf: "flex-start" }} disabled={busy} aria-busy={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>
        </section>
        <section className="box">
          <header className="bh"><h2>Other devices</h2></header>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="note"><Warning size={16} />Changing the password doesn&apos;t sign out other devices yet (SEC-44). Until that&apos;s fixed, use Forgot password on the log-in page: a reset signs out every other device.</div>
          </div>
        </section>
      </div>
    </>
  );
}
