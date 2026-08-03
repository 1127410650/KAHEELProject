/**
 * Remembers an admin list's own view state (search text, filters, sort, page)
 * and its scroll position, so opening a detail file and pressing "back" returns
 * the reviewer to exactly where they were.
 *
 * Stored in `sessionStorage` under a per-page key: it is per-tab, disappears
 * when the tab closes, and never contains anything but UI state.
 */
import { useEffect, useRef } from "react";

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

/**
 * Keeps the snapshot in sync with the live state and restores scroll on mount.
 * `ready` should be false while the list is still loading, so scroll is only
 * restored once rows exist to scroll to.
 */
export function useAdminListMemory<T extends object>(
  key: string,
  state: T,
  ready = true,
): void {
  const restored = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const scrollY = restored.current ? window.scrollY : (read<T>(key)?.scrollY ?? 0);
    try {
      window.sessionStorage.setItem(PREFIX + key, JSON.stringify({ state, scrollY }));
    } catch {
      /* storage unavailable — state memory is a convenience, not a requirement */
    }
  }, [key, state]);

  useEffect(() => {
    if (typeof window === "undefined" || restored.current || !ready) return;
    const snap = read<T>(key);
    restored.current = true;
    if (!snap || !snap.scrollY) return;
    const target = snap.scrollY;
    requestAnimationFrame(() => window.scrollTo({ top: target }));
  }, [key, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const save = () => {
      const snap = read<T>(key);
      try {
        window.sessionStorage.setItem(
          PREFIX + key,
          JSON.stringify({ state: snap?.state ?? state, scrollY: window.scrollY }),
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
