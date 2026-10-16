"use client";
import { useState } from "react";
import { Image as ImageIcon } from "@phosphor-icons/react";
import { upload } from "@/lib/api";
import s from "./catalog.module.css";

/** Lets the admin pick a photo and uploads it straight away. The old photo stays until the new upload succeeds. */
export function PhotoPick({ url, onChange, id }: { url?: string; onChange: (url: string) => void; id: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(f?: File) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErr("Use a JPG, PNG or WebP photo.");
    if (f.size > 10 * 1024 * 1024) return setErr("Photos can be up to 10 MB.");
    setBusy(true); setErr("");
    try { onChange(await upload(f)); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  return (
    <div className="field">
      <span>Photo</span>
      <div className={s.upl}>
        <span className={s.uprev}>{url ? <img src={url} alt="Current photo" /> : <ImageIcon size={24} />}</span>
        <div>
          <label className="btn sm" htmlFor={id} aria-busy={busy}>{busy ? "Uploading…" : url ? "Replace photo" : "Choose photo"}</label>
          <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          <p className="hint" style={{ marginTop: 6 }}>A real American home and the thing being worked on. No people, no AI images.</p>
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    </div>
  );
}
