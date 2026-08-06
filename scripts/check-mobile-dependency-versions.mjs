import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const reviewedVersions = {
  "@capacitor/android": "7.6.8",
  "@capacitor/app": "7.1.2",
  "@capacitor/cli": "7.6.8",
  "@capacitor/core": "7.6.8",
  "@capacitor/ios": "7.6.8",
  "@capacitor/preferences": "7.0.4",
  "capacitor-secure-storage-plugin": "0.12.0",
};

const findings = [];
for (const [name, expectedVersion] of Object.entries(reviewedVersions)) {
  const actualVersion = packageJson.dependencies?.[name] ?? packageJson.devDependencies?.[name];
  if (actualVersion !== expectedVersion) {
    findings.push(`${name}: expected ${expectedVersion}, found ${String(actualVersion)}`);
  }
}

if (findings.length > 0) {
  console.error("Mobile dependency version check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Mobile dependency versions match the reviewed Capacitor 7 set.");
