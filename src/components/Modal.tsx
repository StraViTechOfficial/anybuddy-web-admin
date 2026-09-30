"use client";
import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import s from "./Modal.module.css";

/** Centred dialog (confirmations) or right-hand drawer (records). Esc and the backdrop close it; focus stays inside. */
export function Modal({ title, onClose, children, footer, drawer = false, sub }: {
  title: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; drawer?: boolean; sub?: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-x])");
    (first ?? box.current)?.focus();
    const key = (e: KeyboardEvent) => {
      // Stacked dialogs (a confirm over a drawer): only the top one handles Esc and Tab.
      if (box.current !== [...document.querySelectorAll("[role=dialog]")].at(-1)) return;
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input, select, textarea")];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)!.focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); prev?.focus?.(); };
  }, [onClose]);

  return (
    <>
      <div className={s.scrim} onClick={onClose} />
      <div ref={box} className={drawer ? s.drawer : s.modal} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined} tabIndex={-1}>
        <header className={s.head}>
          <div style={{ minWidth: 0 }}>{typeof title === "string" ? <h2>{title}</h2> : title}{sub && <p className="muted" style={{ marginTop: 4 }}>{sub}</p>}</div>
          <button type="button" data-x className={s.x} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className={s.body}>{children}</div>
        {footer && <footer className={s.foot}>{footer}</footer>}
      </div>
    </>
  );
}
