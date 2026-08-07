import { readFileSync } from "node:fs";

function fail(message) {
  console.error(`Mobile reproducibility check failed: ${message}`);
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
let lock;
try {
  lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
} catch {
  fail("package-lock.json is missing or invalid JSON");
}

const root = lock.packages?.[""];
if (lock.lockfileVersion !== 3 || !root) fail("expected npm package-lock v3 with a root package");

for (const section of ["dependencies", "devDependencies"]) {
  const expected = packageJson[section] ?? {};
  const actual = root[section] ?? {};
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    fail(`package-lock root does not exactly match package.json ${section}`);
  }
}

const reviewedMobileVersions = {
  "node_modules/@capacitor/android": "7.6.8",
  "node_modules/@capacitor/app": "7.1.2",
  "node_modules/@capacitor/cli": "7.6.8",
  "node_modules/@capacitor/core": "7.6.8",
  "node_modules/@capacitor/ios": "7.6.8",
  "node_modules/@capacitor/preferences": "7.0.4",
  "node_modules/capacitor-secure-storage-plugin": "0.12.0",
};

for (const [path, expectedVersion] of Object.entries(reviewedMobileVersions)) {
  const actualVersion = lock.packages?.[path]?.version;
  if (actualVersion !== expectedVersion) {
    fail(`${path} must resolve to ${expectedVersion}, received ${String(actualVersion)}`);
  }
}

let resolvedCount = 0;
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== "object" || entry.resolved === undefined) continue;
  if (typeof entry.resolved !== "string" || !entry.resolved.startsWith("https://registry.npmjs.org/")) {
    fail(`unapproved dependency source at ${path}: ${String(entry.resolved)}`);
  }
  if (typeof entry.integrity !== "string" || !entry.integrity.startsWith("sha512-")) {
    fail(`missing SHA-512 integrity at ${path}`);
  }
  resolvedCount += 1;
}
if (resolvedCount < 600) fail(`unexpectedly small locked dependency graph: ${resolvedCount}`);

const viteConfig = readFileSync("vite.config.ts", "utf8");
if (!/\.\.\.\(isNativeMobileBuild\s*\?\s*\{\s*nitro:\s*false\s*\}\s*:\s*\{\}\)/s.test(viteConfig)) {
  fail("vite.config.ts must disable Nitro only for the native SPA build");
}
if (/defineConfig\(\{\s*nitro:\s*false\s*,/s.test(viteConfig)) {
  fail("Nitro must not be disabled unconditionally because normal web SSR still requires it");
}

console.log(`Mobile reproducibility check passed (${resolvedCount} locked registry packages).`);
