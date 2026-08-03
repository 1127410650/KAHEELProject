/**
 * Canonical share links.
 *
 * Sharing must never leak a preview/temporary host: every URL is rebuilt from
 * the canonical site origin plus the path, dropping query strings and hashes so
 * two visitors always share the same address.
 */
export const SITE_ORIGIN = "https://check-your-name-ai.lovable.app";

/** Canonical absolute URL for an internal path (query/hash stripped). */
export function canonicalUrl(path: string): string {
  const clean = (path.split("#")[0] ?? "").split("?")[0] ?? "";
  const withSlash = clean.startsWith("/") ? clean : `/${clean}`;
  return `${SITE_ORIGIN}${withSlash === "/" ? "" : withSlash.replace(/\/+$/, "")}`;
}

/** Canonical URL of the page currently open (safe during SSR). */
export function canonicalCurrentUrl(): string {
  if (typeof window === "undefined") return SITE_ORIGIN;
  return canonicalUrl(window.location.pathname);
}

export function shareTargets(title: string, url: string) {
  const text = `${title} — ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`,
  };
}
