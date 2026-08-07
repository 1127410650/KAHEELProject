import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AUTHORITY_PATH = resolve(ROOT, ".kaheel/project-authority.json");
const REQUIRE_RUNTIME = process.argv.includes("--require-runtime");
const STATIC_ONLY = process.argv.includes("--static");

const LOCKED = Object.freeze({
  repositoryFullName: "1127410650/KAHEELProject",
  repositoryId: "1318292196",
  defaultBranch: "main",
  supabaseProjectRef: "fdmovlxyqebtgzhsroac",
  supabaseOrigin: "https://fdmovlxyqebtgzhsroac.supabase.co",
  publicOrigin: "https://check-your-name-ai.vercel.app",
  vercelProjectId: "prj_OeJq9TShLOrJkHCMCtrX2uEJSLJV",
  vercelOrgId: "team_5U6h5f6CWoHmohhpAyPir7P1",
  vercelGitProvider: "github",
  vercelGitOwner: "1127410650",
  vercelGitRepository: "KAHEELProject",
  vercelGitRepositoryId: "1318292196",
  vercelProductionHost: "check-your-name-ai.vercel.app",
  nativeApplicationId: "com.kahli.marketplace",
});

const findings = [];
const skippedDirectories = new Set([
  ".git",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  ".output",
  ".nitro",
  "coverage",
  "DerivedData",
  ".gradle",
  "Pods",
]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function report(message) {
  findings.push(message);
}

function normalizedRelative(file) {
  return relative(ROOT, file).replaceAll("\\", "/");
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    report(`${label} is missing or is not valid JSON`);
    return null;
  }
}

function normalizeRepositoryUrl(value) {
  const remote = String(value ?? "").trim().replace(/\/+$/, "").replace(/\.git$/, "");
  const patterns = [
    /^https:\/\/github\.com\/([^/]+\/[^/]+)$/i,
    /^git@github\.com:([^/]+\/[^/]+)$/i,
    /^ssh:\/\/git@github\.com\/([^/]+\/[^/]+)$/i,
    /^git:\/\/github\.com\/([^/]+\/[^/]+)$/i,
  ];
  for (const pattern of patterns) {
    const match = remote.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function normalizeHttpsOrigin(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function walk(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

function operationalFiles(allFiles) {
  const rootFiles = new Set([
    "package.json",
    "vercel.json",
    "vite.config.ts",
    "vite.config.js",
    "capacitor.config.ts",
    "capacitor.config.js",
    "capacitor.config.json",
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.preview",
    ".env.example",
  ]);
  return allFiles.filter((absolute) => {
    const file = normalizedRelative(absolute);
    const top = file.split("/")[0];
    if ([".github", ".kaheel", "scripts", "src", "supabase"].includes(top)) return true;
    return rootFiles.has(file);
  });
}

function readEnvironmentFiles() {
  const values = new Map();
  for (const name of [
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".env.preview",
  ]) {
    const path = resolve(ROOT, name);
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const rawLine of text.split(/\r?\n/u)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!values.has(match[1])) values.set(match[1], value);
    }
  }
  return values;
}

const fileEnvironment = readEnvironmentFiles();
function environmentValue(name) {
  const processValue = process.env[name];
  if (typeof processValue === "string" && processValue.trim()) return processValue.trim();
  return fileEnvironment.get(name)?.trim() || null;
}

const authority = readJson(AUTHORITY_PATH, ".kaheel/project-authority.json");
if (authority) {
  const expected = [
    [authority.schema_version, 1, "schema_version"],
    [authority.repository?.full_name, LOCKED.repositoryFullName, "repository.full_name"],
    [String(authority.repository?.id ?? ""), LOCKED.repositoryId, "repository.id"],
    [authority.repository?.default_branch, LOCKED.defaultBranch, "repository.default_branch"],
    [authority.supabase?.project_ref, LOCKED.supabaseProjectRef, "supabase.project_ref"],
    [authority.supabase?.origin, LOCKED.supabaseOrigin, "supabase.origin"],
    [authority.supabase?.config_path, "supabase/config.toml", "supabase.config_path"],
    [authority.deployment?.public_origin, LOCKED.publicOrigin, "deployment.public_origin"],
    [authority.deployment?.vercel?.project_id, LOCKED.vercelProjectId, "deployment.vercel.project_id"],
    [authority.deployment?.vercel?.org_id, LOCKED.vercelOrgId, "deployment.vercel.org_id"],
    [authority.deployment?.vercel?.git_provider, LOCKED.vercelGitProvider, "deployment.vercel.git_provider"],
    [authority.deployment?.vercel?.git_owner, LOCKED.vercelGitOwner, "deployment.vercel.git_owner"],
    [authority.deployment?.vercel?.git_repository, LOCKED.vercelGitRepository, "deployment.vercel.git_repository"],
    [String(authority.deployment?.vercel?.git_repository_id ?? ""), LOCKED.vercelGitRepositoryId, "deployment.vercel.git_repository_id"],
    [authority.deployment?.vercel?.production_host, LOCKED.vercelProductionHost, "deployment.vercel.production_host"],
    [authority.native?.application_id, LOCKED.nativeApplicationId, "native.application_id"],
  ];
  for (const [actual, locked, label] of expected) {
    if (actual !== locked) report(`${label} must remain locked to ${locked}`);
  }
  for (const policy of [
    "allow_unknown_ci",
    "allow_additional_git_remotes",
    "allow_additional_supabase_configs",
    "allow_unapproved_supabase_origins",
    "allow_unapproved_native_application_ids",
  ]) {
    if (authority.policy?.[policy] !== false) report(`policy.${policy} must remain false`);
  }
}

const allFiles = walk(ROOT);
const relativeFiles = allFiles.map(normalizedRelative);

if (relativeFiles.includes(".gitmodules")) {
  report("Git submodules are forbidden because they introduce an additional repository source");
}

const packageFiles = relativeFiles.filter((file) => file === "package.json" || file.endsWith("/package.json"));
if (packageFiles.length !== 1 || packageFiles[0] !== "package.json") {
  report(`exactly one root package.json is allowed; found: ${packageFiles.join(", ") || "none"}`);
}
const packageJson = readJson(resolve(ROOT, "package.json"), "package.json");
if (packageJson?.workspaces && (Array.isArray(packageJson.workspaces) ? packageJson.workspaces.length : true)) {
  report("package.json workspaces are forbidden until explicitly approved; they can create duplicate applications");
}
if (packageJson?.repository) {
  const configuredRepository =
    typeof packageJson.repository === "string" ? packageJson.repository : packageJson.repository.url;
  if (normalizeRepositoryUrl(configuredRepository) !== LOCKED.repositoryFullName) {
    report("package.json repository must point only to the canonical KAHEELProject repository");
  }
}

const supabaseConfigs = relativeFiles.filter((file) => file.endsWith("supabase/config.toml"));
if (supabaseConfigs.length !== 1 || supabaseConfigs[0] !== "supabase/config.toml") {
  report(`exactly one Supabase config is allowed at supabase/config.toml; found: ${supabaseConfigs.join(", ") || "none"}`);
} else {
  const config = readFileSync(resolve(ROOT, supabaseConfigs[0]), "utf8");
  const ref = config.match(/^\s*project_id\s*=\s*["']([a-z0-9]+)["']/mu)?.[1];
  if (ref !== LOCKED.supabaseProjectRef) {
    report(`supabase/config.toml must use project ${LOCKED.supabaseProjectRef}`);
  }
}

const capacitorConfigs = relativeFiles.filter((file) => /(?:^|\/)capacitor\.config\.(?:ts|js|mjs|cjs|json)$/u.test(file));
if (capacitorConfigs.length > 1 || (capacitorConfigs.length === 1 && !capacitorConfigs[0].startsWith("capacitor.config."))) {
  report(`only one root Capacitor config is allowed; found: ${capacitorConfigs.join(", ")}`);
}
if (capacitorConfigs.length === 1) {
  const capacitor = readFileSync(resolve(ROOT, capacitorConfigs[0]), "utf8");
  const appId = capacitor.match(/\bappId\s*:\s*["']([^"']+)["']/u)?.[1];
  if (appId !== LOCKED.nativeApplicationId) {
    report(`Capacitor appId must remain ${LOCKED.nativeApplicationId}`);
  }
}

for (const file of operationalFiles(allFiles)) {
  const relativeFile = normalizedRelative(file);
  const extension = extname(relativeFile).toLowerCase();
  if (!textExtensions.has(extension) && !relativeFile.startsWith(".env")) continue;
  if (lstatSync(file).size > 2_000_000) continue;
  const text = readFileSync(file, "utf8");

  for (const match of text.matchAll(/https:\/\/([a-z0-9]{20})\.supabase\.co/giu)) {
    if (match[1] !== LOCKED.supabaseProjectRef) {
      report(`${relativeFile} references unapproved Supabase project ${match[1]}`);
    }
  }
  for (const match of text.matchAll(/(?:supabase[_-]?)?(?:project[_-]?(?:id|ref))\s*[:=]\s*["']([a-z0-9]{20})["']/giu)) {
    if (match[1] !== LOCKED.supabaseProjectRef) {
      report(`${relativeFile} assigns unapproved Supabase project ${match[1]}`);
    }
  }
  for (const match of text.matchAll(/(?:https?:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)1127410650\/([A-Za-z0-9_.-]+)/giu)) {
    const repositoryName = match[1].replace(/\.git$/iu, "");
    if (repositoryName !== LOCKED.vercelGitRepository) {
      report(`${relativeFile} references non-canonical repository 1127410650/${repositoryName}`);
    }
  }
}

const browserSupabaseClients = relativeFiles.filter((file) =>
  /^src\/.*supabase.*client\.(?:ts|tsx|js|jsx|mjs|cjs)$/iu.test(file),
);
for (const file of browserSupabaseClients) {
  if (file !== "src/integrations/supabase/client.ts") {
    report(`${file} duplicates the canonical browser Supabase client`);
  }
}

function inspectGitRemotes({ required }) {
  try {
    const names = execFileSync("git", ["remote"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
    if (names.length !== 1 || names[0] !== "origin") {
      report(`only one Git remote named origin is allowed; found: ${names.join(", ") || "none"}`);
      return true;
    }
    const urls = execFileSync("git", ["remote", "get-url", "--all", "origin"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/u)
      .map((value) => value.trim())
      .filter(Boolean);
    if (!urls.length) report("origin has no Git URL");
    for (const url of urls) {
      if (normalizeRepositoryUrl(url) !== LOCKED.repositoryFullName) {
        report(`origin points to a non-canonical repository: ${url}`);
      }
    }
    return true;
  } catch {
    if (required) report("the canonical Git checkout and origin remote could not be verified");
    return false;
  }
}

const hasGitRepository = inspectGitRemotes({ required: false });

if (!STATIC_ONLY) {
  const githubRepository = environmentValue("GITHUB_REPOSITORY");
  const githubRepositoryId = environmentValue("GITHUB_REPOSITORY_ID");
  const isGithubActions = Boolean(githubRepository || environmentValue("GITHUB_ACTIONS") === "true");
  if (isGithubActions) {
    if (githubRepository !== LOCKED.repositoryFullName) {
      report(`GitHub Actions repository must be ${LOCKED.repositoryFullName}`);
    }
    if (githubRepositoryId && githubRepositoryId !== LOCKED.repositoryId) {
      report(`GitHub repository id must be ${LOCKED.repositoryId}`);
    }
  }

  const isVercel = Boolean(
    environmentValue("VERCEL") === "1" ||
      environmentValue("VERCEL_PROJECT_ID") ||
      environmentValue("VERCEL_ENV") ||
      environmentValue("VERCEL_URL"),
  );
  if (isVercel) {
    if (environmentValue("VERCEL_PROJECT_ID") !== LOCKED.vercelProjectId) {
      report(
        `Vercel project id must be ${LOCKED.vercelProjectId}; enable Automatically expose System Environment Variables for this project`,
      );
    }
    const orgId = environmentValue("VERCEL_ORG_ID");
    if (orgId && orgId !== LOCKED.vercelOrgId) {
      report(`Vercel org id must be ${LOCKED.vercelOrgId}`);
    }
    if (environmentValue("VERCEL_GIT_PROVIDER") !== LOCKED.vercelGitProvider) {
      report(`Vercel Git provider must be ${LOCKED.vercelGitProvider}`);
    }
    if (environmentValue("VERCEL_GIT_REPO_OWNER") !== LOCKED.vercelGitOwner) {
      report(`Vercel must be connected to GitHub owner ${LOCKED.vercelGitOwner}`);
    }
    if (environmentValue("VERCEL_GIT_REPO_SLUG") !== LOCKED.vercelGitRepository) {
      report(`Vercel must be connected only to repository ${LOCKED.vercelGitRepository}`);
    }
    if (String(environmentValue("VERCEL_GIT_REPO_ID") ?? "") !== LOCKED.vercelGitRepositoryId) {
      report(`Vercel Git repository id must be ${LOCKED.vercelGitRepositoryId}`);
    }
    const productionUrl = environmentValue("VERCEL_PROJECT_PRODUCTION_URL");
    if (!productionUrl) {
      report("Vercel must expose VERCEL_PROJECT_PRODUCTION_URL for project identity verification");
    } else if (normalizeHttpsOrigin(productionUrl) !== LOCKED.publicOrigin) {
      report(`Vercel production URL must remain ${LOCKED.publicOrigin}`);
    }
  }

  const isCi = ["1", "true"].includes(String(environmentValue("CI") ?? "").toLowerCase());
  if (isCi && !isGithubActions && !isVercel) {
    report("unknown CI/build platform is blocked; only canonical GitHub Actions and canonical Vercel are approved");
  }
  if (!isGithubActions && !isVercel && !isCi && !hasGitRepository) {
    report("build outside an approved platform requires a local checkout with the canonical Git origin");
  }

  const supabaseUrlVariables = [
    "VITE_SUPABASE_URL",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "PUBLIC_SUPABASE_URL",
  ];
  let hasRuntimeSupabaseUrl = false;
  for (const name of supabaseUrlVariables) {
    const value = environmentValue(name);
    if (!value) continue;
    hasRuntimeSupabaseUrl = true;
    if (normalizeHttpsOrigin(value) !== LOCKED.supabaseOrigin) {
      report(`${name} must point only to ${LOCKED.supabaseOrigin}`);
    }
  }

  for (const name of [
    "VITE_SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_ID",
    "SUPABASE_PROJECT_REF",
  ]) {
    const value = environmentValue(name);
    if (value && value !== LOCKED.supabaseProjectRef) {
      report(`${name} must be ${LOCKED.supabaseProjectRef}`);
    }
  }

  for (const name of ["VITE_SITE_ORIGIN", "SITE_ORIGIN", "MOBILE_APP_ORIGIN"]) {
    const value = environmentValue(name);
    if (value && normalizeHttpsOrigin(value) !== LOCKED.publicOrigin) {
      report(`${name} must remain ${LOCKED.publicOrigin}`);
    }
  }

  for (const name of [
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "PUBLIC_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "VITE_SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_SUPABASE_SECRET_KEY",
    "PUBLIC_SUPABASE_SECRET_KEY",
  ]) {
    const value = environmentValue(name);
    if (!value) continue;
    if (name.includes("SERVICE_ROLE") || name.includes("SECRET_KEY") || value.startsWith("sb_secret_")) {
      report(`${name} exposes a forbidden Supabase admin/secret key to client or build output`);
    }
  }

  if (REQUIRE_RUNTIME && !hasRuntimeSupabaseUrl) {
    report(`runtime/build must explicitly provide ${LOCKED.supabaseOrigin} through an approved Supabase URL variable`);
  }
}

const androidGradle = resolve(ROOT, "android/app/build.gradle");
if (existsSync(androidGradle)) {
  const gradle = readFileSync(androidGradle, "utf8");
  for (const match of gradle.matchAll(/\bapplicationId\s+["']([^"']+)["']/gu)) {
    if (match[1] !== LOCKED.nativeApplicationId) {
      report(`Android applicationId must remain ${LOCKED.nativeApplicationId}`);
    }
  }
}
const xcodeProject = resolve(ROOT, "ios/App/App.xcodeproj/project.pbxproj");
if (existsSync(xcodeProject)) {
  const project = readFileSync(xcodeProject, "utf8");
  for (const match of project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/gu)) {
    const bundleId = match[1].trim().replace(/^"|"$/gu, "");
    if (!bundleId.includes("$(") && bundleId !== LOCKED.nativeApplicationId) {
      report(`iOS PRODUCT_BUNDLE_IDENTIFIER must remain ${LOCKED.nativeApplicationId}`);
    }
  }
}

if (findings.length) {
  console.error("KAHEEL project authority check failed:");
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  console.error("Build, install, migration, deployment, signing, and publishing are blocked.");
  process.exit(1);
}

console.log(
  `KAHEEL authority verified: ${LOCKED.repositoryFullName} / Supabase ${LOCKED.supabaseProjectRef}${
    STATIC_ONLY ? " / static source" : REQUIRE_RUNTIME ? " / runtime identity" : ""
  }.`,
);
