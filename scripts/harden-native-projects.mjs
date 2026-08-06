import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const APPROVED_DOMAIN = "check-your-name-ai.vercel.app";

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
  const keyPattern = new RegExp(
    `<key>${key}<\\/key>\\s*<(?:true|false)\\/>`,
    "s",
  );
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

function ensureAppBoundDomain(plist) {
  const arrayPattern = /<key>WKAppBoundDomains<\/key>\s*<array>([\s\S]*?)<\/array>/;
  if (!arrayPattern.test(plist)) {
    return insertBeforeRootDictionaryClose(
      plist,
      `\t<key>WKAppBoundDomains</key>\n\t<array>\n\t\t<string>${APPROVED_DOMAIN}</string>\n\t</array>`,
    );
  }

  return plist.replace(arrayPattern, (full, body) => {
    if (body.includes(`<string>${APPROVED_DOMAIN}</string>`)) return full;
    const nextBody = `${body.trimEnd()}\n\t\t<string>${APPROVED_DOMAIN}</string>\n\t`;
    return full.replace(body, nextBody);
  });
}

function hardenIos() {
  const plistPath = "ios/App/App/Info.plist";
  let plist = readFileSync(plistPath, "utf8");

  plist = ensureAtsPolicy(plist);
  plist = ensureAppBoundDomain(plist);
  plist = setRootBoolean(plist, "UIFileSharingEnabled", false);
  plist = setRootBoolean(plist, "LSSupportsOpeningDocumentsInPlace", false);

  writeFileSync(plistPath, plist);
}

hardenAndroid();
hardenIos();
console.log("Native Android and iOS hardening applied.");
