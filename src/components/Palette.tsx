"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { fullName } from "@/lib/format";
import { main, more } from "./nav";
import s from "./Palette.module.css";

type Opt = { group: string; label: string; sub?: string; href: string };
// Every menu page (from the shared menu list), plus Account, which sits under the user menu.
const PAGES: Opt[] = [...main({}), ...more({}), { href: "/account", label: "Account & security" }]
  .map(({ label, href }) => ({ group: "Pages", label, href }));
type Person = { _id: string; firstName?: string; lastName?: string; email?: string };

// ⌘K / "/": jump to a page, or find a Buddy or customer by name or email (server search, 250 ms after typing stops).
export function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [found, setFound] = useState<Opt[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    if (q.trim().length < 2) return setFound([]);
    const t = setTimeout(async () => {
      const search = q.trim();
      const [b0, b1, c] = await Promise.all([
        api<Person[]>("admin/service-provider/list", { query: { search, status: 0, limit: 5 } }).catch(() => ({ data: [] as Person[] })),
        api<Person[]>("admin/service-provider/list", { query: { search, status: 1, limit: 5 } }).catch(() => ({ data: [] as Person[] })),
        api<Person[]>("admin/customer-management/list-users", { query: { search, limit: 5 } }).catch(() => ({ data: [] as Person[] })),
      ]);
      setFound([
        ...(b0.data || []).map((p) => ({ group: "Buddies", label: fullName(p), sub: "Waiting · " + p.email, href: `/buddies/${p._id}?s=0` })),
        ...(b1.data || []).map((p) => ({ group: "Buddies", label: fullName(p), sub: p.email, href: `/buddies/${p._id}?s=1` })),
        ...(c.data || []).map((p) => ({ group: "Customers", label: fullName(p), sub: p.email, href: `/customers/${p._id}` })),
      ]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const ql = q.trim().toLowerCase();
  const list = [...PAGES.filter((p) => !ql || p.label.toLowerCase().includes(ql)), ...found];
  const go = (o: Opt) => { onClose(); router.push(o.href); };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel(Math.min(sel + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(Math.max(sel - 1, 0)); }
    else if (e.key === "Enter" && list[sel]) { e.preventDefault(); go(list[sel]); }
  };

  let last = "";
  return (
    <>
      <div className={s.scrim} onClick={onClose} />
      <div className={s.pal} role="dialog" aria-modal="true" aria-label="Search and jump">
        <div className={s.pin}>
          <MagnifyingGlass size={20} aria-hidden />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={key}
            placeholder="Search Buddies, customers or pages" role="combobox" aria-expanded="true" aria-controls="palL" aria-activedescendant={`po${sel}`} />
          <kbd>esc</kbd>
        </div>
        <ul id="palL" role="listbox" className={s.list}>
          {list.map((o, i) => {
            const head = o.group !== last ? (last = o.group) : null;
            return (
              <li key={o.group + o.href} role="presentation">
                {head && <div className={s.g}>{head}</div>}
                <div id={`po${i}`} role="option" aria-selected={i === sel} className={s.o} onClick={() => go(o)} onMouseMove={() => setSel(i)}>
                  <b>{o.label}</b>{o.sub && <span className="muted"> · {o.sub}</span>}
                </div>
              </li>
            );
          })}
          {!list.length && <li className={s.g}>No match for “{q}”</li>}
        </ul>
        <div className={s.foot}><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
      </div>
    </>
  );
}
