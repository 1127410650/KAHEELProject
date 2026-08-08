import { readFileSync } from "node:fs";

const path = new URL("../public/.well-known/kaheel-project.json", import.meta.url);
const manifest = JSON.parse(readFileSync(path, "utf8"));

function fail(message) {
  console.error(`KAHEEL project-link foundation check failed: ${message}`);
  process.exit(1);
}

if (manifest.protocol !== "kaheel-project-link/v1") fail("unexpected protocol");
if (manifest.project_id !== "kaheel-market") fail("unexpected project id");
if (manifest.discovery_path !== "/.well-known/kaheel-project.json") {
  fail("unexpected discovery path");
}
if (manifest.linking?.direction !== "bidirectional") fail("linking must be bidirectional");
if (manifest.linking?.data_mode !== "references-only") fail("data must remain reference-only");
if (manifest.linking?.authorization !== "explicit") fail("authorization must be explicit");

for (const key of [
  "auto_trust",
  "shared_database",
  "shared_service_role",
  "permission_inheritance",
]) {
  if (manifest.security?.[key] !== false) fail(`unsafe security setting: ${key}`);
}

console.log("KAHEEL bidirectional project-link foundation verified: kaheel-market");
