import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = readFileSync("src/lib/native-auth-storage.ts", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");

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
  source.includes('SecureStorage.setKeyPrefix("kahli.auth.")'),
  "Native auth keys must remain isolated under the reviewed prefix.",
);
assert(
  source.includes("SecureStorage.clear(false)"),
  "A fresh installation must clear stale keychain auth values.",
);
assert(
  capacitorConfig.includes('"@aparajita/capacitor-secure-storage"'),
  "Capacitor must include only the reviewed secure-storage plugin.",
);
assert(
  !capacitorConfig.includes('"capacitor-secure-storage-plugin"'),
  "Capacitor configuration still references the previous plugin.",
);

console.log("Native auth storage policy tests passed.");
