import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MICROPHONE_PERMISSION = "android.permission.RECORD_AUDIO";
const MICROPHONE_DESCRIPTION =
  "يستخدم KAHEEL الميكروفون فقط للمكالمات الصوتية داخل التطبيق عند بدء المكالمة أو قبولها. KAHEEL uses the microphone only for in-app voice calls when you start or accept a call.";

function ensureAndroidMicrophonePermission(manifest) {
  if (manifest.includes(`android:name=\"${MICROPHONE_PERMISSION}\"`)) return manifest;

  const applicationIndex = manifest.indexOf("<application");
  if (applicationIndex < 0) throw new Error("AndroidManifest.xml has no application element.");

  const permission = `    <uses-permission android:name=\"${MICROPHONE_PERMISSION}\" />\n\n    `;
  return `${manifest.slice(0, applicationIndex)}${permission}${manifest.slice(applicationIndex)}`;
}

function escapePlistString(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setRootString(plist, key, value) {
  const escapedValue = escapePlistString(value);
  const keyPattern = new RegExp(`<key>${key}<\\/key>\\s*<string>[\\s\\S]*?<\\/string>`, "s");
  const replacement = `<key>${key}</key>\n\t<string>${escapedValue}</string>`;

  if (keyPattern.test(plist)) return plist.replace(keyPattern, replacement);

  const closing = plist.lastIndexOf("</dict>");
  if (closing < 0) throw new Error("Info.plist has no root dictionary.");
  return `${plist.slice(0, closing)}\t${replacement}\n${plist.slice(closing)}`;
}

let configuredPlatforms = 0;

const androidManifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(androidManifestPath)) {
  const manifest = readFileSync(androidManifestPath, "utf8");
  writeFileSync(androidManifestPath, ensureAndroidMicrophonePermission(manifest));
  configuredPlatforms += 1;
}

const iosInfoPlistPath = "ios/App/App/Info.plist";
if (existsSync(iosInfoPlistPath)) {
  const plist = readFileSync(iosInfoPlistPath, "utf8");
  writeFileSync(
    iosInfoPlistPath,
    setRootString(plist, "NSMicrophoneUsageDescription", MICROPHONE_DESCRIPTION),
  );
  configuredPlatforms += 1;
}

if (configuredPlatforms === 0) {
  throw new Error("No generated Android or iOS project was found for voice permission setup.");
}

console.log(`Native voice permissions configured for ${configuredPlatforms} platform(s).`);
