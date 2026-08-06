import {
  MOBILE_PASSWORD_RECOVERY_PATH,
  MOBILE_PUBLIC_ORIGIN,
} from "@/lib/mobile-origin";
import {
  hideNativePrivacyShield,
  showNativePrivacyShield,
} from "@/lib/mobile-privacy";
import { isNativePlatform } from "@/lib/native-platform";

const APPROVED_ORIGIN = MOBILE_PUBLIC_ORIGIN;
const MAX_DEEP_LINK_LENGTH = 4096;
const MAX_AUTH_CODE_LENGTH = 2048;
const FORBIDDEN_URL_CREDENTIALS = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
];

type Cleanup = () => void;

function containsUrlCredential(url: URL): boolean {
  for (const key of FORBIDDEN_URL_CREDENTIALS) {
    if (url.searchParams.has(key)) return true;
  }

  const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  const fragmentParams = new URLSearchParams(fragment);
  return FORBIDDEN_URL_CREDENTIALS.some((key) => fragmentParams.has(key));
}

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
    if (containsUrlCredential(url)) return null;
    return url;
  } catch {
    return null;
  }
}

function validPkceCode(value: string): boolean {
  return (
    value.length >= 16 &&
    value.length <= MAX_AUTH_CODE_LENGTH &&
    /^[A-Za-z0-9._~-]+$/u.test(value)
  );
}

async function exchangeRecoveryCode(url: URL): Promise<void> {
  const code = url.searchParams.get("code");
  if (!code) return;

  url.searchParams.delete("code");

  if (url.pathname !== MOBILE_PASSWORD_RECOVERY_PATH || !validPkceCode(code)) return;

  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    // Keep recovery failures generic and never log the single-use code.
  }
}

function navigateInsideSignedBundle(approved: URL): void {
  const localTarget = `${approved.pathname}${approved.search}${approved.hash}`;
  const currentTarget = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (localTarget === currentTarget) return;

  window.history.replaceState(window.history.state, "", localTarget);
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

async function handleApprovedDeepLink(rawUrl: string): Promise<void> {
  const approved = approvedDeepLink(rawUrl);
  if (!approved) return;

  await exchangeRecoveryCode(approved);
  navigateInsideSignedBundle(approved);
}

export async function initializeNativeSecurity(): Promise<Cleanup> {
  if (!isNativePlatform()) return () => undefined;

  const { App } = await import("@capacitor/app");

  const launch = await App.getLaunchUrl();
  if (launch?.url) await handleApprovedDeepLink(launch.url);

  const appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
    void handleApprovedDeepLink(url);
  });

  const appStateListener = await App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) hideNativePrivacyShield();
    else showNativePrivacyShield();
  });

  const pauseListener = await App.addListener("pause", showNativePrivacyShield);
  const resumeListener = await App.addListener("resume", hideNativePrivacyShield);

  return () => {
    hideNativePrivacyShield();
    void appUrlListener.remove();
    void appStateListener.remove();
    void pauseListener.remove();
    void resumeListener.remove();
  };
}
