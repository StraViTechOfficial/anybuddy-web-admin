"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthCard } from "../AuthCard";
import { useReady } from "@/components/useReady";
import s from "../auth.module.css";

// Step 1 of 3 (email, then code, then new password). Nothing here signs you in, unlike the old admin panel.
export default function Forgot() {
  const ready = useReady();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return setErr("Enter an email like name@example.com.");
    setBusy(true);
    setErr("");
    try {
      // codeValidFor is the number of seconds until "Send again" works. It is 30 for a new code, or the time left on a code
      // that is still valid. Older servers don't send it.
      const { data } = await api<{ codeValidFor?: number } | null>("admin/auth/forgot-password", { method: "POST", body: { email } });
      sessionStorage.setItem("ab_reset_email", email);
      sessionStorage.setItem("ab_code_until", String(Date.now() + (data?.codeValidFor ?? 30) * 1000));
      window.location.assign("/code");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Reset your password" sub="We email a 6-digit code to the admin address.">
      <form className={s.form} onSubmit={submit} noValidate method="post" action="#">
        <label className="field">
          <span>Email</span>
          <input className="input" name="email" type="email" autoComplete="username" autoFocus />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn p block" style={{ height: 44 }} disabled={busy || !ready} aria-busy={busy}>{busy ? "Sending…" : "Send code"}</button>
        <Link className={s.link} href="/login">Back to log in</Link>
      </form>
    </AuthCard>
  );
}
