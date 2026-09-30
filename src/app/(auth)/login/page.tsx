"use client";
import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AuthCard } from "../AuthCard";
import { useReady } from "@/components/useReady";
import s from "../auth.module.css";

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}

function Login() {
  const q = useSearchParams();
  const ready = useReady();
  const [err, setErr] = useState(q.get("expired") ? "Your session ended. Log in again." : "");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim(), password = String(f.get("password"));
    if (!email || !password) return setErr("Enter your email and password.");
    setBusy(true);
    setErr("");
    try {
      await api("admin/auth/login", { method: "POST", body: { email, password } });
      const next = q.get("next");
      window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (x) {
      setErr((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Log in" sub="Any-Buddy admin">
      <form className={s.form} onSubmit={submit} noValidate method="post" action="#">
        <label className="field">
          <span>Email</span>
          <input className="input" name="email" type="email" autoComplete="username" autoFocus required />
        </label>
        <div className="field">
          <div className={s.row}>
            <label htmlFor="pw" style={{ fontWeight: 600 }}>Password</label>
            <Link className={s.link} href="/forgot">Forgot password</Link>
          </div>
          <div className={s.pw}>
            <input id="pw" className="input" name="password" type={show ? "text" : "password"} autoComplete="current-password" required />
            <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
          </div>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn p block" style={{ height: 44 }} aria-busy={busy} disabled={busy || !ready}>{busy ? "Logging in…" : "Log in"}</button>
      </form>
    </AuthCard>
  );
}
