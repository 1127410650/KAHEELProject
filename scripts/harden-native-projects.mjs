import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function hardenAndroid() {
  const manifestPath = "android/app/src/main/AndroidManifest.xml";
  let manifest = readFileSync(manifestPath, "utf8");

  for (const [name, value] of [
    ["allowBackup", "false"],
    ["fullBackupContent", "false"],
    ["dataExtractionRules", "@xml/data_extraction_rules"],
    ["usesCleartextTraffic", "false"],
    ["networkSecurityConfig", "@xml/network_security_config"],
  ]) {
    manifest = replaceApplicationAttribute(manifest, name, value);
  }

  if (/android:debuggable="true"/.test(manifest)) {
    throw new Error("Android release manifest must not enable debugging.");
  }

  writeFileSync(manifestPath, manifest);

  const networkConfigPath = "android/app/src/main/res/xml/network_security_config.xml";
  mkdirSync(dirname(networkConfigPath), { recursive: true });
  writeFileSync(
    networkConfigPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="false">\n    <trust-anchors>\n      <certificates src="system" />\n    </trust-anchors>\n  </base-config>\n</network-security-config>\n`,
  );

  const extractionRulesPath = "android/app/src/main/res/xml/data_extraction_rules.xml";
  writeFileSync(
    extractionRulesPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n    <exclude domain="root" path="." />\n    <exclude domain="file" path="." />\n    <exclude domain="database" path="." />\n    <exclude domain="sharedpref" path="." />\n    <exclude domain="external" path="." />\n    <exclude domain="device_root" path="." />\n    <exclude domain="device_file" path="." />\n    <exclude domain="device_database" path="." />\n    <exclude domain="device_sharedpref" path="." />\n  </cloud-backup>\n  <device-transfer>\n    <exclude domain="root" path="." />\n    <exclude domain="file" path="." />\n    <exclude domain="database" path="." />\n    <exclude domain="sharedpref" path="." />\n    <exclude domain="external" path="." />\n    <exclude domain="device_root" path="." />\n    <exclude domain="device_file" path="." />\n    <exclude domain="device_database" path="." />\n    <exclude domain="device_sharedpref" path="." />\n  </device-transfer>\n</data-extraction-rules>\n`,
  );
}

function addPlistEntry(plist, entry) {
  if (plist.includes(entry.marker)) return plist;
  const closing = plist.lastIndexOf("</dict>");
  if (closing < 0) throw new Error("Info.plist has no root dictionary.");
  return `${plist.slice(0, closing)}${entry.xml}\n${plist.slice(closing)}`;
}

function hardenIos() {
  const plistPath = "ios/App/App/Info.plist";
  let plist = readFileSync(plistPath, "utf8");

  const entries = [
    {
      marker: "<key>NSAppTransportSecurity</key>",
      xml: `\t<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<false/>\n\t\t<key>NSAllowsArbitraryLoadsInWebContent</key>\n\t\t<false/>\n\t\t<key>NSAllowsLocalNetworking</key>\n\t\t<false/>\n\t</dict>`,
    },
    {
      marker: "<key>WKAppBoundDomains</key>",
      xml: `\t<key>WKAppBoundDomains</key>\n\t<array>\n\t\t<string>check-your-name-ai.vercel.app</string>\n\t</array>`,
    },
    {
      marker: "<key>UIFileSharingEnabled</key>",
      xml: `\t<key>UIFileSharingEnabled</key>\n\t<false/>`,
    },
    {
      marker: "<key>LSSupportsOpeningDocumentsInPlace</key>",
      xml: `\t<key>LSSupportsOpeningDocumentsInPlace</key>\n\t<false/>`,
    },
  ];

  for (const entry of entries) plist = addPlistEntry(plist, entry);
  writeFileSync(plistPath, plist);
}

hardenAndroid();
hardenIos();
console.log("Native Android and iOS hardening applied.");
