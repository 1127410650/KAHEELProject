import { AUTH_PERSISTENCE_EVENT, rememberSession } from "@/lib/auth-storage";
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
const ephemeralSession = new Map<string, string>();

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
let persistenceTransition: Promise<void> = Promise.resolve();
let persistenceListenerArmed = false;

async function movePersistence(storage: NativeSecureStorage, remember: boolean) {
  if (remember) {
    for (const [key, value] of ephemeralSession) {
      assertAllowedAuthKey(key);
      await storage.setItem(key, value);
    }
    ephemeralSession.clear();
    return;
  }

  for (const key of await storage.keys(false)) {
    if (!key.startsWith(allowedPrefix())) continue;
    const value = await storage.getItem(key);
    if (value !== null) ephemeralSession.set(key, value);
    await storage.removeItem(key);
  }
}

function queuePersistenceTransition(storage: NativeSecureStorage, remember: boolean) {
  persistenceTransition = persistenceTransition
    .catch(() => undefined)
    .then(async () => {
      try {
        await movePersistence(storage, remember);
      } catch (error) {
        if (!remember) {
          ephemeralSession.clear();
          try {
            await storage.clear(false);
          } catch {
            // The rejected transition remains the fail-closed signal to auth operations.
          }
        }
        throw error;
      }
    });
  return persistenceTransition;
}

function armPersistenceListener(storage: NativeSecureStorage) {
  if (persistenceListenerArmed) return;
  persistenceListenerArmed = true;

  window.addEventListener(AUTH_PERSISTENCE_EVENT, (event) => {
    const remember = (event as CustomEvent<{ remember?: boolean }>).detail?.remember;
    if (typeof remember === "boolean") {
      void queuePersistenceTransition(storage, remember).catch(() => undefined);
    }
  });
}

function configuredNativeStorage(): Promise<NativeSecureStorage> {
  if (nativeStorageReady) return nativeStorageReady;

  nativeStorageReady = (async () => {
    const { KeychainAccess, SecureStorage } = await import(
      "@aparajita/capacitor-secure-storage"
    );

    await SecureStorage.setSynchronize(false);
    await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly);
    await SecureStorage.setKeyPrefix(NATIVE_KEY_PREFIX);

    const freshInstall = window.localStorage.getItem(INSTALL_MARKER) !== "1";
    if (freshInstall || !rememberSession()) {
      await SecureStorage.clear(false);
      ephemeralSession.clear();
    }
    if (freshInstall) window.localStorage.setItem(INSTALL_MARKER, "1");

    armPersistenceListener(SecureStorage);
    return SecureStorage;
  })();

  return nativeStorageReady;
}

const nativeStorage: AuthStorage = {
  async getItem(key) {
    assertAllowedAuthKey(key);
    const storage = await configuredNativeStorage();
    await persistenceTransition;
    return rememberSession() ? storage.getItem(key) : (ephemeralSession.get(key) ?? null);
  },

  async setItem(key, value) {
    assertAllowedAuthKey(key);
    if (new TextEncoder().encode(value).byteLength > MAX_AUTH_VALUE_BYTES) {
      throw new Error("Rejected an oversized authentication value.");
    }

    const storage = await configuredNativeStorage();
    await persistenceTransition;
    if (rememberSession()) {
      ephemeralSession.delete(key);
      await storage.setItem(key, value);
    } else {
      ephemeralSession.set(key, value);
      await storage.removeItem(key);
    }
  },

  async removeItem(key) {
    assertAllowedAuthKey(key);
    ephemeralSession.delete(key);
    const storage = await configuredNativeStorage();
    await persistenceTransition;
    await storage.removeItem(key);
  },
};

export function createSupabaseAuthStorage(): AuthStorage | undefined {
  if (typeof window === "undefined") return undefined;
  if (!isNativePlatform()) return window.localStorage;

  purgeLegacyBrowserCopies();
  return nativeStorage;
}
