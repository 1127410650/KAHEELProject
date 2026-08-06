import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = readFileSync("src/lib/native-auth-storage.ts", "utf8");
const preferenceSource = readFileSync("src/lib/auth-storage.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");
const hardeningScript = readFileSync("scripts/harden-native-projects.mjs", "utf8");

assert(
  packageJson.dependencies?.["@aparajita/capacitor-secure-storage"] === "7.1.0",
  "Secure storage must stay pinned to the reviewed Capacitor 7 release.",
);
assert(
  !packageJson.dependencies?.["capacitor-secure-storage-plugin"],
  "The previous secure-storage plugin must not be reintroduced.",
);
assert(
  source.includes("KeychainAccess.whenUnlockedThisDeviceOnly"),
  "iOS auth tokens must be accessible only while unlocked and must not migrate to another device.",
);
assert(
  source.includes("SecureStorage.setSynchronize(false)"),
  "iCloud Keychain synchronization must remain disabled for auth tokens.",
);
assert(
  source.includes("SecureStorage.setKeyPrefix(NATIVE_KEY_PREFIX)"),
  "Native auth keys must remain isolated under the reviewed prefix.",
);
assert(
  source.includes('const NATIVE_KEY_PREFIX = "kahli.auth."'),
  "The reviewed native auth prefix must remain explicit.",
);
assert(
  source.includes("SecureStorage.clear(false)"),
  "A fresh installation or temporary session must clear persisted auth values.",
);
assert(
  source.includes("const ephemeralSession = new Map<string, string>()"),
  "Temporary native sessions must remain in memory only.",
);
assert(
  source.includes("rememberSession() ? storage.getItem(key)"),
  "Native reads must honor the persistence preference.",
);
assert(
  source.includes("ephemeralSession.set(key, value)"),
  "Temporary native writes must use the in-memory session store.",
);
assert(
  source.includes("await storage.removeItem(key)"),
  "Temporary native writes must remove any persisted counterpart.",
);
assert(
  source.includes("AUTH_PERSISTENCE_EVENT"),
  "Native storage must listen for live persistence changes.",
);
assert(
  preferenceSource.includes("window.dispatchEvent"),
  "Changing the persistence preference must notify native storage.",
);
assert(
  capacitorConfig.includes('"@aparajita/capacitor-secure-storage"'),
  "Capacitor must include only the reviewed secure-storage plugin.",
);
assert(
  !capacitorConfig.includes('"capacitor-secure-storage-plugin"'),
  "Capacitor configuration still references the previous plugin.",
);
assert(
  !hardeningScript.includes("SwiftKeychainWrapper"),
  "Native hardening must not patch AppDelegate with a plugin-internal Swift dependency.",
);
assert(
  !hardeningScript.includes("cap_sec"),
  "Native hardening must not depend on an internal keychain service name.",
);

console.log("Native auth storage policy tests passed.");
