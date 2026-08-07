import { execFileSync } from "node:child_process";

const EXPECTED_REPOSITORY = "1127410650/KAHEELProject";
const EXPECTED_REPOSITORY_ID = "1318292196";

function normalizeRemote(value) {
  const remote = String(value ?? "").trim().replace(/\.git$/, "");
  const httpsMatch = remote.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)$/i);
  if (httpsMatch) return httpsMatch[1];
  const sshMatch = remote.match(/^git@github\.com:([^/]+\/[^/]+)$/i);
  if (sshMatch) return sshMatch[1];
  const sshUrlMatch = remote.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+)$/i);
  if (sshUrlMatch) return sshUrlMatch[1];
  return null;
}

function fail(message) {
  console.error(`KAHEEL canonical repository check failed: ${message}`);
  process.exit(1);
}

const ciRepository = process.env.GITHUB_REPOSITORY?.trim();
const ciRepositoryId = process.env.GITHUB_REPOSITORY_ID?.trim();

if (ciRepository) {
  if (ciRepository !== EXPECTED_REPOSITORY) {
    fail(`expected ${EXPECTED_REPOSITORY}, received ${ciRepository}`);
  }
  if (ciRepositoryId && ciRepositoryId !== EXPECTED_REPOSITORY_ID) {
    fail(`expected repository id ${EXPECTED_REPOSITORY_ID}, received ${ciRepositoryId}`);
  }
  console.log(`KAHEEL canonical repository verified in CI: ${EXPECTED_REPOSITORY}`);
  process.exit(0);
}

let remote;
try {
  remote = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
} catch {
  fail("unable to read the local origin remote");
}

const repository = normalizeRemote(remote);
if (!repository) fail("origin is not a recognized GitHub repository URL");
if (repository !== EXPECTED_REPOSITORY) {
  fail(`origin points to ${repository}; only ${EXPECTED_REPOSITORY} is approved`);
}

console.log(`KAHEEL canonical repository verified locally: ${EXPECTED_REPOSITORY}`);
