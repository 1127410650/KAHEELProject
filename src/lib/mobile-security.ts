import { isNativePlatform } from "@/lib/native-platform";

const APPROVED_ORIGIN = "https://check-your-name-ai.vercel.app";

type Cleanup = () => void;

function approvedDeepLink(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.origin !== APPROVED_ORIGIN) return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    return url;
  } catch {
    return null;
  }
}

export async function initializeNativeSecurity(): Promise<Cleanup> {
  if (!isNativePlatform()) return () => undefined;

  const { App } = await import("@capacitor/app");
  const appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
    const approved = approvedDeepLink(url);
    if (!approved) return;

    // Use the already-validated absolute URL. Reconstructing it from a pathname
    // could accidentally interpret a path beginning with // as a new host.
    window.location.assign(approved.href);
  });

  return () => {
    void appUrlListener.remove();
  };
}
