import { existsSync, readFileSync } from "node:fs";

const findings = [];

function report(file, reason) {
  findings.push({ file, reason });
}

function requireFile(path) {
  if (!existsSync(path)) {
    report(path, "required generated native file is missing");
    return null;
  }
  return readFileSync(path, "utf8");
}

function requireText(file, content, expected, reason) {
  if (!content?.includes(expected)) report(file, reason);
}

const manifestPath = "android/app/src/main/AndroidManifest.xml";
const manifest = requireFile(manifestPath);
if (manifest) {
  for (const [expected, reason] of [
    ['android:allowBackup="false"', "Android backup is not disabled"],
    ['android:fullBackupContent="false"', "legacy Android backup is not disabled"],
    [
      'android:dataExtractionRules="@xml/data_extraction_rules"',
      "Android cloud/device-transfer rules are missing",
    ],
    ['android:usesCleartextTraffic="false"', "Android cleartext traffic is not disabled"],
    [
      'android:networkSecurityConfig="@xml/network_security_config"',
      "Android network security configuration is missing",
    ],
  ]) {
    requireText(manifestPath, manifest, expected, reason);
  }

  if (/android:debuggable\s*=\s*"true"/.test(manifest)) {
    report(manifestPath, "Android manifest explicitly enables debugging");
  }

  const forbiddenPermissions = [
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS",
    "android.permission.READ_SMS",
    "android.permission.SEND_SMS",
    "android.permission.CALL_PHONE",
    "android.permission.READ_PHONE_STATE",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.MANAGE_EXTERNAL_STORAGE",
  ];
  for (const permission of forbiddenPermissions) {
    if (manifest.includes(permission)) report(manifestPath, `contains unapproved permission ${permission}`);
  }
}

const networkConfigPath = "android/app/src/main/res/xml/network_security_config.xml";
const networkConfig = requireFile(networkConfigPath);
if (networkConfig) {
  requireText(
    networkConfigPath,
    networkConfig,
    'cleartextTrafficPermitted="false"',
    "network security config permits cleartext traffic",
  );
  requireText(
    networkConfigPath,
    networkConfig,
    '<certificates src="system" />',
    "network security config does not use system trust anchors",
  );
  if (networkConfig.includes('src="user"')) {
    report(networkConfigPath, "network security config trusts user-installed certificates");
  }
}

const extractionRulesPath = "android/app/src/main/res/xml/data_extraction_rules.xml";
const extractionRules = requireFile(extractionRulesPath);
if (extractionRules) {
  for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
    requireText(
      extractionRulesPath,
      extractionRules,
      `<exclude domain="${domain}" path="." />`,
      `backup exclusion for ${domain} is missing`,
    );
  }
}

const plistPath = "ios/App/App/Info.plist";
const plist = requireFile(plistPath);
if (plist) {
  for (const expected of [
    "<key>NSAppTransportSecurity</key>",
    "<key>NSAllowsArbitraryLoads</key>",
    "<key>NSAllowsArbitraryLoadsInWebContent</key>",
    "<key>NSAllowsLocalNetworking</key>",
    "<key>WKAppBoundDomains</key>",
    "<string>check-your-name-ai.vercel.app</string>",
    "<key>UIFileSharingEnabled</key>",
    "<key>LSSupportsOpeningDocumentsInPlace</key>",
  ]) {
    requireText(plistPath, plist, expected, `iOS security setting is missing: ${expected}`);
  }

  const forbiddenUsageDescriptions = [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSLocationAlwaysUsageDescription",
    "NSContactsUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
  ];
  for (const key of forbiddenUsageDescriptions) {
    if (plist.includes(`<key>${key}</key>`)) report(plistPath, `contains unapproved privacy capability ${key}`);
  }
}

for (const signingPath of [
  "android/keystore.properties",
  "android/app/release.keystore",
  "ios/App/App.mobileprovision",
]) {
  if (existsSync(signingPath)) report(signingPath, "signing material must not be stored in the source tree");
}

if (!existsSync("package-lock.json")) {
  report("package-lock.json", "dependency lockfile is missing");
}

if (findings.length) {
  console.error("Native release readiness check failed:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.reason}`);
  process.exit(1);
}

console.log("Native release readiness check passed.");
