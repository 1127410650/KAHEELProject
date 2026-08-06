export const APPROVED_MOBILE_ORIGIN = "https://check-your-name-ai.vercel.app";

export function approvedMobileDeepLink(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.origin !== APPROVED_MOBILE_ORIGIN) return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    return url;
  } catch {
    return null;
  }
}
