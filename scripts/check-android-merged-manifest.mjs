import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const rawPath = process.env.ANDROID_MERGED_MANIFEST;
if (!rawPath) throw new Error("ANDROID_MERGED_MANIFEST is required.");

const manifestPath = resolve(rawPath);
if (!existsSync(manifestPath)) throw new Error(`Merged Android manifest not found: ${manifestPath}`);

const xml = readFileSync(manifestPath, "utf8");
const findings = [];

const packageMatch = xml.match(/<manifest\b[^>]*\bpackage="([^"]+)"/);
if (!packageMatch) throw new Error("Merged Android manifest has no package name.");
const appId = packageMatch[1];

const usesPermissions = [...xml.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"[^>]*\/?\s*>/g)].map(
  (match) => match[1],
);
const allowedPermissions = new Set([
  "android.permission.INTERNET",
  "android.permission.RECORD_AUDIO",
  `${appId}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`,
]);

for (const permission of usesPermissions) {
  if (!allowedPermissions.has(permission)) {
    findings.push(`unexpected uses-permission in release manifest: ${permission}`);
  }
}
for (const required of ["android.permission.INTERNET", "android.permission.RECORD_AUDIO"]) {
  if (!usesPermissions.includes(required)) findings.push(`missing required permission: ${required}`);
}

const applicationTag = xml.match(/<application\b([^>]*)>/)?.[1] ?? "";
for (const [pattern, reason] of [
  [/android:allowBackup="false"/, "release application backup is not disabled"],
  [/android:fullBackupContent="false"/, "release full backup is not disabled"],
  [/android:usesCleartextTraffic="false"/, "release cleartext traffic is not disabled"],
  [/android:networkSecurityConfig="@xml\/network_security_config"/, "release network security config is missing"],
]) {
  if (!pattern.test(applicationTag)) findings.push(reason);
}
if (/android:debuggable="true"/.test(applicationTag)) findings.push("release application is debuggable");

const exportedComponents = [...xml.matchAll(/<(activity|activity-alias|service|receiver|provider)\b([^>]*)android:exported="true"([^>]*)>/g)].map(
  (match) => ({ type: match[1], attrs: `${match[2]} ${match[3]}` }),
);

for (const component of exportedComponents) {
  const name = component.attrs.match(/android:name="([^"]+)"/)?.[1] ?? "";
  if (component.type === "activity" && name === `${appId}.MainActivity`) continue;
  if (
    component.type === "receiver" &&
    name === "androidx.profileinstaller.ProfileInstallReceiver" &&
    /android:permission="android\.permission\.DUMP"/.test(component.attrs)
  ) {
    continue;
  }
  findings.push(`unexpected exported ${component.type}: ${name || "<unnamed>"}`);
}

const fileProvider = xml.match(/<provider\b([^>]*)android:name="androidx\.core\.content\.FileProvider"([^>]*)>/);
if (!fileProvider) {
  findings.push("FileProvider is missing from merged manifest");
} else {
  const attrs = `${fileProvider[1]} ${fileProvider[2]}`;
  if (!/android:exported="false"/.test(attrs)) findings.push("FileProvider must remain non-exported");
  if (!/android:grantUriPermissions="true"/.test(attrs)) findings.push("FileProvider URI grants are not explicitly enabled");
}

if (findings.length) {
  console.error("Merged Android release manifest security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Merged Android release manifest security check passed (${usesPermissions.length} uses-permissions).`);
