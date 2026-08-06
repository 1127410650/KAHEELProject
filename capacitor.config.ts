import type { CapacitorConfig } from "@capacitor/cli";

// Release builds intentionally refuse preview, local-network, and alternate origins.
const PRODUCTION_ORIGIN = "https://check-your-name-ai.vercel.app";
const configuredOrigin = process.env.MOBILE_APP_ORIGIN?.trim() || PRODUCTION_ORIGIN;
const appOrigin = new URL(configuredOrigin);

if (appOrigin.protocol !== "https:") {
  throw new Error("MOBILE_APP_ORIGIN must use HTTPS.");
}

if (appOrigin.origin !== PRODUCTION_ORIGIN) {
  throw new Error(`MOBILE_APP_ORIGIN is not approved: ${appOrigin.origin}`);
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
    webContentsDebuggingEnabled: false,
  },
  ios: {
    allowsLinkPreview: false,
    limitsNavigationsToAppBoundDomains: true,
    webContentsDebuggingEnabled: false,
  },
  includePlugins: [
    "@capacitor/app",
    "@capacitor/keyboard",
    "@capacitor/status-bar",
    "capacitor-secure-storage-plugin",
  ],
};

export default config;
