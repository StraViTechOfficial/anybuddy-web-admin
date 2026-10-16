"use client";
import { useState } from "react";
import { ChatCircle, Copy, Warning } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { date } from "@/lib/format";
import { PageHead, Empty, LoadError } from "@/components/ui";
import { useToast } from "@/components/Toast";

type Ticket = { _id: string; name?: string; email?: string; description?: string; createdAt?: string; type: 1 | 2 };
const validEmail = (e?: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e ?? "");

// Messages from the Contact form (type 1 is a customer, type 2 is a Buddy). They are always shown as plain text.
// Replying and marking a message Open or Resolved need the server to store them. Until then the admin replies by email.
export default function Support() {
  const toast = useToast();
  const [who, setWho] = useState<1 | 2>(1);
  const [sel, setSel] = useState<string>();
  const { data, error, loading, reload } = useLoad(() => api<Ticket[]>("admin/cms-management/list-supportUs-queries", { query: { type: who, limit: 50 } }).then((r) => (r.data || []).map((t) => ({ ...t, type: who }))), [who]);
  const t = data?.find((x) => x._id === sel) ?? data?.[0];
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); toast("Email copied"); } catch { toast(v); } };

  return (
    <>
      <PageHead title="Support" sub="Messages from the Contact form in the apps and website." />
      <section className="box">
        <div className="tbar"><div className="seg" role="tablist">
          <button role="tab" aria-selected={who === 1} onClick={() => { setWho(1); setSel(undefined); }}>From customers</button>
          <button role="tab" aria-selected={who === 2} onClick={() => { setWho(2); setSel(undefined); }}>From Buddies</button>
        </div></div>
        {error ? <LoadError message={error} retry={reload} /> : loading && !data ? <div className="skeleton" style={{ height: 200, margin: 18 }} /> : !data?.length ? <Empty icon={ChatCircle} title="No messages">New Contact form messages appear here.</Empty> : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) minmax(0, 1fr)", minHeight: 360 }} className="support-grid">
            <ul style={{ listStyle: "none", padding: 0, margin: 0, borderRight: "1px solid var(--line)" }}>
              {data.map((x) => (
                <li key={x._id}><button type="button" onClick={() => setSel(x._id)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", border: 0, borderBottom: "1px solid var(--line)", background: x._id === t?._id ? "var(--navy-0)" : "none", boxShadow: x._id === t?._id ? "inset 3px 0 0 var(--navy)" : "none" }}>
                  <b>{x.name || "No name"}</b><br /><span className="hint" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.description}</span>
                </button></li>
              ))}
            </ul>
            {t && (
              <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                <div><h2>{t.name || "No name"}</h2><span className="muted">{t.email}{t.createdAt && ` · ${date(t.createdAt)}`}</span></div>
                {!validEmail(t.email) && <div className="note"><Warning size={16} />“{t.email}” isn&apos;t a valid email, so a reply can&apos;t reach this person.</div>}
                <div style={{ padding: "12px 14px", borderRadius: 14, background: "var(--soft)", border: "1px solid var(--line)", whiteSpace: "pre-wrap" }}>{t.description}</div>
                {validEmail(t.email) && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span className="hint">Reply by email to</span><b>{t.email}</b><button className="btn sm" onClick={() => copy(t.email!)}><Copy size={14} />Copy</button></div>}
                <p className="hint">Replying and marking messages resolved from here aren&apos;t available yet. Reply by email.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
