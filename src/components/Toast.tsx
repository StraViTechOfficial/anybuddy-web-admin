"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import s from "./Toast.module.css";

type Show = (message: string, undo?: () => void) => void;
const Ctx = createContext<Show>(() => {});
export const useToast = () => useContext(Ctx);

// One message at a time, 5 s, optional Undo. Announced politely to screen readers.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; undo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback<Show>((text, undo) => {
    clearTimeout(timer.current);
    setMsg({ text, undo });
    timer.current = setTimeout(() => setMsg(null), 5000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`${s.toast} ${msg ? s.on : ""}`} role="status" aria-live="polite">
        {msg && <span>{msg.text}</span>}
        {msg?.undo && (
          <button onClick={() => { msg.undo?.(); setMsg(null); }}>Undo</button>
        )}
      </div>
    </Ctx.Provider>
  );
}
