/**
 * Opening an ad's location without shipping a map into the page.
 *
 * An approximate ad only ever hands out a rounded point (about a kilometre of
 * uncertainty) or a plain place search, so the exact pin the advertiser kept
 * private is never reconstructable from the link. The target is a plain Google
 * Maps URL — no API, no key — and phones hand it to the installed app.
 */

export interface LocationLinkInput {
  latitude: number | null;
  longitude: number | null;
  visibility: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
}

export interface LocationLink {
  href: string;
  precision: "exact" | "approximate" | "place";
}

/** Round to ~1 km so a hidden pin stays hidden. */
function blur(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapsSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function locationLink(input: LocationLinkInput): LocationLink | null {
  const hasPoint = input.latitude !== null && input.longitude !== null;
  const exact = input.visibility === "exact";

  if (hasPoint && exact) {
    return {
      href: mapsSearch(`${input.latitude!.toFixed(6)},${input.longitude!.toFixed(6)}`),
      precision: "exact",
    };
  }

  if (hasPoint) {
    return {
      href: mapsSearch(`${blur(input.latitude!).toFixed(2)},${blur(input.longitude!).toFixed(2)}`),
      precision: "approximate",
    };
  }

  const query = [input.district, input.city, input.country].filter(Boolean).join(" ");
  if (!query) return null;
  return { href: mapsSearch(query), precision: "place" };
}
