/**
 * البنر الرئيسي المعتمد لكَحيل.
 *
 * • الخلفية تدرّج بالأخضر الغامق (#083A31 → #0D5646) مع لمستين دائريتين
 *   ضبابيتين بلون نعناعي (#DBEFE4) بشفافية منخفضة — بلا رسم توضيحي يدوي.
 * • إن رفع المالك صورة للفتحة `home.hero.banner` (من «إدارة المظهر») تظهر خلف
 *   التدرّج مع طبقة تعتيم تضمن تباين النص. رسم «سوريا فخرنا» الحالي بقي متاحًا
 *   كخيار افتراضي يُطبَّق بزر واحد من بطاقة رفع البنر.
 * • المحتوى مركزي بعرض أقصى 760px: شارة الهوية، عنوان، سطر فرعي، بطاقة بحث
 *   بيضاء عائمة، ثم كبسولات تصنيف سريع.
 * • النسبة والأبعاد محجوزة ⇒ صفر هزّة تخطيط.
 */
import { Link } from "@tanstack/react-router";
import { MapPin, Search } from "lucide-react";

import { useI18n } from "@/i18n";
import { slotAlt, slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";

export const HERO_SLOT_KEY = "home.hero.banner";

/** كبسولات التصنيف السريع أسفل بطاقة البحث. */
const PILLS: { href: string; ar: string; en: string }[] = [
  { href: "/search", ar: "الكل", en: "All" },
  { href: "/search?category=real-estate", ar: "عقارات", en: "Real estate" },
  { href: "/search?category=restaurants", ar: "مطاعم", en: "Restaurants" },
  { href: "/search?category=cars", ar: "سيارات", en: "Cars" },
  { href: "/search?category=services", ar: "خدمات", en: "Services" },
  { href: "/search?category=jobs", ar: "وظائف", en: "Jobs" },
];

export function HomeHero() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const slots = useMediaSlots();
  const image = slotUrl(slots.data, HERO_SLOT_KEY, "");
  const alt = slotAlt(slots.data, HERO_SLOT_KEY, ar ? "بنر كَحيل" : "Kaheel banner");

  return (
    <section
      data-kslot={HERO_SLOT_KEY}
      aria-label={ar ? "كل شي صار بتطبيق واحد" : "Everything in one app"}
      className="relative isolate overflow-hidden rounded-[24px]"
      style={{ backgroundImage: "linear-gradient(135deg, #083A31 0%, #0D5646 100%)" }}
    >
      {image ? (
        <>
          <img
            src={image}
            alt={alt}
            width={1920}
            height={600}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover"
          />
          <span aria-hidden className="absolute inset-0 bg-[#083A31]/72" />
        </>
      ) : null}

      {/* لمستان دائريتان ضبابيتان بلون نعناعي فاتح. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-20 size-64 rounded-full bg-[#DBEFE4] opacity-[0.14] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -start-10 size-72 rounded-full bg-[#DBEFE4] opacity-[0.10] blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-[760px] flex-col items-center gap-[var(--sp-3)] px-[var(--sp-4)] py-[var(--sp-7,40px)] text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DBEFE4]/18 px-3 py-1 text-desc font-bold text-primary-foreground ring-1 ring-inset ring-[#DBEFE4]/35">
          {ar ? "سوريا فخرنا 🇸🇾" : "Syria our pride 🇸🇾"}
        </span>

        <h1 className="text-2xl font-black leading-[1.25] text-primary-foreground sm:text-3xl">
          {ar ? "كل شي صار بتطبيق واحد" : "Everything in one app"}
        </h1>
        <p className="max-w-[52ch] text-desc leading-[1.7] text-primary-foreground/85">
          {ar
            ? "عقارات، سيارات، مطاعم وخدمات — ابحث، قارن، وتواصل مباشرة."
            : "Property, cars, food and services — search, compare and connect directly."}
        </p>

        {/* بطاقة بحث بيضاء عائمة. */}
        <div className="mt-1 w-full rounded-[20px] bg-card p-[var(--sp-3)] shadow-[0_18px_40px_-18px_rgb(8_58_49/0.55)]">
          <div className="flex flex-col gap-[var(--sp-2)] sm:flex-row sm:items-center">
            <Link
              to="/search"
              search={{}}
              className="flex min-w-0 flex-1 items-center gap-[var(--sp-2)] rounded-full bg-secondary/40 px-4 py-2.5 text-start text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <Search className="size-[18px] shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
              <span className="truncate text-desc font-semibold sm:text-sm">
                {ar
                  ? "ابحث عن عقار، سيارة، مطعم أو خدمة…"
                  : "Search property, car, restaurant or service…"}
              </span>
            </Link>

            <a
              href="/search?filters=1"
              className="flex shrink-0 items-center gap-[var(--sp-2)] rounded-full border border-border px-4 py-2.5 text-desc font-bold text-foreground outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/35 sm:text-sm"
            >
              <MapPin className="size-[18px] shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
              {ar ? "حدّد الموقع" : "Set location"}
            </a>

            <a
              href="/search"
              className="k-press inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {ar ? "بحث" : "Search"}
            </a>
          </div>
        </div>

        {/* كبسولات التصنيف السريع. */}
        <div className="-mx-[var(--sp-4)] mt-1 flex w-[calc(100%+2*var(--sp-4))] items-center justify-start gap-[var(--sp-2)] overflow-x-auto px-[var(--sp-4)] [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden">
          {PILLS.map((pill) => (
            <a
              key={pill.href}
              href={pill.href}
              className="k-press shrink-0 whitespace-nowrap rounded-full bg-[#DBEFE4]/18 px-4 py-1.5 text-desc font-bold text-primary-foreground ring-1 ring-inset ring-[#DBEFE4]/30 outline-none hover:bg-[#DBEFE4]/28 focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
            >
              {ar ? pill.ar : pill.en}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
