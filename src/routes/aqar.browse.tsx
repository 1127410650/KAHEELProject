/**
 * صفحة البحث والفلترة في «كَحيل عقار»: نتائج شبكية مع فلاتر أفقية للمدينة والحي
 * والسعر، وحالة الفلترة كلها في معاملات البحث ليكون الرابط قابلًا للمشاركة.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { Search } from "lucide-react";
import { z } from "zod";

import { AqarFilterBar, priceRangeFor } from "@/components/marketplace/aqar/AqarFilterBar";
import { AqarListingCard } from "@/components/marketplace/aqar/AqarListingCard";
import { AqarShell } from "@/components/marketplace/aqar/AqarShell";
import { AqarTrackTabs } from "@/components/marketplace/aqar/AqarTrackTabs";
import { useAqarFavorites } from "@/lib/aqar-favorites";
import { AQAR_TYPE_LABELS, DEFAULT_AQAR_IMAGERY } from "@/lib/aqar-imagery";
import {
  fetchAqarListings,
  fetchAqarPlaces,
  fetchAqarUsdRate,
  isAqarTrack,
  type AqarQuery,
  type AqarTrack,
} from "@/lib/mkt-aqar";

const searchSchema = z.object({
  track: fallback(z.string(), "daily_rent").default("daily_rent"),
  type: fallback(z.string(), "").default(""),
  city: fallback(z.string(), "").default(""),
  district: fallback(z.string(), "").default(""),
  price: fallback(z.string(), "any").default("any"),
  q: fallback(z.string(), "").default(""),
});

type AqarSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/aqar/browse")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "بحث العقارات — كَحيل عقار" },
      {
        name: "description",
        content: "ابحث وفلتر العقارات في سوريا حسب المدينة والحي ونوع العقار ومدى السعر.",
      },
      { property: "og:title", content: "بحث العقارات — كَحيل عقار" },
      {
        property: "og:description",
        content: "فلترة العقارات حسب المدينة والحي والنوع والسعر على كَحيل عقار.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AqarBrowsePage,
});

function AqarBrowsePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/aqar/browse" });
  const { ids, toggle } = useAqarFavorites();

  const track: AqarTrack = isAqarTrack(search.track) ? search.track : "daily_rent";
  const typeCard = DEFAULT_AQAR_IMAGERY.types.find((card) => card.key === search.type);
  const types = typeCard ? [typeCard.key, ...(typeCard.also ?? [])] : undefined;
  const range = priceRangeFor(search.price);
  const term = search.q.trim().slice(0, 80).toLowerCase();

  const query: AqarQuery = {
    track,
    limit: 60,
    ...(types ? { types } : {}),
    ...(search.city ? { city: search.city } : {}),
    ...(search.district ? { district: search.district } : {}),
    ...(typeof range.min === "number" ? { minPrice: range.min } : {}),
    ...(typeof range.max === "number" ? { maxPrice: range.max } : {}),
  };

  const places = useQuery({
    queryKey: ["aqar", "places", track],
    queryFn: () => fetchAqarPlaces(track),
  });
  const usdRate = useQuery({
    queryKey: ["aqar", "usd-rate"],
    queryFn: fetchAqarUsdRate,
    staleTime: 5 * 60 * 1000,
  });
  const listings = useQuery({
    queryKey: ["aqar", "browse", query],
    queryFn: () => fetchAqarListings(query),
  });

  // البحث النصّي يُطبَّق على النتائج المُحمَّلة: العنوان والمدينة والحي.
  const rows = (listings.data ?? []).filter((listing) =>
    term
      ? `${listing.title} ${listing.city} ${listing.district}`.toLowerCase().includes(term)
      : true,
  );

  const hasFilters = Boolean(search.city || search.district || search.type) || search.price !== "any";

  return (
    <AqarShell
      title="بحث العقارات"
      subtitle={typeCard ? AQAR_TYPE_LABELS[typeCard.key] : "كل الأنواع"}
      back="/aqar"
      backLabel="عقار"
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="px-4 pt-4">
          <label className="flex items-center gap-2 rounded-full border border-border bg-card px-4">
            <Search className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">البحث في العقارات</span>
            <input
              type="search"
              value={search.q}
              onChange={(event) =>
                void navigate({ search: (prev: AqarSearch) => ({ ...prev, q: event.target.value }) })
              }
              placeholder="مدينة، حي، أو عنوان الإعلان"
              className="w-full border-0 bg-transparent py-3 text-body text-foreground outline-none placeholder:text-muted-foreground"
              style={{ minHeight: 44 }}
            />
          </label>
        </div>

        <div className="pt-3">
          <AqarTrackTabs
            track={track}
            onChange={(next) =>
              void navigate({ search: (prev: AqarSearch) => ({ ...prev, track: next, district: "" }) })
            }
          />
        </div>

        <AqarFilterBar
          cities={places.data?.cities ?? []}
          districts={search.city ? (places.data?.districtsByCity[search.city] ?? []) : []}
          city={search.city || "all"}
          district={search.district || "all"}
          priceKey={search.price}
          hasFilters={hasFilters}
          onChange={(patch) => void navigate({ search: (prev: AqarSearch) => ({ ...prev, ...patch }) })}
          onReset={() =>
            void navigate({
              search: (prev: AqarSearch) => ({ ...prev, city: "", district: "", type: "", price: "any" }),
            })
          }
        />

        <p className="px-4 pb-2 text-desc text-muted-foreground">
          {listings.isPending
            ? "جارٍ التحميل…"
            : `${rows.length.toLocaleString("en-US")} إعلان مطابق`}
        </p>

        {rows.length === 0 && !listings.isPending ? (
          <p className="px-4 pb-8 text-body text-foreground">
            لا نتائج مطابقة. جرّب توسيع مدى السعر أو إزالة فلتر المدينة.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 px-4 pb-8 sm:grid-cols-2">
            {rows.map((listing) => (
              <li key={listing.id}>
                <AqarListingCard
                  listing={listing}
                  usdRate={usdRate.data ?? null}
                  isFavorite={ids.includes(listing.id)}
                  onToggleFavorite={toggle}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AqarShell>
  );
}
