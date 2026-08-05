import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = "https://check-your-name-ai.vercel.app";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || productionUrl;

const config: CapacitorConfig = {
  appId: "com.kahli.market",
  appName: "كحلي",
  webDir: "mobile-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    backgroundColor: "#071B33",
  },
  ios: {
    backgroundColor: "#071B33",
    contentInset: "automatic",
  },
};

export default config;
