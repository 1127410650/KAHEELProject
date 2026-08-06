import { isNativePlatform } from "@/lib/native-platform";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const MAX_AUTH_VALUE_BYTES = 128 * 1024;
const FIRST_INSTALL_MARKER_KEY = "kahli.native.secure-storage.initialized.v1";
let nativeInitialization: Promise<void> | undefined;

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

  for (const storageName of ["localStorage", "sessionStorage"] as const) {
    try {
      const storage = window[storageName];
      const keys: string[] = [];

      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }

      for (const key of keys) storage.removeItem(key);
    } catch {
      // A privacy-restricted WebView can deny browser storage. Native secure
      // storage remains the only accepted location for authentication data.
    }
  }
}

async function secureStoragePlugin() {
  const { SecureStoragePlugin } = await import("capacitor-secure-storage-plugin");
  return SecureStoragePlugin;
}

async function preferencesPlugin() {
  const { Preferences } = await import("@capacitor/preferences");
  return Preferences;
}

async function initializeNativeSecureStorage(): Promise<void> {
  if (!nativeInitialization) {
    nativeInitialization = (async () => {
      const [secureStorage, preferences] = await Promise.all([
        secureStoragePlugin(),
        preferencesPlugin(),
      ]);
      const marker = await preferences.get({ key: FIRST_INSTALL_MARKER_KEY });

      // iOS Keychain values can survive uninstall/reinstall while app preferences
      // are removed. Clear any surviving session before the first read so a new
      // installation can never inherit the previous installation's login.
      if (marker.value !== "1") {
        await secureStorage.clear();
        await preferences.set({ key: FIRST_INSTALL_MARKER_KEY, value: "1" });
      }

      purgeLegacyBrowserCopies();
    })().catch((error: unknown) => {
      // Permit a later retry after a transient native bridge failure. Until then,
      // auth reads fail closed and auth writes are rejected.
      nativeInitialization = undefined;
      throw error;
    });
  }

  await nativeInitialization;
}

const nativeStorage: AuthStorage = {
  async getItem(key) {
    assertAllowedAuthKey(key);
    try {
      await initializeNativeSecureStorage();
      const plugin = await secureStoragePlugin();
      const result = await plugin.get({ key });
      return result.value;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    assertAllowedAuthKey(key);
    if (new TextEncoder().encode(value).byteLength > MAX_AUTH_VALUE_BYTES) {
      throw new Error("Rejected an oversized authentication value.");
    }

    await initializeNativeSecureStorage();
    const plugin = await secureStoragePlugin();
    await plugin.set({ key, value });
  },

  async removeItem(key) {
    assertAllowedAuthKey(key);
    try {
      await initializeNativeSecureStorage();
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

  return nativeStorage;
}
