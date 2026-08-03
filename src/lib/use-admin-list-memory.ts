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
 * Keeps the snapshot in sync with the live state and restores scroll on mount.
 * `ready` should be false while the list is still loading, so scroll is only
 * restored once rows exist to scroll to.
 *
 * Scroll is captured from a live `scroll` listener rather than read at unmount:
 * by the time the list unmounts, the router has already scrolled the new page
 * to the top, so reading `window.scrollY` there always recorded 0.
 */
export function useAdminListMemory<T extends object>(
  key: string,
  state: T,
  ready = true,
): void {
  const restored = useRef(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      lastScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // State changes never clobber the remembered scroll offset.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const kept = restored.current ? lastScroll.current : (read<T>(key)?.scrollY ?? 0);
    write(key, { state, scrollY: kept });
  }, [key, state]);

  useEffect(() => {
    if (typeof window === "undefined" || restored.current || !ready) return;
    const snap = read<T>(key);
    restored.current = true;
    const target = snap?.scrollY ?? 0;
    if (!target) return;
    // Rows may still be painting, so the first scrollTo can be clamped. Retry
    // over a few frames until the document is tall enough to honour it.
    let attempts = 0;
    const tick = () => {
      window.scrollTo({ top: target });
      lastScroll.current = window.scrollY;
      attempts += 1;
      if (Math.abs(window.scrollY - target) > 2 && attempts < 12) {
        window.setTimeout(tick, 60);
      }
    };
    requestAnimationFrame(tick);
  }, [key, ready]);

  // Persist the last real offset when leaving the page (navigation or reload).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = () => {
      if (!restored.current) return;
      const snap = read<T>(key);
      write(key, { state: snap?.state ?? state, scrollY: lastScroll.current });
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

