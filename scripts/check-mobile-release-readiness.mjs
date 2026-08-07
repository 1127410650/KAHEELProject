import { readFileSync } from "node:fs";

const ledgerPath = ".lovable/audit/mobile-release-readiness.json";
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");
const findings = [];

function fail(message) {
  findings.push(message);
}

function looksSensitive(value) {
  return [
    /sb_secret_/i,
    /service[_-]?role/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/,
    /(?:^|[?&\s])(?:access_token|refresh_token|password|secret|api_key)=/i,
  ].some((pattern) => pattern.test(value));
}

function verifyEvidence(name, entry) {
  if (!entry || typeof entry !== "object") {
    fail(`${name}: evidence block is missing`);
    return;
  }
  if (entry.verified !== true) {
    fail(`${name}: not verified`);
    return;
  }
  if (typeof entry.evidence_ref !== "string" || entry.evidence_ref.trim().length < 8) {
    fail(`${name}: verified without a usable evidence_ref`);
    return;
  }
  if (entry.evidence_ref.length > 512) fail(`${name}: evidence_ref is too long`);
  if (looksSensitive(entry.evidence_ref)) fail(`${name}: evidence_ref appears to contain secret material`);
}

if (ledger.schema_version !== 1) fail("unsupported release evidence schema version");
if (!/^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9_-]*){2,}$/.test(ledger.application_id ?? "")) {
  fail("application_id is missing or invalid");
}
if (ledger.application_id_approved !== true) fail("final application_id has not been explicitly approved");

const configAppId = capacitorConfig.match(/appId:\s*["']([^"']+)["']/)?.[1];
if (!configAppId) {
  fail("capacitor.config.ts has no appId");
} else if (ledger.application_id !== configAppId) {
  fail(`approved application_id does not match capacitor.config.ts (${ledger.application_id} != ${configAppId})`);
}

for (const key of [
  "supabase_recovery_allowlist",
  "supabase_rls_storage",
  "android_real_device_release",
  "ios_real_device_release",
  "android_release_signing",
  "ios_release_signing",
  "universal_app_links",
  "independent_penetration_test",
  "store_privacy_disclosures",
]) {
  verifyEvidence(key, ledger[key]);
}

if (!Number.isInteger(ledger.unresolved_critical_high)) {
  fail("unresolved_critical_high must be an integer backed by the final security review");
} else if (ledger.unresolved_critical_high !== 0) {
  fail(`unresolved Critical/High security findings must be zero (found ${ledger.unresolved_critical_high})`);
}

const calculatedStatus = findings.length === 0 ? "ready" : "blocked";
if (ledger.status !== calculatedStatus) {
  fail(`ledger status must be '${calculatedStatus}' for the recorded evidence`);
}

if (findings.length) {
  console.error("Mobile public-release readiness is BLOCKED:");
  for (const finding of findings) console.error(`- ${finding}`);
  console.error("No signing, store upload, or public distribution is permitted from this evidence state.");
  process.exit(1);
}

console.log("Mobile public-release readiness PASSED with referenced evidence and zero unresolved Critical/High findings.");
