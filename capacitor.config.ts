import type { CapacitorConfig } from "@capacitor/cli";
import { resolveMobileOrigin } from "./scripts/mobile-origin-policy.mjs";

const appOrigin = resolveMobileOrigin();

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
  includePlugins: ["@capacitor/app", "@aparajita/capacitor-secure-storage"],
};

export default config;
