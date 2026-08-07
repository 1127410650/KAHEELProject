import { existsSync, readFileSync } from "node:fs";

const findings = [];
const requireNativeAssets = process.env.MOBILE_NATIVE_ASSETS_REQUIRED === "1";
const requireNativeProjects = process.env.MOBILE_NATIVE_PROJECTS_REQUIRED === "1";

function report(file, reason) {
  findings.push({ file, reason });
}

function read(file) {
  return readFileSync(file, "utf8");
}

function requirePattern(file, content, pattern, reason) {
  if (!pattern.test(content)) report(file, reason);
}

function rejectPattern(file, content, pattern, reason) {
  if (pattern.test(content)) report(file, reason);
}

function occurrenceCount(content, value) {
  return content.split(value).length - 1;
}

const packageJson = JSON.parse(read("package.json"));
const pinnedMobilePackages = [
  "@capacitor/app",
  "@capacitor/core",
  "@capacitor/preferences",
  "capacitor-secure-storage-plugin",
  "@capacitor/android",
  "@capacitor/cli",
  "@capacitor/ios",
];

for (const dependency of pinnedMobilePackages) {
  const version = packageJson.dependencies?.[dependency] ?? packageJson.devDependencies?.[dependency];
  if (!version) {
    report("package.json", `is missing required mobile dependency ${dependency}`);
    continue;
  }

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    report("package.json", `${dependency} must use an exact version, not a range (${version})`);
  }
}

const expectedMobileBuild =
  "npm run security:mobile-all && MOBILE_NATIVE_BUILD=1 vite build && MOBILE_NATIVE_ASSETS_REQUIRED=1 npm run security:mobile";
const expectedReleaseCheck =
  "MOBILE_NATIVE_ASSETS_REQUIRED=1 MOBILE_NATIVE_PROJECTS_REQUIRED=1 npm run security:mobile";

if (packageJson.scripts?.["build:mobile"] !== expectedMobileBuild) {
  report("package.json", "does not run the reviewed fail-closed native SPA build command");
}
if (packageJson.scripts?.["mobile:release:check"] !== expectedReleaseCheck) {
  report("package.json", "does not require both native assets and native projects for release checks");
}

const viteConfig = read("vite.config.ts");
for (const [pattern, reason] of [
  [/MOBILE_NATIVE_BUILD\s*===\s*"1"/, "does not isolate SPA mode to native builds"],
  [/__KAHLI_NATIVE_BUILD__:\s*JSON\.stringify\(isNativeMobileBuild\)/, "does not expose the reviewed native-build constant"],
  [/spa:\s*\{[\s\S]*?enabled:\s*true/, "does not enable TanStack SPA mode for native builds"],
  [/outputPath:\s*"\/index\.html"/, "does not generate a native index.html shell"],
]) {
  requirePattern("vite.config.ts", viteConfig, pattern, reason);
}

const rootRoute = read("src/routes/__root.tsx");
for (const [pattern, reason] of [
  [/declare const __KAHLI_NATIVE_BUILD__:\s*boolean/, "does not declare the native-build constant"],
  [/createNativeContentSecurityPolicy/, "does not construct the native Content Security Policy"],
  [/supabaseUrl\.protocol\s*!==\s*"https:"/, "does not reject a non-HTTPS Supabase CSP origin"],
  [/supabaseUrl\.origin/, "does not bind native HTTP connections to the configured Supabase origin"],
  [/realtimeUrl\.origin/, "does not bind native WebSocket connections to the configured Supabase origin"],
  [/httpEquiv:\s*"Content-Security-Policy"/, "does not emit the native CSP meta element"],
  [/"script-src 'self' 'unsafe-inline'"/, "does not restrict native scripts to the bundled application"],
  [/"object-src 'none'"/, "does not block plugin/object content"],
  [/"frame-src 'none'"/, "does not block embedded frames"],
  [/"base-uri 'none'"/, "does not block base URL rewriting"],
  [/"form-action 'self'"/, "does not restrict form submissions to the local application"],
]) {
  requirePattern("src/routes/__root.tsx", rootRoute, pattern, reason);
}
for (const [pattern, reason] of [
  [/unsafe-eval/, "permits eval-like script execution in the native CSP"],
  [/"connect-src 'self' https: wss:"/, "permits connections to every HTTPS and WSS origin"],
  [/"form-action 'self' https:"/, "permits form submission to arbitrary HTTPS origins"],
]) {
  rejectPattern("src/routes/__root.tsx", rootRoute, pattern, reason);
}

const capacitorConfig = read("capacitor.config.ts");
for (const [pattern, reason] of [
  [/appId:\s*"com\.kahli\.marketplace"/, "does not use the reviewed application identifier"],
  [/webDir:\s*"dist\/client"/, "does not bundle the generated SPA assets"],
  [/loggingBehavior:\s*"none"/, "does not disable native production logs"],
  [/hostname:\s*"localhost"/, "does not use the local bundled application host"],
  [/androidScheme:\s*"https"/, "does not use the secure Android local scheme"],
  [/cleartext:\s*false/, "does not disable cleartext WebView traffic"],
  [/allowMixedContent:\s*false/, "does not disable Android mixed content"],
  [/useLegacyBridge:\s*false/, "does not disable the legacy Android JavaScript bridge"],
  [/@capacitor\/preferences/, "does not include the Preferences plugin required for reinstall detection"],
  [/capacitor-secure-storage-plugin/, "does not include native secure storage"],
]) {
  requirePattern("capacitor.config.ts", capacitorConfig, pattern, reason);
}

for (const [pattern, reason] of [
  [/\burl\s*:/, "loads application code from a remote server.url"],
  [/allowNavigation\s*:/, "adds WebView navigation exceptions"],
  [/cleartext\s*:\s*true/, "enables cleartext traffic"],
  [/allowMixedContent\s*:\s*true/, "enables mixed HTTP/HTTPS content"],
  [/webContentsDebuggingEnabled\s*:\s*true/, "enables WebView debugging"],
  [/useLegacyBridge\s*:\s*true/, "enables the legacy Android JavaScript bridge"],
]) {
  rejectPattern("capacitor.config.ts", capacitorConfig, pattern, reason);
}

const nativeIndexPath = "dist/client/index.html";
if (requireNativeAssets && !existsSync(nativeIndexPath)) {
  report(nativeIndexPath, "is required but was not generated by the native SPA build");
}
if (existsSync(nativeIndexPath)) {
  const nativeIndex = read(nativeIndexPath);
  for (const [pattern, reason] of [
    [/http-equiv=["']Content-Security-Policy["']/i, "does not contain the native CSP meta element"],
    [/object-src\s+'none'/i, "does not block object content in the generated bundle"],
    [/frame-src\s+'none'/i, "does not block frames in the generated bundle"],
    [/form-action\s+'self'/i, "does not restrict form submissions in the generated bundle"],
    [/connect-src\s+'self'\s+https:\/\/[^;\s]+\s+wss:\/\/[^;\s]+/i, "does not pin generated connections to explicit HTTPS and WSS origins"],
  ]) {
    requirePattern(nativeIndexPath, nativeIndex, pattern, reason);
  }
  for (const [pattern, reason] of [
    [/unsafe-eval/i, "permits eval-like script execution in the generated bundle CSP"],
    [/connect-src\s+'self'\s+https:\s+wss:/i, "permits connections to every HTTPS and WSS origin in the generated bundle"],
    [/form-action\s+'self'\s+https:/i, "permits form submission to arbitrary HTTPS origins in the generated bundle"],
  ]) {
    rejectPattern(nativeIndexPath, nativeIndex, pattern, reason);
  }
}

const authStorage = read("src/lib/native-auth-storage.ts");
for (const [pattern, reason] of [
  [/capacitor-secure-storage-plugin/, "does not use native secure storage"],
  [/@capacitor\/preferences/, "does not detect first launch after reinstall"],
  [/await\s+secureStorage\.clear\(\)/, "does not clear surviving Keychain data after reinstall"],
  [/MAX_AUTH_VALUE_BYTES/, "does not enforce an authentication-value size limit"],
  [/assertAllowedAuthKey/, "does not restrict secure-storage keys"],
]) {
  requirePattern("src/lib/native-auth-storage.ts", authStorage, pattern, reason);
}

const mobileSecurity = read("src/lib/mobile-security.ts");
for (const [pattern, reason] of [
  [/MAX_DEEP_LINK_LENGTH/, "does not cap deep-link length"],
  [/url\.origin\s*!==\s*APPROVED_ORIGIN/, "does not enforce the approved deep-link origin"],
  [/url\.pathname\.startsWith\("\/\/"\)/, "does not reject protocol-relative deep-link paths"],
  [/App\.getLaunchUrl\(\)/, "does not validate cold-start deep links"],
  [/window\.history\.replaceState/, "does not route approved links inside the signed local bundle"],
]) {
  requirePattern("src/lib/mobile-security.ts", mobileSecurity, pattern, reason);
}

rejectPattern(
  "src/lib/mobile-security.ts",
  mobileSecurity,
  /window\.location\.(?:assign|replace)\s*\(/,
  "navigates the native WebView away from its signed local bundle",
);

const androidManifestPath = "android/app/src/main/AndroidManifest.xml";
if (requireNativeProjects && !existsSync(androidManifestPath)) {
  report(androidManifestPath, "is required for a native release check but is missing");
}
if (existsSync(androidManifestPath)) {
  const manifest = read(androidManifestPath);
  for (const [pattern, reason] of [
    [/android:allowBackup="false"/, "does not disable Android application backup"],
    [/android:fullBackupContent="false"/, "does not disable Android full backup"],
    [/android:usesCleartextTraffic="false"/, "does not reject Android cleartext traffic"],
    [/android:networkSecurityConfig="@xml\/network_security_config"/, "does not use the reviewed Android network policy"],
  ]) {
    requirePattern(androidManifestPath, manifest, pattern, reason);
  }

  for (const permission of [
    "android.permission.MANAGE_EXTERNAL_STORAGE",
    "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ]) {
    if (manifest.includes(permission)) {
      report(androidManifestPath, `contains forbidden broad permission ${permission}`);
    }
  }

  rejectPattern(
    androidManifestPath,
    manifest,
    /android:debuggable="true"/,
    "enables Android application debugging",
  );

  const networkConfigPath = "android/app/src/main/res/xml/network_security_config.xml";
  if (!existsSync(networkConfigPath)) {
    report(networkConfigPath, "is missing");
  } else {
    const networkConfig = read(networkConfigPath);
    requirePattern(
      networkConfigPath,
      networkConfig,
      /cleartextTrafficPermitted="false"/,
      "does not block cleartext traffic",
    );
    rejectPattern(
      networkConfigPath,
      networkConfig,
      /certificates\s+src="user"/,
      "trusts user-installed certificate authorities",
    );
  }

  if (!existsSync("android/app/src/main/assets/public/index.html")) {
    report("android/app/src/main/assets/public/index.html", "does not contain the bundled SPA entry point");
  }
}

const iosInfoPlistPath = "ios/App/App/Info.plist";
if (requireNativeProjects && !existsSync(iosInfoPlistPath)) {
  report(iosInfoPlistPath, "is required for a native release check but is missing");
}
if (existsSync(iosInfoPlistPath)) {
  const plist = read(iosInfoPlistPath);
  for (const [pattern, reason] of [
    [/<key>NSAppTransportSecurity<\/key>/, "does not define App Transport Security"],
    [/<key>UIFileSharingEnabled<\/key>\s*<false\/>/s, "does not disable iTunes/Finder file sharing"],
    [/<key>LSSupportsOpeningDocumentsInPlace<\/key>\s*<false\/>/s, "does not disable opening app documents in place"],
  ]) {
    requirePattern(iosInfoPlistPath, plist, pattern, reason);
  }

  for (const key of ["NSAllowsArbitraryLoads", "NSAllowsArbitraryLoadsInWebContent", "NSAllowsLocalNetworking"]) {
    rejectPattern(
      iosInfoPlistPath,
      plist,
      new RegExp(`<key>${key}<\\/key>\\s*<true\\/>`, "s"),
      `enables unsafe iOS transport option ${key}`,
    );
  }

  const privacyManifestPath = "ios/App/PrivacyInfo.xcprivacy";
  if (!existsSync(privacyManifestPath)) {
    report(privacyManifestPath, "is missing the Apple required-reason privacy manifest");
  } else {
    const privacyManifest = read(privacyManifestPath);
    requirePattern(
      privacyManifestPath,
      privacyManifest,
      /<string>NSPrivacyAccessedAPICategoryUserDefaults<\/string>/,
      "does not declare UserDefaults access",
    );
    requirePattern(
      privacyManifestPath,
      privacyManifest,
      /<string>CA92\.1<\/string>/,
      "does not declare the approved CA92.1 reason",
    );
  }

  const xcodeProjectPath = "ios/App/App.xcodeproj/project.pbxproj";
  if (!existsSync(xcodeProjectPath)) {
    report(xcodeProjectPath, "is missing");
  } else {
    const xcodeProject = read(xcodeProjectPath);
    requirePattern(
      xcodeProjectPath,
      xcodeProject,
      /path = PrivacyInfo\.xcprivacy;/,
      "does not reference the privacy manifest",
    );
    if (occurrenceCount(xcodeProject, "PrivacyInfo.xcprivacy in Resources") < 2) {
      report(xcodeProjectPath, "does not include the privacy manifest in the app resources phase");
    }
  }
}

if (findings.length > 0) {
  console.error("Mobile security check failed:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.reason}`);
  process.exit(1);
}

console.log("Mobile security check passed.");
