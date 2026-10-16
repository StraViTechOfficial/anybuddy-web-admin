"use client";
import { useState } from "react";
import { PaperPlaneTilt, Bell } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date } from "@/lib/format";
import { PageHead, Empty } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import s from "./notifications.module.css";

type Sent = { _id: string; title: string; message: string; createdAt?: string; isAll?: number };
type Aud = "customers" | "buddies" | "everyone";

// The server sends either to everyone (isAll 1) or to a list of ids (isAll 0). So "all customers" and "all Buddies"
// are sent as a list of ids, read from list-customers and list-buddy.
async function audience() {
  const [c, b] = await Promise.all([
    api<{ _id: string }[]>("admin/notification-management/list-customers", { query: { limit: 1000 } }).catch(() => ({ data: [] as { _id: string }[] })),
    api<{ _id: string }[]>("admin/notification-management/list-buddy", { query: { limit: 1000 } }).catch(() => ({ data: [] as { _id: string }[] })),
  ]);
  return { customers: (c.data || []).map((x) => x._id), buddies: (b.data || []).map((x) => x._id) };
}

export default function Notifications() {
  const toast = useToast();
  const who = useLoad(audience);
  const sent = useLoad(() => api<Sent[]>("admin/notification-management/list", { query: { page: 1, limit: 20 } }).then((r) => r.data || []));
  const [aud, setAud] = useState<Aud>("customers");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [errs, setErrs] = useState<{ t?: boolean; m?: boolean }>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const n = aud === "everyone" ? (who.data ? who.data.customers.length + who.data.buddies.length : 0) : who.data?.[aud].length ?? 0;
  const label = { customers: "All customers", buddies: "All Buddies", everyone: "Everyone" }[aud];

  function review(e: React.FormEvent) {
    e.preventDefault();
    const bad = { t: !title.trim(), m: !msg.trim() };
    setErrs(bad);
    if (bad.t || bad.m) return document.getElementById(bad.t ? "nt" : "nm")?.focus();
    setConfirm(true);
  }
  async function send() {
    setBusy(true);
    try {
      await api("admin/notification-management/send", { method: "POST", body: aud === "everyone" ? { title: title.trim(), message: msg.trim(), isAll: 1 } : { title: title.trim(), message: msg.trim(), isAll: 0, userIds: who.data![aud] } });
      toast(`Sent to ${n} people`); setConfirm(false); setTitle(""); setMsg(""); sent.reload();
    } catch (x) { toast((x as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Notifications" sub="A push message to phones, with a copy in each person's inbox." />
      <div className={s.grid}>
        <section className="box">
          <header className="bh"><h2>New message</h2></header>
          <form onSubmit={review} noValidate className={s.form}>
            <fieldset className={s.rad}><legend>Audience</legend>
              {(["customers", "buddies", "everyone"] as Aud[]).map((k) => (
                <label key={k}><input type="radio" name="aud" checked={aud === k} onChange={() => setAud(k)} /><span><b>{{ customers: "All customers", buddies: "All Buddies", everyone: "Everyone" }[k]}</b><small>{who.data ? (k === "everyone" ? who.data.customers.length + who.data.buddies.length : who.data[k].length) : "…"} people</small></span></label>
              ))}
            </fieldset>
            <label className="field"><span>Title</span><input id="nt" className="input" maxLength={50} value={title} aria-invalid={errs.t} placeholder="Example: Plumbing help this weekend" onChange={(e) => setTitle(e.target.value)} />
              {errs.t ? <span className="err">Add a title.</span> : <span className="hint">{title.length}/50</span>}</label>
            <label className="field"><span>Message</span><textarea id="nm" className="input" rows={4} maxLength={178} value={msg} aria-invalid={errs.m} placeholder="Keep it short. Phones show about two lines." onChange={(e) => setMsg(e.target.value)} />
              {errs.m ? <span className="err">Add a message.</span> : <span className="hint">{msg.length}/178</span>}</label>
            <button className="btn p" style={{ alignSelf: "flex-start" }}><PaperPlaneTilt size={16} />Review and send</button>
          </form>
        </section>
        <section className="box" style={{ padding: 18 }}><h3 style={{ marginBottom: 12 }}>Phone preview</h3>
          <div className={s.phone}><span className={s.pbar} /><span className={s.ps}>Now</span>
            <div className={s.push}><img src="/mark.png" alt="" width={22} height={22} /><div><b>{title || "Title"}</b><span>{msg || "Your message shows here."}</span></div></div></div>
        </section>
      </div>
      <section className="box"><header className="bh"><h2>Sent</h2></header>
        {sent.data?.length ? <table className="stack"><thead><tr><th>Title</th><th>Message</th><th>Sent</th></tr></thead><tbody>{sent.data.map((x) => <tr key={x._id}><td><b>{x.title}</b></td><td className="muted">{x.message}</td><td>{x.createdAt ? date(x.createdAt) : "—"}</td></tr>)}</tbody></table>
          : <Empty icon={Bell} title="No messages sent yet">Sent messages appear here.</Empty>}
      </section>
      {confirm && (
        <Modal title={`Send to ${n} people`} onClose={() => !busy && setConfirm(false)}
          footer={<><button className="btn" onClick={() => setConfirm(false)} disabled={busy}>Back</button><button className="btn p" onClick={send} disabled={busy || !n}>{busy ? "Sending…" : "Send now"}</button></>}>
          <p>{label} get “{title.trim()}” now. Sent messages can&apos;t be recalled.</p>
        </Modal>
      )}
    </>
  );
}
