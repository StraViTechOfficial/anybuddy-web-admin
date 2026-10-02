"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { PageHead, LoadError } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { Editor, clean, isBlank } from "./Editor";

const PAGES = [[1, "About us"], [2, "Terms of use"], [3, "Privacy policy"]] as const;
// The server wraps the saved record: data.content is { _id, content: "<html>" }, not the text itself.
type Cms = { content?: string | { content?: string } } | { content?: string }[];
// Stored as the text customers see. Saving publishes at once; the apps show it on their next open.
const text = (d: Cms | null | undefined) => {
  const c = Array.isArray(d) ? d[0]?.content : d?.content;
  return (typeof c === "object" ? c?.content : c) ?? "";
};

export default function Content() {
  const toast = useToast();
  const [type, setType] = useState<1 | 2 | 3>(1);
  const { data, error, reload, loading } = useLoad(() => api<Cms>("admin/cms-management/list", { query: { type } }).then((r) => text(r.data)), [type]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(data ?? ""); }, [data]);
  const changed = draft !== (data ?? "");
  const name = PAGES.find(([k]) => k === type)![1];

  async function publish() {
    if (isBlank(draft)) return toast(`${name} can't be empty.`);
    setBusy(true);
    try { await api("admin/cms-management/update", { method: "PUT", body: { type, content: clean(draft) } }); toast(`${name} published`); reload(); }
    catch (e) { toast((e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Content pages" sub="Shown in the apps and on the website." />
      <section className="box">
        <div className="tbar">
          <div className="seg" role="tablist">{PAGES.map(([k, l]) => <button key={k} role="tab" aria-selected={type === k} disabled={changed && type !== k} title={changed && type !== k ? "Publish or discard your changes first" : undefined} onClick={() => setType(k)}>{l}</button>)}</div>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            {changed && <span className="hint">Unpublished changes. Publish or discard before switching pages.</span>}
            <button className="btn" disabled={!changed || busy} onClick={() => setDraft(data ?? "")}>Discard</button>
            <button className="btn p" disabled={!changed || busy} aria-busy={busy} onClick={publish}>Publish</button>
          </span>
        </div>
        {error ? <LoadError message={error} retry={reload} /> : (
          <div style={{ padding: 18 }}>
            <div className="field"><span>{name}</span>
              <Editor value={draft} onChange={setDraft} disabled={loading} label={name} />
              <span className="hint">The live version stays up until you publish.</span></div>
          </div>
        )}
      </section>
    </>
  );
}
