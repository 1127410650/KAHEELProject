import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const gradlePath = "android/app/build.gradle";
const filePathsPath = "android/app/src/main/res/xml/file_paths.xml";

if (!existsSync(gradlePath)) {
  console.log("Android project not present; skipping Android release hardening.");
  process.exit(0);
}

let gradle = readFileSync(gradlePath, "utf8");

if (/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(gradle)) {
  throw new Error("Android release build must never use the debug signing key.");
}

if (/minifyEnabled\s+false/.test(gradle)) {
  gradle = gradle.replace(/minifyEnabled\s+false/, "minifyEnabled true");
}
if (!/minifyEnabled\s+true/.test(gradle)) {
  throw new Error("Unable to enable R8 minification for the Android release build.");
}

if (!/shrinkResources\s+true/.test(gradle)) {
  gradle = gradle.replace(/(minifyEnabled\s+true\s*\n)/, "$1            shrinkResources true\n");
}
if (!/shrinkResources\s+true/.test(gradle)) {
  throw new Error("Unable to enable Android release resource shrinking.");
}

gradle = gradle.replace(
  /getDefaultProguardFile\('proguard-android\.txt'\)/g,
  "getDefaultProguardFile('proguard-android-optimize.txt')",
);
if (!/proguard-android-optimize\.txt/.test(gradle)) {
  throw new Error("Android release build is not using the optimized default ProGuard rules.");
}

writeFileSync(gradlePath, gradle);

mkdirSync(dirname(filePathsPath), { recursive: true });
writeFileSync(
  filePathsPath,
  `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n  <!-- Share only app-owned temporary files. Never expose external storage roots. -->\n  <cache-path name="shared_cache" path="." />\n</paths>\n`,
);

console.log("Android release hardening applied: R8/resource shrinking enabled and FileProvider restricted to app cache.");
