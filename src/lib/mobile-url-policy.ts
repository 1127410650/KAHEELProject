export const APPROVED_MOBILE_ORIGIN = "https://check-your-name-ai.vercel.app";

export function approvedMobileDeepLink(
  rawUrl: string,
  approvedOrigin = APPROVED_MOBILE_ORIGIN,
): URL | null {
  try {
    const expected = new URL(approvedOrigin);
    if (expected.protocol !== "https:" || expected.origin !== approvedOrigin) return null;
    if (expected.username || expected.password || (expected.port && expected.port !== "443")) {
      return null;
    }

    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    if (url.origin !== expected.origin) return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;
    return url;
  } catch {
    return null;
  }
}
