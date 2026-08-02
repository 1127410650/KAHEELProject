/**
 * Opening an ad's location without shipping a map into the page.
 *
 * An approximate ad only ever hands out a rounded point (about a kilometre of
 * uncertainty) and a wide zoom, so the exact pin the advertiser kept private is
 * never reconstructable from the link. OpenStreetMap is the target: free, no
 * key, and phones hand the link to the installed map app when they have one.
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

export function locationLink(input: LocationLinkInput): LocationLink | null {
  const hasPoint = input.latitude !== null && input.longitude !== null;
  const exact = input.visibility === "exact";

  if (hasPoint && exact) {
    const lat = input.latitude!.toFixed(6);
    const lng = input.longitude!.toFixed(6);
    return {
      href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
      precision: "exact",
    };
  }

  if (hasPoint) {
    const lat = blur(input.latitude!).toFixed(2);
    const lng = blur(input.longitude!).toFixed(2);
    return {
      href: `https://www.openstreetmap.org/#map=13/${lat}/${lng}`,
      precision: "approximate",
    };
  }

  const query = [input.district, input.city, input.country].filter(Boolean).join(", ");
  if (!query) return null;
  return {
    href: `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`,
    precision: "place",
  };
}
