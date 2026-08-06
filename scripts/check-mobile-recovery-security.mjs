import "./check-native-platform-baseline.mjs";
import { readFileSync } from "node:fs";

const findings = [];

function read(file) {
  return readFileSync(file, "utf8");
}

function requirePattern(file, content, pattern, reason) {
  if (!pattern.test(content)) findings.push(`${file}: ${reason}`);
}

function rejectPattern(file, content, pattern, reason) {
  if (pattern.test(content)) findings.push(`${file}: ${reason}`);
}

const originFile = read("src/lib/mobile-origin.ts");
for (const [pattern, reason] of [
  [/MOBILE_PUBLIC_ORIGIN\s*=\s*"https:\/\/check-your-name-ai\.vercel\.app"/, "does not pin the reviewed HTTPS public origin"],
  [/MOBILE_PASSWORD_RECOVERY_PATH\s*=\s*"\/reset-password"/, "does not pin the reviewed recovery path"],
  [/MOBILE_PASSWORD_RECOVERY_REDIRECT/, "does not expose the reviewed recovery redirect"],
]) {
  requirePattern("src/lib/mobile-origin.ts", originFile, pattern, reason);
}
rejectPattern(
  "src/lib/mobile-origin.ts",
  originFile,
  /localhost|127\.0\.0\.1|http:\/\//,
  "contains a local or cleartext recovery origin",
);

const forgotPassword = read("src/routes/forgot-password.tsx");
for (const [pattern, reason] of [
  [/isNativePlatform\(\)/, "does not distinguish the native recovery flow"],
  [/MOBILE_PASSWORD_RECOVERY_REDIRECT/, "does not use the approved native recovery redirect"],
  [/new URL\("\/reset-password", window\.location\.origin\)\.href/, "does not preserve the normal web recovery redirect"],
]) {
  requirePattern("src/routes/forgot-password.tsx", forgotPassword, pattern, reason);
}
rejectPattern(
  "src/routes/forgot-password.tsx",
  forgotPassword,
  /`\$\{window\.location\.origin\}\/reset-password`/,
  "uses the local Capacitor origin for password recovery",
);

const mobileSecurity = read("src/lib/mobile-security.ts");
for (const [pattern, reason] of [
  [/FORBIDDEN_URL_CREDENTIALS/, "does not define forbidden URL credentials"],
  [/"access_token"/, "does not reject access tokens in deep links"],
  [/"refresh_token"/, "does not reject refresh tokens in deep links"],
  [/MAX_AUTH_CODE_LENGTH/, "does not cap authorization-code length"],
  [/url\.searchParams\.delete\("code"\)/, "does not remove authorization codes before local navigation"],
  [/url\.pathname\s*!==\s*MOBILE_PASSWORD_RECOVERY_PATH/, "does not restrict recovery-code exchange to the recovery path"],
  [/exchangeCodeForSession\(code\)/, "does not exchange the PKCE recovery code explicitly"],
  [/await handleApprovedDeepLink\(launch\.url\)/, "does not complete cold-start recovery handling"],
  [/void handleApprovedDeepLink\(url\)/, "does not process runtime recovery links"],
]) {
  requirePattern("src/lib/mobile-security.ts", mobileSecurity, pattern, reason);
}
for (const [pattern, reason] of [
  [/console\.(?:log|info|warn|error)\([^)]*code/i, "logs a recovery authorization code"],
  [/window\.location\.(?:assign|replace)\s*\(/, "loads recovery content outside the signed local bundle"],
]) {
  rejectPattern("src/lib/mobile-security.ts", mobileSecurity, pattern, reason);
}

if (findings.length > 0) {
  console.error("Mobile recovery security check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Mobile recovery security check passed.");
