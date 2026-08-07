// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isNativeMobileBuild = process.env.MOBILE_NATIVE_BUILD === "1";

export default defineConfig({
  // The native SPA needs TanStack Start's own temporary server output at
  // dist/server/server.js while prerendering its local index.html shell.
  // Lovable's Nitro deploy adapter intentionally remains enabled for normal
  // web/SSR builds, but must not replace that server output in native builds.
  ...(isNativeMobileBuild ? { nitro: false } : {}),
  vite: {
    define: {
      __KAHLI_NATIVE_BUILD__: JSON.stringify(isNativeMobileBuild),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // The normal web deployment is still handled by nitro/vite.
    server: { entry: "server" },
    // Native binaries must contain their reviewed web code. SPA mode generates a
    // client-only index.html for Capacitor without changing the normal SSR build.
    ...(isNativeMobileBuild
      ? {
          spa: {
            enabled: true,
            prerender: {
              outputPath: "/index.html",
              crawlLinks: false,
              retryCount: 0,
            },
          },
        }
      : {}),
  },
});
