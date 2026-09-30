"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthCard, CODE_LIFE_MS } from "../AuthCard";
import { useReady } from "@/components/useReady";
import s from "../auth.module.css";

// Step 2 of 3. A correct code unlocks the new-password step only; it is not a sign-in (the proxy keeps it apart).
export default function Code() {
  const ready = useReady();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  // The server refuses a new code while the last one still works (10 minutes), so the wait is the code's life.
  // Kept per tab as a time, so a reload keeps the countdown.
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const wait = Math.max(0, until - now);
  useEffect(() => {
    setEmail(sessionStorage.getItem("ab_reset_email") || "");
    setUntil(Number(sessionStorage.getItem("ab_code_until")) || Date.now() + CODE_LIFE_MS);
  }, []);
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [wait, now]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const otp = String(new FormData(e.currentTarget).get("otp")).replace(/\D/g, "");
    if (otp.length !== 6) return setErr("Enter the 6-digit code from the email.");
    setBusy(true);
    setErr("");
    try {
      await api("admin/auth/verify-otp", { method: "POST", body: { loginOtp: otp } });
      window.location.assign("/reset");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }
  async function resend() {
    try {
      await api("admin/auth/resend-otp", { method: "POST", body: {} });
      const next = Date.now() + CODE_LIFE_MS;
      sessionStorage.setItem("ab_code_until", String(next));
      setUntil(next);
      setNow(Date.now());
      setErr("");
    } catch (x) {
      setErr((x as Error).message);
    }
  }

  return (
    <AuthCard title="Enter the code" sub={email ? <>Sent to <b>{email}</b>. It works for 10 minutes.</> : "Sent to the admin email. It works for 10 minutes."}>
      <form className={s.form} onSubmit={submit} noValidate method="post" action="#">
        <label className="field">
          <span>6-digit code</span>
          <input className={`input ${s.code}`} name="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus />
        </label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn p block" style={{ height: 44 }} disabled={busy || !ready} aria-busy={busy}>{busy ? "Checking…" : "Continue"}</button>
        <div className={s.row}>
          <Link className={s.link} href="/forgot">Use another email</Link>
          <button type="button" className={s.link} onClick={resend} disabled={wait > 0}>{wait > 0 ? `Send again in ${Math.ceil(wait / 60000)} min` : "Send again"}</button>
        </div>
      </form>
    </AuthCard>
  );
}
