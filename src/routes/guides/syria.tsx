import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  TreePine,
} from "lucide-react";
import { useMemo, useState } from "react";

import { MarketShell } from "@/components/marketplace/MarketShell";
import {
  SYRIA_GUIDE_CATEGORIES,
  SYRIA_GUIDE_ENTITIES,
  searchSyriaGuide,
  type SyriaGuideCategory,
  type SyriaGuideEntity,
} from "@/lib/syria-guide-data";

import { canonicalLinks, canonicalMeta } from "@/lib/share-links";

export const Route = createFileRoute("/guides/syria")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "دليل سوريا — گحيل" },
      {
        name: "description",
        content: "دليل سوريا للجامعات والمشافي والجهات الحكومية والمعالم الأثرية والسياحية.",
      },
      { name: "robots", content: "index, follow" },
      ...canonicalMeta("/guides/syria"),
    ],
    links: canonicalLinks("/guides/syria"),
  }),
  component: SyriaGuidePage,
});

type CategoryFilter = "all" | SyriaGuideCategory;

function SyriaGuidePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const results = useMemo(() => searchSyriaGuide(query, category), [query, category]);

  return (
    <MarketShell>
      <main className="min-h-screen bg-[linear-gradient(180deg,#f4f8f6_0%,#ffffff_30%,#f8fafc_100%)] pb-8">
        <section className="relative isolate overflow-hidden bg-market-navy text-white">
          <img
            src="/images/syria-guide-flag.svg"
            alt="خلفية فنية مستوحاة من علم سوريا"
            className="absolute inset-0 size-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-market-navy/95 via-market-navy/72 to-market-navy/35" />
          <div className="relative mx-auto flex min-h-[310px] w-full max-w-[1240px] flex-col justify-end px-4 pb-8 pt-10 sm:min-h-[360px] sm:px-6 sm:pb-10 lg:px-8">
            <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black backdrop-blur sm:text-xs">
              <ShieldCheck className="size-4" aria-hidden />
              معلومات موثقة ومصادر ظاهرة
            </span>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">دليل سوريا</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82 sm:text-base sm:leading-8">
              جامعات، مشافٍ، جهات حكومية، معالم أثرية وأماكن سياحية ضمن دليل واحد واضح وسهل البحث.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold text-white/88 sm:text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {SYRIA_GUIDE_ENTITIES.length} جهة ومكان
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">خرائط واتجاهات</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">تفاصيل مطوية</span>
            </div>
          </div>
        </section>

        <section className="sticky top-[96px] z-20 border-b border-border/70 bg-background/94 shadow-sm backdrop-blur">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-3 sm:px-6 lg:px-8">
            <label className="relative block" htmlFor="syria-guide-search">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                id="syria-guide-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن جامعة، مشفى، دائرة أو معلم سياحي…"
                className="h-11 w-full rounded-2xl border border-input bg-background pe-4 ps-10 text-sm outline-none transition focus:border-market-navy focus:ring-2 focus:ring-market-navy/15"
              />
            </label>

            <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SYRIA_GUIDE_CATEGORIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  className={
                    category === option.id
                      ? "min-w-max rounded-full bg-market-navy px-3.5 py-2 text-[10px] font-black text-white shadow-sm sm:text-xs"
                      : "min-w-max rounded-full border border-border bg-card px-3.5 py-2 text-[10px] font-black text-muted-foreground transition hover:border-market-navy/30 hover:text-foreground sm:text-xs"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1240px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary sm:text-xs">
                <Sparkles className="size-3.5" aria-hidden />
                افتح البطاقة لقراءة التفاصيل
              </span>
              <h2 className="mt-1 text-xl font-black text-foreground sm:text-2xl">
                الجهات والأماكن
              </h2>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-[10px] font-black text-secondary-foreground sm:text-xs">
              {results.length} نتيجة
            </span>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-12 text-center">
              <Search className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <h3 className="mt-3 text-base font-black text-foreground">لم نجد نتيجة مطابقة</h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                جرّب اسم المدينة أو نوع الجهة بكلمة أقصر.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((entity) => (
                <GuideEntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          )}

          <div className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-[0_10px_35px_rgb(15_23_42/0.06)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-foreground">جهة غير موجودة؟</h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  سنضيف نموذج الاقتراح المباشر وربطه بتنبيهات المستخدم ولوحة مدير النظام في الدفعة
                  التالية.
                </p>
              </div>
              <Link
                to="/"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-market-navy/20 bg-market-navy/5 px-5 text-xs font-black text-market-navy"
              >
                العودة إلى الرئيسية
              </Link>
            </div>
          </div>
        </section>
      </main>
    </MarketShell>
  );
}

function GuideEntityCard({ entity }: { entity: SyriaGuideEntity }) {
  const icon = iconForCategory(entity.category);
  const googleMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entity.mapQuery)}`;
  const appleMaps = `https://maps.apple.com/?q=${encodeURIComponent(entity.mapQuery)}`;
  const embedMaps = `https://www.google.com/maps?q=${encodeURIComponent(entity.mapQuery)}&output=embed`;
  const primaryPhone = entity.phones?.[0];

  return (
    <details className="group overflow-hidden rounded-[1.6rem] border border-border bg-card shadow-[0_8px_28px_rgb(15_23_42/0.07)] open:shadow-[0_16px_42px_rgb(15_23_42/0.12)]">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div
          className={`relative h-40 overflow-hidden bg-gradient-to-br sm:h-48 ${gradientForCategory(entity.category)}`}
        >
          <div
            className="absolute -end-8 -top-8 size-40 rounded-full border border-white/15 bg-white/10 sm:size-48"
            aria-hidden
          />
          <div
            className="absolute end-7 top-7 text-white/18 transition duration-500 group-open:scale-110 sm:end-10 sm:top-8"
            aria-hidden
          >
            {largeIconForCategory(entity.category)}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/12 to-white/5" />
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-[9px] font-black backdrop-blur sm:text-[10px]">
                {icon}
                {labelForCategory(entity.category)}
              </span>
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-market-navy sm:text-[10px]">
                {entity.city}
              </span>
            </div>
            <h3 className="text-lg font-black leading-tight sm:text-xl">{entity.name}</h3>
            <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/80 sm:text-xs">
              {entity.shortDescription}
            </p>
            <div className="mt-3 flex items-center justify-between border-t border-white/18 pt-3 text-[10px] font-bold text-white/80">
              <span>اضغط لفتح التفاصيل</span>
              <ChevronDown
                className="size-4 transition duration-300 group-open:rotate-180"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </summary>

      <div className="space-y-3 p-4 sm:p-5">
        {entity.sections.map((section, index) => (
          <details
            key={`${entity.id}-${section.title}`}
            open={index === 0}
            className="rounded-2xl border border-border bg-background"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black text-foreground [&::-webkit-details-marker]:hidden sm:text-sm">
              {section.title}
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
            </summary>
            <p className="border-t border-border px-4 py-3 text-xs leading-7 text-muted-foreground sm:text-sm">
              {section.content}
            </p>
          </details>
        ))}

        <details className="overflow-hidden rounded-2xl border border-border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black text-foreground [&::-webkit-details-marker]:hidden sm:text-sm">
            الموقع والخريطة
            <MapPin className="size-4 text-market-navy" aria-hidden />
          </summary>
          <div className="border-t border-border p-3">
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              <iframe
                title={`خريطة ${entity.name}`}
                src={embedMaps}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-56 w-full border-0 sm:h-64"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a
                href={googleMaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-market-navy px-3 text-[10px] font-black text-white sm:text-xs"
              >
                <MapPin className="size-3.5" aria-hidden />
                Google Maps
              </a>
              <a
                href={appleMaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[10px] font-black text-foreground sm:text-xs"
              >
                <MapPin className="size-3.5" aria-hidden />
                Apple Maps
              </a>
            </div>
          </div>
        </details>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {primaryPhone ? (
            <a
              href={`tel:${primaryPhone.replace(/[^+\d]/g, "")}`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-market-navy px-2 text-[10px] font-black text-white sm:text-xs"
            >
              <Phone className="size-3.5" aria-hidden />
              اتصال
            </a>
          ) : null}
          {entity.website ? (
            <a
              href={entity.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-[10px] font-black text-foreground sm:text-xs"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              الموقع
            </a>
          ) : null}
          <a
            href={entity.sourceUrl}
            target="_blank"
            rel="noreferrer"
            title={entity.sourceLabel}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-2 text-[10px] font-black text-muted-foreground sm:text-xs"
          >
            <ShieldCheck className="size-3.5" aria-hidden />
            المصدر
          </a>
          <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-muted px-2 text-center text-[9px] font-bold text-muted-foreground sm:text-[10px]">
            تحقق: {entity.verifiedAt}
          </span>
        </div>
      </div>
    </details>
  );
}

function iconForCategory(category: SyriaGuideCategory) {
  if (category === "government") return <Building2 className="size-3.5" aria-hidden />;
  if (category === "hospital") return <Hospital className="size-3.5" aria-hidden />;
  if (category === "university") return <GraduationCap className="size-3.5" aria-hidden />;
  if (category === "heritage") return <Landmark className="size-3.5" aria-hidden />;
  return <TreePine className="size-3.5" aria-hidden />;
}

function largeIconForCategory(category: SyriaGuideCategory) {
  const className = "size-20 sm:size-24";
  if (category === "government") return <Building2 className={className} strokeWidth={1.15} />;
  if (category === "hospital") return <Hospital className={className} strokeWidth={1.15} />;
  if (category === "university") return <GraduationCap className={className} strokeWidth={1.15} />;
  if (category === "heritage") return <Landmark className={className} strokeWidth={1.15} />;
  return <TreePine className={className} strokeWidth={1.15} />;
}

function gradientForCategory(category: SyriaGuideCategory) {
  if (category === "government") return "from-[#0b183a] via-[#12366a] to-[#28739b]";
  if (category === "hospital") return "from-[#083344] via-[#0f766e] to-[#4e9d91]";
  if (category === "university") return "from-[#312e81] via-[#4f46a5] to-[#7c83d5]";
  if (category === "heritage") return "from-[#3f2b18] via-[#8a5a2b] to-[#c58b45]";
  return "from-[#12372a] via-[#1f6c4c] to-[#73a96c]";
}

function labelForCategory(category: SyriaGuideCategory) {
  if (category === "government") return "جهة حكومية";
  if (category === "hospital") return "مشفى";
  if (category === "university") return "جامعة";
  if (category === "heritage") return "معلم أثري";
  return "مكان سياحي";
}
