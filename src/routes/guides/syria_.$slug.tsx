import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Mail, MapPin, Star } from "lucide-react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import { GuidePlaceActions, GuidePlaceBadges } from "@/components/marketplace/GuidePlaceCard";
import { fetchGuidePlace } from "@/lib/mkt-guide-places";
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

  return (
    <MarketShell>
      <main className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">
        <Link
          to="/guides/syria"
          className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-black text-market-navy"
        >
          <ArrowRight className="size-3.5" aria-hidden />
          دليل سوريا
        </Link>

        {isLoading ? (
          <div className="h-40 animate-pulse rounded-3xl border border-border bg-muted/40" />
        ) : error ? (
          <p className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5 text-sm font-bold text-destructive">
            تعذّر تحميل بيانات الجهة، حاول لاحقًا.
          </p>
        ) : !data ? (
          <p className="rounded-3xl border border-border bg-card p-5 text-sm font-bold text-muted-foreground">
            هذه الجهة غير متوفرة في الدليل.
          </p>
        ) : (
          <article className="space-y-5">
            <header className="rounded-3xl border border-border/80 bg-gradient-to-l from-market-navy to-market-navy-soft p-5 text-white sm:p-7">
              <GuidePlaceBadges place={data} />
              <h1 className="mt-3 text-2xl font-black sm:text-3xl">{data.name_ar}</h1>
              {data.name_en ? <p className="mt-1 text-sm text-white/75">{data.name_en}</p> : null}
              <p className="mt-3 text-[12px] font-bold text-white/85">
                {[data.sector, data.category, data.subcategory].filter(Boolean).join(" · ")}
              </p>
            </header>

            <section className="rounded-3xl border border-border/80 bg-card p-5 sm:p-6">
              <h2 className="mb-3 text-sm font-black">الموقع والتواصل</h2>
              <dl className="space-y-2.5 text-[12px] leading-7">
                <Row
                  icon={<MapPin className="size-3.5" aria-hidden />}
                  label="العنوان"
                  value={
                    data.address ||
                    [data.district, data.city, data.governorate].filter(Boolean).join(" · ")
                  }
                />
                {data.opening_hours ? (
                  <Row
                    icon={<Clock className="size-3.5" aria-hidden />}
                    label="أوقات الدوام"
                    value={data.opening_hours}
                  />
                ) : null}
                {data.email ? (
                  <Row
                    icon={<Mail className="size-3.5" aria-hidden />}
                    label="البريد"
                    value={data.email}
                  />
                ) : null}
                {data.stars !== null ? (
                  <Row
                    icon={<Star className="size-3.5" aria-hidden />}
                    label="التقييم"
                    value={String(data.stars)}
                  />
                ) : null}
              </dl>
              <div className="mt-4">
                <GuidePlaceActions place={data} />
              </div>
            </section>

            <section className="rounded-3xl border border-border/80 bg-card p-5 text-[12px] leading-7 sm:p-6">
              <h2 className="mb-2 text-sm font-black">المصدر والتحقق</h2>
              <p className="text-muted-foreground">
                {[data.source_label, data.source_type, data.source_date].filter(Boolean).join(" · ") ||
                  "لا يوجد مصدر منشور لهذا السجل."}
              </p>
              {data.notes ? <p className="mt-2 text-muted-foreground">{data.notes}</p> : null}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 text-market-navy">{icon}</span>
      <div>
        <dt className="font-black">{label}</dt>
        <dd className="text-muted-foreground">{value}</dd>
      </div>
    </div>
  );
}

export { notFound };
