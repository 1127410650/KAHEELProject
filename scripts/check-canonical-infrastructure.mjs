import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXPECTED_SUPABASE_REF = "rgpnhzovtceitqxpiilf";
const EXPECTED_SUPABASE_NAME = "KAHEELProject";
const EXPECTED_SUPABASE_URL = `https://${EXPECTED_SUPABASE_REF}.supabase.co`;
const RETIRED_SUPABASE_REFS = new Set(["fdmovlxyqebtgzhsroac"]);
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const REQUIRE_RUNTIME = process.argv.includes("--require-runtime");
const PROJECT_ID_KEYS = new Set(["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID"]);
const PROJECT_URL_KEYS = new Set(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
const IDENTITY_KEYS = new Set([...PROJECT_ID_KEYS, ...PROJECT_URL_KEYS]);

function fail(message) {
  console.error(`KAHEEL canonical Supabase check failed: ${message}`);
  process.exit(1);
}

function cleanEnvValue(rawValue) {
  let value = String(rawValue ?? "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim();
}

function parseIdentityValues(content) {
  const values = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    if (!IDENTITY_KEYS.has(key)) continue;
    values.push([key, cleanEnvValue(line.slice(separator + 1))]);
  }
  return values;
}

function assertProjectRef(source, value) {
  if (!value) fail(`${source} is empty`);
  if (value !== EXPECTED_SUPABASE_REF) {
    fail(`${source} must reference the approved Supabase project ${EXPECTED_SUPABASE_REF}`);
  }
  runtimeEvidence.push(source);
}

function assertProjectUrl(source, value) {
  if (!value) fail(`${source} is empty`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${source} is not a valid URL`);
  }

  const normalized = `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
  if (normalized !== EXPECTED_SUPABASE_URL || url.search || url.hash) {
    fail(`${source} must reference the approved Supabase project ${EXPECTED_SUPABASE_REF}`);
  }
  runtimeEvidence.push(source);
}

function assertIdentity(source, key, value) {
  if (PROJECT_ID_KEYS.has(key)) assertProjectRef(`${source}:${key}`, value);
  if (PROJECT_URL_KEYS.has(key)) assertProjectUrl(`${source}:${key}`, value);
}

const configPath = new URL("../supabase/config.toml", import.meta.url);
const config = readFileSync(configPath, "utf8");
const configuredRef = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (configuredRef !== EXPECTED_SUPABASE_REF) {
  fail(
    `supabase/config.toml must use ${EXPECTED_SUPABASE_REF}, received ${configuredRef ?? "missing"}`,
  );
}

const runtimeEvidence = [];
for (const key of IDENTITY_KEYS) {
  const value = process.env[key];
  if (value !== undefined) assertIdentity("process environment", key, cleanEnvValue(value));
}

for (const filename of readdirSync(ROOT)
  .filter((name) => /^\.env(?:\.|$)/.test(name))
  .sort()) {
  const path = `${ROOT}/${filename}`;
  if (!statSync(path).isFile()) continue;
  for (const [key, value] of parseIdentityValues(readFileSync(path, "utf8"))) {
    assertIdentity(filename, key, value);
  }
}

if (REQUIRE_RUNTIME && runtimeEvidence.length === 0) {
  fail(
    `no runtime configuration identifies the approved Supabase project ${EXPECTED_SUPABASE_REF}`,
  );
}

let trackedFiles;
try {
  trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
} catch {
  fail("unable to inspect tracked files for conflicting Supabase references");
}

const supabaseHostPattern = /(?:https?:\/\/|db\.)([a-z0-9]{20})\.supabase\.co/gi;
const supabaseProjectIdPattern =
  /(?:^|\n)\s*(?:VITE_)?SUPABASE_PROJECT_ID\s*[:=]\s*["']?([a-z0-9_-]+)/gi;
for (const relativePath of trackedFiles) {
  if (
    relativePath === "scripts/check-canonical-infrastructure.mjs" ||
    relativePath.startsWith(".lovable/backup/")
  ) {
    continue;
  }
  const path = `${ROOT}/${relativePath}`;
  if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size > 2_000_000) continue;

  let content;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    continue;
  }

  for (const match of content.matchAll(supabaseHostPattern)) {
    if (match[1] !== EXPECTED_SUPABASE_REF) {
      fail(`${relativePath} references a non-approved Supabase project`);
    }
  }

  for (const match of content.matchAll(supabaseProjectIdPattern)) {
    if (match[1] !== EXPECTED_SUPABASE_REF) {
      fail(`${relativePath} configures a non-approved Supabase project ID`);
    }
  }

  for (const retiredRef of RETIRED_SUPABASE_REFS) {
    if (content.includes(retiredRef)) {
      fail(`${relativePath} contains retired Supabase project ref ${retiredRef}`);
    }
  }
}

console.log(
  `KAHEEL canonical Supabase project verified: ${EXPECTED_SUPABASE_NAME} (${EXPECTED_SUPABASE_REF})`,
);
