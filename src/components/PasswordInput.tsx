"use client";
import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import s from "./ui.module.css";

/** A password field with a show/hide eye (owner, 6 Oct 2026: on every password field). Takes the input's own props. */
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [show, setShow] = useState(false);
  return (
    <span className={s.pw}>
      <input className="input" {...props} type={show ? "text" : "password"} />
      <button type="button" className={s.eye} onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide password" : "Show password"}>
        {show ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}
