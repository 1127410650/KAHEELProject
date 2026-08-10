/**
 * بطاقات «جيب لي» في الرئيسية بنمط مرسول: بطاقة عريضة للخدمة الأولى ثم شبكة
 * بطاقتين في الصف لبقية الخدمات. الأسماء والأوصاف من `mkt_errand_services`
 * (تُفعَّل وتُطفأ من الإدارة)، والرسوم من فتحات وسائط `home.jeebli.*` فيمكن
 * استبدالها من مركز المظهر بلا تعديل كود.
 *
 * الاستقرار البصري: كل صورة لها أبعاد ونسبة أبعاد، والبطاقات بارتفاع ثابت،
 * فلا هزّة تخطيط عند وصول البيانات (قائمة احتياطية تُعرض قبل ذلك).
 */
import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

import { useI18n } from "@/i18n";
import { slotUrl, useMediaSlots } from "@/lib/mkt-media-slots";
import { serviceName, serviceTagline, useErrandServices } from "@/lib/mkt-errands";
import buyAnything from "@/assets/jeebli/buy-anything.jpg";
import fetchMe from "@/assets/jeebli/fetch-me.jpg";
import furnitureMoving from "@/assets/jeebli/furniture-moving.jpg";
import gasDelivery from "@/assets/jeebli/gas-delivery.jpg";
import sendAnything from "@/assets/jeebli/send-anything.jpg";

/** الرسم الافتراضي لكل خدمة، ويظل قابلاً للاستبدال من فتحة الوسائط. */
const ART: Record<string, string> = {
  "fetch-me": fetchMe,
  "send-anything": sendAnything,
  "buy-anything": buyAnything,
  "gas-delivery": gasDelivery,
  "furniture-moving": furnitureMoving,
};

/** يُعرض قبل وصول القائمة من القاعدة كي يبقى الارتفاع محجوزًا. */
const FALLBACK = [
  { slug: "fetch-me", ar: "جيب لي", en: "Fetch me", taglineAr: "اطلب أي شي من أي مكان ومنجيبولك" },
  { slug: "send-anything", ar: "أرسل أي شي", en: "Send anything", taglineAr: "استلام من مكان وتوصيله لمكان تاني" },
  { slug: "buy-anything", ar: "اطلب أي شي", en: "Buy anything", taglineAr: "الكابتن يشتري ويوصّل لعندك" },
  { slug: "gas-delivery", ar: "توصيل غاز", en: "Gas delivery", taglineAr: "جرة غاز لعند باب البيت" },
  { slug: "furniture-moving", ar: "نقل عفش", en: "Furniture moving", taglineAr: "نقل أثاث بسيارة مناسبة" },
];

type Card = { slug: string; title: string; tagline: string };

export function HomeJeebLi() {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const services = useErrandServices();
  const slots = useMediaSlots();

  const cards: Card[] = (services.data ?? []).length
    ? (services.data ?? []).map((service) => ({
        slug: service.slug,
        title: serviceName(service, ar),
        tagline: serviceTagline(service, ar) ?? "",
      }))
    : FALLBACK.map((item) => ({
        slug: item.slug,
        title: ar ? item.ar : item.en,
        tagline: ar ? item.taglineAr : "",
      }));

  const [lead, ...rest] = cards;
  if (!lead) return null;

  return (
    <section aria-labelledby="home-jeebli-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="home-jeebli-title" className="text-body font-black tracking-tight sm:text-lg">
          {ar ? "جيب لي" : "Jeeb Li"}
        </h2>
        <Link
          to="/errands"
          className="inline-flex min-h-11 items-center gap-1 text-desc font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          {ar ? "كل الخدمات" : "All services"}
          <ChevronLeft className="size-4 rtl:rotate-0 ltr:rotate-180" aria-hidden />
        </Link>
      </div>

      <div className="mt-3 grid gap-2">
        <JeebLiCard card={lead} slots={slots.data} wide />
        <div className="grid grid-cols-2 gap-2">
          {rest.map((card) => (
            <JeebLiCard key={card.slug} card={card} slots={slots.data} />
          ))}
        </div>
      </div>
    </section>
  );
}

function JeebLiCard({
  card,
  slots,
  wide = false,
}: {
  card: Card;
  slots: ReturnType<typeof useMediaSlots>["data"];
  wide?: boolean;
}) {
  const slotKey = `home.jeebli.${card.slug}.art`;
  const art = slotUrl(slots, slotKey, ART[card.slug] ?? ART["fetch-me"]!);

  return (
    <Link
      to="/errands"
      search={{ service: card.slug }}
      data-kslot={slotKey}
      className={`group relative flex min-w-0 items-center gap-2 overflow-hidden rounded-2xl border border-border bg-card px-3 text-start shadow-panel outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/45 ${
        wide ? "min-h-[104px] py-3" : "min-h-[92px] py-2.5"
      }`}
    >
      <span className="relative z-[1] flex min-w-0 flex-1 flex-col gap-1">
        <span className={`font-black leading-tight text-foreground ${wide ? "text-body" : "text-desc"}`}>
          {card.title}
        </span>
        {card.tagline ? (
          <span className="line-clamp-2 text-desc font-medium leading-snug text-muted-foreground">
            {card.tagline}
          </span>
        ) : null}
      </span>
      <img
        src={art}
        alt=""
        width={768}
        height={768}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ aspectRatio: "1 / 1" }}
        className={`shrink-0 rounded-xl object-cover transition duration-300 group-hover:scale-105 ${
          wide ? "size-[80px]" : "size-[64px]"
        }`}
      />
    </Link>
  );
}
