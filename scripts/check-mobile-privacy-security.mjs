import { readFileSync } from "node:fs";

const findings = [];

function requirePattern(file, content, pattern, reason) {
  if (!pattern.test(content)) findings.push(`${file}: ${reason}`);
}

const privacyModule = readFileSync("src/lib/mobile-privacy.ts", "utf8");
for (const [pattern, reason] of [
  [/import\s+"@\/mobile-privacy\.css"/, "does not bundle the privacy-shield stylesheet"],
  [/PRIVACY_SHIELD_ID\s*=\s*"kaheel-native-privacy-shield"/, "does not use the reviewed shield identifier"],
  [/document\.body\.appendChild\(shield\)/, "does not mount the privacy shield above the application"],
  [/getElementById\(PRIVACY_SHIELD_ID\)\?\.remove\(\)/, "does not remove the shield when the app becomes active"],
]) {
  requirePattern("src/lib/mobile-privacy.ts", privacyModule, pattern, reason);
}

const privacyCss = readFileSync("src/mobile-privacy.css", "utf8");
for (const [pattern, reason] of [
  [/#kaheel-native-privacy-shield\s*\{/, "does not style the reviewed privacy shield"],
  [/position:\s*fixed/, "does not pin the shield to the viewport"],
  [/inset:\s*0/, "does not cover all viewport edges"],
  [/z-index:\s*2147483647/, "does not place the shield above application content"],
  [/height:\s*100dvh/, "does not cover the dynamic viewport height"],
  [/pointer-events:\s*auto/, "allows interaction with obscured application content"],
  [/contain:\s*strict/, "does not isolate the shield rendering surface"],
]) {
  requirePattern("src/mobile-privacy.css", privacyCss, pattern, reason);
}

const mobileSecurity = readFileSync("src/lib/mobile-security.ts", "utf8");
for (const [pattern, reason] of [
  [/App\.addListener\("appStateChange"/, "does not react to application active/background state"],
  [/App\.addListener\("pause",\s*showNativePrivacyShield\)/, "does not cover the app on pause"],
  [/App\.addListener\("resume",\s*hideNativePrivacyShield\)/, "does not remove the shield on resume"],
]) {
  requirePattern("src/lib/mobile-security.ts", mobileSecurity, pattern, reason);
}

if (findings.length > 0) {
  console.error("Mobile privacy-shield security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Mobile privacy-shield security check passed.");
