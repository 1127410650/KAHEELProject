import { isNativePlatform } from "@/lib/native-platform";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const MAX_AUTH_VALUE_BYTES = 128 * 1024;

function projectRef(): string {
  const explicit = import.meta.env["VITE_SUPABASE_PROJECT_ID"]?.trim();
  if (explicit) return explicit;

  const rawUrl = import.meta.env["VITE_SUPABASE_URL"]?.trim();
  if (!rawUrl) throw new Error("Missing VITE_SUPABASE_PROJECT_ID for secure mobile auth storage.");

  const hostname = new URL(rawUrl).hostname;
  const inferred = hostname.split(".")[0];
  if (!inferred) throw new Error("Unable to determine the Supabase project reference.");
  return inferred;
}

function allowedPrefix(): string {
  return `sb-${projectRef()}-auth-token`;
}

function assertAllowedAuthKey(key: string): void {
  if (!key.startsWith(allowedPrefix())) {
    throw new Error("Rejected an unexpected secure-storage key.");
  }
}

function purgeLegacyBrowserCopies(): void {
  const prefix = allowedPrefix();
  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  }
}

async function secureStoragePlugin() {
  const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
  return SecureStoragePlugin;
}

const nativeStorage: AuthStorage = {
  async getItem(key) {
    assertAllowedAuthKey(key);
    try {
      const plugin = await secureStoragePlugin();
      const result = await plugin.get({ key });
      return result.value;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    assertAllowedAuthKey(key);
    if (new Blob([value]).size > MAX_AUTH_VALUE_BYTES) {
      throw new Error("Rejected an oversized authentication value.");
    }
    const plugin = await secureStoragePlugin();
    await plugin.set({ key, value });
  },

  async removeItem(key) {
    assertAllowedAuthKey(key);
    try {
      const plugin = await secureStoragePlugin();
      await plugin.remove({ key });
    } catch {
      // Removing an absent key is equivalent to a successful cleanup.
    }
  },
};

export function createSupabaseAuthStorage(): AuthStorage | undefined {
  if (typeof window === "undefined") return undefined;
  if (!isNativePlatform()) return window.localStorage;

  // Never migrate a previously exposed browser token into native secure storage.
  // A first native launch must authenticate again and create a fresh secure session.
  purgeLegacyBrowserCopies();
  return nativeStorage;
}
