import { isNativePlatform } from "@/lib/native-platform";

const APPROVED_ORIGIN = "https://check-your-name-ai.vercel.app";
const MAX_DEEP_LINK_LENGTH = 4096;

type Cleanup = () => void;

function approvedDeepLink(rawUrl: string): URL | null {
  if (!rawUrl || rawUrl.length > MAX_DEEP_LINK_LENGTH) return null;
  if (/[\u0000-\u001F\u007F]/u.test(rawUrl)) return null;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.origin !== APPROVED_ORIGIN) return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    if (url.pathname.startsWith("//") || url.pathname.includes("\\")) return null;
    return url;
  } catch {
    return null;
  }
}

function navigateToApprovedDeepLink(rawUrl: string): void {
  const approved = approvedDeepLink(rawUrl);
  if (!approved) return;

  // Keep the signed application bundle loaded. Only copy the validated route
  // into the local Capacitor origin; never navigate the WebView to remote code.
  const localTarget = `${approved.pathname}${approved.search}${approved.hash}`;
  const currentTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (localTarget === currentTarget) return;

  window.history.replaceState(window.history.state, "", localTarget);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

export async function initializeNativeSecurity(): Promise<Cleanup> {
  if (!isNativePlatform()) return () => undefined;

  const { App } = await import("@capacitor/app");

  const launch = await App.getLaunchUrl();
  if (launch?.url) navigateToApprovedDeepLink(launch.url);

  const appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
    navigateToApprovedDeepLink(url);
  });

  return () => {
    void appUrlListener.remove();
  };
}
