/**
 * Remembers an admin list's own view state (search text, filters, sort, page)
 * and its scroll position, so opening a detail file and pressing "back" returns
 * the reviewer to exactly where they were.
 *
 * Stored in `sessionStorage` under a per-page key: it is per-tab, disappears
 * when the tab closes, and never contains anything but UI state.
 */
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";


const PREFIX = "tahqaq.admin.list.";

type Snapshot<T> = { state: T; scrollY: number };

function read<T>(key: string): Snapshot<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Initial value for a list's state: the remembered snapshot, else `fallback`. */
export function readAdminListState<T>(key: string, fallback: T): T {
  const snap = read<T>(key);
  if (!snap || snap.state === undefined || snap.state === null) return fallback;
  return { ...fallback, ...(snap.state as object) } as T;
}

function write<T>(key: string, snapshot: Snapshot<T>): void {
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(snapshot));
  } catch {
    /* storage unavailable — view memory is a convenience, not a requirement */
  }
}

/**
 * Keeps the snapshot in sync with the live state and restores scroll whenever
 * the list route is the active one again. `ready` should be false while the list
 * is still loading, so scroll is only restored once rows exist to scroll to.
 *
 * Scroll is persisted from a live `scroll` listener, not read at unmount: by the
 * time a detail page renders, the router has already scrolled to the top, and
 * the list component may not unmount at all — so an unmount-time read of
 * `window.scrollY` always recorded 0.
 */
export function useAdminListMemory<T extends object>(
  key: string,
  state: T,
  ready = true,
): void {
  const lastScroll = useRef(0);
  const restoredForVisit = useRef(false);
  const ownPath = useRef<string | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (ownPath.current === null) ownPath.current = pathname;
  const onOwnPath = pathname === ownPath.current;
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist the offset as the reviewer scrolls, but only while this list is the
  // visible route — otherwise the router's scroll-to-top would overwrite it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      if (!onOwnPath) return;
      lastScroll.current = window.scrollY;
      write(key, { state: stateRef.current, scrollY: window.scrollY });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [key, onOwnPath]);

  // State changes never clobber the remembered scroll offset.
  useEffect(() => {
    if (typeof window === "undefined") return;
    write(key, { state, scrollY: read<T>(key)?.scrollY ?? lastScroll.current });
  }, [key, state]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!onOwnPath) {
      restoredForVisit.current = false;
      return;
    }
    console.log("[alm]", key, "own", onOwnPath, "ready", ready, "guard", restoredForVisit.current, "target", read(key)?.scrollY);
    if (restoredForVisit.current || !ready) return;
    restoredForVisit.current = true;
    const target = read<T>(key)?.scrollY ?? 0;
    if (!target) return;
    // Rows may still be painting, so the first scrollTo can be clamped, and the
    // router's own scroll restoration can reset the offset a frame later. Keep
    // re-asserting the offset briefly, and stop as soon as the reviewer scrolls.
    let attempts = 0;
    let cancelled = false;
    let timer = 0;
    const cancel = () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    window.addEventListener("wheel", cancel, { passive: true, once: true });
    window.addEventListener("touchstart", cancel, { passive: true, once: true });
    window.addEventListener("keydown", cancel, { once: true });
    const tick = () => {
      if (cancelled) return;
      window.scrollTo({ top: target });
      console.log("[alm tick]", attempts, window.scrollY, document.body.scrollHeight);
      lastScroll.current = window.scrollY;
      attempts += 1;
      if (attempts < 14) timer = window.setTimeout(tick, 60);
    };
    requestAnimationFrame(tick);
    return () => {
      // StrictMode double-invokes effects: reset the guard so the retained run
      // still restores instead of being skipped as "already restored".
      restoredForVisit.current = false;
      cancel();
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [key, ready, onOwnPath]);

}


