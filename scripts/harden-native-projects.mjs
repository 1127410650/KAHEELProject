import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function replaceApplicationAttribute(xml, name, value) {
  const applicationPattern = /<application\b([^>]*)>/;
  const match = xml.match(applicationPattern);
  if (!match) throw new Error("AndroidManifest.xml has no application element.");

  const attributePattern = new RegExp(`\\sandroid:${name}="[^"]*"`);
  const attributes = attributePattern.test(match[1])
    ? match[1].replace(attributePattern, ` android:${name}="${value}"`)
    : `${match[1]} android:${name}="${value}"`;

  return xml.replace(applicationPattern, `<application${attributes}>`);
}

function rejectAndroidPermission(manifest, permission) {
  if (manifest.includes(permission)) {
    throw new Error(`Android manifest contains forbidden broad permission: ${permission}`);
  }
}

function hardenAndroid() {
  const manifestPath = "android/app/src/main/AndroidManifest.xml";
  let manifest = readFileSync(manifestPath, "utf8");

  for (const [name, value] of [
    ["allowBackup", "false"],
    ["fullBackupContent", "false"],
    ["usesCleartextTraffic", "false"],
    ["networkSecurityConfig", "@xml/network_security_config"],
  ]) {
    manifest = replaceApplicationAttribute(manifest, name, value);
  }

  if (/android:debuggable="true"/.test(manifest)) {
    throw new Error("Android release manifest must not enable debugging.");
  }

  for (const permission of [
    "android.permission.MANAGE_EXTERNAL_STORAGE",
    "android.permission.QUERY_ALL_PACKAGES",
    "android.permission.REQUEST_INSTALL_PACKAGES",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ]) {
    rejectAndroidPermission(manifest, permission);
  }

  writeFileSync(manifestPath, manifest);

  const networkConfigPath = "android/app/src/main/res/xml/network_security_config.xml";
  mkdirSync(dirname(networkConfigPath), { recursive: true });
  writeFileSync(
    networkConfigPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="false">\n    <trust-anchors>\n      <certificates src="system" />\n    </trust-anchors>\n  </base-config>\n</network-security-config>\n`,
  );
}

function insertBeforeRootDictionaryClose(plist, xml) {
  const closing = plist.lastIndexOf("</dict>");
  if (closing < 0) throw new Error("Info.plist has no root dictionary.");
  return `${plist.slice(0, closing)}${xml}\n${plist.slice(closing)}`;
}

function setRootBoolean(plist, key, value) {
  const keyPattern = new RegExp(`<key>${key}<\\/key>\\s*<(?:true|false)\\/>`, "s");
  const replacement = `<key>${key}</key>\n\t<${value ? "true" : "false"}/>`;

  if (keyPattern.test(plist)) return plist.replace(keyPattern, replacement);
  return insertBeforeRootDictionaryClose(plist, `\t${replacement}`);
}

function ensureAtsPolicy(plist) {
  const atsPattern = /<key>NSAppTransportSecurity<\/key>\s*<dict>([\s\S]*?)<\/dict>/;
  const requiredKeys = [
    "NSAllowsArbitraryLoads",
    "NSAllowsArbitraryLoadsInWebContent",
    "NSAllowsLocalNetworking",
  ];

  if (!atsPattern.test(plist)) {
    const xml = `\t<key>NSAppTransportSecurity</key>\n\t<dict>\n${requiredKeys
      .map((key) => `\t\t<key>${key}</key>\n\t\t<false/>`)
      .join("\n")}\n\t</dict>`;
    return insertBeforeRootDictionaryClose(plist, xml);
  }

  return plist.replace(atsPattern, (full, body) => {
    let nextBody = body;
    for (const key of requiredKeys) {
      const childPattern = new RegExp(`<key>${key}<\\/key>\\s*<(?:true|false)\\/>`, "s");
      const replacement = `<key>${key}</key>\n\t\t<false/>`;
      nextBody = childPattern.test(nextBody)
        ? nextBody.replace(childPattern, replacement)
        : `${nextBody.trimEnd()}\n\t\t${replacement}\n\t`;
    }
    return full.replace(body, nextBody);
  });
}

function stablePbxId(label) {
  return createHash("sha1").update(`kahli:${label}`).digest("hex").slice(0, 24).toUpperCase();
}

function insertAfterLine(project, searchFrom, line) {
  const newline = project.indexOf("\n", searchFrom);
  if (newline < 0) throw new Error("Unable to patch the Xcode project structure.");
  return `${project.slice(0, newline + 1)}${line}\n${project.slice(newline + 1)}`;
}

function addPrivacyManifestToXcodeProject(project) {
  if (project.includes("PrivacyInfo.xcprivacy in Resources")) return project;

  const fileRefId = stablePbxId("privacy-manifest-file-reference");
  const buildFileId = stablePbxId("privacy-manifest-build-file");

  const buildSection = "/* Begin PBXBuildFile section */";
  const fileReferenceSection = "/* Begin PBXFileReference section */";
  const resourcesSection = "/* Begin PBXResourcesBuildPhase section */";

  const buildSectionIndex = project.indexOf(buildSection);
  const fileReferenceSectionIndex = project.indexOf(fileReferenceSection);
  const resourcesSectionIndex = project.indexOf(resourcesSection);
  if (buildSectionIndex < 0 || fileReferenceSectionIndex < 0 || resourcesSectionIndex < 0) {
    throw new Error("The Xcode project is missing required PBX sections.");
  }

  project = insertAfterLine(
    project,
    buildSectionIndex,
    `\t\t${buildFileId} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* PrivacyInfo.xcprivacy */; };`,
  );

  project = insertAfterLine(
    project,
    project.indexOf(fileReferenceSection),
    `\t\t${fileRefId} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`,
  );

  const mainGroupMatch = project.match(/\bmainGroup = ([A-F0-9]{24});/);
  if (!mainGroupMatch) throw new Error("Unable to identify the Xcode main group.");

  const mainGroupObject = project.indexOf(`${mainGroupMatch[1]} = {`);
  const mainGroupChildren = project.indexOf("children = (", mainGroupObject);
  if (mainGroupObject < 0 || mainGroupChildren < 0) {
    throw new Error("Unable to identify the Xcode main group children.");
  }
  project = insertAfterLine(
    project,
    mainGroupChildren,
    `\t\t\t\t${fileRefId} /* PrivacyInfo.xcprivacy */,`,
  );

  const resourcesObject = project.indexOf("isa = PBXResourcesBuildPhase;", project.indexOf(resourcesSection));
  const resourceFiles = project.indexOf("files = (", resourcesObject);
  if (resourcesObject < 0 || resourceFiles < 0) {
    throw new Error("Unable to identify the Xcode resources build phase.");
  }
  project = insertAfterLine(
    project,
    resourceFiles,
    `\t\t\t\t${buildFileId} /* PrivacyInfo.xcprivacy in Resources */,`,
  );

  return project;
}

function writePrivacyManifest() {
  const privacyManifestPath = "ios/App/PrivacyInfo.xcprivacy";
  writeFileSync(
    privacyManifestPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n  <key>NSPrivacyAccessedAPITypes</key>\n  <array>\n    <dict>\n      <key>NSPrivacyAccessedAPIType</key>\n      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>\n      <key>NSPrivacyAccessedAPITypeReasons</key>\n      <array>\n        <string>CA92.1</string>\n      </array>\n    </dict>\n  </array>\n</dict>\n</plist>\n`,
  );

  const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
  const project = readFileSync(projectPath, "utf8");
  writeFileSync(projectPath, addPrivacyManifestToXcodeProject(project));
}

function hardenIos() {
  const plistPath = "ios/App/App/Info.plist";
  let plist = readFileSync(plistPath, "utf8");

  plist = ensureAtsPolicy(plist);
  plist = setRootBoolean(plist, "UIFileSharingEnabled", false);
  plist = setRootBoolean(plist, "LSSupportsOpeningDocumentsInPlace", false);

  writeFileSync(plistPath, plist);
  writePrivacyManifest();
}

let hardenedPlatforms = 0;

if (existsSync("android/app/src/main/AndroidManifest.xml")) {
  hardenAndroid();
  hardenedPlatforms += 1;
}

if (existsSync("ios/App/App/Info.plist")) {
  hardenIos();
  hardenedPlatforms += 1;
}

if (hardenedPlatforms === 0) {
  throw new Error("No generated Android or iOS project was found to harden.");
}

console.log(`Native hardening applied to ${hardenedPlatforms} platform(s).`);
