import { execFileSync } from "node:child_process";

const EXPECTED_REPOSITORY = "1127410650/KAHEELProject";
const EXPECTED_REPOSITORY_ID = "1318292196";
const EXPECTED_PROVIDER = "github";

function fail(message) {
  console.error(`KAHEEL canonical repository check failed: ${message}`);
  process.exit(1);
}

function normalizeRepository(value) {
  const remote = String(value ?? "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\.git\/?$/, "")
    .replace(/\/$/, "");

  const httpsMatch = remote.match(/^https:\/\/(?:[^@/]+@)?github\.com\/([^/]+\/[^/]+)$/i);
  if (httpsMatch) return httpsMatch[1];

  const sshMatch = remote.match(/^git@github\.com:([^/]+\/[^/]+)$/i);
  if (sshMatch) return sshMatch[1];

  const sshUrlMatch = remote.match(/^ssh:\/\/(?:git@)?github\.com\/([^/]+\/[^/]+)$/i);
  if (sshUrlMatch) return sshUrlMatch[1];

  if (/^[^/\s]+\/[^/\s]+$/.test(remote)) return remote;
  return null;
}

function assertRepository(label, value) {
  const repository = normalizeRepository(value);
  if (!repository) fail(`${label} is missing or is not a recognized GitHub repository`);
  if (repository.toLowerCase() !== EXPECTED_REPOSITORY.toLowerCase()) {
    fail(`${label} points to ${repository}; only ${EXPECTED_REPOSITORY} is approved`);
  }
  evidence.push(`${label}: ${EXPECTED_REPOSITORY}`);
}

function assertRepositoryId(label, value) {
  const repositoryId = String(value ?? "").trim();
  if (!repositoryId) fail(`${label} is missing`);
  if (repositoryId !== EXPECTED_REPOSITORY_ID) {
    fail(`${label} is ${repositoryId}; only ${EXPECTED_REPOSITORY_ID} is approved`);
  }
  evidence.push(`${label}: ${EXPECTED_REPOSITORY_ID}`);
}

const evidence = [];
const githubContext =
  process.env.GITHUB_ACTIONS === "true" ||
  Boolean(process.env.GITHUB_REPOSITORY) ||
  Boolean(process.env.GITHUB_REPOSITORY_ID);

if (githubContext) {
  assertRepository("GITHUB_REPOSITORY", process.env.GITHUB_REPOSITORY);
  assertRepositoryId("GITHUB_REPOSITORY_ID", process.env.GITHUB_REPOSITORY_ID);
}

const vercelContext =
  process.env.VERCEL === "1" ||
  Boolean(process.env.VERCEL_GIT_PROVIDER) ||
  Boolean(process.env.VERCEL_GIT_REPO_OWNER) ||
  Boolean(process.env.VERCEL_GIT_REPO_SLUG) ||
  Boolean(process.env.VERCEL_GIT_REPO_ID);

if (vercelContext) {
  const provider = process.env.VERCEL_GIT_PROVIDER?.trim().toLowerCase();
  if (provider !== EXPECTED_PROVIDER) {
    fail(`VERCEL_GIT_PROVIDER must be ${EXPECTED_PROVIDER}, received ${provider || "missing"}`);
  }

  const owner = process.env.VERCEL_GIT_REPO_OWNER?.trim();
  const slug = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  assertRepository("Vercel Git repository", owner && slug ? `${owner}/${slug}` : null);
  assertRepositoryId("VERCEL_GIT_REPO_ID", process.env.VERCEL_GIT_REPO_ID);
}

if (process.env.GITLAB_CI === "true") {
  fail("GitLab CI is not an approved source for this project");
}

if (process.env.BITBUCKET_BUILD_NUMBER) {
  fail("Bitbucket Pipelines is not an approved source for this project");
}

for (const [label, value] of [
  ["CI_REPOSITORY_URL", process.env.CI_REPOSITORY_URL],
  ["CIRCLE_REPOSITORY_URL", process.env.CIRCLE_REPOSITORY_URL],
  ["BUILDKITE_REPO", process.env.BUILDKITE_REPO],
  ["REPOSITORY_URL", process.env.REPOSITORY_URL],
  ["BUILD_REPOSITORY_URI", process.env.BUILD_REPOSITORY_URI],
]) {
  if (value) assertRepository(label, value);
}

try {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  assertRepository("local origin", remote);
} catch (error) {
  if (evidence.length === 0) {
    fail("no canonical repository evidence was available from CI, Vercel, or local Git");
  }
  if (error?.status === 1) {
    fail("the local Git origin conflicts with the approved repository");
  }
}

if (evidence.length === 0) {
  fail("no canonical repository evidence was available");
}

console.log(
  `KAHEEL canonical repository verified: ${EXPECTED_REPOSITORY} (${EXPECTED_REPOSITORY_ID})`,
);
