"use client";
import { useCallback, useEffect, useState } from "react";

/** Loads data for a screen and reports loading, then the data or an error. reload() fetches again, and it also runs
 *  again when deps change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load().then(
      (data) => live && setState({ data, loading: false }),
      (e: Error) => live && setState({ error: e.message, loading: false }),
    );
    return () => { live = false; };
  }, [load]);
  useEffect(reload, [reload]);
  return { ...state, reload, set: (data: T) => setState({ data, loading: false }) };
}
