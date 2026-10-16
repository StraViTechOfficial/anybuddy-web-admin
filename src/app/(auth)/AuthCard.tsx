import s from "./auth.module.css";

// One centred card on white with the full-colour logo, and a navy band across the lower part of the page. This follows
// the log-in page rules in WEBSITE-STANDARD.md.
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
