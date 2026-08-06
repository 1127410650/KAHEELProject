import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const REVIEW_BRANCH = "feat/mobile-ios-android-secure-foundation";
const REVIEW_DIR = "public/.well-known/mobile-review";
const REVIEW_OUTPUT = `${REVIEW_DIR}/package-lock.json`;
const CHECKSUM_OUTPUT = `${REVIEW_OUTPUT}.sha256`;
const MODE_OUTPUT = `${REVIEW_DIR}/generation-mode.txt`;
const PEER_ERROR_OUTPUT = `${REVIEW_DIR}/npm-peer-resolution-error.txt`;
const NPM_REGISTRY = "https://registry.npmjs.org/";

const isApprovedReviewBuild =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === REVIEW_BRANCH;

if (!isApprovedReviewBuild) {
  console.log("Skipping temporary package-lock export outside the approved Vercel preview branch.");
  process.exit(0);
}

mkdirSync(REVIEW_DIR, { recursive: true });

const npmEnv = {
  ...process.env,
  npm_config_registry: NPM_REGISTRY,
  npm_config_ignore_scripts: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_color: "false",
};

function runLockGeneration(extraArgs = []) {
  return spawnSync(
    "npm",
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      `--registry=${NPM_REGISTRY}`,
      ...extraArgs,
    ],
    {
      encoding: "utf8",
      env: npmEnv,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
}

function sanitizedFailure(result) {
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    .replaceAll(process.cwd(), "<workspace>")
    .replace(/(npm_[A-Za-z0-9_]*(?:token|password|auth)[A-Za-z0-9_]*=)[^\s]+/gi, "$1<redacted>")
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, "$1<redacted>@")
    .trim();
  return `${combined.slice(0, 100_000)}\n`;
}

let mode = "standard";
let result = runLockGeneration();

if (result.status !== 0) {
  writeFileSync(PEER_ERROR_OUTPUT, sanitizedFailure(result));
  if (existsSync("package-lock.json")) rmSync("package-lock.json");

  mode = "legacy-peer-deps-for-diagnosis-only";
  result = runLockGeneration(["--legacy-peer-deps"]);
  if (result.status !== 0) {
    throw new Error(`Fallback lock generation failed:\n${sanitizedFailure(result)}`);
  }
} else if (existsSync(PEER_ERROR_OUTPUT)) {
  rmSync(PEER_ERROR_OUTPUT);
}

const lockText = readFileSync("package-lock.json", "utf8");
const lock = JSON.parse(lockText);
const root = lock.packages?.[""];

if (lock.lockfileVersion !== 3 || !root) {
  throw new Error("Generated package-lock.json is not an npm lockfile v3 with a root package.");
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const section of ["dependencies", "devDependencies"]) {
  const expected = packageJson[section] ?? {};
  const actual = root[section] ?? {};
  for (const [name, version] of Object.entries(expected)) {
    if (actual[name] !== version) {
      throw new Error(`Generated lock root does not preserve ${section}.${name}=${version}.`);
    }
  }
}

const requiredMobilePackages = {
  "node_modules/@capacitor/android": "7.6.8",
  "node_modules/@capacitor/app": "7.1.2",
  "node_modules/@capacitor/cli": "7.6.8",
  "node_modules/@capacitor/core": "7.6.8",
  "node_modules/@capacitor/ios": "7.6.8",
  "node_modules/@capacitor/preferences": "7.0.4",
  "node_modules/capacitor-secure-storage-plugin": "0.13.0",
};

for (const [path, version] of Object.entries(requiredMobilePackages)) {
  if (lock.packages[path]?.version !== version) {
    throw new Error(`Generated lock is missing the reviewed ${path} version ${version}.`);
  }
}

writeFileSync(REVIEW_OUTPUT, lockText);
writeFileSync(MODE_OUTPUT, `${mode}\n`);
const checksum = createHash("sha256").update(lockText).digest("hex");
writeFileSync(CHECKSUM_OUTPUT, `${checksum}  package-lock.json\n`);
console.log(`Exported reviewed package lock (${mode}): ${checksum}`);
