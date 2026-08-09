/**
 * sitemap.xml — built on the server, from the canonical site origin only.
 *
 * `robots.txt` allows full indexing but the site had no sitemap, so new public
 * URLs (6.6k guide records, listings, stores, profiles) were left to be found
 * by crawling alone. Only public, indexable paths are listed: anything behind
 * a guard or marked `noindex` is deliberately absent.
 */
import { supabasePublicConfig } from "@/integrations/supabase/public-config";
import { SITE_ORIGIN } from "@/lib/share-links";

/** Static public pages, in rough order of importance. */
const STATIC_PATHS = [
  "/",
  "/search",
  "/services",
  "/guides/syria",
  "/guides/students",
  "/about",
  "/help",
] as const;

const MAX_ROWS_PER_SET = 5000;

interface SitemapEntry {
  path: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
}

async function selectRows<T>(
  table: string,
  query: string,
): Promise<T[]> {
  const url = `${supabasePublicConfig.url}/rest/v1/${table}?${query}&limit=${MAX_ROWS_PER_SET}`;
  const response = await fetch(url, {
    headers: {
      apikey: supabasePublicConfig.publishableKey,
      accept: "application/json",
    },
  });
  if (!response.ok) return [];
  return (await response.json()) as T[];
}

async function dynamicEntries(): Promise<SitemapEntry[]> {
  const [guides, listings, stores] = await Promise.all([
    selectRows<{ slug: string }>("mkt_guide_places", "select=slug&is_published=eq.true"),
    selectRows<{ slug: string }>("mkt_listings", "select=slug&status=eq.published"),
    selectRows<{ slug: string }>("mkt_storefronts", "select=slug&status=eq.published"),
  ]);

  return [
    ...guides.map((row) => entry(`/guides/syria/${row.slug}`, "monthly", "0.5")),
    ...listings.map((row) => entry(`/ads/${row.slug}`, "daily", "0.7")),
    ...stores.map((row) => entry(`/stores/${row.slug}`, "weekly", "0.6")),
  ];
}

function entry(
  path: string,
  changefreq: SitemapEntry["changefreq"],
  priority: string,
): SitemapEntry {
  return { path, changefreq, priority };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function render(entries: SitemapEntry[]): string {
  const body = entries
    .map(
      (item) =>
        `  <url><loc>${escapeXml(`${SITE_ORIGIN}${item.path === "/" ? "" : item.path}`)}</loc>` +
        `<changefreq>${item.changefreq}</changefreq><priority>${item.priority}</priority></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/** Full sitemap response; a data failure still returns the static pages. */
export async function sitemapResponse(): Promise<Response> {
  const statics = STATIC_PATHS.map((path) =>
    entry(path, path === "/" ? "daily" : "weekly", path === "/" ? "1.0" : "0.8"),
  );

  let dynamic: SitemapEntry[] = [];
  try {
    dynamic = await dynamicEntries();
  } catch (error) {
    console.error("[sitemap] dynamic entries unavailable", error);
  }

  const seen = new Set<string>();
  const entries = [...statics, ...dynamic].filter((item) => {
    if (seen.has(item.path)) return false;
    seen.add(item.path);
    return true;
  });

  return new Response(render(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
