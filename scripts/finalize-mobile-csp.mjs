import { existsSync, readFileSync, writeFileSync } from "node:fs";

const indexPath = "dist/client/index.html";
const requireNativeAssets = process.env.MOBILE_NATIVE_ASSETS_REQUIRED === "1";

if (!requireNativeAssets) {
  process.exit(0);
}

if (!existsSync(indexPath)) {
  throw new Error(`${indexPath} is required before finalizing the native Content Security Policy.`);
}

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
if (!rawSupabaseUrl) {
  throw new Error("VITE_SUPABASE_URL is required to finalize the native Content Security Policy.");
}

const supabaseUrl = new URL(rawSupabaseUrl);
if (
  supabaseUrl.protocol !== "https:" ||
  supabaseUrl.username ||
  supabaseUrl.password ||
  (supabaseUrl.port && supabaseUrl.port !== "443")
) {
  throw new Error("The native Content Security Policy requires a credential-free HTTPS Supabase origin.");
}

const realtimeUrl = new URL(supabaseUrl);
realtimeUrl.protocol = "wss:";

const policy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl.origin} ${realtimeUrl.origin}`,
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

if (policy.includes("unsafe-eval")) {
  throw new Error("Native Content Security Policy must never allow unsafe-eval.");
}

let html = readFileSync(indexPath, "utf8");
const cspMetaPattern = /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/giu;
const existing = html.match(cspMetaPattern) ?? [];
if (existing.length > 1) {
  throw new Error("Generated native index contains multiple Content Security Policy meta elements.");
}

const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
if (existing.length === 1) {
  html = html.replace(cspMetaPattern, meta);
} else {
  const headPattern = /<head(?:\s[^>]*)?>/iu;
  const head = html.match(headPattern)?.[0];
  if (!head) throw new Error("Generated native index has no head element for CSP injection.");
  html = html.replace(headPattern, `${head}\n    ${meta}`);
}

const finalMatches = html.match(cspMetaPattern) ?? [];
if (finalMatches.length !== 1) {
  throw new Error("Native Content Security Policy finalization did not produce exactly one meta element.");
}
for (const required of [
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  `connect-src 'self' ${supabaseUrl.origin} ${realtimeUrl.origin}`,
]) {
  if (!html.includes(required)) {
    throw new Error(`Final native Content Security Policy is missing: ${required}`);
  }
}

writeFileSync(indexPath, html);
console.log(`Native Content Security Policy finalized for ${supabaseUrl.origin}.`);
