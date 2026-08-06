import type { CapacitorConfig } from "@capacitor/cli";

// Release builds intentionally refuse preview, local-network, alternate, and
// credential-bearing origins. A future custom production domain must be reviewed
// and changed here explicitly rather than injected at build time.
const PRODUCTION_ORIGIN = "https://check-your-name-ai.vercel.app";
const configuredOrigin = process.env.MOBILE_APP_ORIGIN?.trim() || PRODUCTION_ORIGIN;
const appOrigin = new URL(configuredOrigin);

if (appOrigin.protocol !== "https:") {
  throw new Error("MOBILE_APP_ORIGIN must use HTTPS.");
}

if (appOrigin.username || appOrigin.password) {
  throw new Error("MOBILE_APP_ORIGIN must not contain URL credentials.");
}

if (appOrigin.origin !== PRODUCTION_ORIGIN) {
  throw new Error(`MOBILE_APP_ORIGIN is not approved: ${appOrigin.origin}`);
}

if ((appOrigin.pathname && appOrigin.pathname !== "/") || appOrigin.search || appOrigin.hash) {
  throw new Error("MOBILE_APP_ORIGIN must be an origin only, without path, query, or fragment.");
}

const config: CapacitorConfig = {
  appId: "com.kahli.marketplace",
  appName: "Kahli",
  webDir: "mobile-shell",
  loggingBehavior: "none",
  zoomEnabled: false,
  server: {
    url: appOrigin.origin,
    cleartext: false,
    allowNavigation: [appOrigin.hostname],
    errorPath: "/offline.html",
  },
  android: {
    allowMixedContent: false,
    useLegacyBridge: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    allowsLinkPreview: false,
    limitsNavigationsToAppBoundDomains: true,
    webContentsDebuggingEnabled: false,
  },
  cordova: {
    failOnUninstalledPlugins: true,
  },
  includePlugins: [
    "@capacitor/app",
    "@capacitor/keyboard",
    "@capacitor/preferences",
    "@capacitor/status-bar",
    "capacitor-secure-storage-plugin",
  ],
};

export default config;
