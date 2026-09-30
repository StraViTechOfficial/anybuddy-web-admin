import s from "./auth.module.css";

// How long an emailed reset code works (backend OTP_EXPIRY_MINUTES); a new one can't be sent before then.
export const CODE_LIFE_MS = 10 * 60 * 1000;

// One centred card on white with the full-colour logo; a navy band across the lower page (WEBSITE-STANDARD, log-in pages).
export function AuthCard({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className={s.page}>
      <div className={s.logo}>
        <img src="/mark.png" alt="" width={40} height={40} />
        <b>Any-Buddy</b>
        <span className={s.badge}>ADMIN</span>
      </div>
      <section className={s.card}>
        <h1 className={s.h}>{title}</h1>
        {sub && <p className={s.sub}>{sub}</p>}
        {children}
      </section>
      <div className={s.band} aria-hidden="true" />
    </main>
  );
}
