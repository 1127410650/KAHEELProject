import { existsSync, readFileSync } from "node:fs";

const findings = [];

function requirePattern(file, content, pattern, reason) {
  if (!pattern.test(content)) findings.push(`${file}: ${reason}`);
}

const callCenterPath = "src/lib/mkt-call-center.tsx";
const callCenter = readFileSync(callCenterPath, "utf8");
for (const [pattern, reason] of [
  [/navigator\.mediaDevices\?\.getUserMedia/, "does not detect microphone capability"],
  [/prepareMicrophone\(\)/, "does not request microphone access when a voice call starts"],
  [/mic_denied/, "does not handle microphone denial explicitly"],
]) {
  requirePattern(callCenterPath, callCenter, pattern, reason);
}

const configurationPath = "scripts/configure-native-voice-permissions.mjs";
const configuration = readFileSync(configurationPath, "utf8");
for (const [pattern, reason] of [
  [/android\.permission\.RECORD_AUDIO/, "does not configure Android microphone permission"],
  [/NSMicrophoneUsageDescription/, "does not configure the iOS microphone usage description"],
  [/No generated Android or iOS project was found/, "does not fail closed when native projects are absent"],
]) {
  requirePattern(configurationPath, configuration, pattern, reason);
}

const androidManifestPath = "android/app/src/main/AndroidManifest.xml";
if (existsSync(androidManifestPath)) {
  const manifest = readFileSync(androidManifestPath, "utf8");
  requirePattern(
    androidManifestPath,
    manifest,
    /<uses-permission\s+android:name="android\.permission\.RECORD_AUDIO"\s*\/>/,
    "does not contain the required in-app voice-call microphone permission",
  );
}

const iosInfoPlistPath = "ios/App/App/Info.plist";
if (existsSync(iosInfoPlistPath)) {
  const plist = readFileSync(iosInfoPlistPath, "utf8");
  requirePattern(
    iosInfoPlistPath,
    plist,
    /<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/s,
    "does not contain a non-empty microphone usage description",
  );
}

if (findings.length > 0) {
  console.error("Mobile voice permission check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Mobile voice permissions match the in-app WebRTC feature.");
