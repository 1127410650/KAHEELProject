import { isNativePlatform } from "@/lib/native-platform";
import { approvedMobileDeepLink } from "@/lib/mobile-url-policy";

type Cleanup = () => void;

export async function initializeNativeSecurity(): Promise<Cleanup> {
  if (!isNativePlatform()) return () => undefined;

  const activeOrigin = window.location.origin;
  const { App } = await import("@capacitor/app");
  const appUrlListener = await App.addListener("appUrlOpen", ({ url }) => {
    const approved = approvedMobileDeepLink(url, activeOrigin);
    if (!approved) return;

    // Use the already-validated absolute URL. Reconstructing it from a pathname
    // could accidentally interpret a path beginning with // as a new host.
    window.location.assign(approved.href);
  });

  return () => {
    void appUrlListener.remove();
  };
}
