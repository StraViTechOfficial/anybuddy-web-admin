"use client";
import { useEffect, useState } from "react";

/** False until the page's script has run. Sign-in forms stay disabled until then: a submit before that would be a plain
 *  browser GET and put the email and password in the address bar and server logs (seen on a slow machine). */
export function useReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready;
}
