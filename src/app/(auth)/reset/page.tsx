"use client";
import { PasswordInput } from "@/components/PasswordInput";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { AuthCard } from "../AuthCard";
import { useReady } from "@/components/useReady";
import s from "../auth.module.css";

// Step 3 of 3. Saving signs out every other session (backend endSessions) and signs this browser in.
export default function Reset() {
  const ready = useReady();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("pw")), confirmPassword = String(f.get("pw2"));
    if (newPassword.length < 8) return setErr("Use at least 8 characters.");
    if (newPassword !== confirmPassword) return setErr("The two passwords don't match.");
    setBusy(true);
    setErr("");
    try {
      await api("admin/auth/reset-password", { method: "POST", body: { newPassword, confirmPassword } });
      sessionStorage.removeItem("ab_reset_email");
      window.location.assign("/");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Set a new password" sub="At least 8 characters. Other devices are signed out.">
      <form className={s.form} onSubmit={submit} noValidate method="post" action="#">
        <label className="field"><span>New password</span><PasswordInput name="pw" autoComplete="new-password" autoFocus /></label>
        <label className="field"><span>New password again</span><PasswordInput name="pw2" autoComplete="new-password" /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn p block" style={{ height: 44 }} disabled={busy || !ready} aria-busy={busy}>{busy ? "Saving…" : "Save and log in"}</button>
      </form>
    </AuthCard>
  );
}
