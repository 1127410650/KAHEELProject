/**
 * صفحة عالم القسم المولّدة من القالب: هيرو بفتحة صورة، بطاقات الأقسام الفرعية
 * بصور خلفية كبيرة، فلاتر أفقية، ثم صفّا «مميزة» و«الأحدث».
 *
 * كل الصور تأتي من فتحات `mkt_media_slots` التي تُنشأ تلقائيًا مع ترقية القسم
 * (`world.{slug}.hero` و`world.{slug}.sub.{childSlug}`) وتُدار من
 * `/admin/appearance` — فلا صورة مكتوبة في الكود لأي قسم.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ListingCard, type ListingCardData } from "@/components/marketplace/ListingCard";
import { SectionHead } from "@/components/marketplace/home/noon/NoonKit";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { categoryName, childrenOf, type CategoryNode } from "@/lib/mkt-category-tree";
import { slotAlt, slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";
import { loadListings } from "@/lib/mkt-queries";
import { PageBlocks, type BlockOverrides } from "@/components/marketplace/composer/PageBlocks";
import { str, usePageBlocks } from "@/lib/mkt-page-composer";

const HERO_FALLBACK = "/images/market/world-hero.svg";
const SUB_FALLBACK = "/images/market/world-sub.svg";

export function CategoryWorldPage({
  world,
  tree,
}: {
  world: CategoryNode;
  tree: CategoryNode[];
}) {
  const { locale } = useI18n();
  const lang = locale === "ar" ? "ar" : "en";
  const slots = useMediaSlots();
  const subs = useMemo(() => childrenOf(tree, world.id), [tree, world.id]);
  const [activeSub, setActiveSub] = useState<string>("");

  const scopeIds = activeSub ? [activeSub] : [world.id, ...subs.map((s) => s.id)];

  const featured = useQuery({
    queryKey: ["mkt", "world", world.slug, "featured", activeSub, lang],
    staleTime: 120_000,
    queryFn: () => loadListings({ categoryIds: scopeIds, featuredOnly: true, limit: 8 }, lang),
  });
  const newest = useQuery({
    queryKey: ["mkt", "world", world.slug, "newest", activeSub, lang],
    staleTime: 120_000,
    queryFn: () => loadListings({ categoryIds: scopeIds, sort: "newest", limit: 12 }, lang),
  });

  const heroUrl = slotUrl(slots.data, `world.${world.slug}.hero`, HERO_FALLBACK);
  const composed = usePageBlocks("category.world");
  const blocks = composed.data ?? [];

  /* أقسام الصفحة تُعرَّف مرة واحدة، ويستخدمها المسارَان: التركيب المكتوب في
     الكود، والتأليف من /admin/composer (قالب واحد لكل عوالم الأقسام). */
  const heroSection = (
    <section data-kslot={`world.${world.slug}.hero`} className="px-4 pt-3">
      <div className="relative overflow-hidden rounded-[var(--r-card)] border border-border">
        <img
          src={heroUrl}
          alt={slotAlt(slots.data, `world.${world.slug}.hero`, categoryName(world, locale))}
          className="h-40 w-full object-cover sm:h-56"
          loading="eager"
          decoding="async"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="absolute inset-x-4 bottom-3">
          <h1 className="text-page font-extrabold text-white drop-shadow-md">
            {categoryName(world, locale)}
          </h1>
          {world.tagline_ar ? (
            <p className="mt-1 line-clamp-2 text-desc font-semibold text-white/90">
              {world.tagline_ar}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );

  const chipsNav =
    subs.length > 0 ? (
      <nav
        aria-label="فلاتر القسم"
        className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
      >
        {[{ id: "", label: "الكل" }, ...subs.map((s) => ({ id: s.id, label: categoryName(s, locale) }))].map(
          (chip) => (
            <button
              key={chip.id || "all"}
              type="button"
              onClick={() => setActiveSub(chip.id)}
              className={
                activeSub === chip.id
                  ? "min-h-[44px] shrink-0 rounded-full bg-primary px-4 text-desc font-bold text-primary-foreground"
                  : "min-h-[44px] shrink-0 rounded-full border border-border bg-card px-4 text-desc font-semibold text-foreground hover:bg-accent"
              }
            >
              {chip.label}
            </button>
          ),
        )}
      </nav>
    ) : null;

  const subsGrid =
    subs.length > 0 ? (
      <section className="px-4 py-3">
        <h2 className="mb-2 text-section font-extrabold text-foreground">تصفّح الأقسام الفرعية</h2>
        <ul className="grid grid-cols-2 gap-3">
          {subs.map((sub, index) => {
            const key = `world.${world.slug}.sub.${sub.slug}`;
            const wide = subs.length % 2 === 1 && index === subs.length - 1;
            return (
              <li key={sub.id} className={wide ? "col-span-2" : ""}>
                <a
                  data-kslot={key}
                  href={`/categories/${sub.slug}`}
                  className="k-lift relative block overflow-hidden rounded-[var(--r-card)] border border-border"
                >
                  <img
                    src={slotUrl(slots.data, key, SUB_FALLBACK)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`w-full object-cover ${wide ? "h-36" : "h-28"}`}
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
                  <strong className="absolute inset-x-3 bottom-2 text-section font-extrabold text-white drop-shadow-md">
                    {categoryName(sub, locale)}
                  </strong>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  const overrides: BlockOverrides = {
    hero_image: () => heroSection,
    hero_gradient: () => heroSection,
    category_grid: () => (
      <>
        {chipsNav}
        {subsGrid}
      </>
    ),
    listing_rail: (block) => {
      const featuredRow = str(block.settings, "source", "newest") === "featured";
      return (
        <WorldRow
          id={`world-${world.slug}-${featuredRow ? "featured" : "newest"}`}
          title={str(block.settings, "title_ar", featuredRow ? "إعلانات مميزة" : "الأحدث في القسم")}
          href={`/search?category=${world.slug}`}
          rows={(featuredRow ? featured.data : newest.data) ?? []}
          loading={featuredRow ? featured.isLoading : newest.isLoading}
        />
      );
    },
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {blocks.length > 0 ? (
        <PageBlocks blocks={blocks} overrides={overrides} />
      ) : (
        <>
          {heroSection}
          {chipsNav}
          {subsGrid}

          <WorldRow
            id={`world-${world.slug}-featured`}
            title="إعلانات مميزة"
            href={`/search?category=${world.slug}`}
            rows={featured.data ?? []}
            loading={featured.isLoading}
          />
          <WorldRow
            id={`world-${world.slug}-newest`}
            title="الأحدث في القسم"
            href={`/search?category=${world.slug}`}
            rows={newest.data ?? []}
            loading={newest.isLoading}
          />
        </>
      )}
    </div>
  );
}


function WorldRow({
  id,
  title,
  href,
  rows,
  loading,
}: {
  id: string;
  title: string;
  href: string;
  rows: ListingCardData[];
  loading: boolean;
}) {
  if (!loading && rows.length === 0) return null;
  return (
    <section aria-labelledby={id} className="px-4 py-3">
      <SectionHead id={id} title={title} href={href} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)
          : rows.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
      </div>
    </section>
  );
}
