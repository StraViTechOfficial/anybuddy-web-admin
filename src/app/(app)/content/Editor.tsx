"use client";
import { useEffect, useRef, useState } from "react";
import { TextB, TextItalic, ListBullets, ListNumbers, LinkSimple, LinkBreak, ArrowCounterClockwise, ArrowClockwise } from "@phosphor-icons/react";
import { useToast } from "@/components/Toast";
import s from "./content.module.css";
import DOMPurify from "dompurify";

const parse = (html: string) => { const t = document.createElement("template"); t.innerHTML = html; return t.content; };

/** Removes anything that can run code (scripts, frames, on* handlers, javascript:/data: links) with DOMPurify.
 *  Returns the input untouched when nothing was removed, so publishing an unedited page sends the stored text byte
 *  for byte. */
export function clean(html: string) {
  const safe = DOMPurify.sanitize(html);
  return DOMPurify.removed.length ? safe : html;
}

export const isBlank = (html: string) => !parse(html).textContent?.trim();

// Pasted text from Word / Google Docs keeps its structure (headings, lists, bold, links) and loses every style.
const KEEP: Record<string, string> = { P: "p", DIV: "p", H1: "h2", H2: "h2", H3: "h3", H4: "h3", UL: "ul", OL: "ol", LI: "li", STRONG: "strong", B: "strong", EM: "em", I: "em", A: "a", BR: "br" };
const DROP = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "HEAD", "XML", "TEMPLATE"]);
function tidy(src: Node, out: Node) {
  src.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) return out.appendChild(document.createTextNode(n.textContent ?? ""));
    if (!(n instanceof Element) || DROP.has(n.tagName) || n.tagName.includes(":")) return; // o:p and other Office tags
    // Google Docs wraps the whole paste in <b style="font-weight:normal">.
    const tag = n.tagName === "B" && /font-weight:\s*(normal|400)/.test(n.getAttribute("style") ?? "") ? undefined : KEEP[n.tagName];
    if (!tag) return tidy(n, out);
    const el = document.createElement(tag);
    const href = n.getAttribute("href") ?? "";
    if (tag === "a" && /^(https?:|mailto:|\/|#)/i.test(href)) el.setAttribute("href", href);
    tidy(n, el);
    out.appendChild(el);
  });
}

const okLink = (u: string) => /^https:\/\/[^\s]+$/i.test(u) || /^(\/(?!\/)|#)\S*$/.test(u);
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);

// ponytail: document.execCommand is deprecated but works in every browser and needs no dependency. If it starts
// producing junk markup (stray <span style>, broken lists), move to a small editor library such as Tiptap.
const exec = (cmd: string, arg?: string) => document.execCommand(cmd, false, arg);

type Props = { value: string; onChange: (html: string) => void; disabled?: boolean; label: string };

export function Editor({ value, onChange, disabled, label }: Props) {
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<string | null>(null); // the draft the editor area currently shows
  const [raw, setRaw] = useState(false);
  const [on, setOn] = useState({ b: false, i: false, ul: false, ol: false, block: "" });

  // Only rewrite the editor when the draft changed from outside (new page, Discard, View HTML). Typing never re-renders it,
  // and the stored HTML is never reformatted until the admin actually edits.
  useEffect(() => {
    if (!ref.current || value === shown.current) return;
    ref.current.innerHTML = clean(value);
    shown.current = value;
  }, [value]);

  const sync = () => {
    const sel = document.getSelection();
    if (!ref.current || !sel?.anchorNode || !ref.current.contains(sel.anchorNode)) return;
    setOn({ b: document.queryCommandState("bold"), i: document.queryCommandState("italic"), ul: document.queryCommandState("insertUnorderedList"), ol: document.queryCommandState("insertOrderedList"), block: String(document.queryCommandValue("formatBlock")).toLowerCase() });
  };
  useEffect(() => {
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  });

  const emit = () => { const html = ref.current!.innerHTML; shown.current = html; onChange(html); };
  const run = (cmd: string, arg?: string) => {
    ref.current!.focus();
    exec(cmd, arg);
    if (cmd.endsWith("List")) liftList();
    emit();
    sync();
  };

  // Chrome builds a new list inside the paragraph it came from (<p><ul>…</ul></p>, invalid HTML the site would render
  // oddly). Lift that one list out, keeping the caret where it was.
  function liftList() {
    const sel = document.getSelection();
    const at = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const keep = at && [at.startContainer, at.startOffset] as const;
    const list = at?.startContainer.parentElement?.closest("ul, ol");
    const box = list?.parentElement;
    if (!list || !box || box === ref.current || !/^(P|DIV)$/.test(box.tagName) || box.childNodes.length !== 1) return;
    box.replaceWith(list);
    if (keep) sel!.setPosition(keep[0], keep[1]);
  }

  function link() {
    const sel = document.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const url = window.prompt("Link address. Starts with https:// or / for a page on this site.")?.trim();
    if (!url) return;
    if (!okLink(url)) return toast("Use a link that starts with https:// or /.");
    ref.current!.focus();
    if (range) { sel!.removeAllRanges(); sel!.addRange(range); }
    if (range && !range.collapsed) run("createLink", url);
    else run("insertHTML", `<a href="${esc(url)}">${esc(url)}</a>`);
  }

  function paste(e: React.ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    if (!html) return run("insertText", e.clipboardData.getData("text/plain"));
    const box = document.createElement("div");
    tidy(new DOMParser().parseFromString(html, "text/html").body, box);
    run("insertHTML", box.innerHTML);
  }

  const off = disabled || raw;
  const tool = (title: string, children: React.ReactNode, cmd: string, arg?: string, pressed?: boolean) => (
    <button type="button" className={s.tool} aria-label={title} title={title} aria-pressed={pressed} disabled={off}
      onMouseDown={(e) => e.preventDefault()} onClick={() => (cmd === "link" ? link() : run(cmd, arg))}>{children}</button>
  );

  return (
    <div className={s.wrap}>
      <div className={s.tools} role="toolbar" aria-label={`Format ${label}`}>
        {tool("Heading", "Heading", "formatBlock", "h2", on.block === "h2")}
        {tool("Subheading", "Subheading", "formatBlock", "h3", on.block === "h3")}
        {tool("Paragraph", "Paragraph", "formatBlock", "p", on.block === "p")}
        <i className={s.sep} />
        {tool("Bold (Cmd+B)", <TextB size={18} weight="bold" />, "bold", undefined, on.b)}
        {tool("Italic (Cmd+I)", <TextItalic size={18} />, "italic", undefined, on.i)}
        {tool("Bulleted list", <ListBullets size={18} />, "insertUnorderedList", undefined, on.ul)}
        {tool("Numbered list", <ListNumbers size={18} />, "insertOrderedList", undefined, on.ol)}
        {tool("Add link", <LinkSimple size={18} />, "link")}
        {tool("Remove link", <LinkBreak size={18} />, "unlink")}
        <i className={s.sep} />
        {tool("Undo (Cmd+Z)", <ArrowCounterClockwise size={18} />, "undo")}
        {tool("Redo (Cmd+Shift+Z)", <ArrowClockwise size={18} />, "redo")}
        <button type="button" className={s.tool} style={{ marginLeft: "auto" }} aria-pressed={raw} disabled={disabled} onClick={() => setRaw(!raw)}>View HTML</button>
      </div>
      <div ref={ref} className={s.doc} hidden={raw} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label}
        onFocus={() => exec("defaultParagraphSeparator", "p")} onInput={emit} onPaste={paste} />
      {raw && <textarea className={`input ${s.raw}`} aria-label={`${label} HTML`} rows={20} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
