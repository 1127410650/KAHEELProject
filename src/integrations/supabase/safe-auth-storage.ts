/**
 * Supabase Auth storage that stays usable inside embedded previews and strict
 * iOS privacy modes. Accessing `window.localStorage` can itself throw in those
 * environments, so handing it directly to supabase-js can crash the React root
 * before the session provider has a chance to render.
 *
 * Normal browsers still use durable localStorage. The in-memory map is only a
 * last-resort fallback for the current page lifetime when durable storage is
 * unavailable; it never creates a second persistent token store.
 */

const memory = new Map<string, string>();
let durable: Storage | null | undefined;

function durableStorage(): Storage | null {
  if (durable !== undefined) return durable;
  if (typeof window === "undefined") {
    durable = null;
    return durable;
  }

  try {
    const storage = window.localStorage;
    const probe = "__gohail_auth_storage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    durable = storage;
  } catch {
    durable = null;
  }
  return durable;
}

function disableDurableStorage() {
  durable = null;
}

export const safeAuthStorage = {
  getItem(key: string): string | null {
    const storage = durableStorage();
    if (storage) {
      try {
        return storage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        disableDurableStorage();
      }
    }
    return memory.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    const storage = durableStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        memory.delete(key);
        return;
      } catch {
        disableDurableStorage();
      }
    }
    memory.set(key, value);
  },

  removeItem(key: string): void {
    memory.delete(key);
    const storage = durableStorage();
    if (!storage) return;
    try {
      storage.removeItem(key);
    } catch {
      disableDurableStorage();
    }
  },
};
