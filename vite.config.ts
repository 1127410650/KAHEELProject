// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Lovable may opt previews into Vite's experimental full-bundle dev mode.
// This app relies on TanStack Start virtual modules and SSR, which currently
// fail during the first preview request in bundled-dev mode. Keep Lovable's
// stable classic dev pipeline until upstream virtual-module support is ready.
// Production builds (including Vercel) are unaffected by this preview-only opt-out.
if (process.env["LOVABLE_SANDBOX"] === "1") {
  process.env["LOVABLE_FEATURE_BUNDLED_DEV"] = "false";
}

// Lovable/Vercel integrations commonly expose the browser-safe Supabase
// values without the VITE_ prefix. Vite only embeds VITE_* variables in the
// client bundle, so normalise the two public values before Lovable's env
// injection plugin runs. Never map a secret/service-role key here.
const publicSupabaseUrl = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
const publicSupabaseKey =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

if (publicSupabaseKey?.startsWith("sb_secret_")) {
  throw new Error(
    "SUPABASE_PUBLISHABLE_KEY contains a secret key and cannot be embedded in the browser bundle.",
  );
}

if (publicSupabaseUrl) process.env["VITE_SUPABASE_URL"] = publicSupabaseUrl;
if (publicSupabaseKey) {
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] = publicSupabaseKey;
}

const publicSupabaseDefine: Record<string, string> = {};
if (publicSupabaseUrl) {
  publicSupabaseDefine["import.meta.env.VITE_SUPABASE_URL"] = JSON.stringify(publicSupabaseUrl);
}
if (publicSupabaseKey) {
  publicSupabaseDefine["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"] =
    JSON.stringify(publicSupabaseKey);
}

export default defineConfig({
  vite: { define: publicSupabaseDefine },
  // Vercel auto-detects its deployment preset. Local builds use a runnable
  // Node server so `npm run preview` exercises the actual Nitro output.
  nitro: process.env["VERCEL"] === "1" ? true : { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
