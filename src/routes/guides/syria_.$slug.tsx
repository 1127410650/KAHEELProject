import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, Clock, Globe, Mail, MapPin, Star } from "lucide-react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { GuidePlaceActions, GuidePlaceBadges } from "@/components/marketplace/GuidePlaceCard";
import { GuidePlaceCommunity } from "@/components/marketplace/guide/GuidePlaceCommunity";
import { GuideBookingButton } from "@/components/marketplace/guide/GuideBookingButton";
import { GuideDirectoryNotice } from "@/components/marketplace/guide/GuideDirectoryNotice";
import { OsmAttribution } from "@/components/marketplace/guide/OsmAttribution";

import { fetchGuidePlace, websiteHref } from "@/lib/mkt-guide-places";
import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/guides/syria_/$slug")({
  ssr: "data-only",
  head: ({ params }) => ({
    meta: [
      { title: "جهة في دليل سوريا — كَحيل" },
      { name: "description", content: "بيانات الجهة ومصادرها وطرق التواصل والاتجاهات." },
      ...canonicalMeta(`/guides/syria/${params.slug}`),
    ],
    links: canonicalLinks(`/guides/syria/${params.slug}`),
  }),
  component: GuidePlacePage,
});

function GuidePlacePage() {
  const { slug } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["guide-place", slug],
    queryFn: () => fetchGuidePlace(slug),
  });

  const site = data ? websiteHref(data) : null;
  const location = data
    ? data.address || [data.district, data.city, data.governorate].filter(Boolean).join(" · ")
    : "";

  return (
    <MarketShell>
      <main className="mx-auto w-full max-w-[860px] px-3 py-3 sm:px-5 sm:py-4">
        {/* سطر تنقّل خفيف — لا بطاقة كبيرة */}
        <nav
          aria-label="مسار التنقّل"
          className="mb-2.5 flex items-center gap-1 text-desc font-bold text-muted-foreground"
        >
          <Link to="/guides/syria" className="inline-flex items-center gap-1 hover:text-market-navy">
            <ArrowRight className="size-3" aria-hidden />
            دليل سوريا
          </Link>
          <ChevronLeft className="size-3 opacity-60" aria-hidden />
          <span className="truncate text-foreground">{data?.name_ar ?? "…"}</span>
        </nav>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-muted/40" />
        ) : error ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-desc font-bold text-destructive">
            تعذّر تحميل بيانات الجهة، حاول لاحقًا.
          </p>
        ) : !data ? (
          <p className="rounded-2xl border border-border bg-card p-4 text-desc font-bold text-muted-foreground">
            هذه الجهة غير متوفرة في الدليل.
          </p>
        ) : (
          <article className="space-y-2.5">
            <GuideDirectoryNotice
              placeName={data.name_ar}
              placeSlug={data.slug}
              onClaim={() =>
                document
                  .getElementById("guide-claim")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
            />

            {/* بطاقة واحدة مضغوطة: الاسم + التصنيف + العنوان والتواصل */}
            <section className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="text-xl font-black leading-tight sm:text-[26px]">{data.name_ar}</h1>
                  {data.name_en ? (
                    <p className="mt-0.5 text-desc font-bold text-muted-foreground">{data.name_en}</p>
                  ) : null}
                  <p className="mt-1 text-desc font-bold text-market-navy-soft">
                    {[data.sector, data.category, data.subcategory].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <GuidePlaceBadges place={data} />
              </div>

              <dl className="mt-2.5 grid gap-1.5 border-t border-border/60 pt-2.5 text-desc leading-5 sm:grid-cols-2">
                <Row icon={<MapPin className="size-3.5" aria-hidden />} label="العنوان" value={location} />
                {data.opening_hours ? (
                  <Row
                    icon={<Clock className="size-3.5" aria-hidden />}
                    label="أوقات الدوام"
                    value={data.opening_hours}
                  />
                ) : null}
                {site ? (
                  <Row
                    icon={<Globe className="size-3.5" aria-hidden />}
                    label="الموقع الإلكتروني"
                    value={data.website ?? site}
                    href={site}
                  />
                ) : null}
                {data.email ? (
                  <Row
                    icon={<Mail className="size-3.5" aria-hidden />}
                    label="البريد"
                    value={data.email}
                    href={`mailto:${data.email}`}
                  />
                ) : null}
                {/* 0 stars means "unrated" in the imported registry, not a real score. */}
                {data.stars !== null && data.stars > 0 ? (
                  <Row
                    icon={<Star className="size-3.5" aria-hidden />}
                    label="التقييم"
                    value={`${data.stars} نجوم`}
                  />
                ) : null}
              </dl>

              <div className="mt-2.5 border-t border-border/60 pt-2.5">
                <GuideBookingButton place={data} />
                <div className="mt-2">
                  <GuidePlaceActions place={data} />
                </div>
              </div>
            </section>

            <GuidePlaceCommunity placeId={data.id} placeName={data.name_ar} />

            <section className="rounded-2xl border border-border/80 bg-card p-3.5 text-desc leading-5 sm:p-4">
              <h2 className="mb-1.5 text-desc font-black">المصدر والتحقق</h2>
              <p className="text-muted-foreground">
                {[data.source_label, data.source_type, data.source_date].filter(Boolean).join(" · ") ||
                  "لا يوجد مصدر منشور لهذا السجل."}
              </p>
              {data.notes ? <p className="mt-1.5 text-muted-foreground">{data.notes}</p> : null}
              <OsmAttribution className="mt-2" />
            </section>
          </article>
        )}
      </main>
    </MarketShell>
  );
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-0.5 text-market-navy">{icon}</span>
      <div className="min-w-0">
        <dt className="font-black">{label}</dt>
        <dd className="break-words text-muted-foreground">
          {href ? (
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer noopener nofollow"
              className="underline decoration-dotted underline-offset-2 hover:text-market-navy"
            >
              {value}
            </a>
          ) : (
            value
          )}
        </dd>
      </div>
    </div>
  );
}
