import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const binaryExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".ttf",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const findings = [];

function report(file, reason) {
  findings.push({ file, reason });
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function inspectText(file, content) {
  if (/sb_secret_[A-Za-z0-9._-]{16,}/g.test(content)) {
    report(file, "contains a Supabase secret API key");
  }

  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g.test(content)) {
    report(file, "contains private key material");
  }

  if (/^\s*VITE_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PRIVATE|PASSWORD)[A-Z0-9_]*\s*=/gim.test(content)) {
    report(file, "exposes a secret-looking value through a VITE_ client variable");
  }

  const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
  for (const token of content.match(jwtPattern) ?? []) {
    const payload = decodeJwtPayload(token);
    if (payload?.role === "service_role" || payload?.role === "supabase_admin") {
      report(file, "contains a privileged Supabase JWT");
      break;
    }
  }
}

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

for (const file of trackedFiles) {
  if (binaryExtensions.has(extname(file).toLowerCase())) continue;
  try {
    inspectText(file, readFileSync(file, "utf8"));
  } catch {
    // Unreadable or non-text tracked files are ignored by this text-only check.
  }
}

const capacitorConfig = readFileSync("capacitor.config.ts", "utf8");
for (const [pattern, reason] of [
  [/cleartext\s*:\s*true/, "enables cleartext traffic"],
  [/allowMixedContent\s*:\s*true/, "enables mixed HTTP/HTTPS content"],
  [/webContentsDebuggingEnabled\s*:\s*true/, "enables WebView debugging"],
  [/loggingBehavior\s*:\s*["']debug["']/, "enables native debug logging"],
  [/allowNavigation\s*:\s*\[\s*["']\*["']\s*\]/, "allows navigation to every origin"],
  [
    /limitsNavigationsToAppBoundDomains\s*:\s*false/,
    "disables the iOS app-bound-domain restriction",
  ],
]) {
  if (pattern.test(capacitorConfig)) report("capacitor.config.ts", reason);
}

for (const requiredSetting of [
  'loggingBehavior: "none"',
  "cleartext: false",
  "allowMixedContent: false",
  "webContentsDebuggingEnabled: false",
  "limitsNavigationsToAppBoundDomains: true",
]) {
  if (!capacitorConfig.includes(requiredSetting)) {
    report("capacitor.config.ts", `is missing required setting: ${requiredSetting}`);
  }
}

const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
const responseHeaders = new Map(
  (vercelConfig.headers ?? [])
    .flatMap((rule) => rule.headers ?? [])
    .map((header) => [header.key.toLowerCase(), header.value]),
);

for (const requiredHeader of [
  "strict-transport-security",
  "content-security-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
]) {
  if (!responseHeaders.has(requiredHeader)) {
    report("vercel.json", `is missing required security header: ${requiredHeader}`);
  }
}

const contentSecurityPolicy = responseHeaders.get("content-security-policy") ?? "";
for (const requiredDirective of [
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
]) {
  if (!contentSecurityPolicy.includes(requiredDirective)) {
    report("vercel.json", `CSP is missing required directive: ${requiredDirective}`);
  }
}

if (/script-src[^;]*https:/i.test(contentSecurityPolicy)) {
  report("vercel.json", "CSP allows scripts from arbitrary HTTPS origins");
}
if (contentSecurityPolicy.includes("'unsafe-eval'")) {
  report("vercel.json", "CSP enables unsafe JavaScript evaluation");
}

const permissionsPolicy = responseHeaders.get("permissions-policy") ?? "";
for (const deniedCapability of ["camera=()", "microphone=()", "payment=()", "usb=()"] ) {
  if (!permissionsPolicy.includes(deniedCapability)) {
    report("vercel.json", `Permissions-Policy does not deny ${deniedCapability}`);
  }
}

const configuredOrigin = process.env.MOBILE_APP_ORIGIN;
if (configuredOrigin && configuredOrigin !== "https://check-your-name-ai.vercel.app") {
  report("environment", "sets MOBILE_APP_ORIGIN to an unapproved origin");
}

if (findings.length > 0) {
  console.error("Client security check failed:");
  for (const finding of findings) console.error(`- ${finding.file}: ${finding.reason}`);
  process.exit(1);
}

console.log("Client security check passed.");
