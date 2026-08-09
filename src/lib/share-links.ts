/**
 * Canonical share links.
 *
 * Sharing must never leak a preview/temporary host: every URL is rebuilt from
 * the canonical site origin plus the path, dropping query strings and hashes so
 * two visitors always share the same address.
 */
const configuredOrigin = String(import.meta.env["VITE_SITE_ORIGIN"] ?? "").trim();

/**
 * Vercel is the production source of truth. A custom domain can be supplied at
 * build time without changing code. The browser location is intentionally not
 * used here so copied links from local, Lovable or Vercel previews never leak a
 * temporary host.
 */
export const SITE_ORIGIN = (configuredOrigin || "https://check-your-name-ai.vercel.app").replace(
  /\/+$/,
  "",
);

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

/**
 * Canonical `<link>` + `og:url` for a public page.
 *
 * A page that can be reached with tracking parameters, a trailing slash, or a
 * retired alias must still declare ONE address, otherwise search engines split
 * its signals across variants. Leaf routes only: a canonical on the root route
 * would be concatenated into every page.
 */
export function canonicalHead(path: string): {
  links: { rel: string; href: string }[];
  meta: { property: string; content: string }[];
} {
  const href = canonicalUrl(path);
  return {
    links: [{ rel: "canonical", href }],
    meta: [{ property: "og:url", content: href }],
  };
}
