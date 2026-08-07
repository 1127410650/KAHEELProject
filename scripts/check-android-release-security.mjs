import { existsSync, readFileSync } from "node:fs";

const findings = [];
const requireNativeProjects = process.env.MOBILE_NATIVE_PROJECTS_REQUIRED === "1";

function read(path) {
  return readFileSync(path, "utf8");
}

function requirePattern(path, content, pattern, reason) {
  if (!pattern.test(content)) findings.push(`${path}: ${reason}`);
}

function rejectPattern(path, content, pattern, reason) {
  if (pattern.test(content)) findings.push(`${path}: ${reason}`);
}

const hardenerPath = "scripts/harden-android-release.mjs";
const hardener = read(hardenerPath);
for (const [pattern, reason] of [
  [/minifyEnabled true/, "does not enable R8 minification"],
  [/shrinkResources true/, "does not enable resource shrinking"],
  [/proguard-android-optimize\.txt/, "does not require optimized default ProGuard rules"],
  [/<cache-path name="shared_cache" path="\." \/>/, "does not restrict FileProvider to app-owned cache"],
  [/signingConfigs\.debug/, "does not reject debug signing in release builds"],
]) {
  requirePattern(hardenerPath, hardener, pattern, reason);
}
rejectPattern(
  hardenerPath,
  hardener,
  /<external-path|<external-files-path|<root-path/,
  "writes a FileProvider path that can expose external or root storage",
);

const gradlePath = "android/app/build.gradle";
const filePathsPath = "android/app/src/main/res/xml/file_paths.xml";

if (requireNativeProjects && !existsSync(gradlePath)) {
  findings.push(`${gradlePath}: generated Android release project is required but missing`);
}

if (existsSync(gradlePath)) {
  const gradle = read(gradlePath);
  for (const [pattern, reason] of [
    [/release\s*\{[\s\S]*?minifyEnabled\s+true/, "release does not enable R8 minification"],
    [/release\s*\{[\s\S]*?shrinkResources\s+true/, "release does not enable resource shrinking"],
    [/proguard-android-optimize\.txt/, "release does not use optimized default ProGuard rules"],
  ]) {
    requirePattern(gradlePath, gradle, pattern, reason);
  }
  rejectPattern(
    gradlePath,
    /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/,
    "release build uses the debug signing key",
  );
}

if (requireNativeProjects && !existsSync(filePathsPath)) {
  findings.push(`${filePathsPath}: restricted FileProvider paths are required but missing`);
}

if (existsSync(filePathsPath)) {
  const filePaths = read(filePathsPath);
  requirePattern(
    filePathsPath,
    filePaths,
    /<cache-path name="shared_cache" path="\." \/>/,
    "FileProvider is not restricted to app-owned cache",
  );
  rejectPattern(
    filePathsPath,
    /<external-path|<external-files-path|<root-path/,
    "FileProvider exposes external or root storage",
  );
}

if (findings.length) {
  console.error("Android release security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Android release security check passed.");
