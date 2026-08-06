import { isNativePlatform } from "@/lib/native-platform";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

type NativeSecureStorage = typeof import("@aparajita/capacitor-secure-storage")["SecureStorage"];

const MAX_AUTH_VALUE_BYTES = 128 * 1024;
const NATIVE_KEY_PREFIX = "kahli.auth.";
const INSTALL_MARKER = "kahli.native.secure-storage.initialized";

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

let nativeStorageReady: Promise<NativeSecureStorage> | undefined;

function configuredNativeStorage(): Promise<NativeSecureStorage> {
  if (nativeStorageReady) return nativeStorageReady;

  nativeStorageReady = (async () => {
    const { KeychainAccess, SecureStorage } = await import(
      "@aparajita/capacitor-secure-storage"
    );

    // Auth tokens must remain local to this device and unavailable while locked.
    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    await SecureStorage.setKeyPrefix(NATIVE_KEY_PREFIX);

    // iOS Keychain can survive uninstall. localStorage does not, so a missing
    // marker identifies a fresh installation and stale auth values are removed.
    if (window.localStorage.getItem(INSTALL_MARKER) !== "1") {
      await SecureStorage.clear(false);
      window.localStorage.setItem(INSTALL_MARKER, "1");
    }

    return SecureStorage;
  })();

  return nativeStorageReady;
}

const nativeStorage: AuthStorage = {
  async getItem(key) {
    assertAllowedAuthKey(key);
    const storage = await configuredNativeStorage();
    return storage.getItem(key);
  },

  async setItem(key, value) {
    assertAllowedAuthKey(key);
    if (new TextEncoder().encode(value).byteLength > MAX_AUTH_VALUE_BYTES) {
      throw new Error("Rejected an oversized authentication value.");
    }
    const storage = await configuredNativeStorage();
    await storage.setItem(key, value);
  },

  async removeItem(key) {
    assertAllowedAuthKey(key);
    const storage = await configuredNativeStorage();
    await storage.removeItem(key);
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
