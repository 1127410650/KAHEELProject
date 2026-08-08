// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Keep this check in Vite itself so direct `vite build`/`vite dev` invocations
// cannot bypass the package-script guard used by CI, Vercel, and Lovable.
for (const script of [
  "./scripts/check-canonical-repository.mjs",
  "./scripts/check-canonical-infrastructure.mjs",
]) {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL(script, import.meta.url)), "--require-runtime"],
    {
      stdio: "inherit",
    },
  );
}

export default defineConfig({
  // Vercel auto-detects its deployment preset. Local builds use a runnable
  // Node server so `npm run preview` exercises the actual Nitro output.
  nitro: process.env["VERCEL"] === "1" ? true : { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
