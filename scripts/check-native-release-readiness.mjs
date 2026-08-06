import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { resolveMobileOrigin } from "./mobile-origin-policy.mjs";

const approvedMobileHost = resolveMobileOrigin().hostname;
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

function requirePlistFalse(file, content, key) {
  const pattern = new RegExp(`<key>${key}<\\/key>\\s*<false\\s*\\/>`);
  if (!pattern.test(content ?? "")) report(file, `${key} must be explicitly false`);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
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

  const exportedComponents = manifest.match(/android:exported\s*=\s*"true"/g) ?? [];
  if (exportedComponents.length !== 1) {
    report(manifestPath, "exactly one launcher activity may be exported");
  }
  for (const expected of [
    "android.intent.action.MAIN",
    "android.intent.category.LAUNCHER",
  ]) {
    requireText(manifestPath, manifest, expected, `launcher intent is missing ${expected}`);
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
    "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.SYSTEM_ALERT_WINDOW",
    "android.permission.WRITE_SETTINGS",
  ];
  for (const permission of forbiddenPermissions) {
    if (manifest.includes(permission)) report(manifestPath, `contains unapproved permission ${permission}`);
  }
}

const variablesPath = "android/variables.gradle";
const variables = requireFile(variablesPath);
if (variables) {
  for (const [name, minimum] of [
    ["minSdkVersion", 23],
    ["compileSdkVersion", 35],
    ["targetSdkVersion", 35],
  ]) {
    const match = variables.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
    if (!match || Number(match[1]) < minimum) {
      report(variablesPath, `${name} must be at least ${minimum}`);
    }
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
  for (const domain of [
    "root",
    "file",
    "database",
    "sharedpref",
    "external",
    "device_root",
    "device_file",
    "device_database",
    "device_sharedpref",
  ]) {
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
  requireText(
    plistPath,
    plist,
    "<key>NSAppTransportSecurity</key>",
    "iOS App Transport Security dictionary is missing",
  );
  for (const key of [
    "NSAllowsArbitraryLoads",
    "NSAllowsArbitraryLoadsInWebContent",
    "NSAllowsLocalNetworking",
    "UIFileSharingEnabled",
    "LSSupportsOpeningDocumentsInPlace",
  ]) {
    requirePlistFalse(plistPath, plist, key);
  }

  const domainsMatch = plist.match(
    /<key>WKAppBoundDomains<\/key>\s*<array>([\s\S]*?)<\/array>/,
  );
  if (!domainsMatch) {
    report(plistPath, "WKAppBoundDomains is missing");
  } else {
    const domains = [...domainsMatch[1].matchAll(/<string>([^<]+)<\/string>/g)].map(
      (match) => match[1],
    );
    if (domains.length !== 1 || domains[0] !== approvedMobileHost) {
      report(plistPath, "WKAppBoundDomains must contain only the active approved host");
    }
  }

  const forbiddenUsageDescriptions = [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSLocationWhenInUseUsageDescription",
    "NSLocationAlwaysUsageDescription",
    "NSContactsUsageDescription",
    "NSPhotoLibraryUsageDescription",
    "NSPhotoLibraryAddUsageDescription",
    "NSSpeechRecognitionUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
  ];
  for (const key of forbiddenUsageDescriptions) {
    if (plist.includes(`<key>${key}</key>`)) report(plistPath, `contains unapproved privacy capability ${key}`);
  }
}

const podfilePath = "ios/App/Podfile";
const podfile = requireFile(podfilePath);
if (podfile) {
  const deployment = podfile.match(/platform\s+:ios,\s*['"](\d+(?:\.\d+)?)['"]/);
  if (!deployment || Number(deployment[1]) < 14) {
    report(podfilePath, "iOS deployment target must be at least 14.0");
  }
}

for (const file of [...walk("android"), ...walk("ios")]) {
  const extension = extname(file).toLowerCase();
  if ([".jks", ".keystore", ".p12", ".pfx", ".mobileprovision"].includes(extension)) {
    report(file, "signing material must not be stored in the source tree");
  }

  if (extension === ".entitlements") {
    const entitlements = readFileSync(file, "utf8");
    for (const key of [
      "com.apple.developer.icloud-container-identifiers",
      "com.apple.developer.ubiquity-container-identifiers",
      "com.apple.security.application-groups",
      "keychain-access-groups",
      "com.apple.developer.associated-domains",
    ]) {
      if (entitlements.includes(`<key>${key}</key>`)) {
        report(file, `contains unapproved entitlement ${key}`);
      }
    }
  }
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
